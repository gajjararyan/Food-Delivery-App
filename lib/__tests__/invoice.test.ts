import { buildInvoiceData, generateInvoiceNumber, invoiceHtmlDocument, isOrderPaid } from '../invoice';
import type { Order } from '../types';

function sampleOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    customer_id: '22222222-2222-4222-8222-222222222222',
    maker_id: '33333333-3333-4333-8333-333333333333',
    menu_item_id: '44444444-4444-4444-8444-444444444444',
    status: 'placed',
    meal_date: '2026-07-14',
    meal_slot: 'lunch',
    delivery_window: '13:00-13:15',
    subtotal: 149,
    credits_applied: 0,
    total: 149,
    razorpay_order_id: 'order_test123',
    razorpay_payment_id: 'pay_test456',
    thali_snapshot: {
      menuName: 'Gujarati Thali',
      kitchenName: 'Nani Geeta',
      basePrice: 149,
      swapCreditsApplied: 0,
      fulfillmentMode: 'takeaway',
      quantities: { comp1: 1 },
      payment: {
        invoiceNumber: 'GKS-20260714-11111111',
        paidAt: '2026-07-14T10:00:00.000Z',
        razorpayOrderId: 'order_test123',
        razorpayPaymentId: 'pay_test456',
        method: 'razorpay',
        status: 'paid',
      },
      components: [
        {
          id: 'comp1',
          menu_item_id: '44444444-4444-4444-8444-444444444444',
          name: 'Roti',
          serving_amount: 1,
          serving_unit: 'piece',
          included_qty: 1,
          min_qty: 1,
          max_qty: 4,
          unit_price_delta: 0,
          has_jain_variant: false,
          jain_substitute: null,
          sort_order: 0,
          component_type: 'included',
        },
      ],
    },
    created_at: '2026-07-14T09:00:00.000Z',
    updated_at: '2026-07-14T10:00:00.000Z',
    ...overrides,
  };
}

describe('invoice', () => {
  it('generates stable invoice numbers from order id', () => {
    expect(generateInvoiceNumber('11111111-1111-4111-8111-111111111111', '2026-07-14T09:00:00.000Z')).toBe(
      'GKS-20260714-11111111',
    );
  });

  it('builds invoice data with payment and line items', () => {
    const data = buildInvoiceData(sampleOrder(), { full_name: 'Audit User', phone: '+917043156067' });
    expect(data.invoiceNumber).toBe('GKS-20260714-11111111');
    expect(data.paymentStatus).toBe('Paid');
    expect(data.razorpayPaymentId).toBe('pay_test456');
    expect(data.customerName).toBe('Audit User');
    expect(data.grandTotal).toBe(149);
  });

  it('treats placed orders with payment snapshot as paid', () => {
    expect(isOrderPaid(sampleOrder())).toBe(true);
    expect(isOrderPaid(sampleOrder({ status: 'payment_pending' }))).toBe(false);
  });

  it('includes HTML document for print/download', () => {
    const html = invoiceHtmlDocument(buildInvoiceData(sampleOrder()));
    expect(html).toContain('GKS-20260714-11111111');
    expect(html).toContain('pay_test456');
  });
});
