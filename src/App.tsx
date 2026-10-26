/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  FarmSettings,
  NattuKozhiRateSettings,
  NotificationItem,
  OrderRecord,
  OrderStatus,
} from './types/eggFarm';
import { INITIAL_RATES, INITIAL_SETTINGS, INITIAL_ORDERS } from './data/initialData';
import { playNewOrderChime } from './utils/audioAlert';
import { MeeshoStyleCheckout } from './components/MeeshoStyleCheckout';
import { OwnerServerApp } from './components/OwnerServerApp';
import { NotificationCenter } from './components/NotificationCenter';
import { syncStorefrontToFirestore, syncOrderToFirestore } from './firebase';
import { Sparkles } from 'lucide-react';

const OWNER_TOKEN_STORAGE_KEY = 'rehoboth_owner_server_token_v1';
const LIVE_STOREFRONT_CACHE_KEY = 'rehoboth_live_storefront_cache_v2';

type ActiveAppMode = 'customer' | 'owner';

interface CachedStorefrontState {
  rates: NattuKozhiRateSettings;
  settings: FarmSettings;
  version: number;
}

function loadCachedStorefront(): CachedStorefrontState | null {
  try {
    const raw = localStorage.getItem(LIVE_STOREFRONT_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CachedStorefrontState>;
    if (
      parsed &&
      typeof parsed.version === 'number' &&
      parsed.version >= 10 &&
      parsed.rates &&
      parsed.settings
    ) {
      return {
        rates: { ...INITIAL_RATES, ...parsed.rates },
        settings: { ...INITIAL_SETTINGS, ...parsed.settings, ownerPhone: '' },
        version: parsed.version,
      };
    }
  } catch {
    // ignore storage errors
  }
  return null;
}

function saveCachedStorefront(
  rates: NattuKozhiRateSettings,
  settings: FarmSettings,
  version: number
): void {
  try {
    localStorage.setItem(
      LIVE_STOREFRONT_CACHE_KEY,
      JSON.stringify({
        rates,
        settings: { ...settings, ownerPhone: '' },
        version,
      })
    );
  } catch {
    // ignore storage errors
  }
}

function getPeerOrigin(): string | null {
  if (typeof window === 'undefined') return null;
  const origin = window.location.origin;
  if (origin.includes('ais-dev-')) {
    return origin.replace('ais-dev-', 'ais-pre-');
  }
  if (origin.includes('ais-pre-')) {
    return origin.replace('ais-pre-', 'ais-dev-');
  }
  return null;
}

function mergeOrdersById(primary: OrderRecord[], secondary: OrderRecord[]): OrderRecord[] {
  const map = new Map<string, OrderRecord>();
  for (const o of secondary) {
    if (o && o.id) map.set(o.id, o);
  }
  for (const o of primary) {
    if (o && o.id) map.set(o.id, o);
  }
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

function detectInitialAppMode(): ActiveAppMode {
  if (typeof window === 'undefined') return 'customer';
  const pathname = window.location.pathname.toLowerCase();
  const hash = window.location.hash.toLowerCase();
  const params = new URLSearchParams(window.location.search);

  if (
    pathname.startsWith('/owner') ||
    hash === '#owner' ||
    hash === '#owner-app' ||
    hash === '#owner-server-control' ||
    params.get('app') === 'owner' ||
    params.get('owner') === '1' ||
    params.get('owner') === 'true'
  ) {
    return 'owner';
  }
  return 'customer';
}

export default function App() {
  const initialCache = loadCachedStorefront();

  const [rates, setRates] = useState<NattuKozhiRateSettings>(
    initialCache ? initialCache.rates : INITIAL_RATES
  );
  const [settings, setSettings] = useState<FarmSettings>(
    initialCache ? initialCache.settings : INITIAL_SETTINGS
  );
  const [orders, setOrders] = useState<OrderRecord[]>(INITIAL_ORDERS);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const [ownerToken, setOwnerToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem(OWNER_TOKEN_STORAGE_KEY);
    } catch {
      return null;
    }
  });
  const [isOwnerAuthenticated, setIsOwnerAuthenticated] = useState<boolean>(false);

  // Completely separate app routing:
  // '/' -> Pure Customer Egg Ordering App (Zero owner UI on screen)
  // '/owner-server-control' (or '/owner-app') -> Dedicated Standalone Owner Server Control App
  const [appMode, setAppMode] = useState<ActiveAppMode>(detectInitialAppMode);

  const [language, setLanguage] = useState<'en' | 'ta'>('ta');
  const [isNotificationsOpen, setIsNotificationsOpen] = useState<boolean>(false);
  const [selectedOrderIdForTracking, setSelectedOrderIdForTracking] = useState<string | undefined>(
    undefined
  );
  const [recentToast, setRecentToast] = useState<{ message: string; sub?: string } | null>(null);

  const prevOrderCountRef = useRef<number | null>(null);
  const lastOwnerMutationAtRef = useRef<number>(0);
  const serverVersionRef = useRef<number>(initialCache ? initialCache.version : 10);

  useEffect(() => {
    const syncModeFromUrl = () => {
      setAppMode(detectInitialAppMode());
    };
    window.addEventListener('popstate', syncModeFromUrl);
    window.addEventListener('hashchange', syncModeFromUrl);

    return () => {
      window.removeEventListener('popstate', syncModeFromUrl);
      window.removeEventListener('hashchange', syncModeFromUrl);
    };
  }, []);

  // Fetch central server state from BOTH local origin & peer origin (ais-dev <-> ais-pre)
  const fetchServerState = useCallback(
    async (tokenOverride?: string | null) => {
      const pollStartedAt = Date.now();
      const activeToken = tokenOverride !== undefined ? tokenOverride : ownerToken;
      const peerOrigin = getPeerOrigin();

      const headers: Record<string, string> = {};
      if (activeToken) {
        headers['Authorization'] = `Bearer ${activeToken}`;
      }

      const fetchFromOrigin = async (baseUrl: string) => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 2800);
        try {
          const res = await fetch(`${baseUrl}/api/state`, {
            headers,
            cache: 'no-store',
            signal: controller.signal,
          });
          if (!res.ok) return null;
          return await res.json();
        } catch {
          return null;
        } finally {
          clearTimeout(timer);
        }
      };

      try {
        const [localData, peerData] = await Promise.all([
          fetchFromOrigin(''),
          peerOrigin ? fetchFromOrigin(peerOrigin) : Promise.resolve(null),
        ]);

        if (!localData && !peerData) return;

        const localVersion = typeof localData?.version === 'number' ? localData.version : 0;
        const peerVersion = typeof peerData?.version === 'number' ? peerData.version : 0;

        // Pick whichever server has the newest monotonic version
        const newestData =
          peerData && peerVersion > localVersion ? peerData : localData || peerData;
        const newestVersion = Math.max(localVersion, peerVersion);

        // If one origin is behind the other and we have an owner token, heal the lagging origin
        if (activeToken && localData && peerData && localVersion !== peerVersion) {
          const laggingBaseUrl = localVersion < peerVersion ? '' : peerOrigin!;
          const winningSource = localVersion < peerVersion ? peerData : localData;
          void fetch(`${laggingBaseUrl}/api/admin/sync-peer`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${activeToken}`,
            },
            body: JSON.stringify({
              rates: winningSource.rates,
              settings: winningSource.settings,
              orders: winningSource.orders,
              notifications: winningSource.notifications,
              version: newestVersion,
            }),
          }).catch(() => {});
        }

        // Ignore stale poll responses if the owner mutated rates/settings after this poll started
        const recentlyMutated =
          pollStartedAt <= lastOwnerMutationAtRef.current ||
          Date.now() - lastOwnerMutationAtRef.current < 4000;

        if (!recentlyMutated && newestData) {
          if (newestVersion >= serverVersionRef.current) {
            serverVersionRef.current = newestVersion;
            if (newestData.rates) {
              setRates((prev) =>
                JSON.stringify(prev) === JSON.stringify(newestData.rates)
                  ? prev
                  : newestData.rates
              );
            }
            if (newestData.settings) {
              setSettings((prev) =>
                JSON.stringify(prev) === JSON.stringify(newestData.settings)
                  ? prev
                  : newestData.settings
              );
            }
            if (newestData.rates && newestData.settings) {
              saveCachedStorefront(newestData.rates, newestData.settings, newestVersion);
            }
          }
        }

        const authed = Boolean(
          localData?.isOwnerAuthenticated || peerData?.isOwnerAuthenticated
        );
        setIsOwnerAuthenticated(authed);

        if (!authed && activeToken && localData && !localData.isOwnerAuthenticated) {
          localStorage.removeItem(OWNER_TOKEN_STORAGE_KEY);
          setOwnerToken(null);
        }

        const combinedOrders = mergeOrdersById(
          Array.isArray(newestData?.orders) ? newestData.orders : [],
          Array.isArray(localData?.orders)
            ? localData.orders
            : Array.isArray(peerData?.orders)
            ? peerData.orders
            : []
        );

        if (authed && combinedOrders.length > 0) {
          if (
            prevOrderCountRef.current !== null &&
            combinedOrders.length > prevOrderCountRef.current
          ) {
            const latestOrder = combinedOrders[0];
            playNewOrderChime();
            setRecentToast({
              message: `🐓 New Order Received: ${latestOrder.id}`,
              sub: `${latestOrder.customer.fullName} · ₹${latestOrder.totalAmount} (${latestOrder.totalEggs} Country Eggs)`,
            });
            setTimeout(() => setRecentToast(null), 6000);
          }
          prevOrderCountRef.current = combinedOrders.length;
          setOrders((prev) =>
            JSON.stringify(prev) === JSON.stringify(combinedOrders) ? prev : combinedOrders
          );
        }

        if (authed && Array.isArray(newestData?.notifications)) {
          setNotifications((prev) =>
            JSON.stringify(prev) === JSON.stringify(newestData.notifications)
              ? prev
              : newestData.notifications
          );
        }
      } catch {
        // Transient network interruption; next poll/SSE will automatically resync
      }
    },
    [ownerToken]
  );

  // Initial fetch + periodic poll every 3 seconds so Customer App & Owner Server App stay 100% linked across dev & published links
  useEffect(() => {
    fetchServerState();
    const interval = setInterval(() => {
      fetchServerState();
    }, 3000);
    return () => clearInterval(interval);
  }, [fetchServerState]);

  // Real-time Server-Sent Events (SSE) subscription to BOTH current & peer origins for instant updates
  useEffect(() => {
    const sources: EventSource[] = [];
    const origins = [''];
    const peerOrigin = getPeerOrigin();
    if (peerOrigin) origins.push(peerOrigin);

    const handleSseMessage = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'state_update') {
          const incomingVer = typeof payload.version === 'number' ? payload.version : 0;
          if (incomingVer >= serverVersionRef.current) {
            serverVersionRef.current = incomingVer;
            if (payload.rates) {
              setRates((prev) =>
                JSON.stringify(prev) === JSON.stringify(payload.rates) ? prev : payload.rates
              );
            }
            if (payload.settings) {
              setSettings((prev) =>
                JSON.stringify(prev) === JSON.stringify(payload.settings)
                  ? prev
                  : payload.settings
              );
            }
            if (payload.rates && payload.settings) {
              saveCachedStorefront(payload.rates, payload.settings, incomingVer);
            }
          }
          if (ownerToken) {
            fetchServerState(ownerToken);
          }
        }
      } catch {
        // ignore malformed SSE packet
      }
    };

    for (const baseUrl of origins) {
      try {
        const es = new EventSource(`${baseUrl}/api/events`);
        es.onmessage = handleSseMessage;
        sources.push(es);
      } catch {
        // Fallback polling is already active
      }
    }

    return () => {
      for (const es of sources) {
        es.close();
      }
    };
  }, [ownerToken, fetchServerState]);

  const unreadNotificationsCount = notifications.filter((n) => !n.read).length;

  // Owner Server Login Handler (Logs into both local and peer origin simultaneously)
  const handleOwnerLogin = async (
    username: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    const peerOrigin = getPeerOrigin();
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (peerOrigin) {
        void fetch(`${peerOrigin}/api/admin/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password }),
        }).catch(() => {});
      }

      const data = await res.json();
      if (res.ok && data.success && data.token) {
        localStorage.setItem(OWNER_TOKEN_STORAGE_KEY, data.token);
        setOwnerToken(data.token);
        setIsOwnerAuthenticated(true);
        if (typeof data.version === 'number') {
          serverVersionRef.current = Math.max(serverVersionRef.current, data.version);
        }
        if (data.rates) setRates(data.rates);
        if (data.settings) setSettings(data.settings);
        if (Array.isArray(data.orders)) {
          prevOrderCountRef.current = data.orders.length;
          setOrders(data.orders);
        }
        if (Array.isArray(data.notifications)) {
          setNotifications(data.notifications);
        }
        return { success: true };
      }
      return { success: false, error: data.error || 'Invalid credentials' };
    } catch {
      return { success: false, error: 'Unable to reach server' };
    }
  };

  // Owner Logout Handler
  const handleOwnerLogout = async () => {
    try {
      if (ownerToken) {
        await fetch('/api/admin/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${ownerToken}` },
        });
      }
    } catch {
      // ignore network error on logout
    } finally {
      localStorage.removeItem(OWNER_TOKEN_STORAGE_KEY);
      setOwnerToken(null);
      setIsOwnerAuthenticated(false);
    }
  };

  // New Order Placed Handler (Submits to BOTH local and published/peer origin)
  const handleOrderPlaced = async (
    newOrder: OrderRecord
  ): Promise<{ ok: boolean; error?: string; order?: OrderRecord }> => {
    const peerOrigin = getPeerOrigin();
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: newOrder }),
      });
      const data = await res.json();
      if (!res.ok) {
        return {
          ok: false,
          error: data.error || 'UTR verification failed on server',
        };
      }
      const createdOrder: OrderRecord = data.order || newOrder;
      if (typeof data.version === 'number') {
        serverVersionRef.current = Math.max(serverVersionRef.current, data.version);
      }

      if (peerOrigin) {
        void fetch(`${peerOrigin}/api/orders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order: createdOrder }),
        }).catch(() => {});
      }

      setOrders((prev) => mergeOrdersById([createdOrder], prev));
      setSelectedOrderIdForTracking(createdOrder.id);
      await syncOrderToFirestore(createdOrder).catch(() => {});
      return { ok: true, order: createdOrder };
    } catch {
      return {
        ok: false,
        error: 'சர்வரை தொடர்பு கொள்ள முடியவில்லை. மீண்டும் முயற்சிக்கவும்.',
      };
    }
  };

  // Track an order on the server by Order ID or Phone Number (Checks both local & peer origin)
  const handleTrackOrderOnServer = useCallback(async (query: string): Promise<OrderRecord | null> => {
    const peerOrigin = getPeerOrigin();
    try {
      const res = await fetch(`/api/orders/track?q=${encodeURIComponent(query)}`, {
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json();
        if (data.order) return data.order;
      }
    } catch {
      // try peer origin next
    }

    if (peerOrigin) {
      try {
        const peerRes = await fetch(
          `${peerOrigin}/api/orders/track?q=${encodeURIComponent(query)}`,
          { cache: 'no-store' }
        );
        if (peerRes.ok) {
          const peerData = await peerRes.json();
          if (peerData.order) return peerData.order;
        }
      } catch {
        // ignore
      }
    }
    return null;
  }, []);

  // Owner Updates Rates on Server (Pushes simultaneously to BOTH Dev & Published External Link servers)
  const handleUpdateRates = async (newRates: NattuKozhiRateSettings): Promise<boolean> => {
    if (!ownerToken) return false;
    lastOwnerMutationAtRef.current = Date.now();
    const nextVersion = serverVersionRef.current + 1;
    serverVersionRef.current = nextVersion;
    setRates(newRates);
    saveCachedStorefront(newRates, settings, nextVersion);

    const peerOrigin = getPeerOrigin();
    const bodyPayload = JSON.stringify({ rates: newRates, version: nextVersion });
    const reqHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ownerToken}`,
    };

    try {
      const [localRes, peerRes] = await Promise.allSettled([
        fetch('/api/admin/rates', {
          method: 'PUT',
          headers: reqHeaders,
          body: bodyPayload,
        }),
        peerOrigin
          ? fetch(`${peerOrigin}/api/admin/rates`, {
              method: 'PUT',
              headers: reqHeaders,
              body: bodyPayload,
            })
          : Promise.reject(new Error('no peer')),
      ]);

      const localOk = localRes.status === 'fulfilled' && localRes.value.ok;
      const peerOk = peerRes.status === 'fulfilled' && peerRes.value.ok;

      if (!localOk && !peerOk) return false;

      if (localOk) {
        const data = await localRes.value.json();
        lastOwnerMutationAtRef.current = Date.now();
        if (typeof data.version === 'number') {
          serverVersionRef.current = Math.max(serverVersionRef.current, data.version);
        }
        if (data.rates) {
          setRates(data.rates);
          saveCachedStorefront(data.rates, settings, serverVersionRef.current);
          await syncStorefrontToFirestore(data.rates, settings).catch(() => {});
        }
      }
      return true;
    } catch {
      return false;
    }
  };

  // Owner Updates Order Status on Server (Pushes to BOTH Dev & Published servers)
  const handleUpdateOrderStatus = async (
    orderId: string,
    status: OrderStatus,
    deliveryDetails?: { name: string; phone: string }
  ) => {
    if (!ownerToken) return;
    lastOwnerMutationAtRef.current = Date.now();
    const peerOrigin = getPeerOrigin();
    const reqHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ownerToken}`,
    };
    const bodyPayload = JSON.stringify({ status, deliveryDetails });

    try {
      const [localRes] = await Promise.allSettled([
        fetch(`/api/admin/orders/${encodeURIComponent(orderId)}/status`, {
          method: 'PUT',
          headers: reqHeaders,
          body: bodyPayload,
        }),
        peerOrigin
          ? fetch(`${peerOrigin}/api/admin/orders/${encodeURIComponent(orderId)}/status`, {
              method: 'PUT',
              headers: reqHeaders,
              body: bodyPayload,
            })
          : Promise.resolve(null),
      ]);

      if (localRes.status === 'fulfilled' && localRes.value.ok) {
        const data = await localRes.value.json();
        if (typeof data.version === 'number') {
          serverVersionRef.current = Math.max(serverVersionRef.current, data.version);
        }
        if (Array.isArray(data.orders)) {
          setOrders(data.orders);
        }
        if (data.order) {
          await syncOrderToFirestore(data.order).catch(() => {});
        }
      }
    } catch {
      // Will resync on next poll
    }
  };

  // Owner Updates Settings on Server (Pushes simultaneously to BOTH Dev & Published External Link servers)
  const handleUpdateSettings = async (newSettings: FarmSettings): Promise<boolean> => {
    if (!ownerToken) return false;
    lastOwnerMutationAtRef.current = Date.now();
    const nextVersion = serverVersionRef.current + 1;
    serverVersionRef.current = nextVersion;
    setSettings(newSettings);
    saveCachedStorefront(rates, newSettings, nextVersion);

    const peerOrigin = getPeerOrigin();
    const bodyPayload = JSON.stringify({ settings: newSettings, version: nextVersion });
    const reqHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ownerToken}`,
    };

    try {
      const [localRes, peerRes] = await Promise.allSettled([
        fetch('/api/admin/settings', {
          method: 'PUT',
          headers: reqHeaders,
          body: bodyPayload,
        }),
        peerOrigin
          ? fetch(`${peerOrigin}/api/admin/settings`, {
              method: 'PUT',
              headers: reqHeaders,
              body: bodyPayload,
            })
          : Promise.reject(new Error('no peer')),
      ]);

      const localOk = localRes.status === 'fulfilled' && localRes.value.ok;
      const peerOk = peerRes.status === 'fulfilled' && peerRes.value.ok;

      if (!localOk && !peerOk) return false;

      if (localOk) {
        const data = await localRes.value.json();
        lastOwnerMutationAtRef.current = Date.now();
        if (typeof data.version === 'number') {
          serverVersionRef.current = Math.max(serverVersionRef.current, data.version);
        }
        if (data.settings) {
          setSettings(data.settings);
          saveCachedStorefront(rates, data.settings, serverVersionRef.current);
          await syncStorefrontToFirestore(rates, data.settings).catch(() => {});
        }
      }
      return true;
    } catch {
      return false;
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    if (!ownerToken) return;
    const peerOrigin = getPeerOrigin();
    try {
      await Promise.allSettled([
        fetch('/api/admin/notifications/read', {
          method: 'PUT',
          headers: { Authorization: `Bearer ${ownerToken}` },
        }),
        peerOrigin
          ? fetch(`${peerOrigin}/api/admin/notifications/read`, {
              method: 'PUT',
              headers: { Authorization: `Bearer ${ownerToken}` },
            })
          : Promise.resolve(null),
      ]);
    } catch {
      // ignore
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#1c1917] flex items-center justify-center p-0 sm:p-4 overflow-hidden relative font-sans">
      {/* Background ambient farm lighting */}
      <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-amber-900/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] bg-orange-950/25 rounded-full blur-3xl pointer-events-none" />

      {/* Toast Alert (Only shown inside the Separate Owner Server App on new order) */}
      {appMode === 'owner' && recentToast && (
        <div className="fixed top-4 right-4 z-50 bg-stone-900 text-white border border-amber-600/50 rounded-2xl px-5 py-3 shadow-2xl max-w-sm flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
          <div className="p-1.5 bg-amber-600 rounded-xl text-white shrink-0 mt-0.5">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold">{recentToast.message}</div>
            {recentToast.sub && (
              <div className="text-[11px] text-stone-300 mt-0.5">{recentToast.sub}</div>
            )}
          </div>
        </div>
      )}

      {/* FIXED 16:9 WIDESCREEN CONTAINER */}
      <div className="w-full h-screen sm:h-auto sm:aspect-[16/9] sm:max-h-[92vh] sm:max-w-6xl bg-[#faf8f5] shadow-2xl sm:rounded-3xl border sm:border-stone-700/60 flex flex-col overflow-hidden relative">
        {appMode === 'owner' ? (
          /* SEPARATE STANDALONE OWNER SERVER CONTROL APP (/owner-server-control) */
          <OwnerServerApp
            isAuthenticated={isOwnerAuthenticated}
            onOwnerLogin={handleOwnerLogin}
            onOwnerLogout={handleOwnerLogout}
            rates={rates}
            onUpdateRates={handleUpdateRates}
            orders={orders}
            onUpdateOrderStatus={handleUpdateOrderStatus}
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            notifications={notifications}
            unreadNotifications={unreadNotificationsCount}
            onOpenNotifications={() => setIsNotificationsOpen(true)}
            language={language}
            onToggleLanguage={() => setLanguage((l) => (l === 'en' ? 'ta' : 'en'))}
          />
        ) : (
          /* PURE CUSTOMER EGG ORDERING APP (/) - ZERO OWNER CONTROLS OR BARS ON THIS SCREEN */
          <MeeshoStyleCheckout
            rates={rates}
            settings={settings}
            language={language}
            onOrderPlaced={handleOrderPlaced}
            orders={orders}
            isOwnerAuthenticated={false}
            onTrackOrderOnServer={handleTrackOrderOnServer}
            onOpenAdmin={() => {}}
            onOpenNotifications={() => {}}
            unreadNotifications={0}
            onToggleLanguage={() => setLanguage((l) => (l === 'en' ? 'ta' : 'en'))}
            initialOrderId={selectedOrderIdForTracking}
          />
        )}
      </div>

      {/* Owner Notification Center Drawer (Only inside Owner Server App) */}
      {appMode === 'owner' && (
        <NotificationCenter
          isOpen={isNotificationsOpen}
          onClose={() => setIsNotificationsOpen(false)}
          notifications={notifications}
          onMarkAllRead={handleMarkAllNotificationsRead}
          onSelectOrder={(orderId) => {
            setSelectedOrderIdForTracking(orderId);
          }}
          language={language}
        />
      )}
    </div>
  );
}
