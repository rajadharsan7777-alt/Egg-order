import QRCode from 'qrcode';
import { OrderRecord, FarmSettings } from '../types/eggFarm';

/**
 * Builds standard NPCI UPI URI scheme compatible with Google Pay, PhonePe, Paytm, CRED, etc.
 */
export function buildUpiUri(params: {
  payeeVpa: string;
  payeeName: string;
  amount: number;
  transactionNote: string;
}): string {
  const vpa = params.payeeVpa.trim();
  const name = encodeURIComponent(params.payeeName.trim());
  const formattedAmount = params.amount.toFixed(2);
  const note = encodeURIComponent(params.transactionNote.trim());

  return `upi://pay?pa=${vpa}&pn=${name}&am=${formattedAmount}&cu=INR&tn=${note}`;
}

/**
 * Generates an SVG or PNG data URL for the UPI payment QR code.
 */
export async function generateUpiQrDataUrl(upiUri: string): Promise<string> {
  try {
    return await QRCode.toDataURL(upiUri, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 320,
      color: {
        dark: '#1c1917',
        light: '#ffffff',
      },
    });
  } catch {
    return '';
  }
}

/**
 * Validates that the customer entered a 12-digit UPI UTR / Reference number.
 */
export function validateStrictUpiUtr(
  rawUtr: string,
  language: 'en' | 'ta' = 'ta'
): { valid: boolean; cleanUtr: string; error?: string } {
  const cleanUtr = rawUtr.trim().replace(/\D/g, '');

  if (!/^\d{12}$/.test(cleanUtr)) {
    return {
      valid: false,
      cleanUtr,
      error:
        language === 'ta'
          ? 'தயவுசெய்து GPay / UPI கட்டணம் செலுத்திய பின் வரும் 12-இலக்க UTR எண்ணை உள்ளிடவும்.'
          : 'Please enter the 12-digit UPI Transaction ID / UTR number after completing payment.',
    };
  }

  return { valid: true, cleanUtr };
}

/**
 * Creates a pre-filled WhatsApp message for the farm owner.
 */
export function buildOwnerWhatsAppAlert(order: OrderRecord, _settings: FarmSettings): string {
  const itemsText = order.items
    .map(
      (i) =>
        `• ${i.quantity}x ${i.packName} (${i.quantity * i.eggCount} eggs) - ₹${i.quantity * i.unitPrice}`
    )
    .join('\n');

  const text = `🥚 *NEW NATTU KOZHI EGG ORDER!* (${order.id})
-----------------------------------
*Customer:* ${order.customer.fullName}
*Mobile:* ${order.customer.phone}
*Address:* ${order.customer.address}, ${order.customer.landmark ? 'Near ' + order.customer.landmark + ', ' : ''}${order.customer.area} - ${order.customer.pincode}
*Slot:* ${order.customer.deliverySlot}

*Items:*
${itemsText}

*Total Eggs:* ${order.totalEggs} Nattu Kozhi Eggs
*Subtotal:* ₹${order.subtotal}
*Delivery Fee:* ₹${order.deliveryFee === 0 ? 'FREE' : '₹' + order.deliveryFee}
*TOTAL AMOUNT:* ₹${order.totalAmount}
*Payment Method:* Direct GPay / UPI
*UPI Ref/UTR:* ${order.upiReferenceId || 'Pending verification'}
-----------------------------------`;

  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/**
 * Creates a pre-filled WhatsApp message for the customer with order receipt (NO owner phone number exposed).
 */
export function buildCustomerOrderShare(order: OrderRecord, settings: FarmSettings): string {
  const itemsText = order.items
    .map((i) => `• ${i.quantity}x ${i.packName} (₹${i.quantity * i.unitPrice})`)
    .join('\n');

  const isConfirmed =
    order.status === 'confirmed_packing' ||
    order.status === 'out_for_delivery' ||
    order.status === 'delivered';

  const statusHeading = isConfirmed ? 'ORDER CONFIRMED' : 'PAYMENT VERIFICATION PENDING';

  const text = `🥚 *${settings.farmName} - ${statusHeading}*
-----------------------------------
Hello ${order.customer.fullName}!
*Order ID:* ${order.id}
*Status:* ${order.status.replace('_', ' ').toUpperCase()}

*Your Fresh Eggs:*
${itemsText}
*Total Eggs:* ${order.totalEggs} eggs
*Amount:* ₹${order.totalAmount}
*UTR Ref:* ${order.upiReferenceId}
*Delivery Address:* ${order.customer.address}, ${order.customer.area}
*Delivery Slot:* ${order.customer.deliverySlot}
-----------------------------------`;

  const cleanPhone = order.customer.phone.replace(/\D/g, '');
  const targetPhone = cleanPhone.startsWith('91') ? cleanPhone : `91${cleanPhone}`;
  return `https://wa.me/${targetPhone}?text=${encodeURIComponent(text)}`;
}
