import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'gharkaswad_pending_checkout_v1';

export type PendingCheckoutProof = {
  orderId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
  savedAt: string;
};

async function readMap(): Promise<Record<string, PendingCheckoutProof>> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, PendingCheckoutProof>;
  } catch {
    return {};
  }
}

export async function savePendingCheckoutProof(proof: Omit<PendingCheckoutProof, 'savedAt'>): Promise<void> {
  const map = await readMap();
  map[proof.orderId] = { ...proof, savedAt: new Date().toISOString() };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export async function loadPendingCheckoutProof(orderId: string): Promise<PendingCheckoutProof | null> {
  const map = await readMap();
  return map[orderId] ?? null;
}

export async function clearPendingCheckoutProof(orderId: string): Promise<void> {
  const map = await readMap();
  delete map[orderId];
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}
