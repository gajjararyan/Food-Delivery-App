import { legalConfig } from '../constants/legal/config';
import type { DeliveryFeeLine } from './delivery';
import type { Order } from './types';
import { orderFulfillmentMode } from './orderStatus';
import { formatInr } from './date';

export type OrderPaymentSnapshot = {
  invoiceNumber: string;
  paidAt: string;
  razorpayOrderId?: string | null;
  razorpayPaymentId?: string | null;
  method: 'razorpay' | 'credits' | 'sandbox' | 'local';
  status: 'paid' | 'pending' | 'failed';
};

export type InvoiceLine = {
  label: string;
  amount: number;
  emphasis?: boolean;
};

export type InvoiceData = {
  invoiceNumber: string;
  orderId: string;
  issuedAt: string;
  paidAt: string | null;
  companyName: string;
  companyAddress: string;
  gstNumber: string;
  supportEmail: string;
  customerName: string;
  customerPhone: string | null;
  customerEmail: string | null;
  billingAddress: string;
  kitchenName: string;
  menuName: string;
  mealDate: string;
  mealSlot: string;
  deliveryWindow: string;
  fulfillmentMode: string;
  itemLines: InvoiceLine[];
  creditsApplied: number;
  grandTotal: number;
  paymentMethod: string;
  paymentStatus: string;
  razorpayOrderId: string | null;
  razorpayPaymentId: string | null;
  orderStatus: string;
};

export function generateInvoiceNumber(orderId: string, createdAt?: string): string {
  const date = (createdAt ?? new Date().toISOString()).slice(0, 10).replace(/-/g, '');
  const short = orderId.replace(/-/g, '').slice(0, 8).toUpperCase();
  return `GKS-${date}-${short}`;
}

export function getOrderPaymentSnapshot(order: Order): OrderPaymentSnapshot | null {
  const raw = order.thali_snapshot?.payment;
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  const invoiceNumber =
    typeof p.invoiceNumber === 'string' ? p.invoiceNumber : generateInvoiceNumber(order.id, order.created_at);
  return {
    invoiceNumber,
    paidAt: typeof p.paidAt === 'string' ? p.paidAt : order.updated_at,
    razorpayOrderId:
      (typeof p.razorpayOrderId === 'string' ? p.razorpayOrderId : null) ?? order.razorpay_order_id,
    razorpayPaymentId:
      (typeof p.razorpayPaymentId === 'string' ? p.razorpayPaymentId : null) ?? order.razorpay_payment_id,
    method:
      p.method === 'razorpay' || p.method === 'credits' || p.method === 'sandbox' || p.method === 'local'
        ? p.method
        : order.razorpay_payment_id?.startsWith('pay_')
          ? 'razorpay'
          : order.razorpay_payment_id === 'credits_only'
            ? 'credits'
            : 'local',
    status:
      p.status === 'paid' || p.status === 'pending' || p.status === 'failed'
        ? p.status
        : order.status === 'payment_pending' || order.status === 'payment_failed'
          ? 'pending'
          : 'paid',
  };
}

export function buildPaymentSnapshotForOrder(
  order: Order,
  overrides?: Partial<OrderPaymentSnapshot>,
): OrderPaymentSnapshot {
  const existing = getOrderPaymentSnapshot(order);
  const paid =
    order.status !== 'payment_pending' &&
    order.status !== 'payment_failed' &&
    order.status !== 'cancelled';

  return {
    invoiceNumber: existing?.invoiceNumber ?? generateInvoiceNumber(order.id, order.created_at),
    paidAt: existing?.paidAt ?? (paid ? order.updated_at : new Date().toISOString()),
    razorpayOrderId: overrides?.razorpayOrderId ?? order.razorpay_order_id,
    razorpayPaymentId: overrides?.razorpayPaymentId ?? order.razorpay_payment_id,
    method:
      overrides?.method ??
      (order.razorpay_payment_id === 'credits_only'
        ? 'credits'
        : order.razorpay_payment_id?.startsWith('pay_')
          ? 'razorpay'
          : 'local'),
    status: overrides?.status ?? (paid ? 'paid' : 'pending'),
  };
}

function feeLinesFromSnapshot(order: Order): InvoiceLine[] {
  const breakdown = order.thali_snapshot?.deliveryFeeBreakdown as
    | { lines?: DeliveryFeeLine[] }
    | undefined;
  if (breakdown?.lines?.length) {
    return breakdown.lines.map((line) => ({ label: line.label, amount: line.amount }));
  }
  const deliveryFee = Number(order.thali_snapshot?.deliveryFee) || 0;
  if (deliveryFee > 0) {
    return [{ label: 'Delivery & platform charges', amount: deliveryFee }];
  }
  return [];
}

export function buildInvoiceData(
  order: Order,
  customer?: { full_name?: string | null; email?: string | null; phone?: string | null },
): InvoiceData {
  const payment = getOrderPaymentSnapshot(order) ?? buildPaymentSnapshotForOrder(order);
  const snap = order.thali_snapshot;
  const menuName = (typeof snap.menuName === 'string' ? snap.menuName : null) ?? 'Thali';
  const kitchenName = (typeof snap.kitchenName === 'string' ? snap.kitchenName : null) ?? 'Home kitchen';
  const customerName =
    (typeof snap.customerName === 'string' ? snap.customerName : null) ??
    customer?.full_name?.trim() ??
    'Customer';
  const billingAddress =
    (typeof snap.deliveryAddress === 'string' && snap.deliveryAddress.trim()) ||
    (orderFulfillmentMode(order) === 'takeaway'
      ? (typeof snap.kitchenAddress === 'string' ? snap.kitchenAddress : 'Pickup at kitchen')
      : 'Address on file');

  const itemLines: InvoiceLine[] = [
    { label: menuName, amount: Number(order.subtotal) || 0 },
    ...feeLinesFromSnapshot(order),
  ];

  if (order.credits_applied > 0) {
    itemLines.push({ label: 'Credits applied', amount: -order.credits_applied });
  }

  itemLines.push({ label: 'Total paid', amount: Number(order.total) || 0, emphasis: true });

  const methodLabel =
    payment.method === 'razorpay'
      ? 'Razorpay (UPI / Card / Netbanking)'
      : payment.method === 'credits'
        ? 'Wallet credits'
        : payment.method === 'sandbox'
          ? 'Sandbox (test)'
          : 'In-app';

  return {
    invoiceNumber: payment.invoiceNumber,
    orderId: order.id,
    issuedAt: order.created_at,
    paidAt: payment.status === 'paid' ? payment.paidAt : null,
    companyName: legalConfig.companyName,
    companyAddress: legalConfig.registeredAddress,
    gstNumber: legalConfig.gstNumber,
    supportEmail: legalConfig.supportEmail,
    customerName,
    customerPhone: customer?.phone ?? order.customer_phone ?? null,
    customerEmail: customer?.email ?? null,
    billingAddress,
    kitchenName,
    menuName,
    mealDate: order.meal_date,
    mealSlot: order.meal_slot,
    deliveryWindow: order.delivery_window,
    fulfillmentMode: orderFulfillmentMode(order) === 'delivery' ? 'Delivery' : 'Takeaway',
    itemLines,
    creditsApplied: Number(order.credits_applied) || 0,
    grandTotal: Number(order.total) || 0,
    paymentMethod: methodLabel,
    paymentStatus: payment.status === 'paid' ? 'Paid' : payment.status === 'failed' ? 'Failed' : 'Pending',
    razorpayOrderId: payment.razorpayOrderId ?? null,
    razorpayPaymentId: payment.razorpayPaymentId ?? null,
    orderStatus: order.status,
  };
}

export function invoiceHtmlDocument(data: InvoiceData): string {
  const rows = data.itemLines
    .map(
      (line) =>
        `<tr><td>${escapeHtml(line.label)}</td><td style="text-align:right;font-weight:${line.emphasis ? '700' : '400'}">${formatInr(line.amount)}</td></tr>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Invoice ${escapeHtml(data.invoiceNumber)}</title>
  <style>
    body { font-family: Georgia, 'Times New Roman', serif; color: #2c1810; margin: 32px; max-width: 720px; }
    h1 { font-size: 1.5rem; margin: 0 0 4px; color: #8b3a2a; }
    .muted { color: #6b5b54; font-size: 0.9rem; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    td { padding: 8px 0; border-bottom: 1px solid #e8ddd4; }
    .section { margin-top: 24px; }
    .label { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.06em; color: #8b3a2a; }
    @media print { body { margin: 16px; } }
  </style>
</head>
<body>
  <h1>${escapeHtml(data.companyName)}</h1>
  <p class="muted">${escapeHtml(data.companyAddress)}<br/>GSTIN: ${escapeHtml(data.gstNumber)}</p>
  <div class="section">
    <div class="label">Tax Invoice</div>
    <p><strong>${escapeHtml(data.invoiceNumber)}</strong></p>
    <p class="muted">Order ${escapeHtml(data.orderId)} · Issued ${escapeHtml(new Date(data.issuedAt).toLocaleString('en-IN'))}</p>
  </div>
  <div class="section">
    <div class="label">Bill to</div>
    <p>${escapeHtml(data.customerName)}<br/>${escapeHtml(data.billingAddress)}</p>
  </div>
  <div class="section">
    <div class="label">Order</div>
    <p>${escapeHtml(data.menuName)} from ${escapeHtml(data.kitchenName)}<br/>
    ${escapeHtml(data.mealDate)} · ${escapeHtml(data.mealSlot)} · ${escapeHtml(data.deliveryWindow)} · ${escapeHtml(data.fulfillmentMode)}</p>
  </div>
  <table>${rows}</table>
  <div class="section">
    <div class="label">Payment</div>
    <p>${escapeHtml(data.paymentMethod)} — <strong>${escapeHtml(data.paymentStatus)}</strong></p>
    ${data.razorpayOrderId ? `<p class="muted">Razorpay Order: ${escapeHtml(data.razorpayOrderId)}</p>` : ''}
    ${data.razorpayPaymentId ? `<p class="muted">Razorpay Payment: ${escapeHtml(data.razorpayPaymentId)}</p>` : ''}
    ${data.paidAt ? `<p class="muted">Paid at ${escapeHtml(new Date(data.paidAt).toLocaleString('en-IN'))}</p>` : ''}
  </div>
  <p class="muted">Questions? ${escapeHtml(data.supportEmail)}</p>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function isOrderPaid(order: Order): boolean {
  if (order.status === 'payment_pending' || order.status === 'payment_failed') return false;
  const payment = getOrderPaymentSnapshot(order);
  return payment?.status === 'paid' || order.status !== 'cancelled';
}
