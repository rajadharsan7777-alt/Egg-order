import React, { useState, useEffect } from 'react';
import {
  CustomerDetails,
  FarmSettings,
  NattuKozhiPack,
  NattuKozhiRateSettings,
  OrderItem,
  OrderRecord,
  OrderStatus,
  PackKey,
} from '../types/eggFarm';
import {
  buildUpiUri,
  generateUpiQrDataUrl,
  buildCustomerOrderShare,
  validateStrictUpiUtr,
} from '../utils/upi';
import { EggIllustration } from './EggIllustration';
import {
  Check,
  Plus,
  Minus,
  QrCode,
  ShieldCheck,
  Copy,
  Phone,
  MapPin,
  Clock,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Search,
  PackageCheck,
  Truck,
  CheckCircle2,
  Share2,
  AlertCircle,
  RefreshCw,
  Bell,
  Server,
} from 'lucide-react';

interface MeeshoStyleCheckoutProps {
  rates: NattuKozhiRateSettings;
  settings: FarmSettings;
  language: 'en' | 'ta';
  onOrderPlaced: (order: OrderRecord) => Promise<{ ok: boolean; error?: string; order?: OrderRecord }>;
  orders: OrderRecord[];
  isOwnerAuthenticated: boolean;
  onTrackOrderOnServer: (query: string) => Promise<OrderRecord | null>;
  onOpenAdmin: () => void;
  onOpenNotifications: () => void;
  unreadNotifications: number;
  onToggleLanguage: () => void;
  initialOrderId?: string;
}

type MeeshoStep = 'pack_select' | 'address' | 'payment' | 'tracking';

export const MeeshoStyleCheckout: React.FC<MeeshoStyleCheckoutProps> = ({
  rates,
  settings,
  language,
  onOrderPlaced,
  orders,
  isOwnerAuthenticated,
  onTrackOrderOnServer,
  onOpenAdmin,
  onOpenNotifications,
  unreadNotifications,
  onToggleLanguage,
  initialOrderId,
}) => {
  const [currentStep, setCurrentStep] = useState<MeeshoStep>(initialOrderId ? 'tracking' : 'pack_select');
  const [selectedPackKey, setSelectedPackKey] = useState<PackKey>('tray_30');
  const [quantity, setQuantity] = useState<number>(1);

  // Address form state (Meesho style)
  const [customer, setCustomer] = useState<CustomerDetails>({
    fullName: '',
    phone: '',
    address: '',
    landmark: '',
    area: '',
    pincode: '',
    deliverySlot: 'Morning Slot (7:30 AM - 10:30 AM)',
    specialInstructions: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [upiReference, setUpiReference] = useState<string>('');
  const [copiedUpi, setCopiedUpi] = useState<boolean>(false);
  const [confirmedOrder, setConfirmedOrder] = useState<OrderRecord | null>(null);

  // Strict payment verification states
  const [paymentError, setPaymentError] = useState<string>('');
  const [isVerifyingPayment, setIsVerifyingPayment] = useState<boolean>(false);
  const [paymentVerifiedSuccess, setPaymentVerifiedSuccess] = useState<boolean>(false);
  const [awaitingServerUtrOrder, setAwaitingServerUtrOrder] = useState<OrderRecord | null>(null);

  // Secret Owner Gesture (disabled on pure customer app)
  const [secretClickCount, setSecretClickCount] = useState<number>(0);

  // Tracking tab search state
  const [trackerSearchId, setTrackerSearchId] = useState<string>(initialOrderId || '');
  const [activeTrackedOrder, setActiveTrackedOrder] = useState<OrderRecord | null>(
    initialOrderId ? orders.find((o) => o.id === initialOrderId) || null : null
  );
  const [trackerNotFound, setTrackerNotFound] = useState<boolean>(false);

  useEffect(() => {
    if (initialOrderId) {
      const found = orders.find((o) => o.id === initialOrderId);
      if (found) {
        setActiveTrackedOrder(found);
        setTrackerSearchId(initialOrderId);
        setCurrentStep('tracking');
      }
    }
  }, [initialOrderId, orders]);

  // Nattu Kozhi Packs (6-EGG PACK COMPLETELY REMOVED AS REQUESTED)
  const packs: NattuKozhiPack[] = [
    {
      key: 'tray_30',
      name: '30-Egg Country Tray (பண்ணை டிரே)',
      tamilName: '30 முட்டை அட்டை டிரே (டிரே ஆஃபர்)',
      eggCount: 30,
      price: rates.tray30Price,
      packagingType: 'Shockproof Pulp Tray',
      badge: 'BEST SELLER · RECOMMENDED',
      bestFor: 'Family daily breakfast & nutrition for 2-3 weeks',
      tamilBestFor: 'குடும்பத்தின் 2-3 வார சத்தான காலை உணவுக்கு சிறந்தது',
      savingsText: `Save ₹${Math.round(rates.pricePerEgg * 30 - rates.tray30Price)} vs piece rate`,
    },
    {
      key: 'pack_12',
      name: '12-Egg Country Box (குடும்ப பெட்டி)',
      tamilName: '12 முட்டைகள் பெட்டி',
      eggCount: 12,
      price: rates.pack12Price,
      packagingType: 'Shockproof Box',
      bestFor: 'Weekly supply for small families & couples',
      tamilBestFor: 'ஒரு வார குடும்ப தேவைக்கு ஏற்றது',
    },
    {
      key: 'tray_60',
      name: '60-Egg Double Tray (2 டிரே)',
      tamilName: '60 முட்டைகள் (2 அட்டை டிரே)',
      eggCount: 60,
      price: rates.doubleTray60Price,
      packagingType: '2x Molded Pulp Trays',
      badge: 'EXTRA SAVINGS',
      bestFor: 'Gym athletes, protein diets & joint households',
      tamilBestFor: 'உடற்பயிற்சி செய்பவர்கள் மற்றும் பெரிய குடும்பங்களுக்கு',
      savingsText: `Save ₹${Math.round(rates.pricePerEgg * 60 - rates.doubleTray60Price)}`,
    },
    {
      key: 'bulk_100',
      name: '100-Egg Wholesale Crate (கிரேட்)',
      tamilName: '100 முட்டைகள் பண்ணை கிரேட்',
      eggCount: 100,
      price: rates.bulk100Price,
      packagingType: 'Heavy Crate',
      badge: 'WHOLESALE BULK',
      bestFor: 'Bakeries, catering & regular bulk consumers',
      tamilBestFor: 'பேக்கரி, உணவகங்கள் மற்றும் மொத்த கொள்முதலுக்கு',
      savingsText: `Save ₹${Math.round(rates.pricePerEgg * 100 - rates.bulk100Price)}`,
    },
  ];

  const activePack = packs.find((p) => p.key === selectedPackKey) || packs[0];
  const totalEggs = activePack.eggCount * quantity;
  const subtotal = activePack.price * quantity;
  const deliveryFee = subtotal >= settings.freeDeliveryThreshold ? 0 : settings.deliveryFee;
  const grandTotal = subtotal + deliveryFee;

  // Keyboard shortcut for owner: Ctrl + Shift + O
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'O' || e.key === 'o')) {
        e.preventDefault();
        onOpenAdmin();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onOpenAdmin]);

  // Generate UPI QR whenever entering payment step
  useEffect(() => {
    if (currentStep === 'payment' && grandTotal > 0) {
      const uri = buildUpiUri({
        payeeVpa: settings.gpayUpiId,
        payeeName: settings.gpayName,
        amount: grandTotal,
        transactionNote: `Nattu Kozhi ${totalEggs} Eggs`,
      });
      generateUpiQrDataUrl(uri).then((url) => setQrDataUrl(url));
    }
  }, [currentStep, grandTotal, settings.gpayUpiId, settings.gpayName, totalEggs]);

  const handleSecretChickenClick = () => {
    const nextCount = secretClickCount + 1;
    setSecretClickCount(nextCount);
    if (nextCount >= 5) {
      setSecretClickCount(0);
      onOpenAdmin();
    } else {
      setTimeout(() => setSecretClickCount(0), 2000);
    }
  };

  const validateAddress = () => {
    const errs: Record<string, string> = {};
    if (!customer.fullName.trim()) errs.fullName = 'Full Name is required';
    if (!customer.phone.trim() || customer.phone.replace(/\D/g, '').length < 10) {
      errs.phone = '10-digit mobile number is required';
    }
    if (!customer.address.trim()) errs.address = 'House/Door no & Street is required';
    if (!customer.area.trim()) errs.area = 'Town or Area name is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // DIRECT 12-DIGIT UTR ORDER CONFIRMATION HANDLER
  const handleVerifyAndConfirmPayment = async () => {
    setPaymentError('');

    const utrCheck = validateStrictUpiUtr(upiReference, language);
    if (!utrCheck.valid) {
      setPaymentError(
        utrCheck.error ||
          (language === 'ta'
            ? 'தயவுசெய்து GPay கட்டணம் செலுத்திய பின் வரும் 12-இலக்க UTR எண்ணை உள்ளிடவும்.'
            : 'Please enter the 12-digit UPI UTR number after completing payment.')
      );
      return;
    }

    setIsVerifyingPayment(true);

    const orderId = `NK-${Math.floor(1000 + Math.random() * 9000)}`;
    const orderItem: OrderItem = {
      packKey: activePack.key,
      packName: activePack.name,
      eggCount: activePack.eggCount,
      unitPrice: activePack.price,
      quantity,
      totalEggs,
    };

    const newOrder: OrderRecord = {
      id: orderId,
      createdAt: new Date().toISOString(),
      customer,
      items: [orderItem],
      totalEggs,
      subtotal,
      deliveryFee,
      totalAmount: grandTotal,
      status: 'confirmed_packing',
      paymentMethod: 'gpay_upi',
      upiReferenceId: utrCheck.cleanUtr,
      estimatedDelivery: 'Confirmed & Packing Fresh Country Eggs',
      notes: '12-digit GPay UTR submitted',
    };

    const result = await onOrderPlaced(newOrder);
    setIsVerifyingPayment(false);

    if (!result.ok) {
      setPaymentError(
        result.error ||
          (language === 'ta'
            ? 'சரியான 12-இலக்க UTR எண்ணை உள்ளிடவும்.'
            : 'Please enter a valid 12-digit UPI UTR.')
      );
      return;
    }

    const savedOrder: OrderRecord = {
      ...(result.order || newOrder),
      status: 'confirmed_packing',
    };

    // Immediately confirm order and transition to Order Confirmed / Tracking screen
    setPaymentVerifiedSuccess(true);
    setConfirmedOrder(savedOrder);
    setActiveTrackedOrder(savedOrder);
    setTrackerSearchId(savedOrder.id);
    setAwaitingServerUtrOrder(null);
    setCurrentStep('tracking');
    setTimeout(() => setPaymentVerifiedSuccess(false), 1500);
  };

  const copyUpiId = () => {
    navigator.clipboard.writeText(settings.gpayUpiId);
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2000);
  };

  const directUpiLink = buildUpiUri({
    payeeVpa: settings.gpayUpiId,
    payeeName: settings.gpayName,
    amount: grandTotal,
    transactionNote: 'Nattu Kozhi Farm Order',
  });

  const handleTrackerSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = trackerSearchId.trim();
    if (!query) return;

    const serverOrder = await onTrackOrderOnServer(query);
    if (serverOrder) {
      setActiveTrackedOrder(serverOrder);
      setTrackerNotFound(false);
      return;
    }

    const foundLocal = orders.find(
      (o) =>
        o.id.toLowerCase() === query.toLowerCase() ||
        o.customer.phone.replace(/\D/g, '').includes(query.replace(/\D/g, ''))
    );

    if (foundLocal) {
      setActiveTrackedOrder(foundLocal);
      setTrackerNotFound(false);
    } else {
      setTrackerNotFound(true);
    }
  };

  // Live poll tracked order status from server so customer sees rider dispatch & delivery updates automatically
  useEffect(() => {
    if (currentStep !== 'tracking' || !activeTrackedOrder?.id) return;
    const interval = setInterval(async () => {
      const updated = await onTrackOrderOnServer(activeTrackedOrder.id);
      if (updated) {
        setActiveTrackedOrder(updated);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [currentStep, activeTrackedOrder?.id, onTrackOrderOnServer]);

  return (
    <div className="w-full h-full flex flex-col bg-[#faf8f5] select-none text-stone-900">
      {/* 1. TOP HEADER (Meesho Style Header - OWNER BUTTON HIDDEN FROM PUBLIC) */}
      <header className="bg-white border-b border-stone-200 px-4 sm:px-6 py-3 flex items-center justify-between gap-4 shrink-0 shadow-xs z-20">
        {/* Brand Lockup - Clicking chicken 3 times unlocks secret owner portal */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSecretChickenClick}
            className="text-2xl cursor-pointer hover:scale-110 active:scale-95 transition-transform"
            title={settings.farmName}
          >
            🐓
          </button>
          <div>
            <div className="text-sm sm:text-base font-extrabold text-stone-900 leading-tight">
              {language === 'ta' ? settings.tamilFarmName : settings.farmName}
            </div>
            <div className="text-[10px] text-amber-900 font-semibold tracking-wide uppercase">
              100% Pure Country Chicken Eggs · Direct
            </div>
          </div>
        </div>

        {/* Meesho Step Indicator (Interactive Stepper) */}
        <div className="hidden md:flex items-center gap-2 text-xs font-semibold">
          {/* Step 1 */}
          <button
            type="button"
            onClick={() => setCurrentStep('pack_select')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-all cursor-pointer ${
              currentStep === 'pack_select'
                ? 'bg-amber-800 text-white font-bold'
                : 'text-stone-600 hover:text-stone-900 bg-stone-100'
            }`}
          >
            <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[10px]">1</span>
            <span>{language === 'ta' ? 'முட்டை தேர்வு' : 'Select Pack'}</span>
          </button>

          <span className="text-stone-300">›</span>

          {/* Step 2 */}
          <button
            type="button"
            onClick={() => setCurrentStep('address')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-all cursor-pointer ${
              currentStep === 'address'
                ? 'bg-amber-800 text-white font-bold'
                : 'text-stone-600 hover:text-stone-900 bg-stone-100'
            }`}
          >
            <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[10px]">2</span>
            <span>{language === 'ta' ? 'டெலிவரி முகவரி' : 'Delivery Address'}</span>
          </button>

          <span className="text-stone-300">›</span>

          {/* Step 3 */}
          <button
            type="button"
            onClick={() => {
              if (validateAddress()) setCurrentStep('payment');
              else setCurrentStep('address');
            }}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-all cursor-pointer ${
              currentStep === 'payment'
                ? 'bg-amber-800 text-white font-bold'
                : 'text-stone-600 hover:text-stone-900 bg-stone-100'
            }`}
          >
            <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[10px]">3</span>
            <span>{language === 'ta' ? 'ஜிபே கட்டணம்' : 'Payment (GPay QR)'}</span>
          </button>

          <span className="text-stone-300">›</span>

          {/* Step 4 */}
          <button
            type="button"
            onClick={() => setCurrentStep('tracking')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-all cursor-pointer ${
              currentStep === 'tracking'
                ? 'bg-amber-800 text-white font-bold'
                : 'text-stone-600 hover:text-stone-900 bg-stone-100'
            }`}
          >
            <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[10px]">4</span>
            <span>{language === 'ta' ? 'டிராக்கிங்' : 'Live Tracking'}</span>
          </button>
        </div>

        {/* Right Action: Language toggle only (Pure Customer App - Owner has a Separate Dedicated Server App) */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleLanguage}
            className="px-2.5 py-1 text-xs font-semibold text-stone-700 border border-stone-200 rounded-lg hover:border-stone-400 bg-white transition-colors cursor-pointer"
          >
            {language === 'en' ? 'தமிழ்' : 'English'}
          </button>
        </div>
      </header>

      {/* 2. MAIN 16:9 SCREEN BODY */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-5 flex flex-col justify-between">
        {/* STEP 1: PACK SELECTION (6-EGG PACK REMOVED) */}
        {currentStep === 'pack_select' && (
          <div className="h-full flex flex-col justify-between gap-4">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
              {/* Left Column: Authentic Nattu Kozhi Showcase */}
              <div className="lg:col-span-5 bg-white border border-stone-200 rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-xs">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-amber-900 tracking-wider uppercase bg-amber-50 border border-amber-200/80 px-2 py-0.5 rounded">
                      {rates.harvestStamp}
                    </span>
                    <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded">
                      {rates.inStock ? 'IN STOCK' : 'SOLD OUT'}
                    </span>
                  </div>

                  <div className="relative h-44 sm:h-52 w-full rounded-xl overflow-hidden bg-stone-50 border border-stone-100">
                    <EggIllustration type="nattu_kozhi" className="w-full h-full object-cover" />
                  </div>

                  <div>
                    <h2 className="text-lg sm:text-xl font-extrabold text-stone-900 leading-snug">
                      {language === 'ta'
                        ? 'அசல் நாட்டுக்கோழி பண்ணை முட்டை'
                        : 'Pure Country Chicken Farm Eggs'}
                    </h2>
                    <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                      {language === 'ta'
                        ? 'திறந்தவெளியில் மேய்ந்து இயற்கை தானியங்கள், மூலிகைகள் உண்டு வளர்ந்த நாட்டுக்கோழிகளின் முட்டைகள். அடர் மஞ்சள் கரு, அதிக சத்துக்கள்.'
                        : 'Free-range pasture raised country hens. Dense amber yolk, high natural protein, zero antibiotics or hormone injections.'}
                    </p>
                  </div>
                </div>

                {/* Today's Rate Bar */}
                <div className="mt-3 pt-3 border-t border-stone-100 flex items-center justify-between text-xs">
                  <div>
                    <div className="text-[10px] text-stone-500 uppercase">Single Egg Rate</div>
                    <div className="text-base font-extrabold text-stone-900 tabular-nums">
                      ₹{rates.pricePerEgg.toFixed(2)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-amber-800 font-bold uppercase">30 Tray Offer</div>
                    <div className="text-base font-extrabold text-amber-900 tabular-nums">
                      ₹{rates.tray30Price} (Save ₹{Math.round(rates.pricePerEgg * 30 - rates.tray30Price)})
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Pack Picker (30-Tray, 12-Box, 60-Tray, 100-Crate) */}
              <div className="lg:col-span-7 bg-white border border-stone-200 rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-xs">
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                    <div className="text-sm font-bold text-stone-900">
                      {language === 'ta' ? 'அளவு தேர்வு செய்க (Select Pack Size):' : 'Choose Your Pack Size:'}
                    </div>
                    <span className="text-[11px] text-stone-500">
                      Nested in safe shockproof trays
                    </span>
                  </div>

                  {/* Pack choices list */}
                  <div className="space-y-2.5">
                    {packs.map((pack) => {
                      const isSelected = selectedPackKey === pack.key;
                      return (
                        <div
                          key={pack.key}
                          onClick={() => setSelectedPackKey(pack.key)}
                          className={`p-3.5 rounded-xl border-2 transition-all cursor-pointer flex items-center justify-between gap-3 ${
                            isSelected
                              ? 'border-amber-800 bg-amber-50/50 shadow-xs'
                              : 'border-stone-200 bg-white hover:border-stone-300'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                                isSelected ? 'border-amber-800 bg-amber-800 text-white' : 'border-stone-300'
                              }`}
                            >
                              {isSelected && <Check className="w-3 h-3" />}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-stone-900 text-xs sm:text-sm">
                                  {language === 'ta' ? pack.tamilName : pack.name}
                                </span>
                                {pack.badge && (
                                  <span className="text-[9px] bg-amber-800 text-white font-extrabold px-1.5 py-0.2 rounded">
                                    {pack.badge}
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-stone-500">
                                {pack.eggCount} Country Eggs · {pack.packagingType}
                              </div>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <div className="text-base sm:text-lg font-black text-amber-950 tabular-nums">
                              ₹{pack.price}
                            </div>
                            {pack.savingsText && (
                              <div className="text-[10px] text-emerald-700 font-bold">
                                {pack.savingsText}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Quantity and Subtotal bar */}
                <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-semibold text-stone-700">Quantity:</span>
                    <div className="flex items-center border border-stone-300 rounded-lg bg-stone-50">
                      <button
                        type="button"
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                        disabled={quantity <= 1}
                        className="px-2.5 py-1 text-xs text-stone-600 hover:text-stone-900 disabled:opacity-30 cursor-pointer"
                      >
                        -
                      </button>
                      <span className="px-2 text-xs font-bold tabular-nums">{quantity}</span>
                      <button
                        type="button"
                        onClick={() => setQuantity(quantity + 1)}
                        className="px-2.5 py-1 text-xs text-stone-600 hover:text-stone-900 cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                    <span className="text-stone-500 text-[11px]">
                      ({totalEggs} Country Eggs total)
                    </span>
                  </div>

                  <div className="text-right">
                    <div className="text-xs text-stone-500">Item Total</div>
                    <div className="text-lg font-black text-stone-900 tabular-nums">₹{subtotal}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Checkout Strip */}
            <div className="bg-white border border-stone-200 rounded-2xl p-3 sm:p-4 flex items-center justify-between shadow-xs mt-2">
              <div className="flex items-center gap-4">
                <div>
                  <div className="text-xs text-stone-500">
                    Total: <strong className="text-stone-800">{totalEggs} Country Eggs</strong> ({quantity} {quantity === 1 ? 'pack' : 'packs'})
                  </div>
                  <div className="text-xl font-black text-amber-950 tabular-nums">
                    ₹{grandTotal}
                  </div>
                </div>
                <div className="hidden sm:block text-xs text-emerald-700 font-semibold bg-emerald-50 px-2.5 py-1 rounded-lg">
                  {deliveryFee === 0 ? '✓ Free Direct Farm Delivery' : `+ ₹${deliveryFee} Safe Pulp Delivery`}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setCurrentStep('address')}
                className="px-6 py-3 text-xs sm:text-sm font-bold text-white bg-amber-800 hover:bg-amber-900 active:scale-98 rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
              >
                <span>{language === 'ta' ? 'முகவரி உள்ளிட தொடர்க' : 'Continue to Delivery Address'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: DELIVERY ADDRESS FORM */}
        {currentStep === 'address' && (
          <div className="h-full flex flex-col justify-between gap-4">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch flex-1">
              {/* Left Column: Address Inputs */}
              <div className="lg:col-span-8 bg-white border border-stone-200 rounded-2xl p-4 sm:p-6 shadow-xs flex flex-col justify-between space-y-4">
                <div>
                  <div className="border-b border-stone-100 pb-3 flex items-center justify-between">
                    <div>
                      <h3 className="text-base sm:text-lg font-bold text-stone-900">
                        {language === 'ta' ? 'டெலிவரி முகவரி விவரங்கள்' : 'Enter Delivery Address'}
                      </h3>
                      <p className="text-xs text-stone-500">
                        {language === 'ta'
                          ? 'முட்டைகள் உடையாமல் கொண்டு சேர்க்க உங்கள் முழு முகவரியை தெளிவாக பதிவு செய்யவும்.'
                          : 'Please provide full address for safe, shockproof doorstep delivery.'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCurrentStep('pack_select')}
                      className="text-xs font-semibold text-stone-500 hover:text-stone-800 underline cursor-pointer"
                    >
                      Change Pack
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-4">
                    <div className="space-y-1">
                      <label className="font-bold text-stone-700">Full Customer Name *</label>
                      <input
                        type="text"
                        value={customer.fullName}
                        onChange={(e) => setCustomer({ ...customer, fullName: e.target.value })}
                        placeholder="e.g. Senthil Kumar"
                        className="w-full px-3 py-2 text-sm border border-stone-300 rounded-xl focus:outline-amber-700 bg-white"
                      />
                      {errors.fullName && <p className="text-rose-600 text-[11px]">{errors.fullName}</p>}
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-stone-700">WhatsApp Mobile Number *</label>
                      <input
                        type="tel"
                        value={customer.phone}
                        onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
                        placeholder="e.g. 9842112345"
                        className="w-full px-3 py-2 text-sm border border-stone-300 rounded-xl focus:outline-amber-700 bg-white"
                      />
                      {errors.phone && <p className="text-rose-600 text-[11px]">{errors.phone}</p>}
                    </div>

                    <div className="sm:col-span-2 space-y-1">
                      <label className="font-bold text-stone-700">Door No, Flat / Building & Street *</label>
                      <input
                        type="text"
                        value={customer.address}
                        onChange={(e) => setCustomer({ ...customer, address: e.target.value })}
                        placeholder="e.g. No 42, 3rd Cross, Kamaraj Street"
                        className="w-full px-3 py-2 text-sm border border-stone-300 rounded-xl focus:outline-amber-700 bg-white"
                      />
                      {errors.address && <p className="text-rose-600 text-[11px]">{errors.address}</p>}
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-stone-700">Town / Area / Colony *</label>
                      <input
                        type="text"
                        value={customer.area}
                        onChange={(e) => setCustomer({ ...customer, area: e.target.value })}
                        placeholder="e.g. Anna Nagar / Town"
                        className="w-full px-3 py-2 text-sm border border-stone-300 rounded-xl focus:outline-amber-700 bg-white"
                      />
                      {errors.area && <p className="text-rose-600 text-[11px]">{errors.area}</p>}
                    </div>

                    <div className="space-y-1">
                      <label className="font-semibold text-stone-700">Landmark (Optional)</label>
                      <input
                        type="text"
                        value={customer.landmark}
                        onChange={(e) => setCustomer({ ...customer, landmark: e.target.value })}
                        placeholder="Near Water Tank / Temple"
                        className="w-full px-3 py-2 text-sm border border-stone-300 rounded-xl focus:outline-amber-700 bg-white"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-semibold text-stone-700">Pincode</label>
                      <input
                        type="text"
                        value={customer.pincode}
                        onChange={(e) => setCustomer({ ...customer, pincode: e.target.value })}
                        placeholder="e.g. 641001"
                        className="w-full px-3 py-2 text-sm border border-stone-300 rounded-xl focus:outline-amber-700 bg-white"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-semibold text-stone-700">Preferred Delivery Slot</label>
                      <select
                        value={customer.deliverySlot}
                        onChange={(e) => setCustomer({ ...customer, deliverySlot: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-stone-300 rounded-xl focus:outline-amber-700 bg-white"
                      >
                        <option value="Morning Slot (7:30 AM - 10:30 AM)">Morning (7:30 AM - 10:30 AM) - Fresh Laid</option>
                        <option value="Afternoon Slot (12:00 PM - 3:00 PM)">Afternoon (12:00 PM - 3:00 PM)</option>
                        <option value="Evening Slot (4:30 PM - 7:30 PM)">Evening (4:30 PM - 7:30 PM)</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="pt-2 text-xs text-stone-500 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>
                    Your phone number is only used for rider dispatch and WhatsApp receipt.
                  </span>
                </div>
              </div>

              {/* Right Column: Price Details */}
              <div className="lg:col-span-4 bg-white border border-stone-200 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between">
                <div className="space-y-4 text-xs">
                  <h4 className="font-bold text-stone-900 border-b border-stone-100 pb-2 text-sm">
                    {language === 'ta' ? 'விலை விவரம் (Price Details)' : 'Order Price Summary'}
                  </h4>

                  <div className="space-y-2.5">
                    <div className="flex justify-between text-stone-600">
                      <span>Nattu Kozhi Pack:</span>
                      <span className="font-bold text-stone-900">{activePack.name}</span>
                    </div>
                    <div className="flex justify-between text-stone-600">
                      <span>Total Eggs:</span>
                      <span className="font-bold text-stone-900">{totalEggs} Country Eggs</span>
                    </div>
                    <div className="flex justify-between text-stone-600">
                      <span>Item Subtotal ({quantity} {quantity === 1 ? 'pack' : 'packs'}):</span>
                      <span className="font-bold text-stone-900 tabular-nums">₹{subtotal}</span>
                    </div>
                    <div className="flex justify-between text-stone-600">
                      <span>Safe Pulp Tray Delivery:</span>
                      <span className="font-bold tabular-nums">
                        {deliveryFee === 0 ? (
                          <span className="text-emerald-700">FREE</span>
                        ) : (
                          `₹${deliveryFee}`
                        )}
                      </span>
                    </div>

                    <div className="border-t border-stone-200 pt-3 flex justify-between text-base font-extrabold text-stone-900">
                      <span>Total Amount to Pay:</span>
                      <span className="text-amber-950 tabular-nums">₹{grandTotal}</span>
                    </div>
                  </div>

                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-200/80 text-amber-900 text-[11px] leading-relaxed">
                    Next screen will display your direct GPay QR code for payment. UTR entry is required to verify and place the order.
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="bg-white border border-stone-200 rounded-2xl p-3 sm:p-4 flex items-center justify-between shadow-xs mt-2">
              <button
                type="button"
                onClick={() => setCurrentStep('pack_select')}
                className="px-4 py-2.5 text-xs font-semibold text-stone-600 hover:text-stone-900 flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (validateAddress()) {
                    setCurrentStep('payment');
                  }
                }}
                className="px-6 py-3 text-xs sm:text-sm font-bold text-white bg-amber-800 hover:bg-amber-900 active:scale-98 rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
              >
                <span>{language === 'ta' ? 'ஜிபே QR கட்டணம் செலுத்த தொடர்க' : 'Proceed to Payment (GPay QR)'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: STRICT PAYMENT METHOD WITH MANDATORY UTR VERIFICATION */}
        {currentStep === 'payment' && (
          <div className="h-full flex flex-col justify-between gap-4">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch flex-1">
              {/* Left Column: QR Code & Payment Method */}
              <div className="lg:col-span-8 bg-white border border-stone-200 rounded-2xl p-4 sm:p-6 shadow-xs flex flex-col justify-between space-y-4 text-center sm:text-left">
                <div className="space-y-4">
                  <div className="border-b border-stone-100 pb-3 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                        {language === 'ta' ? 'பணம் செலுத்தும் முறை (Payment Method)' : 'Select Payment Option'}
                      </div>
                      <h3 className="text-base sm:text-lg font-bold text-stone-900">
                        {language === 'ta' ? 'ஜிபே (GPay / UPI) நேரடி QR ஸ்கேன்' : 'Google Pay / PhonePe UPI QR Code'}
                      </h3>
                    </div>
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md">
                      100% Secure Direct Farm VPA
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-center gap-6 py-1">
                    {/* Uploaded Official GPay QR Code Box (Cropped strictly to QR code only) */}
                    <div className="p-3 bg-white border border-stone-200 rounded-2xl shadow-xs shrink-0">
                      <svg
                        viewBox="235 455 970 970"
                        className="w-44 h-44 sm:w-48 sm:h-48 rounded-xl bg-white block"
                        role="img"
                        aria-label="GPay UPI QR Code"
                      >
                        <image
                          href="/assets/aistudio/GooglePay_QR_de0e6275.png"
                          width="1440"
                          height="2000"
                        />
                      </svg>
                    </div>

                    {/* QR Details & Action */}
                    <div className="space-y-3 text-xs text-left max-w-sm">
                      <div className="bg-stone-50 p-3 rounded-xl border border-stone-200 space-y-1">
                        <div className="text-[10px] text-stone-500 uppercase">Payee Name</div>
                        <div className="font-bold text-stone-900 text-sm">{settings.gpayName}</div>
                        <div className="text-[10px] text-stone-500 uppercase pt-1">GPay UPI ID</div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-amber-900 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            {settings.gpayUpiId}
                          </span>
                          <button
                            type="button"
                            onClick={copyUpiId}
                            className="p-1 text-stone-600 hover:text-stone-900 cursor-pointer"
                            title="Copy UPI ID"
                          >
                            {copiedUpi ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>

                      {/* Direct mobile tap link */}
                      <a
                        href={directUpiLink}
                        className="w-full py-2.5 px-3 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl transition-all flex items-center justify-center gap-2 shadow-xs"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>Tap to Pay via GPay / UPI App</span>
                      </a>
                    </div>
                  </div>

                  {/* 12-DIGIT UTR INPUT BOX */}
                  <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3 sm:p-4 text-xs space-y-2 text-left">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-stone-900 block">
                        {language === 'ta'
                          ? 'கட்டண பரிவர்த்தனை எண் (12-Digit UPI UTR / Transaction Ref ID) *:'
                          : '12-Digit UPI Ref No / UTR after completing payment *:'}
                      </label>
                      <span className="text-[10px] font-bold text-amber-900 uppercase">
                        12 Digits
                      </span>
                    </div>

                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={12}
                      value={upiReference}
                      onChange={(e) => {
                        const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 12);
                        setUpiReference(digitsOnly);
                        setPaymentError('');
                      }}
                      placeholder={
                        language === 'ta'
                          ? 'GPay ரசீதில் உள்ள 12-இலக்க UTR எண்ணை உள்ளிடவும்'
                          : 'Enter 12-digit UPI Transaction ID from GPay receipt'
                      }
                      className="w-full px-3 py-2.5 text-sm font-mono border border-stone-300 rounded-xl focus:outline-amber-700 bg-white tracking-wider"
                    />

                    {paymentError && (
                      <p className="text-rose-700 font-bold text-xs bg-rose-50 p-2.5 rounded-lg border border-rose-200 leading-relaxed">
                        {paymentError}
                      </p>
                    )}

                    <p className="text-[11px] text-stone-600">
                      {language === 'ta'
                        ? 'மேலே உள்ள GPay QR கோடை ஸ்கேன் செய்து பணம் செலுத்திய பின், ரசீதில் வரும் 12-இலக்க UTR எண்ணை உள்ளிட்டு ஆர்டரை உறுதி செய்யவும்.'
                        : 'Scan the GPay QR code above to pay, then enter your 12-digit UTR number to confirm your order.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Right Column: Amount Payable */}
              <div className="lg:col-span-4 bg-white border border-stone-200 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between">
                <div className="space-y-4 text-xs">
                  <h4 className="font-bold text-stone-900 border-b border-stone-100 pb-2 text-sm">
                    {language === 'ta' ? 'செலுத்த வேண்டிய தொகை' : 'Final Amount to Pay'}
                  </h4>

                  <div className="space-y-2">
                    <div className="flex justify-between text-stone-600">
                      <span>Customer:</span>
                      <span className="font-bold text-stone-900">{customer.fullName}</span>
                    </div>
                    <div className="flex justify-between text-stone-600">
                      <span>Delivery To:</span>
                      <span className="font-medium text-stone-800 truncate max-w-[150px]">{customer.area}</span>
                    </div>
                    <div className="flex justify-between text-stone-600">
                      <span>Items:</span>
                      <span className="font-bold text-stone-900">{totalEggs} Country Eggs</span>
                    </div>
                    <div className="border-t border-stone-200 pt-3 flex justify-between text-lg font-black text-amber-950">
                      <span>Total Payable:</span>
                      <span className="tabular-nums">₹{grandTotal}</span>
                    </div>
                  </div>

                  <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200/80 text-emerald-900 text-[11px] leading-relaxed">
                    {language === 'ta'
                      ? 'பணம் செலுத்தி 12-இலக்க UTR எண்ணை உள்ளிட்டவுடன் உங்கள் ஆர்டர் உடனடியாக உறுதி செய்யப்படும் (Order Confirmed).'
                      : 'Enter your 12-digit GPay UTR reference after payment to immediately confirm your order.'}
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Actions with Confirm Order Button */}
            <div className="bg-white border border-stone-200 rounded-2xl p-3 sm:p-4 flex items-center justify-between shadow-xs mt-2">
              <button
                type="button"
                onClick={() => {
                  setAwaitingServerUtrOrder(null);
                  setCurrentStep('address');
                }}
                className="px-4 py-2.5 text-xs font-semibold text-stone-600 hover:text-stone-900 flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Address</span>
              </button>

              <button
                type="button"
                disabled={isVerifyingPayment}
                onClick={handleVerifyAndConfirmPayment}
                className="px-6 py-3 text-xs sm:text-sm font-bold text-white bg-emerald-700 hover:bg-emerald-800 active:scale-98 disabled:opacity-60 rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
              >
                {isVerifyingPayment ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>
                      {language === 'ta' ? 'ஆர்டர் உறுதி செய்யப்படுகிறது...' : 'Confirming Order...'}
                    </span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>
                      {language === 'ta'
                        ? `ஆர்டரை உறுதி செய்க (₹${grandTotal})`
                        : `Confirm Order (₹${grandTotal})`}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: LIVE TRACKING & ORDER CONFIRMED */}
        {currentStep === 'tracking' && (
          <div className="h-full flex flex-col justify-between gap-4">
            <div className="bg-white border border-stone-200 rounded-2xl p-4 sm:p-6 shadow-xs flex-1 overflow-y-auto space-y-5">
              {/* Header with Search */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-4">
                <div>
                  <div className="text-xs font-bold text-amber-800 uppercase tracking-wider">
                    {language === 'ta' ? 'லைவ் ஆர்டர் டிராக்கிங்' : 'Live Order Delivery Tracking'}
                  </div>
                  <h3 className="text-lg font-bold text-stone-900">
                    {activeTrackedOrder ? `Order: ${activeTrackedOrder.id}` : 'Track Any Order'}
                  </h3>
                </div>

                {/* Search Bar */}
                <form onSubmit={handleTrackerSearch} className="flex gap-2">
                  <input
                    type="text"
                    value={trackerSearchId}
                    onChange={(e) => setTrackerSearchId(e.target.value)}
                    placeholder="Enter Order ID or Mobile..."
                    className="px-3 py-1.5 text-xs border border-stone-300 rounded-lg bg-stone-50"
                  />
                  <button
                    type="submit"
                    className="px-4 py-1.5 text-xs font-bold text-white bg-amber-800 hover:bg-amber-900 rounded-lg cursor-pointer"
                  >
                    Track
                  </button>
                </form>
              </div>

              {trackerNotFound && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-800 shrink-0" />
                  <span>No order found with this ID or mobile. Please check again.</span>
                </div>
              )}

              {/* Order Confirmed Banner */}
              {activeTrackedOrder && (
                <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl text-emerald-950 flex items-start gap-3">
                  <div className="p-2 bg-emerald-600 text-white rounded-xl shrink-0 mt-0.5">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div className="space-y-0.5">
                    <h4 className="text-sm font-bold text-emerald-900">
                      {language === 'ta'
                        ? '✅ ஆர்டர் உறுதி செய்யப்பட்டது (Order Confirmed)!'
                        : '✅ Order Confirmed!'}
                    </h4>
                    <p className="text-xs text-emerald-800 leading-relaxed">
                      {language === 'ta'
                        ? `உங்கள் ஆர்டர் (${activeTrackedOrder.id}) மற்றும் ஜிபே கட்டண விவரம் (UTR: ${activeTrackedOrder.upiReferenceId}) வெற்றிகரமாக பதிவு செய்யப்பட்டு ஆர்டர் உறுதி செய்யப்பட்டது!`
                        : `Your order (${activeTrackedOrder.id}) with GPay UTR (${activeTrackedOrder.upiReferenceId}) is confirmed! Fresh country eggs will be delivered safely.`}
                    </p>
                  </div>
                </div>
              )}

              {/* Empty Search Prompt if no order is active */}
              {!activeTrackedOrder && (
                <div className="py-12 px-4 text-center max-w-md mx-auto space-y-3">
                  <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto text-2xl border border-amber-200">
                    🔍
                  </div>
                  <h4 className="text-base font-bold text-stone-900">
                    {language === 'ta' ? 'ஆர்டர் நிலையை அறிய தேடவும்' : 'Search & Track Your Order'}
                  </h4>
                  <p className="text-xs text-stone-600">
                    {language === 'ta'
                      ? 'உங்கள் ஆர்டர் ஐடி அல்லது பதிவு செய்த மொபைல் எண்ணை மேலே உள்ள பெட்டியில் உள்ளிட்டு "Track" பட்டனை அழுத்தவும்.'
                      : 'Enter your Order ID (e.g. NK-1024) or mobile number above to track your fresh egg delivery.'}
                  </p>
                </div>
              )}

              {/* Active Tracked Order Timeline */}
              {activeTrackedOrder && (
                <div className="space-y-5">
                  {/* Summary Bar */}
                  <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 text-xs">
                    <div>
                      <div className="text-stone-500">Customer</div>
                      <div className="font-bold text-stone-900 text-sm">
                        {activeTrackedOrder.customer.fullName} ({activeTrackedOrder.customer.phone})
                      </div>
                      <div className="text-stone-600 mt-0.5">
                        {activeTrackedOrder.customer.address}, {activeTrackedOrder.customer.area}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-stone-500">Eggs & Total</div>
                      <div className="font-black text-amber-900 text-sm tabular-nums">
                        {activeTrackedOrder.totalEggs} Country Eggs · ₹{activeTrackedOrder.totalAmount}
                      </div>
                      <div className="text-emerald-700 font-semibold">
                        GPay UTR: {activeTrackedOrder.upiReferenceId}
                      </div>
                    </div>
                  </div>

                  {/* 4-Stage Stepper Pipeline */}
                  <div>
                    <div className="text-xs font-bold text-stone-700 mb-3">Live Delivery Status:</div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                      {/* Stage 1 */}
                      <div
                        className={`p-3 rounded-xl border ${
                          activeTrackedOrder.status === 'pending_payment'
                            ? 'bg-amber-50 border-amber-300 shadow-xs'
                            : 'bg-white border-stone-200'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Clock className="w-4 h-4 text-amber-800" />
                          <span className="font-bold text-stone-900">
                            {activeTrackedOrder.status === 'pending_payment'
                              ? '1. Verifying UTR'
                              : '1. Payment Verified'}
                          </span>
                        </div>
                        <p className="text-[11px] text-stone-500">
                          {activeTrackedOrder.status === 'pending_payment'
                            ? 'Checking GPay UTR on server'
                            : 'GPay UTR verified'}
                        </p>
                      </div>

                      {/* Stage 2 */}
                      <div
                        className={`p-3 rounded-xl border ${
                          activeTrackedOrder.status === 'confirmed_packing'
                            ? 'bg-blue-50 border-blue-300 shadow-xs'
                            : activeTrackedOrder.status === 'out_for_delivery' ||
                              activeTrackedOrder.status === 'delivered'
                            ? 'bg-white border-stone-200'
                            : 'bg-stone-50/50 opacity-60 border-stone-200'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <PackageCheck className="w-4 h-4 text-blue-700" />
                          <span className="font-bold text-stone-900">2. Order Confirmed & Packed</span>
                        </div>
                        <p className="text-[11px] text-stone-500">Tested in pulp trays</p>
                      </div>

                      {/* Stage 3 */}
                      <div
                        className={`p-3 rounded-xl border ${
                          activeTrackedOrder.status === 'out_for_delivery'
                            ? 'bg-purple-50 border-purple-300 shadow-xs'
                            : activeTrackedOrder.status === 'delivered'
                            ? 'bg-white border-stone-200'
                            : 'bg-stone-50/50 opacity-60 border-stone-200'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Truck className="w-4 h-4 text-purple-700" />
                          <span className="font-bold text-stone-900">3. Out for Delivery</span>
                        </div>
                        <p className="text-[11px] text-stone-500">
                          {activeTrackedOrder.assignedDeliveryBoy?.name || 'Rider dispatched'}
                        </p>
                      </div>

                      {/* Stage 4 */}
                      <div
                        className={`p-3 rounded-xl border ${
                          activeTrackedOrder.status === 'delivered'
                            ? 'bg-emerald-50 border-emerald-300 shadow-xs'
                            : 'bg-stone-50/50 opacity-60 border-stone-200'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                          <span className="font-bold text-stone-900">4. Delivered Fresh</span>
                        </div>
                        <p className="text-[11px] text-stone-500">Handed over safely</p>
                      </div>
                    </div>
                  </div>

                  {/* Clean footer without any helpline phone number */}
                  <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-stone-100 text-xs">
                    <div className="text-stone-600 font-medium">
                      {language === 'ta' ? settings.tamilFarmName : settings.farmName} · Direct Farm Delivery
                    </div>
                    <a
                      href={buildCustomerOrderShare(activeTrackedOrder, settings)}
                      target="_blank"
                      rel="noreferrer"
                      className="px-4 py-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 rounded-xl font-bold flex items-center gap-1.5 transition-colors"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>Share Receipt on WhatsApp</span>
                    </a>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Actions */}
            <div className="bg-white border border-stone-200 rounded-2xl p-3 sm:p-4 flex items-center justify-between shadow-xs mt-2">
              <button
                type="button"
                onClick={() => {
                  setCurrentStep('pack_select');
                  setQuantity(1);
                  setUpiReference('');
                  setPaymentError('');
                  setAwaitingServerUtrOrder(null);
                }}
                className="px-5 py-2.5 text-xs font-bold text-white bg-amber-800 hover:bg-amber-900 rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>{language === 'ta' ? 'புதிய முட்டை ஆர்டர் செய்ய' : 'Order More Eggs'}</span>
              </button>

              <div className="flex items-center gap-3 text-xs text-stone-500">
                <span>100% Pure Nattu Kozhi Eggs · Fresh Laid Daily</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
