import { Platform } from 'react-native';

export type RazorpayCheckoutOptions = {
  description: string;
  image?: string;
  currency: string;
  key: string;
  amount: number;
  name: string;
  order_id: string;
  prefill?: {
    email?: string;
    contact?: string;
    name?: string;
  };
  theme?: { color: string };
};

export type RazorpaySuccessResponse = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

/** Load the Razorpay checkout.js script once and resolve when ready. */
function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).Razorpay) {
      resolve();
      return;
    }
    const existing = document.querySelector(
      'script[src="https://checkout.razorpay.com/v1/checkout.js"]',
    );
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Razorpay SDK failed to load')));
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Razorpay SDK failed to load'));
    document.body.appendChild(script);
  });
}

export async function openRazorpayCheckout(
  options: RazorpayCheckoutOptions,
): Promise<RazorpaySuccessResponse> {
  if (Platform.OS === 'web') {
    await loadRazorpayScript();

    return new Promise((resolve, reject) => {
      // Track whether the outcome was already settled (success or failure)
      // so that modal.ondismiss can distinguish "user cancelled" from
      // "modal closed after payment failure".
      let settled = false;

      const rzp = new (window as any).Razorpay({
        ...options,
        modal: {
          // Don't show Razorpay's own "Payment Failed" alert dialog — we handle it ourselves.
          escape: false,
          ondismiss: () => {
            if (!settled) {
              settled = true;
              reject(new Error('USER_CANCELLED'));
            }
          },
        },
        handler: (response: RazorpaySuccessResponse) => {
          settled = true;
          resolve(response);
        },
      });

      rzp.on('payment.failed', (response: any) => {
        if (!settled) {
          settled = true;
          // Close the modal before rejecting so the dismissed handler
          // doesn't fire a spurious USER_CANCELLED on top of this.
          rzp.close();
          reject(new Error(response?.error?.description ?? 'Payment failed'));
        }
      });

      rzp.open();
    });
  }

  // Native (requires a development build — not compatible with Expo Go)
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const RazorpayCheckout = require('react-native-razorpay').default;
    const data = await RazorpayCheckout.open(options);
    return data as RazorpaySuccessResponse;
  } catch (error: any) {
    // react-native-razorpay uses code 2 for user-cancelled
    if (error?.code === 2) {
      throw new Error('USER_CANCELLED');
    }
    throw error;
  }
}
