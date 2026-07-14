import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import { calculateCartTotals, normalizeCartLine } from '../lib/delivery';
import type { CartLine, DeliveryWindow, FulfillmentMode, Uuid } from '../lib/types';
import { calculateThaliPrice } from '../lib/pricing';
import { logger } from '../lib/logger';

const CART_LINE_KEY = 'gharkaswad_cart_line';
const PENDING_ORDER_KEY = 'gharkaswad_pending_order_id';

type CartContextValue = {
  line: CartLine | null;
  hydrated: boolean;
  setLine: (line: CartLine | null) => void;
  clearCart: () => void;
  updateQuantities: (quantities: Record<Uuid, number>) => void;
  setDeliveryWindow: (window: DeliveryWindow) => void;
  setFulfillmentMode: (mode: FulfillmentMode) => void;
  setDeliveryAddress: (address: string) => void;
  setDeliveryDistanceKm: (distanceKm: string) => void;
  setCookingInstructions: (note: string) => void;
  hasItems: boolean;
  lineTotal: number;
  pendingOrderId: Uuid | null;
  setPendingOrderId: (id: Uuid | null) => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: PropsWithChildren) {
  const [line, setLineState] = useState<CartLine | null>(null);
  const [pendingOrderId, setPendingOrderIdState] = useState<Uuid | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [storedLine, storedPending] = await Promise.all([
          AsyncStorage.getItem(CART_LINE_KEY),
          AsyncStorage.getItem(PENDING_ORDER_KEY),
        ]);
        if (!mounted) return;
        if (storedLine) setLineState(normalizeCartLine(JSON.parse(storedLine) as CartLine));
        if (storedPending) setPendingOrderIdState(storedPending);
      } catch (cause) {
        logger.warn('cart hydrate failed', cause);
      } finally {
        if (mounted) setHydrated(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const persistLine = useCallback((next: CartLine | null) => {
    setLineState(next);
    void (next
      ? AsyncStorage.setItem(CART_LINE_KEY, JSON.stringify(next))
      : AsyncStorage.removeItem(CART_LINE_KEY));
  }, []);

  const setLine = useCallback(
    (next: CartLine | null) => {
      persistLine(next ? normalizeCartLine(next) : null);
    },
    [persistLine],
  );

  const setPendingOrderId = useCallback((id: Uuid | null) => {
    setPendingOrderIdState(id);
    void (id
      ? AsyncStorage.setItem(PENDING_ORDER_KEY, id)
      : AsyncStorage.removeItem(PENDING_ORDER_KEY));
  }, []);

  const clearCart = useCallback(() => {
    setLine(null);
    setPendingOrderId(null);
  }, [setLine, setPendingOrderId]);

  const updateQuantities = useCallback((quantities: Record<Uuid, number>) => {
    setLineState((prev) => {
      if (!prev) return prev;
      const next = { ...prev, quantities };
      void AsyncStorage.setItem(CART_LINE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const setDeliveryWindow = useCallback((deliveryWindow: DeliveryWindow) => {
    setLineState((prev) => {
      if (!prev) return prev;
      const next = { ...prev, deliveryWindow };
      void AsyncStorage.setItem(CART_LINE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const setFulfillmentMode = useCallback((fulfillmentMode: FulfillmentMode) => {
    setLineState((prev) => {
      if (!prev) return prev;
      const next = { ...prev, fulfillmentMode };
      void AsyncStorage.setItem(CART_LINE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const setDeliveryAddress = useCallback((deliveryAddress: string) => {
    setLineState((prev) => {
      if (!prev) return prev;
      const next = { ...prev, deliveryAddress };
      void AsyncStorage.setItem(CART_LINE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const setDeliveryDistanceKm = useCallback((distanceKm: string) => {
    setLineState((prev) => {
      if (!prev) return prev;
      const parsed = Number(distanceKm);
      const next = {
        ...prev,
        deliveryDistanceKm:
          distanceKm.trim() === '' || Number.isNaN(parsed)
            ? undefined
            : Math.round(parsed * 10) / 10,
      };
      void AsyncStorage.setItem(CART_LINE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const setCookingInstructions = useCallback((note: string) => {
    setLineState((prev) => {
      if (!prev) return prev;
      const trimmed = note.slice(0, 200);
      const next = {
        ...prev,
        cookingInstructions: trimmed.trim() ? trimmed : undefined,
      };
      void AsyncStorage.setItem(CART_LINE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const lineTotal = useMemo(() => {
    if (!line) return 0;
    const itemTotal = calculateThaliPrice(
      line.basePrice,
      line.components,
      line.quantities,
      line.swapCreditsApplied,
    ).finalPrice;
    return calculateCartTotals(line, itemTotal).grandTotal;
  }, [line]);

  const value = useMemo(
    () => ({
      line,
      hydrated,
      setLine,
      clearCart,
      updateQuantities,
      setDeliveryWindow,
      setFulfillmentMode,
      setDeliveryAddress,
      setDeliveryDistanceKm,
      setCookingInstructions,
      hasItems: Boolean(line),
      lineTotal,
      pendingOrderId,
      setPendingOrderId,
    }),
    [
      line,
      hydrated,
      setLine,
      clearCart,
      updateQuantities,
      setDeliveryWindow,
      setFulfillmentMode,
      setDeliveryAddress,
      setDeliveryDistanceKm,
      setCookingInstructions,
      lineTotal,
      pendingOrderId,
      setPendingOrderId,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error('useCart must be used within CartProvider');
  }
  return ctx;
}
