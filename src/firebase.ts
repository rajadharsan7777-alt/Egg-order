import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { FarmSettings, NattuKozhiRateSettings, OrderRecord } from './types/eggFarm';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: boolean | string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validate connection to Firestore on boot
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

// Blueprint volumetric & regex constraints synchronized with firebase-blueprint.json
export const BLUEPRINT_CONSTRAINTS = {
  ID_REGEX: /^[a-zA-Z0-9_\-]+$/,
  FARM_NAME_MAX: 120,
  OWNER_NAME_MAX: 80,
  PHONE_MIN: 10,
  PHONE_MAX: 15,
  UPI_ID_MAX: 100,
  DELIVERY_AREAS_MAX: 300,
  FARM_LOCATION_MAX: 200,
  HARVEST_STAMP_MAX: 120,
  CUSTOMER_NAME_MAX: 100,
  ADDRESS_MAX: 300,
  LANDMARK_MAX: 150,
  AREA_MAX: 120,
  PINCODE_MAX: 12,
  SLOT_MAX: 100,
  UTR_MAX: 32,
};

function sanitizeString(val: string, maxLength: number, fallback = 'N/A'): string {
  const trimmed = (val || '').trim();
  if (!trimmed) return fallback.slice(0, maxLength);
  return trimmed.slice(0, maxLength);
}

/**
 * Syncs the current storefront rates & settings to Firestore `/storefront/main`
 * when the verified farm owner is signed into Firebase Auth.
 */
export async function syncStorefrontToFirestore(
  rates: NattuKozhiRateSettings,
  settings: FarmSettings
): Promise<void> {
  const user = auth.currentUser;
  if (!user || !user.emailVerified || user.email !== 'rajadharsan7777@gmail.com') {
    return;
  }

  const path = 'storefront/main';
  const ref = doc(db, 'storefront', 'main');

  try {
    const existingSnap = await getDoc(ref);
    const ownerId = existingSnap.exists()
      ? String(existingSnap.data().ownerId || user.uid)
      : user.uid;

    const payload = {
      configId: 'main',
      ownerId,
      farmName: sanitizeString(settings.farmName, BLUEPRINT_CONSTRAINTS.FARM_NAME_MAX, 'Rehoboth Muttai Pannai'),
      tamilFarmName: sanitizeString(settings.tamilFarmName, BLUEPRINT_CONSTRAINTS.FARM_NAME_MAX, 'ரெகோபோத் முட்டை பண்ணை'),
      ownerName: sanitizeString(settings.ownerName, BLUEPRINT_CONSTRAINTS.OWNER_NAME_MAX, 'Dharsan'),
      ownerPhone: sanitizeString(settings.ownerPhone, BLUEPRINT_CONSTRAINTS.PHONE_MAX, '0000000000'),
      gpayUpiId: sanitizeString(settings.gpayUpiId, BLUEPRINT_CONSTRAINTS.UPI_ID_MAX, 'rajadharsan7777@okaxis'),
      gpayName: sanitizeString(settings.gpayName, BLUEPRINT_CONSTRAINTS.UPI_ID_MAX, 'Rehoboth Muttai Pannai'),
      deliveryFee: Math.max(0, Math.min(5000, Number(settings.deliveryFee) || 0)),
      freeDeliveryThreshold: Math.max(0, Math.min(100000, Number(settings.freeDeliveryThreshold) || 0)),
      deliveryAreas: sanitizeString(settings.deliveryAreas, BLUEPRINT_CONSTRAINTS.DELIVERY_AREAS_MAX, 'Local Town'),
      farmLocation: sanitizeString(settings.farmLocation, BLUEPRINT_CONSTRAINTS.FARM_LOCATION_MAX, 'Tamil Nadu'),
      pricePerEgg: Math.max(1, Math.min(1000, Number(rates.pricePerEgg) || 12.5)),
      pack12Price: Math.max(1, Math.min(20000, Number(rates.pack12Price) || 150)),
      tray30Price: Math.max(1, Math.min(50000, Number(rates.tray30Price) || 350)),
      doubleTray60Price: Math.max(1, Math.min(100000, Number(rates.doubleTray60Price) || 680)),
      bulk100Price: Math.max(1, Math.min(200000, Number(rates.bulk100Price) || 1100)),
      inStock: Boolean(rates.inStock),
      dailyHarvestCount: Math.max(0, Math.min(1000000, Number(rates.dailyHarvestCount) || 0)),
      harvestStamp: sanitizeString(rates.harvestStamp, BLUEPRINT_CONSTRAINTS.HARVEST_STAMP_MAX, 'Laid Today Morning'),
      updatedAt: serverTimestamp(),
    };

    await setDoc(ref, payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Syncs an order record to Firestore `/orders/{orderId}` when the verified user/admin is signed in.
 */
export async function syncOrderToFirestore(order: OrderRecord): Promise<void> {
  const user = auth.currentUser;
  if (!user || !user.emailVerified) {
    return;
  }

  const safeOrderId = order.id.replace(/[^a-zA-Z0-9_\-]/g, '').slice(0, 64) || 'NK-1000';
  const path = `orders/${safeOrderId}`;
  const ref = doc(db, 'orders', safeOrderId);

  try {
    const existingSnap = await getDoc(ref);
    const firstItem = order.items[0] || {
      packKey: 'tray_30',
      packName: '30-Egg Country Tray',
      quantity: 1,
    };

    const payload = {
      orderId: safeOrderId,
      ownerId: existingSnap.exists() ? String(existingSnap.data().ownerId || user.uid) : user.uid,
      customerName: sanitizeString(order.customer.fullName, BLUEPRINT_CONSTRAINTS.CUSTOMER_NAME_MAX, 'Customer'),
      customerPhone: sanitizeString(order.customer.phone.replace(/\D/g, ''), BLUEPRINT_CONSTRAINTS.PHONE_MAX, '9999999999'),
      customerAddress: sanitizeString(order.customer.address, BLUEPRINT_CONSTRAINTS.ADDRESS_MAX, 'Address'),
      customerLandmark: (order.customer.landmark || '').trim().slice(0, BLUEPRINT_CONSTRAINTS.LANDMARK_MAX),
      customerArea: sanitizeString(order.customer.area, BLUEPRINT_CONSTRAINTS.AREA_MAX, 'Town'),
      customerPincode: (order.customer.pincode || '').trim().slice(0, BLUEPRINT_CONSTRAINTS.PINCODE_MAX),
      deliverySlot: sanitizeString(order.customer.deliverySlot, BLUEPRINT_CONSTRAINTS.SLOT_MAX, 'Morning Slot'),
      packKey: ['pack_12', 'tray_30', 'tray_60', 'bulk_100'].includes(firstItem.packKey)
        ? firstItem.packKey
        : 'tray_30',
      packName: sanitizeString(firstItem.packName, 120, '30-Egg Country Tray'),
      quantity: Math.max(1, Math.min(500, Number(firstItem.quantity) || 1)),
      totalEggs: Math.max(12, Math.min(50000, Number(order.totalEggs) || 30)),
      subtotal: Math.max(1, Math.min(5000000, Number(order.subtotal) || 350)),
      deliveryFee: Math.max(0, Math.min(5000, Number(order.deliveryFee) || 0)),
      totalAmount: Math.max(1, Math.min(5005000, Number(order.totalAmount) || 350)),
      status: existingSnap.exists() ? order.status : 'pending_payment',
      upiReferenceId: sanitizeString(order.upiReferenceId || 'VERIFIED1234', BLUEPRINT_CONSTRAINTS.UTR_MAX, 'VERIFIED1234'),
      estimatedDelivery: sanitizeString(order.estimatedDelivery, 120, 'Fresh morning harvest delivery'),
      riderName: (order.assignedDeliveryBoy?.name || '').trim().slice(0, 100),
      riderPhone: (order.assignedDeliveryBoy?.phone || '').trim().slice(0, 20),
      createdAt: existingSnap.exists() ? existingSnap.data().createdAt : serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await setDoc(ref, payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function signInOwnerWithGoogle() {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signOutOwnerGoogle() {
  await signOut(auth);
}
