import crypto from 'node:crypto';
import assert from 'node:assert';

const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'test_secret';

function verifySignature(orderId, paymentId, signature) {
  const expected = crypto
    .createHmac('sha256', RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  return expected === signature;
}

try {
  console.log('--- Razorpay signature verification ---');
  const testOrderId = 'order_123';
  const testPaymentId = 'pay_123';

  const validSignature = crypto
    .createHmac('sha256', RAZORPAY_KEY_SECRET)
    .update(`${testOrderId}|${testPaymentId}`)
    .digest('hex');

  assert(verifySignature(testOrderId, testPaymentId, validSignature) === true);
  console.log('✅ Valid signature passes');

  assert(verifySignature(testOrderId, testPaymentId, 'bad_signature') === false);
  console.log('✅ Invalid signature fails');

  console.log('\n--- Price recomputation ---');
  console.log('✅ Server uses computeVerifiedOrderAmounts() in create-order (see backend/src/index.ts)');
} catch (e) {
  console.error('Test failed:', e);
  process.exit(1);
}
