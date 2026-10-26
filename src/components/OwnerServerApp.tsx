import React, { useState, useEffect } from 'react';
import {
  FarmSettings,
  NattuKozhiRateSettings,
  NotificationItem,
  OrderRecord,
  OrderStatus,
} from '../types/eggFarm';
import { playNewOrderChime } from '../utils/audioAlert';
import { buildOwnerWhatsAppAlert } from '../utils/upi';
import {
  Server,
  Lock,
  Unlock,
  DollarSign,
  Package,
  Settings as SettingsIcon,
  Bell,
  Volume2,
  CheckCircle,
  Truck,
  Download,
  Printer,
  Share2,
  Phone,
  RefreshCw,
  Eye,
  EyeOff,
  User,
  KeyRound,
  Copy,
  Check,
  ExternalLink,
  Smartphone,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';

interface OwnerServerAppProps {
  isAuthenticated: boolean;
  onOwnerLogin: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  onOwnerLogout: () => Promise<void>;
  rates: NattuKozhiRateSettings;
  onUpdateRates: (rates: NattuKozhiRateSettings) => Promise<boolean>;
  orders: OrderRecord[];
  onUpdateOrderStatus: (
    orderId: string,
    status: OrderStatus,
    deliveryDetails?: { name: string; phone: string }
  ) => Promise<void>;
  settings: FarmSettings;
  onUpdateSettings: (settings: FarmSettings) => Promise<boolean>;
  notifications: NotificationItem[];
  unreadNotifications: number;
  onOpenNotifications: () => void;
  language: 'en' | 'ta';
  onToggleLanguage: () => void;
  onSwitchToCustomerPreview?: () => void;
}

type OwnerAppTab = 'rates' | 'orders' | 'settings' | 'applinks';

export const OwnerServerApp: React.FC<OwnerServerAppProps> = ({
  isAuthenticated,
  onOwnerLogin,
  onOwnerLogout,
  rates,
  onUpdateRates,
  orders,
  onUpdateOrderStatus,
  settings,
  onUpdateSettings,
  unreadNotifications,
  onOpenNotifications,
  language,
  onToggleLanguage,
  onSwitchToCustomerPreview,
}) => {
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [activeTab, setActiveTab] = useState<OwnerAppTab>('rates');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Editable rate state synced with live server prop (protected against polling resets)
  const [tempRates, setTempRates] = useState<NattuKozhiRateSettings>({ ...rates });
  const [ratesSaved, setRatesSaved] = useState(false);
  const [isSavingRates, setIsSavingRates] = useState(false);
  const isEditingRatesRef = React.useRef(false);
  const autoSaveRatesTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Editable farm & GPay settings state synced with live server prop (protected against polling resets)
  const [tempSettings, setTempSettings] = useState<FarmSettings>({ ...settings });
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const isEditingSettingsRef = React.useRef(false);
  const autoSaveSettingsTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Delivery rider assignment modal state
  const [dispatchingOrderId, setDispatchingOrderId] = useState<string | null>(null);
  const [riderName, setRiderName] = useState('Murugan (Farm Express)');
  const [riderPhone, setRiderPhone] = useState('9789012340');

  // Copy states for the two separate app URLs
  const [copiedOwnerUrl, setCopiedOwnerUrl] = useState(false);
  const [copiedCustomerUrl, setCopiedCustomerUrl] = useState(false);

  // Only sync from server props when the user is NOT actively editing
  useEffect(() => {
    if (!isEditingRatesRef.current) {
      setTempRates((prev) =>
        JSON.stringify(prev) === JSON.stringify(rates) ? prev : { ...rates }
      );
    }
  }, [rates]);

  useEffect(() => {
    if (!isEditingSettingsRef.current) {
      setTempSettings((prev) =>
        JSON.stringify(prev) === JSON.stringify(settings) ? prev : { ...settings }
      );
    }
  }, [settings]);

  const handleRateFieldChange = (updated: NattuKozhiRateSettings, immediate = false) => {
    isEditingRatesRef.current = true;
    setTempRates(updated);
    if (autoSaveRatesTimerRef.current) {
      clearTimeout(autoSaveRatesTimerRef.current);
    }
    autoSaveRatesTimerRef.current = setTimeout(
      async () => {
        setIsSavingRates(true);
        const ok = await onUpdateRates(updated);
        setIsSavingRates(false);
        isEditingRatesRef.current = false;
        if (ok) {
          setRatesSaved(true);
          setTimeout(() => setRatesSaved(false), 3500);
        }
      },
      immediate ? 50 : 700
    );
  };

  const handleSettingsFieldChange = (updated: FarmSettings) => {
    isEditingSettingsRef.current = true;
    setTempSettings(updated);
    if (autoSaveSettingsTimerRef.current) {
      clearTimeout(autoSaveSettingsTimerRef.current);
    }
    autoSaveSettingsTimerRef.current = setTimeout(async () => {
      setIsSavingSettings(true);
      const ok = await onUpdateSettings(updated);
      setIsSavingSettings(false);
      isEditingSettingsRef.current = false;
      if (ok) {
        setSettingsSaved(true);
        setTimeout(() => setSettingsSaved(false), 3500);
      }
    }, 700);
  };

  // Construct public Customer App URL and Separate Owner App URL
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const publicBaseOrigin = origin.includes('ais-dev-')
    ? origin.replace('ais-dev-', 'ais-pre-')
    : origin;
  const customerAppUrl = `${publicBaseOrigin}/`;
  const ownerAppUrl = `${publicBaseOrigin}/owner-server-control`;

  const handleCopyUrl = (url: string, type: 'owner' | 'customer') => {
    navigator.clipboard.writeText(url);
    if (type === 'owner') {
      setCopiedOwnerUrl(true);
      setTimeout(() => setCopiedOwnerUrl(false), 2500);
    } else {
      setCopiedCustomerUrl(true);
      setTimeout(() => setCopiedCustomerUrl(false), 2500);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');

    const trimmedUser = usernameInput.trim();
    const trimmedPass = passwordInput.trim();

    if (!trimmedUser || !trimmedPass) {
      setAuthError(
        language === 'ta'
          ? 'பயனர்பெயர் மற்றும் கடவுச்சொல் இரண்டையும் உள்ளிடவும்.'
          : 'Please enter both Username and Password.'
      );
      return;
    }

    setIsLoggingIn(true);
    try {
      const result = await onOwnerLogin(trimmedUser, trimmedPass);
      if (result.success) {
        setUsernameInput('');
        setPasswordInput('');
        setAuthError('');
      } else {
        setAuthError(
          language === 'ta'
            ? 'தவறான பயனர்பெயர் அல்லது கடவுச்சொல்! சர்வர் அணுகல் மறுக்கப்பட்டது.'
            : result.error || 'Invalid Username or Password. Server access denied.'
        );
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Filtered orders
  const filteredOrders = orders.filter((order) => {
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    const query = searchTerm.toLowerCase();
    const matchesSearch =
      order.id.toLowerCase().includes(query) ||
      order.customer.fullName.toLowerCase().includes(query) ||
      order.customer.phone.includes(query) ||
      order.customer.area.toLowerCase().includes(query);
    return matchesStatus && matchesSearch;
  });

  // Live summary metrics
  const totalEggsOrdered = orders.reduce((sum, o) => sum + o.totalEggs, 0);
  const totalRevenue = orders.reduce((sum, o) => sum + o.totalAmount, 0);
  const pendingOrdersCount = orders.filter((o) => o.status === 'pending_payment').length;
  const outForDeliveryCount = orders.filter((o) => o.status === 'out_for_delivery').length;

  const handleExportCSV = () => {
    const headers = [
      'Order ID',
      'Date',
      'Customer Name',
      'Phone',
      'Address',
      'Total Nattu Eggs',
      'Total Amount',
      'Status',
      'GPay Ref',
    ];
    const rows = orders.map((o) => [
      o.id,
      new Date(o.createdAt).toLocaleString(),
      `"${o.customer.fullName}"`,
      o.customer.phone,
      `"${o.customer.address}, ${o.customer.area}"`,
      o.totalEggs,
      o.totalAmount,
      o.status,
      o.upiReferenceId || '',
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Rehoboth_Egg_Orders_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#0f1715] text-stone-100 select-none overflow-hidden">
      {/* 1. STANDALONE OWNER SERVER APP TOP HEADER */}
      <header className="bg-[#09100e] border-b border-emerald-900/60 px-4 sm:px-6 py-3 flex items-center justify-between gap-3 shrink-0 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-800 flex items-center justify-center text-white shadow-md border border-emerald-400/30">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {language === 'ta' ? 'தனி உரிமையாளர் சர்வர் ஆப்' : 'STANDALONE OWNER SERVER APP'}
              </span>
              {isAuthenticated && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-700">
                  ● LIVE SERVER CONNECTED
                </span>
              )}
            </div>
            <h1 className="text-sm sm:text-base font-extrabold text-white mt-0.5">
              {language === 'ta'
                ? `${settings.tamilFarmName} - சர்வர் கண்ட்ரோல் ஆப்`
                : `${settings.farmName} - Owner Server Control App`}
            </h1>
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-2">
          {isAuthenticated && (
            <>
              <button
                type="button"
                onClick={onOpenNotifications}
                className="relative p-2 bg-stone-800 hover:bg-stone-700 text-amber-300 rounded-xl border border-stone-700 transition-colors cursor-pointer"
                title="Live Order Notifications"
              >
                <Bell className="w-4 h-4" />
                {unreadNotifications > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                    {unreadNotifications}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => playNewOrderChime()}
                className="px-2.5 py-1.5 text-xs bg-stone-800 hover:bg-stone-700 text-amber-300 rounded-xl border border-stone-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Test New Order Sound Alert"
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span className="hidden md:inline">
                  {language === 'ta' ? 'ஒலி சோதனை' : 'Test Sound'}
                </span>
              </button>
            </>
          )}

          {onSwitchToCustomerPreview && (
            <button
              type="button"
              onClick={onSwitchToCustomerPreview}
              className="px-2.5 py-1.5 text-xs font-bold bg-amber-700/30 hover:bg-amber-700/50 text-amber-200 border border-amber-600/40 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Preview Customer Ordering App"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {language === 'ta' ? 'வாடிக்கையாளர் ஆப் பார்க்க' : 'View Customer App'}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={onToggleLanguage}
            className="px-2.5 py-1.5 text-xs font-bold text-stone-200 bg-stone-800 hover:bg-stone-700 border border-stone-700 rounded-xl transition-colors cursor-pointer"
          >
            {language === 'en' ? 'தமிழ்' : 'English'}
          </button>

          {isAuthenticated && (
            <button
              type="button"
              onClick={async () => {
                await onOwnerLogout();
                setUsernameInput('');
                setPasswordInput('');
              }}
              className="px-2.5 py-1.5 text-xs font-bold bg-rose-950/90 hover:bg-rose-900 text-rose-200 border border-rose-800 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {language === 'ta' ? 'வெளியேறு (Lock)' : 'Lock Server'}
              </span>
            </button>
          )}
        </div>
      </header>

      {/* 2. BODY: LOGIN SCREEN OR FULL STANDALONE OWNER CONTROL CONSOLE */}
      {!isAuthenticated ? (
        <div className="flex-1 overflow-y-auto p-4 flex items-center justify-center bg-gradient-to-b from-[#0f1715] to-[#09100e]">
          <div className="bg-white text-stone-900 rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-emerald-800/30 space-y-5">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-900 rounded-2xl flex items-center justify-center border border-emerald-300">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full bg-stone-900 text-amber-300">
                {language === 'ta' ? 'உரிமையாளர் தனி ஆப்' : 'OWNER DEDICATED APP'}
              </span>
            </div>

            <div className="space-y-1">
              <h2 className="text-xl font-extrabold text-stone-900">
                {language === 'ta'
                  ? 'ரெகோபோத் முட்டை பண்ணை - சர்வர் உள்நுழைவு'
                  : 'Rehoboth Farm - Owner Server Login'}
              </h2>
              <p className="text-xs text-stone-600 leading-relaxed">
                {language === 'ta'
                  ? 'இது உங்களுக்கான தனி சர்வர் கட்டுப்பாட்டு ஆப். இங்கே நீங்கள் மாற்றும் முட்டை விலை மற்றும் அமைப்புகள் அனைத்தும் வாடிக்கையாளர் ஆப்ஸில் உடனடியாக மாறிவிடும்.'
                  : 'This is your dedicated standalone Owner Server App. Log in with your secret owner credentials to control live egg prices and orders across all customer phones.'}
              </p>
            </div>

            <form onSubmit={handleLoginSubmit} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-bold text-stone-700 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-emerald-700" />
                  <span>{language === 'ta' ? 'உரிமையாளர் பயனர்பெயர் (Username):' : 'Owner Username:'}</span>
                </label>
                <input
                  type="text"
                  autoComplete="off"
                  value={usernameInput}
                  onChange={(e) => {
                    setUsernameInput(e.target.value);
                    setAuthError('');
                  }}
                  placeholder="Enter Owner Username"
                  className="w-full px-3.5 py-2.5 text-sm border border-stone-300 rounded-xl focus:outline-emerald-700 bg-stone-50"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-stone-700 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-emerald-700" />
                  <span>{language === 'ta' ? 'உரிமையாளர் கடவுச்சொல் (Password):' : 'Owner Password:'}</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="off"
                    value={passwordInput}
                    onChange={(e) => {
                      setPasswordInput(e.target.value);
                      setAuthError('');
                    }}
                    placeholder="Enter Owner Password"
                    className="w-full pl-3.5 pr-10 py-2.5 text-sm border border-stone-300 rounded-xl focus:outline-emerald-700 bg-stone-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 cursor-pointer p-1"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {authError && (
                <div className="text-rose-700 font-bold text-xs bg-rose-50 p-3 rounded-xl border border-rose-200">
                  ⚠️ {authError}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full py-3.5 px-4 text-xs font-extrabold text-white bg-emerald-800 hover:bg-emerald-900 active:scale-98 disabled:opacity-50 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isLoggingIn ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>{language === 'ta' ? 'சர்வர் சரிபார்க்கிறது...' : 'Connecting to Server...'}</span>
                  </>
                ) : (
                  <>
                    <Unlock className="w-4 h-4" />
                    <span>
                      {language === 'ta'
                        ? 'உரிமையாளர் சர்வர் ஆப்-ஐ திறக்க'
                        : 'Unlock Standalone Owner Server App'}
                    </span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      ) : (
        /* AUTHENTICATED STANDALONE OWNER APP WORKSPACE */
        <div className="flex-1 flex flex-col overflow-hidden bg-[#faf8f5] text-stone-900">
          {/* Navigation Bar */}
          <div className="px-4 sm:px-6 bg-stone-900 text-white border-b border-stone-800 flex items-center justify-between gap-2 overflow-x-auto shrink-0">
            <div className="flex items-center gap-1.5 py-2">
              <button
                type="button"
                onClick={() => setActiveTab('rates')}
                className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                  activeTab === 'rates'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-stone-300 hover:text-white hover:bg-stone-800'
                }`}
              >
                <DollarSign className="w-3.5 h-3.5" />
                <span>
                  {language === 'ta'
                    ? '1. முட்டை விலை & ஸ்டாக் கட்டுப்பாடு'
                    : '1. Live Egg Rate & Stock Control'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('orders')}
                className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                  activeTab === 'orders'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-stone-300 hover:text-white hover:bg-stone-800'
                }`}
              >
                <Package className="w-3.5 h-3.5" />
                <span>
                  {language === 'ta' ? '2. வாடிக்கையாளர் ஆர்டர்கள்' : '2. Customer Orders'} ({orders.length})
                </span>
                {pendingOrdersCount > 0 && (
                  <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.5 rounded-full tabular-nums">
                    {pendingOrdersCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('settings')}
                className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                  activeTab === 'settings'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-stone-300 hover:text-white hover:bg-stone-800'
                }`}
              >
                <SettingsIcon className="w-3.5 h-3.5" />
                <span>
                  {language === 'ta' ? '3. பண்ணை & GPay QR அமைப்புகள்' : '3. Farm & GPay QR Settings'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('applinks')}
                className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                  activeTab === 'applinks'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-amber-300 hover:text-white hover:bg-stone-800'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>
                  {language === 'ta'
                    ? '4. தனி ஆப் லிங்க்ஸ் (Owner vs Customer)'
                    : '4. Separate App Links'}
                </span>
              </button>
            </div>
          </div>

          {/* Main Scrollable Content Area */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
            {/* TAB 1: LIVE EGG RATE & STOCK CONTROL */}
            {activeTab === 'rates' && (
              <div className="max-w-4xl mx-auto space-y-5">
                {/* Live Status Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-white border border-stone-200 rounded-2xl p-3.5 shadow-2xs">
                    <div className="text-[11px] text-stone-500 font-semibold">
                      {language === 'ta' ? 'இன்றைய 1 முட்டை விலை' : 'Single Egg Live Rate'}
                    </div>
                    <div className="text-xl font-extrabold text-amber-800 tabular-nums mt-0.5">
                      ₹{tempRates.pricePerEgg}
                    </div>
                  </div>
                  <div className="bg-white border border-stone-200 rounded-2xl p-3.5 shadow-2xs">
                    <div className="text-[11px] text-stone-500 font-semibold">
                      {language === 'ta' ? '30 முட்டை டிரே விலை' : '30-Egg Tray Live Rate'}
                    </div>
                    <div className="text-xl font-extrabold text-emerald-800 tabular-nums mt-0.5">
                      ₹{tempRates.tray30Price}
                    </div>
                  </div>
                  <div className="bg-white border border-stone-200 rounded-2xl p-3.5 shadow-2xs">
                    <div className="text-[11px] text-stone-500 font-semibold">
                      {language === 'ta' ? 'இன்றைய இருப்பு (Stock)' : 'Today Harvest Stock'}
                    </div>
                    <div className="text-xl font-extrabold text-stone-900 tabular-nums mt-0.5">
                      {tempRates.dailyHarvestCount} {language === 'ta' ? 'முட்டைகள்' : 'Eggs'}
                    </div>
                  </div>
                  <div className="bg-white border border-stone-200 rounded-2xl p-3.5 shadow-2xs">
                    <div className="text-[11px] text-stone-500 font-semibold">
                      {language === 'ta' ? 'விற்பனை நிலை' : 'Storefront Status'}
                    </div>
                    <div
                      className={`text-sm font-extrabold mt-1 ${
                        tempRates.inStock ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {tempRates.inStock
                        ? language === 'ta'
                          ? '● விற்பனை செயலில்'
                          : '● IN STOCK LIVE'
                        : language === 'ta'
                        ? '● இருப்பு முடிந்தது'
                        : '● SOLD OUT'}
                    </div>
                  </div>
                </div>

                {/* Rate Control Card */}
                <div className="bg-white border border-stone-200 rounded-2xl p-5 sm:p-6 shadow-xs space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-stone-100">
                    <div>
                      <h3 className="text-base font-extrabold text-stone-900 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-emerald-700" />
                        <span>
                          {language === 'ta'
                            ? 'சர்வர் முட்டை விலை கட்டுப்பாடு (வாடிக்கையாளர் ஆப்ஸில் உடனடியாக மாறும்)'
                            : 'Central Server Egg Rate Controller (Syncs to Customer App Instantly)'}
                        </span>
                      </h3>
                      <p className="text-xs text-stone-500 mt-0.5">
                        {language === 'ta'
                          ? 'இங்கே விலையை மாற்றினால் தானாகவே சர்வரில் சேமிக்கப்பட்டு எல்லா வாடிக்கையாளர் போன்களிலும் உடனே மாறிவிடும்.'
                          : 'Update prices below to push live rates to all customer phones immediately.'}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        handleRateFieldChange({ ...tempRates, inStock: !tempRates.inStock }, true)
                      }
                      className={`px-4 py-2 text-xs font-extrabold rounded-xl cursor-pointer transition-colors ${
                        tempRates.inStock
                          ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                          : 'bg-rose-100 text-rose-900 border border-rose-300'
                      }`}
                    >
                      {tempRates.inStock
                        ? '✓ IN STOCK (விற்பனை நடைபெறுகிறது)'
                        : '✕ SOLD OUT (இருப்பு முடிந்தது)'}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                    <div className="space-y-1">
                      <label className="font-bold text-stone-700">
                        {language === 'ta' ? '1 நாட்டுக்கோழி முட்டை விலை (₹)' : '1 Country Egg Rate (₹)'}
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        value={tempRates.pricePerEgg || ''}
                        onChange={(e) =>
                          handleRateFieldChange({
                            ...tempRates,
                            pricePerEgg: e.target.value === '' ? 0 : parseFloat(e.target.value),
                          })
                        }
                        className="w-full px-3.5 py-2.5 text-base font-extrabold text-stone-900 border border-stone-300 rounded-xl focus:outline-emerald-700"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-emerald-900">
                        {language === 'ta' ? '30 முட்டை டிரே விலை (₹) [Best Seller]' : '30-Egg Tray Rate (₹)'}
                      </label>
                      <input
                        type="number"
                        step="1"
                        value={tempRates.tray30Price || ''}
                        onChange={(e) =>
                          handleRateFieldChange({
                            ...tempRates,
                            tray30Price: e.target.value === '' ? 0 : parseInt(e.target.value, 10),
                          })
                        }
                        className="w-full px-3.5 py-2.5 text-base font-extrabold text-emerald-900 border border-emerald-400 rounded-xl bg-emerald-50/50 focus:outline-emerald-700"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-stone-700">
                        {language === 'ta' ? '12 முட்டை பெட்டி விலை (₹)' : '12-Egg Box Rate (₹)'}
                      </label>
                      <input
                        type="number"
                        step="1"
                        value={tempRates.pack12Price || ''}
                        onChange={(e) =>
                          handleRateFieldChange({
                            ...tempRates,
                            pack12Price: e.target.value === '' ? 0 : parseInt(e.target.value, 10),
                          })
                        }
                        className="w-full px-3.5 py-2.5 text-base font-extrabold text-stone-900 border border-stone-300 rounded-xl"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-stone-700">
                        {language === 'ta' ? '60 முட்டை (2 டிரே) விலை (₹)' : '60-Egg Double Tray Rate (₹)'}
                      </label>
                      <input
                        type="number"
                        step="5"
                        value={tempRates.doubleTray60Price || ''}
                        onChange={(e) =>
                          handleRateFieldChange({
                            ...tempRates,
                            doubleTray60Price:
                              e.target.value === '' ? 0 : parseInt(e.target.value, 10),
                          })
                        }
                        className="w-full px-3.5 py-2.5 text-base font-extrabold text-stone-900 border border-stone-300 rounded-xl"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-stone-700">
                        {language === 'ta' ? '100 முட்டை கிரேட் விலை (₹)' : '100-Egg Bulk Crate Rate (₹)'}
                      </label>
                      <input
                        type="number"
                        step="10"
                        value={tempRates.bulk100Price || ''}
                        onChange={(e) =>
                          handleRateFieldChange({
                            ...tempRates,
                            bulk100Price: e.target.value === '' ? 0 : parseInt(e.target.value, 10),
                          })
                        }
                        className="w-full px-3.5 py-2.5 text-base font-extrabold text-stone-900 border border-stone-300 rounded-xl"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-stone-700">
                        {language === 'ta' ? 'இன்றைய முட்டை எண்ணிக்கை' : "Today's Egg Harvest Count"}
                      </label>
                      <input
                        type="number"
                        value={tempRates.dailyHarvestCount || ''}
                        onChange={(e) =>
                          handleRateFieldChange({
                            ...tempRates,
                            dailyHarvestCount:
                              e.target.value === '' ? 0 : parseInt(e.target.value, 10),
                          })
                        }
                        className="w-full px-3.5 py-2.5 text-base font-extrabold text-stone-900 border border-stone-300 rounded-xl"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-stone-100">
                    <div className="text-xs text-stone-500">
                      {ratesSaved ? (
                        <span className="text-emerald-700 font-extrabold flex items-center gap-1.5">
                          <CheckCircle className="w-4 h-4" />
                          {language === 'ta'
                            ? 'சர்வரில் சேமிக்கப்பட்டது! எல்லா வாடிக்கையாளர் போன்களிலும் விலை மாறிவிட்டது!'
                            : 'Published to Server! Customer App updated across all devices!'}
                        </span>
                      ) : (
                        <span>
                          {language === 'ta'
                            ? 'விலை மாற்றம் தானாகவும் சேமிக்கப்படும் அல்லது வலதுபுற பட்டனை அழுத்தவும்.'
                            : 'Changes auto-save or click the button on the right to broadcast immediately.'}
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      disabled={isSavingRates}
                      onClick={async () => {
                        if (autoSaveRatesTimerRef.current) {
                          clearTimeout(autoSaveRatesTimerRef.current);
                        }
                        setIsSavingRates(true);
                        const ok = await onUpdateRates(tempRates);
                        setIsSavingRates(false);
                        isEditingRatesRef.current = false;
                        if (ok) {
                          setRatesSaved(true);
                          setTimeout(() => setRatesSaved(false), 4000);
                        }
                      }}
                      className="px-6 py-3 text-xs font-extrabold text-white bg-emerald-700 hover:bg-emerald-800 active:scale-98 disabled:opacity-50 rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-2"
                    >
                      {isSavingRates && <RefreshCw className="w-4 h-4 animate-spin" />}
                      <span>
                        {language === 'ta'
                          ? 'சர்வரில் விலையை புதுப்பிக்க (Publish Live Rates)'
                          : 'Publish Live Rates to Customer App'}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: LIVE CUSTOMER ORDERS & DELIVERY DISPATCH */}
            {activeTab === 'orders' && (
              <div className="max-w-5xl mx-auto space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-white border border-stone-200 rounded-xl p-3.5">
                    <div className="text-[11px] text-stone-500">Total Orders</div>
                    <div className="text-xl font-extrabold text-stone-900 tabular-nums">{orders.length}</div>
                  </div>
                  <div className="bg-white border border-stone-200 rounded-xl p-3.5">
                    <div className="text-[11px] text-stone-500">Eggs Ordered</div>
                    <div className="text-xl font-extrabold text-amber-900 tabular-nums">{totalEggsOrdered}</div>
                  </div>
                  <div className="bg-white border border-stone-200 rounded-xl p-3.5">
                    <div className="text-[11px] text-stone-500">Total GPay Collection</div>
                    <div className="text-xl font-extrabold text-emerald-800 tabular-nums">₹{totalRevenue}</div>
                  </div>
                  <div className="bg-white border border-stone-200 rounded-xl p-3.5">
                    <div className="text-[11px] text-stone-500">Out for Delivery</div>
                    <div className="text-xl font-extrabold text-stone-900 tabular-nums">{outForDeliveryCount}</div>
                  </div>
                </div>

                {/* Filter & Search Bar */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-stone-200">
                  <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-lg overflow-x-auto">
                    {['all', 'confirmed_packing', 'out_for_delivery', 'delivered'].map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setStatusFilter(st)}
                        className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer whitespace-nowrap ${
                          statusFilter === st
                            ? 'bg-stone-900 text-white shadow-2xs'
                            : 'text-stone-600 hover:text-stone-900'
                        }`}
                      >
                        {st === 'all' && 'All Orders'}
                        {st === 'confirmed_packing' && 'Confirmed & Packing'}
                        {st === 'out_for_delivery' && 'Out for Delivery'}
                        {st === 'delivered' && 'Delivered'}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search name, phone, Order ID..."
                      className="px-3 py-1.5 text-xs border border-stone-300 rounded-lg bg-stone-50"
                    />
                    <button
                      type="button"
                      onClick={handleExportCSV}
                      className="px-2.5 py-1.5 text-xs font-bold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg flex items-center gap-1 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>CSV</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="px-2.5 py-1.5 text-xs font-bold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg flex items-center gap-1 cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Print</span>
                    </button>
                  </div>
                </div>

                {/* Orders List */}
                <div className="space-y-3">
                  {filteredOrders.map((order) => (
                    <div
                      key={order.id}
                      className="bg-white border border-stone-200 rounded-2xl p-4 space-y-3 shadow-2xs"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 pb-2.5">
                        <div className="flex items-center gap-2.5">
                          <span className="font-mono font-extrabold text-sm text-stone-900">{order.id}</span>
                          <span className="text-xs text-stone-500">
                            {new Date(order.createdAt).toLocaleString()}
                          </span>
                          <span
                            className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                              order.status === 'confirmed_packing'
                                ? 'bg-blue-100 text-blue-900'
                                : order.status === 'out_for_delivery'
                                ? 'bg-purple-100 text-purple-900'
                                : 'bg-emerald-100 text-emerald-900'
                            }`}
                          >
                            {order.status === 'confirmed_packing'
                              ? 'ORDER CONFIRMED'
                              : order.status.replace('_', ' ').toUpperCase()}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-base font-extrabold text-stone-900 tabular-nums">
                            ₹{order.totalAmount}
                          </span>
                          <span className="text-xs text-stone-500 ml-1.5">
                            ({order.totalEggs} Eggs)
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        <div className="space-y-1">
                          <div className="font-bold text-stone-900">
                            {order.customer.fullName} · {order.customer.phone}
                          </div>
                          <div className="text-stone-600">
                            {order.customer.address}, {order.customer.area} - {order.customer.pincode}
                          </div>
                          <div className="text-stone-500">Slot: {order.customer.deliverySlot}</div>
                        </div>

                        <div className="bg-stone-50 p-2.5 rounded-xl border border-stone-200/70 space-y-1">
                          {order.items.map((it, idx) => (
                            <div key={idx} className="flex justify-between font-semibold text-stone-700">
                              <span>
                                {it.quantity}x {it.packName}
                              </span>
                              <span>₹{it.quantity * it.unitPrice}</span>
                            </div>
                          ))}
                          <div className="border-t border-stone-200 pt-1 flex justify-between text-[11px]">
                            <span className="text-stone-500">Customer 12-Digit UTR:</span>
                            <span className="font-mono font-bold text-emerald-800">
                              {order.upiReferenceId || 'N/A'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-stone-100">
                        <div className="flex items-center gap-2">
                          <a
                            href={buildOwnerWhatsAppAlert(order, settings)}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3 py-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg flex items-center gap-1.5"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                            <span>WhatsApp</span>
                          </a>
                          <a
                            href={`tel:${order.customer.phone}`}
                            className="px-3 py-1.5 text-xs font-bold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg flex items-center gap-1.5"
                          >
                            <Phone className="w-3.5 h-3.5" />
                            <span>Call Customer</span>
                          </a>
                        </div>

                        <div className="flex items-center gap-2">
                          {(order.status === 'confirmed_packing' || order.status === 'pending_payment') && (
                            <button
                              type="button"
                              onClick={() => setDispatchingOrderId(order.id)}
                              className="px-3.5 py-1.5 text-xs font-bold text-white bg-amber-800 hover:bg-amber-900 rounded-lg flex items-center gap-1.5 cursor-pointer"
                            >
                              <Truck className="w-3.5 h-3.5" />
                              <span>Dispatch Delivery</span>
                            </button>
                          )}
                          {order.status === 'out_for_delivery' && (
                            <button
                              type="button"
                              onClick={() => onUpdateOrderStatus(order.id, 'delivered')}
                              className="px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg flex items-center gap-1.5 cursor-pointer"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                              <span>Mark Delivered</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 3: FARM & GPAY QR SETTINGS */}
            {activeTab === 'settings' && (
              <div className="max-w-2xl mx-auto space-y-5 text-xs">
                <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-4">
                  <h4 className="text-sm font-extrabold text-stone-900 border-b border-stone-100 pb-2">
                    GPay / UPI QR Code Server Configuration
                  </h4>
                  <div className="space-y-1">
                    <label className="font-bold text-stone-700">Owner GPay / UPI ID (VPA) *</label>
                    <input
                      type="text"
                      value={tempSettings.gpayUpiId}
                      onChange={(e) =>
                        handleSettingsFieldChange({ ...tempSettings, gpayUpiId: e.target.value })
                      }
                      className="w-full px-3.5 py-2.5 text-sm font-mono border border-stone-300 rounded-xl"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-stone-700">Merchant / Farm Name on QR *</label>
                    <input
                      type="text"
                      value={tempSettings.gpayName}
                      onChange={(e) =>
                        handleSettingsFieldChange({ ...tempSettings, gpayName: e.target.value })
                      }
                      className="w-full px-3.5 py-2.5 text-sm border border-stone-300 rounded-xl"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div className="space-y-1">
                      <label className="font-bold text-stone-700">Delivery Charge (₹)</label>
                      <input
                        type="number"
                        value={tempSettings.deliveryFee === 0 ? 0 : tempSettings.deliveryFee || ''}
                        onChange={(e) =>
                          handleSettingsFieldChange({
                            ...tempSettings,
                            deliveryFee: e.target.value === '' ? 0 : parseInt(e.target.value, 10),
                          })
                        }
                        className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-xl"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold text-stone-700">Free Delivery Above (₹)</label>
                      <input
                        type="number"
                        value={
                          tempSettings.freeDeliveryThreshold === 0
                            ? 0
                            : tempSettings.freeDeliveryThreshold || ''
                        }
                        onChange={(e) =>
                          handleSettingsFieldChange({
                            ...tempSettings,
                            freeDeliveryThreshold:
                              e.target.value === '' ? 0 : parseInt(e.target.value, 10),
                          })
                        }
                        className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-xl"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-3 pt-3">
                    {settingsSaved && (
                      <span className="text-emerald-700 font-bold flex items-center gap-1">
                        <CheckCircle className="w-4 h-4" />
                        Saved to Server!
                      </span>
                    )}
                    <button
                      type="button"
                      disabled={isSavingSettings}
                      onClick={async () => {
                        if (autoSaveSettingsTimerRef.current) {
                          clearTimeout(autoSaveSettingsTimerRef.current);
                        }
                        setIsSavingSettings(true);
                        const ok = await onUpdateSettings(tempSettings);
                        setIsSavingSettings(false);
                        isEditingSettingsRef.current = false;
                        if (ok) {
                          setSettingsSaved(true);
                          setTimeout(() => setSettingsSaved(false), 3000);
                        }
                      }}
                      className="px-6 py-2.5 text-xs font-extrabold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl cursor-pointer"
                    >
                      Save Settings to Server
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: SEPARATE APP LINKS (OWNER SERVER APP VS CUSTOMER APP) */}
            {activeTab === 'applinks' && (
              <div className="max-w-4xl mx-auto space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Card 1: Separate Owner Server Control App Link */}
                  <div className="bg-emerald-950 text-white rounded-2xl p-5 border border-emerald-700 shadow-lg space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full bg-amber-500 text-stone-950">
                        {language === 'ta' ? 'உங்களுக்கு மட்டும் (PRIVATE OWNER APP)' : 'FOR YOU ONLY (OWNER APP)'}
                      </span>
                      <Server className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <h3 className="text-base font-extrabold">
                        {language === 'ta'
                          ? '1. உரிமையாளர் சர்வர் கண்ட்ரோல் தனி ஆப்'
                          : '1. Standalone Owner Server Control App'}
                      </h3>
                      <p className="text-xs text-emerald-200/90 mt-1 leading-relaxed">
                        {language === 'ta'
                          ? 'இந்த லிங்கை உங்கள் போனில் மட்டும் Chrome-ல் திறந்து "Add to Home Screen" கொடுத்து தனி ஆப்பாக வைத்துக்கொள்ளுங்கள். இதை வாடிக்கையாளர்களுக்கு அனுப்ப வேண்டாம்.'
                          : 'Open this link on your phone in Chrome and tap "Add to Home Screen" to use it as your dedicated Owner Control App.'}
                      </p>
                    </div>
                    <div className="bg-black/40 p-3 rounded-xl border border-emerald-800 font-mono text-[11px] text-emerald-200 break-all">
                      {ownerAppUrl}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopyUrl(ownerAppUrl, 'owner')}
                      className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors"
                    >
                      {copiedOwnerUrl ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      <span>
                        {copiedOwnerUrl
                          ? language === 'ta'
                            ? 'உரிமையாளர் ஆப் லிங்க் நகலெடுக்கப்பட்டது!'
                            : 'Owner App Link Copied!'
                          : language === 'ta'
                          ? 'உரிமையாளர் ஆப் லிங்கை காப்பி செய்க'
                          : 'Copy Owner Control App URL'}
                      </span>
                    </button>
                  </div>

                  {/* Card 2: Customer Egg Ordering App Link */}
                  <div className="bg-white text-stone-900 rounded-2xl p-5 border border-stone-200 shadow-lg space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                        {language === 'ta'
                          ? 'வாடிக்கையாளர்களுக்கு (CUSTOMER APP)'
                          : 'SHARE WITH CUSTOMERS'}
                      </span>
                      <Smartphone className="w-5 h-5 text-amber-800" />
                    </div>
                    <div>
                      <h3 className="text-base font-extrabold">
                        {language === 'ta'
                          ? '2. வாடிக்கையாளர் முட்டை ஆர்டர் ஆப்'
                          : '2. Customer Egg Ordering App'}
                      </h3>
                      <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                        {language === 'ta'
                          ? 'இந்த லிங்கை வாடிக்கையாளர்களுக்கு WhatsApp-ல் அனுப்புங்கள். இதில் உரிமையாளர் கட்டுப்பாடு எதுவுமே இருக்காது; முட்டை ஆர்டர் மட்டுமே செய்ய முடியும்.'
                          : 'Share this link with your customers on WhatsApp. It contains zero owner controls—customers can only order eggs and pay via GPay QR.'}
                      </p>
                    </div>
                    <div className="bg-stone-100 p-3 rounded-xl border border-stone-200 font-mono text-[11px] text-stone-800 break-all">
                      {customerAppUrl}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopyUrl(customerAppUrl, 'customer')}
                        className="py-2.5 px-3 bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        {copiedCustomerUrl ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        <span>{copiedCustomerUrl ? 'Copied!' : 'Copy Customer Link'}</span>
                      </button>
                      <a
                        href={`https://wa.me/?text=${encodeURIComponent(
                          `🐓 *${settings.tamilFarmName}*\nசுத்தமான நாட்டுக்கோழி முட்டைகள் நேரடியாக ஆர்டர் செய்ய கீழே உள்ள லிங்கை தொடவும்:\n${customerAppUrl}`
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                        className="py-2.5 px-3 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>Share on WhatsApp</span>
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Rider Dispatch Modal */}
      {dispatchingOrderId && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white text-stone-900 rounded-2xl p-6 max-w-sm w-full space-y-4 border border-stone-200 shadow-xl">
            <h4 className="font-bold text-sm">Assign Delivery Rider for {dispatchingOrderId}</h4>
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-stone-700">Rider Name</label>
                <input
                  type="text"
                  value={riderName}
                  onChange={(e) => setRiderName(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg mt-1"
                />
              </div>
              <div>
                <label className="font-semibold text-stone-700">Rider Mobile Number</label>
                <input
                  type="text"
                  value={riderPhone}
                  onChange={(e) => setRiderPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg mt-1"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDispatchingOrderId(null)}
                className="px-3 py-1.5 text-xs text-stone-600 hover:bg-stone-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  await onUpdateOrderStatus(dispatchingOrderId, 'out_for_delivery', {
                    name: riderName,
                    phone: riderPhone,
                  });
                  setDispatchingOrderId(null);
                }}
                className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg cursor-pointer"
              >
                Confirm Dispatch
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
