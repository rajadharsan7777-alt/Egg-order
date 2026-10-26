import type { FarmSettings, NattuKozhiRateSettings, OrderRecord } from '../types/eggFarm.ts';

export const INITIAL_RATES: NattuKozhiRateSettings = {
  pricePerEgg: 12.5,
  pack12Price: 150,
  tray30Price: 350, // 30 egg tray
  doubleTray60Price: 680, // 60 eggs (2 trays)
  bulk100Price: 1100, // 100 eggs wholesale crate
  inStock: true,
  dailyHarvestCount: 450,
  harvestStamp: 'Laid Today, 05:30 AM Morning Harvest',
};

export const INITIAL_SETTINGS: FarmSettings = {
  farmName: 'Rehoboth Muttai Pannai',
  tamilFarmName: 'ரெகோபோத் முட்டை பண்ணை',
  ownerName: 'Dharsan',
  ownerPhone: '',
  gpayUpiId: 'rajadharsan2006@okicici',
  gpayName: 'Rehoboth Muttai Pannai',
  deliveryFee: 25,
  freeDeliveryThreshold: 350,
  deliveryAreas: 'Local Town, Bypass, Residential Areas & 15km Free Delivery Radius',
  farmLocation: 'Green Valley Country Poultry Farm, Tamil Nadu',
  audioAlertEnabled: true,
};

export const INITIAL_ORDERS: OrderRecord[] = [
  {
    id: 'NK-1024',
    createdAt: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
    customer: {
      fullName: 'Senthil Kumar',
      phone: '9842112345',
      address: 'Plot 42, 3rd Cross, Sri Ram Nagar',
      landmark: 'Near Water Tank',
      area: 'Anna Nagar',
      pincode: '641001',
      deliverySlot: 'Today Morning (7:30 AM - 10:30 AM)',
      specialInstructions: 'Pure country eggs for baby porridge. Handle safely.',
    },
    items: [
      {
        packKey: 'tray_30',
        packName: '30-Egg Country Tray (அட்டை டிரே)',
        eggCount: 30,
        unitPrice: 350,
        quantity: 1,
        totalEggs: 30,
      },
    ],
    totalEggs: 30,
    subtotal: 350,
    deliveryFee: 0,
    totalAmount: 350,
    status: 'out_for_delivery',
    paymentMethod: 'gpay_upi',
    upiReferenceId: 'UPI-430918239012',
    estimatedDelivery: 'Within 25 mins',
    assignedDeliveryBoy: {
      name: 'Murugan (Farm Express Rider)',
      phone: '9789012340',
    },
    notes: 'Payment verified on GPay. Pulp tray wrapped.',
  },
  {
    id: 'NK-1023',
    createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    customer: {
      fullName: 'Dr. Kavitha Mohan',
      phone: '9443298765',
      address: 'Flat 4B, Kaveri Towers, Trichy Road',
      landmark: 'Opposite Government Hospital',
      area: 'Town Centre',
      pincode: '641018',
      deliverySlot: 'Morning Slot (7:30 AM - 10:30 AM)',
      specialInstructions: 'Ring doorbell twice.',
    },
    items: [
      {
        packKey: 'tray_60',
        packName: '60 Eggs (2 Trays Family Pack)',
        eggCount: 60,
        unitPrice: 680,
        quantity: 1,
        totalEggs: 60,
      },
    ],
    totalEggs: 60,
    subtotal: 680,
    deliveryFee: 0,
    totalAmount: 680,
    status: 'confirmed_packing',
    paymentMethod: 'gpay_upi',
    upiReferenceId: 'GPAY-8891230491',
    estimatedDelivery: 'Today by 11:30 AM',
    notes: 'Trays candled and packed.',
  },
  {
    id: 'NK-1022',
    createdAt: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString(),
    customer: {
      fullName: 'Vetri Traditional Siddha Clinic',
      phone: '9894056789',
      address: 'No 18, South Car Street, Temple Gate',
      landmark: 'Near Pillaiyar Kovil',
      area: 'Bazaar Street',
      pincode: '641002',
      deliverySlot: 'Early Morning Fresh Dispatch',
    },
    items: [
      {
        packKey: 'bulk_100',
        packName: '100 Eggs Wholesale Farm Crate',
        eggCount: 100,
        unitPrice: 1100,
        quantity: 1,
        totalEggs: 100,
      },
    ],
    totalEggs: 100,
    subtotal: 1100,
    deliveryFee: 0,
    totalAmount: 1100,
    status: 'delivered',
    paymentMethod: 'gpay_upi',
    upiReferenceId: 'AXIS-5521908234',
    estimatedDelivery: 'Delivered Successfully',
    notes: 'Medicinal grade country eggs delivered.',
  },
];
