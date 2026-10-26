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

type ActiveAppMode = 'customer' | 'owner';

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
  const [rates, setRates] = useState<NattuKozhiRateSettings>(INITIAL_RATES);
  const [settings, setSettings] = useState<FarmSettings>(INITIAL_SETTINGS);
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
  const [selectedOrderIdForTracking, setSelectedOrderIdForTracking] = useState<string | undefined>(undefined);
  const [recentToast, setRecentToast] = useState<{ message: string; sub?: string } | null>(null);

  const prevOrderCountRef = useRef<number | null>(null);
  const lastOwnerMutationAtRef = useRef<number>(0);

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

  // Fetch central server state (rates, settings, and owner orders if in owner app & authenticated)
  const fetchServerState = useCallback(async (tokenOverride?: string | null) => {
    const pollStartedAt = Date.now();
    const activeToken = tokenOverride !== undefined ? tokenOverride : ownerToken;
    try {
      const headers: Record<string, string> = {};
      if (activeToken) {
        headers['Authorization'] = `Bearer ${activeToken}`;
      }
      const res = await fetch('/api/state', { headers, cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();

      // Ignore stale poll responses if the owner mutated rates/settings after this poll started
      const recentlyMutated =
        pollStartedAt <= lastOwnerMutationAtRef.current ||
        Date.now() - lastOwnerMutationAtRef.current < 4000;

      if (!recentlyMutated) {
        if (data.rates) {
          setRates((prev) =>
            JSON.stringify(prev) === JSON.stringify(data.rates) ? prev : data.rates
          );
        }
        if (data.settings) {
          setSettings((prev) =>
            JSON.stringify(prev) === JSON.stringify(data.settings) ? prev : data.settings
          );
        }
      }

      const authed = Boolean(data.isOwnerAuthenticated);
      setIsOwnerAuthenticated(authed);

      if (!authed && activeToken) {
        localStorage.removeItem(OWNER_TOKEN_STORAGE_KEY);
        setOwnerToken(null);
      }

      if (authed && Array.isArray(data.orders)) {
        if (
          prevOrderCountRef.current !== null &&
          data.orders.length > prevOrderCountRef.current
        ) {
          const latestOrder = data.orders[0];
          playNewOrderChime();
          setRecentToast({
            message: `🐓 New Order Received: ${latestOrder.id}`,
            sub: `${latestOrder.customer.fullName} · ₹${latestOrder.totalAmount} (${latestOrder.totalEggs} Country Eggs)`,
          });
          setTimeout(() => setRecentToast(null), 6000);
        }
        prevOrderCountRef.current = data.orders.length;
        setOrders((prev) =>
          JSON.stringify(prev) === JSON.stringify(data.orders) ? prev : data.orders
        );
      }

      if (authed && Array.isArray(data.notifications)) {
        setNotifications((prev) =>
          JSON.stringify(prev) === JSON.stringify(data.notifications) ? prev : data.notifications
        );
      }
    } catch {
      // Transient network interruption; next poll/SSE will automatically resync
    }
  }, [ownerToken]);

  // Initial fetch + periodic poll every 3.5 seconds so Customer App & Owner Server App stay 100% linked
  useEffect(() => {
    fetchServerState();
    const interval = setInterval(() => {
      fetchServerState();
    }, 3500);
    return () => clearInterval(interval);
  }, [fetchServerState]);

  // Real-time Server-Sent Events (SSE) subscription for instant cross-app rate updates
  useEffect(() => {
    let es: EventSource | null = null;
    try {
      es = new EventSource('/api/events');
      es.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'state_update') {
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
            if (ownerToken) {
              fetchServerState(ownerToken);
            }
          }
        } catch {
          // ignore malformed SSE packet
        }
      };
    } catch {
      // Fallback polling is already active
    }
    return () => {
      if (es) es.close();
    };
  }, [ownerToken, fetchServerState]);

  const unreadNotificationsCount = notifications.filter((n) => !n.read).length;

  // Owner Server Login Handler (Used exclusively inside the Separate Owner Server App)
  const handleOwnerLogin = async (
    username: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      if (res.ok && data.success && data.token) {
        localStorage.setItem(OWNER_TOKEN_STORAGE_KEY, data.token);
        setOwnerToken(data.token);
        setIsOwnerAuthenticated(true);
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

  // New Order Placed Handler (From Customer App -> Validated by Server & sent to Owner Server App)
  const handleOrderPlaced = async (
    newOrder: OrderRecord
  ): Promise<{ ok: boolean; error?: string; order?: OrderRecord }> => {
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
      setOrders((prev) => [createdOrder, ...prev]);
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

  // Track an order on the server by Order ID or Phone Number
  const handleTrackOrderOnServer = useCallback(async (query: string): Promise<OrderRecord | null> => {
    try {
      const res = await fetch(`/api/orders/track?q=${encodeURIComponent(query)}`, {
        cache: 'no-store',
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.order || null;
    } catch {
      return null;
    }
  }, []);

  // Owner Updates Rates on Server (From Separate Owner App -> Immediately syncs to Customer App)
  const handleUpdateRates = async (newRates: NattuKozhiRateSettings): Promise<boolean> => {
    if (!ownerToken) return false;
    lastOwnerMutationAtRef.current = Date.now();
    setRates(newRates);
    try {
      const res = await fetch('/api/admin/rates', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({ rates: newRates }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      lastOwnerMutationAtRef.current = Date.now();
      if (data.rates) {
        setRates(data.rates);
        await syncStorefrontToFirestore(data.rates, settings).catch(() => {});
      }
      return true;
    } catch {
      return false;
    }
  };

  // Owner Updates Order Status on Server
  const handleUpdateOrderStatus = async (
    orderId: string,
    status: OrderStatus,
    deliveryDetails?: { name: string; phone: string }
  ) => {
    if (!ownerToken) return;
    lastOwnerMutationAtRef.current = Date.now();
    try {
      const res = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({ status, deliveryDetails }),
      });
      if (res.ok) {
        const data = await res.json();
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

  // Owner Updates Settings on Server
  const handleUpdateSettings = async (newSettings: FarmSettings): Promise<boolean> => {
    if (!ownerToken) return false;
    lastOwnerMutationAtRef.current = Date.now();
    setSettings(newSettings);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({ settings: newSettings }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      lastOwnerMutationAtRef.current = Date.now();
      if (data.settings) {
        setSettings(data.settings);
        await syncStorefrontToFirestore(rates, data.settings).catch(() => {});
      }
      return true;
    } catch {
      return false;
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    if (!ownerToken) return;
    try {
      await fetch('/api/admin/notifications/read', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${ownerToken}` },
      });
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
            {recentToast.sub && <div className="text-[11px] text-stone-300 mt-0.5">{recentToast.sub}</div>}
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
