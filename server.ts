import express from 'express';
import type { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { INITIAL_RATES, INITIAL_SETTINGS, INITIAL_ORDERS } from './src/data/initialData.ts';
import type {
  FarmSettings,
  NattuKozhiRateSettings,
  NotificationItem,
  OrderRecord,
  OrderStatus,
} from './src/types/eggFarm.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_FILE_PATH = path.join(__dirname, 'farm_server_db.json');

// Owner credentials strictly verified on the server only
const OWNER_USERNAME = 'kozhifarmrajadharsan@24052026';
const OWNER_PASSWORD = '15042006@24052026';

interface ServerDatabase {
  rates: NattuKozhiRateSettings;
  settings: FarmSettings;
  orders: OrderRecord[];
  notifications: NotificationItem[];
  ownerTokens: string[];
  updatedAt: string;
}

// Deterministic HMAC token so owner session remains valid across server restarts
const STATIC_OWNER_TOKEN = crypto
  .createHmac('sha256', `${OWNER_USERNAME}:${OWNER_PASSWORD}`)
  .update('rehoboth_owner_server_session_v1')
  .digest('hex');

function validateServerUtr(rawUtr: string): { valid: boolean; cleanUtr: string; error?: string } {
  const cleanUtr = String(rawUtr || '').trim().replace(/\D/g, '');

  if (!/^\d{12}$/.test(cleanUtr)) {
    return {
      valid: false,
      cleanUtr,
      error: 'தவறான UTR எண்! ஜிபே ரசீதில் உள்ள சரியான 12-இலக்க எண்ணை மட்டும் உள்ளிடவும்.',
    };
  }

  return { valid: true, cleanUtr };
}

function loadDatabase(): ServerDatabase {
  try {
    if (fs.existsSync(DB_FILE_PATH)) {
      const raw = fs.readFileSync(DB_FILE_PATH, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<ServerDatabase>;
      const loadedOrders = Array.isArray(parsed.orders)
        ? parsed.orders.map((o) =>
            o.status === 'pending_payment' ? { ...o, status: 'confirmed_packing' as OrderStatus } : o
          )
        : INITIAL_ORDERS;
      return {
        rates: { ...INITIAL_RATES, ...(parsed.rates || {}) },
        settings: {
          ...INITIAL_SETTINGS,
          ...(parsed.settings || {}),
          ownerPhone: '',
          farmName:
            parsed.settings?.farmName && parsed.settings.farmName !== 'Arasan Nattu Kozhi Pannai'
              ? parsed.settings.farmName
              : INITIAL_SETTINGS.farmName,
          tamilFarmName:
            parsed.settings?.tamilFarmName && parsed.settings.tamilFarmName !== 'அரசன் நாட்டுக்கோழி பண்ணை'
              ? parsed.settings.tamilFarmName
              : INITIAL_SETTINGS.tamilFarmName,
        },
        orders: loadedOrders,
        notifications: Array.isArray(parsed.notifications)
          ? parsed.notifications
          : [
              {
                id: 'notif_init_1',
                orderId: 'NK-1024',
                customerName: 'Senthil Kumar',
                totalAmount: 350,
                totalEggs: 30,
                timestamp: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
                read: false,
              },
            ],
        ownerTokens: Array.isArray(parsed.ownerTokens)
          ? Array.from(new Set([...parsed.ownerTokens, STATIC_OWNER_TOKEN]))
          : [STATIC_OWNER_TOKEN],
        updatedAt: parsed.updatedAt || new Date().toISOString(),
      };
    }
  } catch (err) {
    console.error('Error reading farm_server_db.json, initializing fresh DB:', err);
  }

  const initialDb: ServerDatabase = {
    rates: { ...INITIAL_RATES },
    settings: { ...INITIAL_SETTINGS, ownerPhone: '' },
    orders: [...INITIAL_ORDERS],
    notifications: [
      {
        id: 'notif_init_1',
        orderId: 'NK-1024',
        customerName: 'Senthil Kumar',
        totalAmount: 350,
        totalEggs: 30,
        timestamp: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
        read: false,
      },
    ],
    ownerTokens: [],
    updatedAt: new Date().toISOString(),
  };
  saveDatabase(initialDb);
  return initialDb;
}

function saveDatabase(dbData: ServerDatabase): void {
  try {
    dbData.settings.ownerPhone = '';
    dbData.updatedAt = new Date().toISOString();
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(dbData, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to persist farm_server_db.json:', err);
  }
}

let dbState: ServerDatabase = loadDatabase();

// Connected SSE clients for instant real-time cross-device updates
const sseClients = new Set<Response>();

function broadcastStateUpdate(): void {
  const publicPayload = JSON.stringify({
    type: 'state_update',
    rates: dbState.rates,
    settings: { ...dbState.settings, ownerPhone: '' },
    updatedAt: dbState.updatedAt,
  });

  for (const client of sseClients) {
    try {
      client.write(`data: ${publicPayload}\n\n`);
    } catch {
      sseClients.delete(client);
    }
  }
}

function extractOwnerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  return null;
}

function isValidOwnerRequest(req: Request): boolean {
  const token = extractOwnerToken(req);
  if (!token) return false;
  return token === STATIC_OWNER_TOKEN || dbState.ownerTokens.includes(token);
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '1mb' }));

  // Prevent caching on API routes so all devices always get fresh live rates
  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
  });

  // 1. Real-Time Server-Sent Events (SSE) stream for all devices
  app.get('/api/events', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const initialPayload = JSON.stringify({
      type: 'state_update',
      rates: dbState.rates,
      settings: { ...dbState.settings, ownerPhone: '' },
      updatedAt: dbState.updatedAt,
    });
    res.write(`data: ${initialPayload}\n\n`);

    sseClients.add(res);

    const keepAlive = setInterval(() => {
      try {
        res.write(': keep-alive\n\n');
      } catch {
        clearInterval(keepAlive);
        sseClients.delete(res);
      }
    }, 20000);

    req.on('close', () => {
      clearInterval(keepAlive);
      sseClients.delete(res);
    });
  });

  // 2. Get current storefront state (rates & settings for all devices; orders/notifications if owner token is valid)
  app.get('/api/state', (req: Request, res: Response) => {
    const isOwner = isValidOwnerRequest(req);
    res.json({
      rates: dbState.rates,
      settings: { ...dbState.settings, ownerPhone: '' },
      updatedAt: dbState.updatedAt,
      isOwnerAuthenticated: isOwner,
      orders: isOwner ? dbState.orders : undefined,
      notifications: isOwner ? dbState.notifications : undefined,
    });
  });

  // 3. Track a specific order by Order ID or Customer Mobile Number (Public Customer Tracker)
  app.get('/api/orders/track', (req: Request, res: Response) => {
    const query = String(req.query.q || '').trim().toLowerCase();
    if (!query) {
      res.status(400).json({ error: 'Search query is required' });
      return;
    }

    const cleanDigits = query.replace(/\D/g, '');
    const found = dbState.orders.find(
      (o) =>
        o.id.toLowerCase() === query ||
        (cleanDigits.length >= 6 && o.customer.phone.replace(/\D/g, '').includes(cleanDigits))
    );

    if (!found) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    res.json({ order: found });
  });

  // 4. Customer submits order with 12-digit UTR -> Immediately Confirmed
  app.post('/api/orders', (req: Request, res: Response) => {
    const incomingOrder = req.body?.order as OrderRecord | undefined;
    if (
      !incomingOrder ||
      !incomingOrder.id ||
      !incomingOrder.customer?.fullName ||
      !incomingOrder.customer?.phone ||
      !incomingOrder.upiReferenceId
    ) {
      res.status(400).json({ error: 'Invalid order details or missing UPI UTR reference' });
      return;
    }

    // 12-digit UTR validation
    const utrCheck = validateServerUtr(incomingOrder.upiReferenceId);
    if (!utrCheck.valid) {
      res.status(400).json({ error: utrCheck.error });
      return;
    }

    // Immediately confirm order upon valid 12-digit UTR submission
    const newOrder: OrderRecord = {
      ...incomingOrder,
      upiReferenceId: utrCheck.cleanUtr,
      createdAt: new Date().toISOString(),
      status: 'confirmed_packing',
      estimatedDelivery: 'Confirmed & Packing Fresh Country Eggs',
    };

    dbState.orders = [newOrder, ...dbState.orders];

    const newNotif: NotificationItem = {
      id: `notif_${Date.now()}`,
      orderId: newOrder.id,
      customerName: newOrder.customer.fullName,
      totalAmount: newOrder.totalAmount,
      totalEggs: newOrder.totalEggs,
      timestamp: newOrder.createdAt,
      read: false,
    };
    dbState.notifications = [newNotif, ...dbState.notifications];

    saveDatabase(dbState);
    broadcastStateUpdate();

    res.status(201).json({ order: newOrder });
  });

  // 5. Owner Server Login (Strictly verifies credentials on server)
  app.post('/api/admin/login', (req: Request, res: Response) => {
    const username = String(req.body?.username || '').trim();
    const password = String(req.body?.password || '').trim();

    if (username === OWNER_USERNAME && password === OWNER_PASSWORD) {
      const token = STATIC_OWNER_TOKEN;
      if (!dbState.ownerTokens.includes(token)) {
        dbState.ownerTokens = [...dbState.ownerTokens.slice(-19), token];
      }
      saveDatabase(dbState);

      res.json({
        success: true,
        token,
        rates: dbState.rates,
        settings: dbState.settings,
        orders: dbState.orders,
        notifications: dbState.notifications,
      });
      return;
    }

    res.status(401).json({
      success: false,
      error: 'Invalid owner credentials. Server access denied.',
    });
  });

  // 6. Owner Logout (Clears client session)
  app.post('/api/admin/logout', (_req: Request, res: Response) => {
    res.json({ success: true });
  });

  // 7. Owner Updates Daily Egg Rates (Broadcasts to ALL devices immediately)
  app.put('/api/admin/rates', (req: Request, res: Response) => {
    if (!isValidOwnerRequest(req)) {
      res.status(403).json({ error: 'Unauthorized. Owner server token required.' });
      return;
    }

    const incomingRates = req.body?.rates as Partial<NattuKozhiRateSettings> | undefined;
    if (!incomingRates) {
      res.status(400).json({ error: 'Missing rates payload' });
      return;
    }

    const numOrFallback = (val: unknown, fallback: number): number => {
      const parsed = Number(val);
      return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
    };

    dbState.rates = {
      pricePerEgg: numOrFallback(incomingRates.pricePerEgg, dbState.rates.pricePerEgg),
      pack12Price: numOrFallback(incomingRates.pack12Price, dbState.rates.pack12Price),
      tray30Price: numOrFallback(incomingRates.tray30Price, dbState.rates.tray30Price),
      doubleTray60Price: numOrFallback(incomingRates.doubleTray60Price, dbState.rates.doubleTray60Price),
      bulk100Price: numOrFallback(incomingRates.bulk100Price, dbState.rates.bulk100Price),
      inStock: typeof incomingRates.inStock === 'boolean' ? incomingRates.inStock : dbState.rates.inStock,
      dailyHarvestCount: numOrFallback(incomingRates.dailyHarvestCount, dbState.rates.dailyHarvestCount),
      harvestStamp:
        incomingRates.harvestStamp !== undefined
          ? String(incomingRates.harvestStamp).trim() || dbState.rates.harvestStamp
          : dbState.rates.harvestStamp,
    };

    saveDatabase(dbState);
    broadcastStateUpdate();

    res.json({
      success: true,
      rates: dbState.rates,
      updatedAt: dbState.updatedAt,
    });
  });

  // 8. Owner Updates Farm & GPay QR Settings (Broadcasts to ALL devices immediately)
  app.put('/api/admin/settings', (req: Request, res: Response) => {
    if (!isValidOwnerRequest(req)) {
      res.status(403).json({ error: 'Unauthorized. Owner server token required.' });
      return;
    }

    const incomingSettings = req.body?.settings as Partial<FarmSettings> | undefined;
    if (!incomingSettings) {
      res.status(400).json({ error: 'Missing settings payload' });
      return;
    }

    dbState.settings = {
      ...dbState.settings,
      ...incomingSettings,
      deliveryFee:
        typeof incomingSettings.deliveryFee === 'number'
          ? incomingSettings.deliveryFee
          : dbState.settings.deliveryFee,
      freeDeliveryThreshold:
        typeof incomingSettings.freeDeliveryThreshold === 'number'
          ? incomingSettings.freeDeliveryThreshold
          : dbState.settings.freeDeliveryThreshold,
    };

    saveDatabase(dbState);
    broadcastStateUpdate();

    res.json({
      success: true,
      settings: dbState.settings,
      updatedAt: dbState.updatedAt,
    });
  });

  // 9. Owner Updates Order Status / Assigns Delivery Rider
  app.put('/api/admin/orders/:orderId/status', (req: Request, res: Response) => {
    if (!isValidOwnerRequest(req)) {
      res.status(403).json({ error: 'Unauthorized. Owner server token required.' });
      return;
    }

    const { orderId } = req.params;
    const status = req.body?.status as OrderStatus | undefined;
    const deliveryDetails = req.body?.deliveryDetails as { name: string; phone: string } | undefined;

    if (!status) {
      res.status(400).json({ error: 'Status is required' });
      return;
    }

    let updatedOrder: OrderRecord | null = null;
    dbState.orders = dbState.orders.map((o) => {
      if (o.id === orderId) {
        updatedOrder = {
          ...o,
          status,
          ...(deliveryDetails ? { assignedDeliveryBoy: deliveryDetails } : {}),
          estimatedDelivery:
            status === 'delivered'
              ? 'Delivered Fresh to Customer'
              : status === 'out_for_delivery'
              ? 'Out for delivery with rider'
              : o.estimatedDelivery,
        };
        return updatedOrder;
      }
      return o;
    });

    saveDatabase(dbState);
    broadcastStateUpdate();

    res.json({
      success: true,
      order: updatedOrder,
      orders: dbState.orders,
    });
  });

  // 10. Owner Marks All Notifications Read
  app.put('/api/admin/notifications/read', (req: Request, res: Response) => {
    if (!isValidOwnerRequest(req)) {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }

    dbState.notifications = dbState.notifications.map((n) => ({ ...n, read: true }));
    saveDatabase(dbState);

    res.json({
      success: true,
      notifications: dbState.notifications,
    });
  });

  // Mount Vite in dev or static dist in production
  const distPath = path.join(__dirname, 'dist');
  const hasBuiltDist = fs.existsSync(path.join(distPath, 'index.html'));
  const isProd =
    hasBuiltDist &&
    (process.env.NODE_ENV === 'production' || process.env.npm_lifecycle_event === 'start');

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distPath));
    app.use((_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Rehoboth Muttai Pannai server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
