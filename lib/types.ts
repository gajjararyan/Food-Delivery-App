/**
 * Domain types matching Supabase schema (Step 2).
 * Keep in sync with /supabase/migrations.
 */

export type Uuid = string;

export type MakerTier = 'unverified' | 'verified' | 'featured';

export type OrderStatus =
  | 'payment_pending'
  | 'placed'
  | 'accepted'
  | 'cooking'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled'
  | 'payment_failed';

export type DeliveryWindow = '13:00-13:15' | '19:00-19:15';

export type MealSlot = 'lunch' | 'dinner';

export type FulfillmentMode = 'takeaway' | 'delivery';

export type Profile = {
  id: Uuid;
  phone: string;
  full_name: string | null;
  email?: string | null;
  avatar_url: string | null;
  jain_preference: boolean;
  created_at: string;
  updated_at: string;
};

export type MakerProfile = {
  id: Uuid;
  display_name: string;
  kitchen_name: string;
  bio: string | null;
  photo_url: string | null;
  /** Kitchen banner on chef profile (local marketplace / pilot). */
  cover_url?: string | null;
  /** Full kitchen address from Google Maps / geocoder. */
  kitchen_address?: string | null;
  /** Kitchen latitude (WGS84) — used for delivery tracking & distance. */
  lat?: number | null;
  /** Kitchen longitude (WGS84). */
  lng?: number | null;
  tier: MakerTier;
  cuisine_tags: string[];
  rating_avg: number;
  rating_count: number;
  is_active: boolean;
  /** Chef toggle — false hides kitchen from Discover and blocks new orders. */
  is_open?: boolean;
  created_at: string;
};

export type MenuItem = {
  id: Uuid;
  maker_id: Uuid;
  name: string;
  description: string | null;
  image_url: string | null;
  base_price: number;
  meal_slot: MealSlot;
  is_available: boolean;
  has_jain_variant: boolean;
  created_at: string;
};

export type ThaliComponentType = 'included' | 'addon_toggle' | 'addon_stepper';

export type ServingUnit = import('./servingSize').ServingUnit;

export type ThaliComponent = {
  id: Uuid;
  menu_item_id: Uuid;
  name: string;
  /** Amount per serving (e.g. 400 gm, 500 ml, 1 piece). Defaults to 1 piece for legacy rows. */
  serving_amount: number;
  serving_unit: ServingUnit;
  included_qty: number;
  min_qty: number;
  max_qty: number;
  unit_price_delta: number;
  has_jain_variant: boolean;
  jain_substitute: string | null;
  sort_order: number;
  /** Defaults to `included` when unset (legacy data). */
  component_type?: ThaliComponentType;
};

export type SelectedQuantity = {
  componentId: Uuid;
  quantity: number;
};

/** In-memory cart snapshot — survives auth redirects; used until checkout. */
export type CartLine = {
  menuItemId: Uuid;
  makerId: Uuid;
  menuName: string;
  kitchenName: string;
  basePrice: number;
  /** Component snapshot at add-to-cart (ids + pricing + display names). */
  components: Pick<
    ThaliComponent,
    | 'id'
    | 'name'
    | 'serving_amount'
    | 'serving_unit'
    | 'included_qty'
    | 'min_qty'
    | 'max_qty'
    | 'unit_price_delta'
    | 'has_jain_variant'
    | 'jain_substitute'
    | 'component_type'
  >[];
  quantities: Record<Uuid, number>;
  applyJain: boolean;
  swapCreditsApplied: number;
  /** Lunch or dinner — set by chef on the menu item. */
  mealSlot: MealSlot;
  deliveryWindow: DeliveryWindow;
  /** Pick up at kitchen (₹0) or deliver nearby (₹/km). */
  fulfillmentMode: FulfillmentMode;
  /** Customer-entered delivery address. */
  deliveryAddress?: string;
  /** Distance from kitchen in km — used for delivery fees. */
  deliveryDistanceKm?: number;
  /** Delivery / pickup point coordinates (WGS84). */
  customerLat?: number;
  customerLng?: number;
  /** Reference to a saved address used for delivery, or the takeaway pickup point. */
  savedAddressId?: Uuid;
  /** Takeaway: who is collecting the order. */
  pickupIsSelf?: boolean;
  pickupContactName?: string;
  pickupLat?: number;
  pickupLng?: number;
  /**
   * Optional note for the kitchen (spice level, allergies, “no onion”, etc.).
   * Shown to the chef on the order card — kitchens try to honour it when possible.
   */
  cookingInstructions?: string;
  mealDate: string;
};

/** Saved delivery / pickup location for a customer. */
export type SavedAddress = {
  id: Uuid;
  customer_id: Uuid;
  label: string;
  lat: number;
  lng: number;
  formatted_hint: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

export type Subscription = {
  id: Uuid;
  customer_id: Uuid;
  maker_id: Uuid;
  menu_item_id: Uuid;
  plan_days: number;
  meal_slot: MealSlot;
  delivery_window: DeliveryWindow;
  status: 'active' | 'paused' | 'cancelled';
  paused_dates: string[];
  starts_on: string;
  ends_on: string | null;
  created_at: string;
};

export type Order = {
  id: Uuid;
  customer_id: Uuid;
  /** Present when order was placed with a phone (DEV_AUTH / pilot). */
  customer_phone?: string | null;
  maker_id: Uuid;
  menu_item_id: Uuid;
  status: OrderStatus;
  meal_date: string;
  meal_slot: MealSlot;
  delivery_window: DeliveryWindow;
  subtotal: number;
  credits_applied: number;
  total: number;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  /** 4-digit handoff code for takeaway orders. */
  pickup_pin?: string | null;
  thali_snapshot: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type Credit = {
  id: Uuid;
  customer_id: Uuid;
  amount: number;
  reason: string;
  order_id: Uuid | null;
  subscription_id: Uuid | null;
  created_at: string;
};

export type Review = {
  id: Uuid;
  customer_id: Uuid;
  order_id: Uuid;
  maker_id: Uuid;
  rating: number;
  comment: string | null;
  created_at: string;
};

export type ChefApplication = {
  id: Uuid;
  full_name: string;
  phone: string;
  city: string;
  cuisine_experience: string;
  message: string | null;
  status: 'new' | 'reviewing' | 'accepted' | 'rejected';
  created_at: string;
  /**
   * Client-side only: approval ran but kitchen publish/activation failed.
   * When set, UI must show "needs retry" — not a clean Accepted success.
   */
  activation_error?: string | null;
};
