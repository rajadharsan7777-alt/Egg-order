import React, { useState, useEffect } from 'react';
import { FarmSettings, NattuKozhiRateSettings, OrderRecord, OrderStatus } from '../types/eggFarm';
import { playNewOrderChime } from '../utils/audioAlert';
import { buildOwnerWhatsAppAlert } from '../utils/upi';
import {
  Lock,
  Unlock,
  DollarSign,
  Package,
  Settings as SettingsIcon,
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
  Server,
} from 'lucide-react';

interface AdminPortalProps {
  isOpen: boolean;
  onClose: () => void;
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
  language: 'en' | 'ta';
}

type AdminTab = 'rates' | 'orders' | 'settings';

export const AdminPortal: React.FC<AdminPortalProps> = ({
  isOpen,
  onClose,
  isAuthenticated,
  onOwnerLogin,
  onOwnerLogout,
  rates,
  onUpdateRates,
  orders,
  onUpdateOrderStatus,
  settings,
  onUpdateSettings,
  language,
}) => {
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [activeTab, setActiveTab] = useState<AdminTab>('rates');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Local state for live rates editing synced with server prop
  const [tempRates, setTempRates] = useState<NattuKozhiRateSettings>({ ...rates });
  const [ratesSaved, setRatesSaved] = useState(false);
  const [isSavingRates, setIsSavingRates] = useState(false);

  // Editable settings local state synced with server prop
  const [tempSettings, setTempSettings] = useState<FarmSettings>({ ...settings });
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Assign delivery boy modal state
  const [dispatchingOrderId, setDispatchingOrderId] = useState<string | null>(null);
  const [riderName, setRiderName] = useState('Murugan (Farm Express)');
  const [riderPhone, setRiderPhone] = useState('9789012340');

  useEffect(() => {
    setTempRates({ ...rates });
  }, [rates]);

  useEffect(() => {
    setTempSettings({ ...settings });
  }, [settings]);

  if (!isOpen) return null;

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

  // Daily statistics
  const totalEggsToday = orders.reduce((sum, o) => sum + o.totalEggs, 0);
  const totalRevenueToday = orders.reduce((sum, o) => sum + o.totalAmount, 0);
  const pendingOrdersCount = orders.filter((o) => o.status === 'pending_payment').length;
  const outForDeliveryCount = orders.filter((o) => o.status === 'out_for_delivery').length;

  // Export orders to CSV
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

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/75 backdrop-blur-xs">
      <div className="bg-white rounded-3xl max-w-5xl w-full max-h-[94vh] flex flex-col shadow-2xl overflow-hidden border border-stone-200">
        {/* Top Header */}
        <div className="p-4 sm:p-5 border-b border-stone-200 bg-stone-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-700 rounded-xl text-white">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-amber-300 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                <span>
                  {language === 'ta'
                    ? 'பண்ணை உரிமையாளர் சர்வர் கட்டுப்பாடு (Owner Server Only)'
                    : 'Private Farm Owner Server Control'}
                </span>
                {isAuthenticated && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-emerald-900/80 text-emerald-300 border border-emerald-700">
                    ● LIVE SERVER SYNC
                  </span>
                )}
              </div>
              <h2 className="text-lg font-bold">
                {language === 'ta'
                  ? 'ரெகோபோத் முட்டை பண்ணை - விலை & ஆர்டர் சர்வர்'
                  : 'Rehoboth Egg Farm - Live Rate & Order Server'}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isAuthenticated && (
              <>
                <button
                  type="button"
                  onClick={() => playNewOrderChime()}
                  className="px-2.5 py-1.5 text-xs bg-stone-800 hover:bg-stone-700 text-amber-300 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Test audio alert chime"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Test Chime</span>
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await onOwnerLogout();
                    setUsernameInput('');
                    setPasswordInput('');
                    onClose();
                  }}
                  className="px-2.5 py-1.5 text-xs bg-rose-900/70 hover:bg-rose-800 text-rose-200 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Revoke server session and hide owner controls"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">
                    {language === 'ta' ? 'சர்வரை பூட்டுக (Logout)' : 'Lock Server & Exit'}
                  </span>
                </button>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-stone-400 hover:text-white rounded-lg hover:bg-stone-800 transition-colors cursor-pointer text-sm font-semibold"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Auth Check via Server-Verified Username & Password */}
        {!isAuthenticated ? (
          <div className="p-8 sm:p-14 text-center max-w-md mx-auto space-y-6 my-auto">
            <div className="w-16 h-16 bg-amber-50 text-amber-800 rounded-2xl flex items-center justify-center mx-auto text-2xl border border-amber-200">
              🔒
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-bold text-stone-900">
                {language === 'ta' ? 'உரிமையாளர் சர்வர் உள்நுழைவு' : 'Owner Server Login'}
              </h3>
              <p className="text-xs text-stone-600 leading-relaxed">
                {language === 'ta'
                  ? 'முட்டை விலையை எல்லா போன்களிலும் மாற்றவும், ஆர்டர்களை நிர்வகிக்கவும் உங்கள் பயனர்பெயர் மற்றும் கடவுச்சொல்லை உள்ளிடவும்.'
                  : 'Enter your secret owner username and password to unlock live server control.'}
              </p>
            </div>

            <form onSubmit={handleLoginSubmit} className="space-y-4 text-left text-xs">
              {/* Username Input */}
              <div className="space-y-1.5">
                <label className="font-bold text-stone-700 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-stone-500" />
                  <span>{language === 'ta' ? 'பயனர்பெயர் (Username):' : 'Owner Username:'}</span>
                </label>
                <input
                  type="text"
                  autoComplete="off"
                  value={usernameInput}
                  onChange={(e) => {
                    setUsernameInput(e.target.value);
                    setAuthError('');
                  }}
                  placeholder="Enter Username"
                  className="w-full px-3.5 py-2.5 text-sm border border-stone-300 rounded-xl focus:outline-amber-700 bg-stone-50/70"
                />
              </div>

              {/* Password Input with Eye toggle */}
              <div className="space-y-1.5">
                <label className="font-bold text-stone-700 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-stone-500" />
                  <span>{language === 'ta' ? 'கடவுச்சொல் (Password):' : 'Owner Password:'}</span>
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
                    placeholder="Enter Password"
                    className="w-full pl-3.5 pr-10 py-2.5 text-sm border border-stone-300 rounded-xl focus:outline-amber-700 bg-stone-50/70"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 cursor-pointer p-1"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {authError && (
                <p className="text-rose-700 font-bold text-xs bg-rose-50 p-2.5 rounded-xl border border-rose-200">
                  ⚠️ {authError}
                </p>
              )}

              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full py-3.5 px-4 text-xs font-bold text-white bg-amber-800 hover:bg-amber-900 active:scale-98 disabled:opacity-50 rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
              >
                {isLoggingIn ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>{language === 'ta' ? 'சர்வர் சரிபார்க்கிறது...' : 'Verifying with Server...'}</span>
                  </>
                ) : (
                  <>
                    <Unlock className="w-4 h-4" />
                    <span>{language === 'ta' ? 'சர்வர் கட்டுப்பாட்டை திறக்க' : 'Unlock Server Console'}</span>
                  </>
                )}
              </button>
            </form>
          </div>
        ) : (
          /* Authenticated Dashboard View */
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Top Navigation Tabs */}
            <div className="px-5 border-b border-stone-200 flex items-center justify-between gap-4 bg-stone-50/70 overflow-x-auto">
              <div className="flex gap-2 py-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('rates')}
                  className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                    activeTab === 'rates'
                      ? 'bg-amber-800 text-white shadow-xs'
                      : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/50'
                  }`}
                >
                  <DollarSign className="w-3.5 h-3.5" />
                  <span>
                    {language === 'ta' ? 'இன்றைய முட்டை விலை மாற்ற (Live Rates)' : 'Daily Egg Rate Control'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('orders')}
                  className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                    activeTab === 'orders'
                      ? 'bg-amber-800 text-white shadow-xs'
                      : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/50'
                  }`}
                >
                  <Package className="w-3.5 h-3.5" />
                  <span>
                    {language === 'ta' ? 'ஆர்டர் பதிவுகள்' : 'Live Order Logs'} ({orders.length})
                  </span>
                  {pendingOrdersCount > 0 && (
                    <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.2 rounded-full tabular-nums">
                      {pendingOrdersCount}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('settings')}
                  className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                    activeTab === 'settings'
                      ? 'bg-amber-800 text-white shadow-xs'
                      : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/50'
                  }`}
                >
                  <SettingsIcon className="w-3.5 h-3.5" />
                  <span>
                    {language === 'ta' ? 'பண்ணை & ஜிபே QR அமைப்புகள்' : 'Farm & GPay QR Settings'}
                  </span>
                </button>
              </div>
            </div>

            {/* Tab Contents */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#faf8f5]">
              {/* 1. LIVE ORDERS & LOGS TAB */}
              {activeTab === 'orders' && (
                <div className="space-y-5">
                  {/* Summary Metrics */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-white border border-stone-200 rounded-xl p-3.5">
                      <div className="text-[11px] text-stone-500">Total Orders</div>
                      <div className="text-xl font-bold text-stone-900 tabular-nums">{orders.length}</div>
                    </div>
                    <div className="bg-white border border-stone-200 rounded-xl p-3.5">
                      <div className="text-[11px] text-stone-500">Nattu Eggs Ordered</div>
                      <div className="text-xl font-bold text-amber-900 tabular-nums">{totalEggsToday} Eggs</div>
                    </div>
                    <div className="bg-white border border-stone-200 rounded-xl p-3.5">
                      <div className="text-[11px] text-stone-500">Total GPay Collection</div>
                      <div className="text-xl font-bold text-emerald-800 tabular-nums">₹{totalRevenueToday}</div>
                    </div>
                    <div className="bg-white border border-stone-200 rounded-xl p-3.5">
                      <div className="text-[11px] text-stone-500">Out for Delivery</div>
                      <div className="text-xl font-bold text-stone-900 tabular-nums">{outForDeliveryCount}</div>
                    </div>
                  </div>

                  {/* Filter and Search toolbar */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-1 p-1 bg-stone-100 rounded-lg overflow-x-auto">
                      {['all', 'pending_payment', 'confirmed_packing', 'out_for_delivery', 'delivered'].map((st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => setStatusFilter(st)}
                          className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all cursor-pointer whitespace-nowrap ${
                            statusFilter === st
                              ? 'bg-white text-stone-900 shadow-xs'
                              : 'text-stone-600 hover:text-stone-900'
                          }`}
                        >
                          {st === 'all' && 'All Orders'}
                          {st === 'pending_payment' && 'Pending'}
                          {st === 'confirmed_packing' && 'Packing'}
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
                        placeholder="Search customer, phone, ID..."
                        className="px-3 py-1.5 text-xs border border-stone-300 rounded-lg bg-white"
                      />
                      <button
                        type="button"
                        onClick={handleExportCSV}
                        className="px-2.5 py-1.5 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg flex items-center gap-1.5 cursor-pointer"
                        title="Download CSV"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">CSV</span>
                      </button>
                      <button
                        type="button"
                        onClick={handlePrint}
                        className="px-2.5 py-1.5 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg flex items-center gap-1.5 cursor-pointer"
                        title="Print Orders"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Print</span>
                      </button>
                    </div>
                  </div>

                  {/* Orders Cards List */}
                  {filteredOrders.length === 0 ? (
                    <div className="text-center py-12 text-stone-400 text-xs">
                      No orders found matching the filter criteria.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredOrders.map((order) => (
                        <div
                          key={order.id}
                          className="bg-white border border-stone-200 rounded-xl p-4 hover:border-stone-300 transition-all space-y-3"
                        >
                          {/* Row 1: Order ID, Timestamp & Amount */}
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 pb-2.5">
                            <div className="flex items-center gap-3">
                              <span className="font-mono font-bold text-sm text-stone-900">{order.id}</span>
                              <span className="text-xs text-stone-500">
                                {new Date(order.createdAt).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}{' '}
                                · {new Date(order.createdAt).toLocaleDateString()}
                              </span>
                              <span
                                className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                                  order.status === 'pending_payment'
                                    ? 'bg-amber-100 text-amber-900'
                                    : order.status === 'confirmed_packing'
                                    ? 'bg-blue-100 text-blue-900'
                                    : order.status === 'out_for_delivery'
                                    ? 'bg-purple-100 text-purple-900'
                                    : 'bg-emerald-100 text-emerald-900'
                                }`}
                              >
                                {order.status.replace('_', ' ').toUpperCase()}
                              </span>
                            </div>

                            <div className="text-right">
                              <span className="text-base font-bold text-stone-900 tabular-nums">
                                ₹{order.totalAmount}
                              </span>
                              <span className="text-xs text-stone-500 ml-2">
                                ({order.totalEggs} Nattu Kozhi eggs)
                              </span>
                            </div>
                          </div>

                          {/* Row 2: Customer Address & Items */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                            <div className="space-y-1">
                              <div className="font-semibold text-stone-800">
                                Customer: {order.customer.fullName} · {order.customer.phone}
                              </div>
                              <div className="text-stone-600 leading-relaxed">
                                {order.customer.address},{' '}
                                {order.customer.landmark ? `Near ${order.customer.landmark}, ` : ''}
                                {order.customer.area} - {order.customer.pincode}
                              </div>
                              <div className="text-stone-500">
                                Slot:{' '}
                                <span className="font-medium text-stone-700">{order.customer.deliverySlot}</span>
                              </div>
                              {order.customer.specialInstructions && (
                                <div className="text-amber-800 font-medium bg-amber-50/70 p-1.5 rounded">
                                  Note: {order.customer.specialInstructions}
                                </div>
                              )}
                            </div>

                            <div className="space-y-1.5 bg-stone-50 p-2.5 rounded-lg border border-stone-200/60">
                              <div className="font-semibold text-stone-700">Egg Items:</div>
                              {order.items.map((it, i) => (
                                <div key={i} className="flex justify-between text-stone-600">
                                  <span>
                                    {it.quantity}x {it.packName}
                                  </span>
                                  <span className="font-semibold tabular-nums">
                                    ₹{it.quantity * it.unitPrice}
                                  </span>
                                </div>
                              ))}
                              <div className="border-t border-stone-200/80 pt-1 text-[11px] text-stone-500 flex justify-between">
                                <span>Verified GPay UTR:</span>
                                <span className="font-mono font-bold text-emerald-800">
                                  {order.upiReferenceId || 'Pending'}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Row 3: Action Buttons */}
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-stone-100">
                            <div className="flex items-center gap-2">
                              <a
                                href={buildOwnerWhatsAppAlert(order, settings)}
                                target="_blank"
                                rel="noreferrer"
                                className="px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg flex items-center gap-1.5 transition-colors"
                              >
                                <Share2 className="w-3 h-3" />
                                <span>WhatsApp Farm Alert</span>
                              </a>
                              <a
                                href={`tel:${order.customer.phone}`}
                                className="px-3 py-1.5 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg flex items-center gap-1.5 transition-colors"
                              >
                                <Phone className="w-3 h-3" />
                                <span>Call Customer</span>
                              </a>
                            </div>

                            <div className="flex items-center gap-1.5">
                              {order.status === 'pending_payment' && (
                                <button
                                  type="button"
                                  onClick={() => onUpdateOrderStatus(order.id, 'confirmed_packing')}
                                  className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg cursor-pointer"
                                >
                                  ✓ Confirm Payment & Pack Trays
                                </button>
                              )}
                              {order.status === 'confirmed_packing' && (
                                <button
                                  type="button"
                                  onClick={() => setDispatchingOrderId(order.id)}
                                  className="px-3 py-1.5 text-xs font-semibold text-white bg-amber-800 hover:bg-amber-900 rounded-lg flex items-center gap-1 cursor-pointer"
                                >
                                  <Truck className="w-3 h-3" />
                                  <span>Dispatch with Rider</span>
                                </button>
                              )}
                              {order.status === 'out_for_delivery' && (
                                <button
                                  type="button"
                                  onClick={() => onUpdateOrderStatus(order.id, 'delivered')}
                                  className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg flex items-center gap-1 cursor-pointer"
                                >
                                  <CheckCircle className="w-3 h-3" />
                                  <span>Mark Delivered</span>
                                </button>
                              )}
                              {order.status === 'delivered' && (
                                <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
                                  <CheckCircle className="w-3.5 h-3.5" />
                                  <span>Delivery Complete</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 2. DAILY NATTU KOZHI RATE & STOCK EDITOR TAB */}
              {activeTab === 'rates' && (
                <div className="space-y-6 max-w-2xl mx-auto">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-xs text-emerald-950 flex items-start gap-3">
                    <Server className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                    <div>
                      <strong className="font-bold text-sm">
                        {language === 'ta'
                          ? 'நிகழ்நேர சர்வர் விலை கட்டுப்பாடு (All-Device Server Sync)'
                          : 'Real-Time Server Price Sync Across All Devices'}
                      </strong>
                      <p className="mt-1 text-emerald-800">
                        {language === 'ta'
                          ? 'இங்கே நீங்கள் மாற்றும் முட்டை விலை நேரடியாக சர்வரில் சேமிக்கப்பட்டு, மற்ற எல்லா போன்கள் மற்றும் கம்ப்யூட்டர்களிலும் உடனடியாக மாறிவிடும்!'
                          : 'Any rate changes saved here are immediately published to the central server and synced across all customer phones and browsers in real time!'}
                      </p>
                    </div>
                  </div>

                  <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-5">
                    {/* In-Stock Toggle */}
                    <div className="flex items-center justify-between pb-4 border-b border-stone-100">
                      <div>
                        <div className="text-sm font-bold text-stone-900">Farm Stock Availability</div>
                        <div className="text-xs text-stone-500">
                          Toggle whether fresh country eggs are available today
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setTempRates({ ...tempRates, inStock: !tempRates.inStock })}
                        className={`px-4 py-2 text-xs font-bold rounded-xl cursor-pointer transition-colors ${
                          tempRates.inStock
                            ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                            : 'bg-rose-100 text-rose-900 border border-rose-300'
                        }`}
                      >
                        {tempRates.inStock ? 'IN STOCK (விற்பனை நடைபெறுகிறது)' : 'SOLD OUT (இருப்பு முடிந்தது)'}
                      </button>
                    </div>

                    {/* Price Inputs Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div className="space-y-1">
                        <label className="font-bold text-stone-700">
                          Price per Single Nattu Kozhi Egg (₹) *
                        </label>
                        <input
                          type="number"
                          step="0.5"
                          value={tempRates.pricePerEgg}
                          onChange={(e) =>
                            setTempRates({ ...tempRates, pricePerEgg: parseFloat(e.target.value) || 0 })
                          }
                          className="w-full px-3 py-2.5 text-base font-bold text-stone-900 border border-stone-300 rounded-xl focus:outline-amber-700"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="font-bold text-amber-900">
                          30-Egg Tray Rate (₹) * [Best Value]
                        </label>
                        <input
                          type="number"
                          step="1"
                          value={tempRates.tray30Price}
                          onChange={(e) =>
                            setTempRates({ ...tempRates, tray30Price: parseInt(e.target.value) || 0 })
                          }
                          className="w-full px-3 py-2.5 text-base font-bold text-amber-900 border border-amber-300 rounded-xl focus:outline-amber-700 bg-amber-50/50"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="font-semibold text-stone-700">12-Egg Box Rate (₹)</label>
                        <input
                          type="number"
                          step="1"
                          value={tempRates.pack12Price}
                          onChange={(e) =>
                            setTempRates({ ...tempRates, pack12Price: parseInt(e.target.value) || 0 })
                          }
                          className="w-full px-3 py-2 text-sm font-bold border border-stone-300 rounded-xl"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="font-semibold text-stone-700">60-Egg Double Tray Rate (₹)</label>
                        <input
                          type="number"
                          step="5"
                          value={tempRates.doubleTray60Price}
                          onChange={(e) =>
                            setTempRates({
                              ...tempRates,
                              doubleTray60Price: parseInt(e.target.value) || 0,
                            })
                          }
                          className="w-full px-3 py-2 text-sm font-bold border border-stone-300 rounded-xl"
                        />
                      </div>

                      <div className="sm:col-span-2 space-y-1">
                        <label className="font-semibold text-stone-700">
                          100-Egg Wholesale Farm Crate (₹)
                        </label>
                        <input
                          type="number"
                          step="10"
                          value={tempRates.bulk100Price}
                          onChange={(e) =>
                            setTempRates({ ...tempRates, bulk100Price: parseInt(e.target.value) || 0 })
                          }
                          className="w-full px-3 py-2 text-sm font-bold border border-stone-300 rounded-xl"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-2 border-t border-stone-100">
                      <div className="space-y-1">
                        <label className="font-semibold text-stone-700">Today's Fresh Harvest Count</label>
                        <input
                          type="number"
                          value={tempRates.dailyHarvestCount}
                          onChange={(e) =>
                            setTempRates({
                              ...tempRates,
                              dailyHarvestCount: parseInt(e.target.value) || 0,
                            })
                          }
                          className="w-full px-3 py-2 border border-stone-300 rounded-xl font-bold"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="font-semibold text-stone-700">Harvest Timestamp Tag</label>
                        <input
                          type="text"
                          value={tempRates.harvestStamp}
                          onChange={(e) => setTempRates({ ...tempRates, harvestStamp: e.target.value })}
                          className="w-full px-3 py-2 border border-stone-300 rounded-xl"
                        />
                      </div>
                    </div>

                    {/* Save Button */}
                    <div className="flex items-center justify-end gap-3 pt-3">
                      {ratesSaved && (
                        <span className="text-emerald-700 font-bold flex items-center gap-1 text-xs">
                          <CheckCircle className="w-4 h-4" />
                          {language === 'ta'
                            ? 'சர்வரில் சேமிக்கப்பட்டது! எல்லா போன்களிலும் விலை மாறிவிட்டது!'
                            : 'Synced to Server! Live on all devices!'}
                        </span>
                      )}
                      <button
                        type="button"
                        disabled={isSavingRates}
                        onClick={async () => {
                          setIsSavingRates(true);
                          const ok = await onUpdateRates(tempRates);
                          setIsSavingRates(false);
                          if (ok) {
                            setRatesSaved(true);
                            setTimeout(() => setRatesSaved(false), 3500);
                          }
                        }}
                        className="px-6 py-2.5 text-xs font-bold text-white bg-amber-800 hover:bg-amber-900 active:scale-98 disabled:opacity-50 rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-2"
                      >
                        {isSavingRates && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                        <span>
                          {language === 'ta'
                            ? 'சர்வரில் விலையை புதுப்பிக்க (Publish to All Devices)'
                            : "Publish Today's Rates to Server"}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* 3. SETTINGS & GPAY TAB */}
              {activeTab === 'settings' && (
                <div className="space-y-6 max-w-2xl mx-auto text-xs">
                  <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-4">
                    <h4 className="text-sm font-bold text-stone-900 border-b border-stone-100 pb-2">
                      GPay / UPI Payment QR Code Settings
                    </h4>

                    <div className="space-y-1">
                      <label className="font-bold text-stone-700">Owner GPay / UPI ID (VPA) *</label>
                      <input
                        type="text"
                        value={tempSettings.gpayUpiId}
                        onChange={(e) => setTempSettings({ ...tempSettings, gpayUpiId: e.target.value })}
                        placeholder="e.g. rajadharsan7777@okaxis"
                        className="w-full px-3 py-2.5 text-sm font-mono border border-stone-300 rounded-xl focus:outline-amber-700 bg-white"
                      />
                      <p className="text-[11px] text-stone-500">
                        This UPI ID generates the scannable QR code on all customer devices for direct payment to your bank account.
                      </p>
                    </div>

                    <div className="space-y-1">
                      <label className="font-semibold text-stone-700">Display Payee Name on QR *</label>
                      <input
                        type="text"
                        value={tempSettings.gpayName}
                        onChange={(e) => setTempSettings({ ...tempSettings, gpayName: e.target.value })}
                        placeholder="e.g. Rehoboth Muttai Pannai"
                        className="w-full px-3 py-2 text-sm border border-stone-300 rounded-xl focus:outline-amber-700 bg-white"
                      />
                    </div>
                  </div>

                  <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-4">
                    <h4 className="text-sm font-bold text-stone-900 border-b border-stone-100 pb-2">
                      Farm Delivery & Operations
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="font-semibold text-stone-700">Owner Helpline Mobile</label>
                        <input
                          type="text"
                          value={tempSettings.ownerPhone}
                          onChange={(e) => setTempSettings({ ...tempSettings, ownerPhone: e.target.value })}
                          className="w-full px-3 py-2 text-sm border border-stone-300 rounded-xl"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="font-semibold text-stone-700">Standard Delivery Fee (₹)</label>
                        <input
                          type="number"
                          value={tempSettings.deliveryFee}
                          onChange={(e) =>
                            setTempSettings({
                              ...tempSettings,
                              deliveryFee: parseInt(e.target.value) || 0,
                            })
                          }
                          className="w-full px-3 py-2 text-sm border border-stone-300 rounded-xl"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="font-semibold text-stone-700">Free Delivery Above (₹)</label>
                        <input
                          type="number"
                          value={tempSettings.freeDeliveryThreshold}
                          onChange={(e) =>
                            setTempSettings({
                              ...tempSettings,
                              freeDeliveryThreshold: parseInt(e.target.value) || 0,
                            })
                          }
                          className="w-full px-3 py-2 text-sm border border-stone-300 rounded-xl"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="font-semibold text-stone-700">Farm Location</label>
                        <input
                          type="text"
                          value={tempSettings.farmLocation}
                          onChange={(e) =>
                            setTempSettings({ ...tempSettings, farmLocation: e.target.value })
                          }
                          className="w-full px-3 py-2 text-sm border border-stone-300 rounded-xl"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-2">
                    {settingsSaved && (
                      <span className="text-emerald-700 font-bold flex items-center gap-1 text-xs">
                        <CheckCircle className="w-4 h-4" />
                        Settings Synced to Server!
                      </span>
                    )}
                    <button
                      type="button"
                      disabled={isSavingSettings}
                      onClick={async () => {
                        setIsSavingSettings(true);
                        const ok = await onUpdateSettings(tempSettings);
                        setIsSavingSettings(false);
                        if (ok) {
                          setSettingsSaved(true);
                          setTimeout(() => setSettingsSaved(false), 3000);
                        }
                      }}
                      className="px-6 py-2.5 text-xs font-bold text-white bg-amber-800 hover:bg-amber-900 active:scale-98 disabled:opacity-50 rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-2"
                    >
                      {isSavingSettings && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                      <span>Save Farm Settings to Server</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal for dispatching rider assignment */}
        {dispatchingOrderId && (
          <div className="fixed inset-0 z-60 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full space-y-4 border border-stone-200 shadow-xl">
              <h4 className="font-bold text-stone-900 text-sm">
                Assign Delivery Rider for {dispatchingOrderId}
              </h4>
              <div className="space-y-3 text-xs">
                <div>
                  <label className="font-medium text-stone-700">Rider / Delivery Boy Name</label>
                  <input
                    type="text"
                    value={riderName}
                    onChange={(e) => setRiderName(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg mt-1"
                  />
                </div>
                <div>
                  <label className="font-medium text-stone-700">Rider Mobile Number</label>
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
                  className="px-4 py-1.5 text-xs font-bold text-white bg-amber-800 hover:bg-amber-900 rounded-lg cursor-pointer"
                >
                  Confirm Dispatch
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
