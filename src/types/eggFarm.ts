export interface NattuKozhiRateSettings {
  pricePerEgg: number;
  tray30Price: number; // 30 eggs tray
  doubleTray60Price: number; // 60 eggs (2 trays)
  bulk100Price: number; // 100 eggs bulk carton
  pack12Price: number; // 12 eggs pack
  inStock: boolean;
  dailyHarvestCount: number;
  harvestStamp: string;
}

export type PackKey = 'pack_12' | 'tray_30' | 'tray_60' | 'bulk_100';

export interface NattuKozhiPack {
  key: PackKey;
  name: string;
  tamilName: string;
  eggCount: number;
  price: number;
  packagingType: string;
  badge?: string;
  bestFor: string;
  tamilBestFor: string;
  savingsText?: string;
}

export type OrderStatus = 'pending_payment' | 'confirmed_packing' | 'out_for_delivery' | 'delivered' | 'cancelled';

export interface CustomerDetails {
  fullName: string;
  phone: string;
  address: string;
  landmark: string;
  area: string;
  pincode: string;
  deliverySlot: string;
  specialInstructions?: string;
}

export interface OrderItem {
  packKey: PackKey;
  packName: string;
  eggCount: number;
  unitPrice: number;
  quantity: number;
  totalEggs: number;
}

export interface OrderRecord {
  id: string;
  createdAt: string;
  customer: CustomerDetails;
  items: OrderItem[];
  totalEggs: number;
  subtotal: number;
  deliveryFee: number;
  totalAmount: number;
  status: OrderStatus;
  paymentMethod: 'gpay_upi';
  upiReferenceId?: string;
  estimatedDelivery: string;
  assignedDeliveryBoy?: {
    name: string;
    phone: string;
  };
  notes?: string;
}

export interface FarmSettings {
  farmName: string;
  tamilFarmName: string;
  ownerName: string;
  ownerPhone: string;
  gpayUpiId: string;
  gpayName: string;
  deliveryFee: number;
  freeDeliveryThreshold: number;
  deliveryAreas: string;
  farmLocation: string;
  audioAlertEnabled: boolean;
}

export interface NotificationItem {
  id: string;
  orderId: string;
  customerName: string;
  totalAmount: number;
  totalEggs: number;
  timestamp: string;
  read: boolean;
}
