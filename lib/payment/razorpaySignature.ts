import crypto from 'node:crypto';

/** Razorpay payment signature: HMAC-SHA256 of `order_id|payment_id` with key secret. */
export function verifyRazorpayPaymentSignature(
  keySecret: string,
  razorpayOrderId: string,
  razorpayPaymentId: string,
  razorpaySignature: string,
): boolean {
  if (!keySecret || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    return false;
  }
  const expected = crypto
    .createHmac('sha256', keySecret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');
  return expected === razorpaySignature;
}
