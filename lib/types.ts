export interface Product {
  id: string;
  name: string;
  price: number;
  image_url: string;
  url: string;
}

export interface ApiMessage {
  role: "user" | "assistant";
  content: string;
}

export interface UserProfile {
  name: string;
  age: number | null;
  gender: string;
}

export interface RecipientProfile {
  age: number | null;
  gender: string;
  relationship: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

// Externalized checkout/session state. Tracked on the client and injected into
// EVERY API call as a [STATE] block so the agent never has to infer cart,
// delivery, or checkout progress from conversation history alone (which broke
// down on long/ambiguous threads — the delivery-address loop bug).
export type CheckoutStage = "idle" | "collecting_address" | "address_confirmed" | "complete";

export interface ChatState {
  cartItems: { name: string; price: number }[]; // current cart contents
  cartCount: number;                             // total items in cart
  deliveryCity: string | null;                   // city confirmed by user, null if unknown
  checkoutStage: CheckoutStage;
  budgetStated: number | null;                   // budget the user mentioned, null if none
}

export interface DeliveryInfo {
  city: string;
  available: boolean;
  etaLabel: string; // e.g. "Friday, June 20"
}

export interface OccasionInfo {
  label: string;       // e.g. "Her birthday"
  targetDate: string;  // ISO date string
  emoji?: string;      // e.g. "🎂"
}

export interface GiftMessageInfo {
  prefill?: string;
}

export interface BundleInfo {
  title: string;
  items: Product[];
  total: number;
}

// Order tracking result, mapped server-side from the kapruka_track_order MCP
// response into a clean, display-ready shape. `found: false` is the graceful
// "no such order" case — the card renders a not-found state instead of a
// timeline. `stage` is the canonical 0–3 stepper index (Received → Preparing →
// Out for delivery → Delivered); -1 means cancelled.
export interface TrackingStep {
  step: string;
  timestamp: string;
}

export interface TrackingInfo {
  found: boolean;
  orderNumber: string;
  status: string;            // raw status token (delivered | shipped | ...)
  statusDisplay: string;     // human label
  stage: number;             // 0–3 canonical stepper index, -1 = cancelled
  orderDate?: string;
  deliveryDate?: string;
  amount?: string;           // formatted "LKR 26,060"
  recipientName?: string;
  recipientCity?: string;
  latestStep?: string;       // most recent progress note / comment
  progress: TrackingStep[];
}

export type ChatItemType =
  | "user"
  | "agent"
  | "typing"
  | "skeleton"
  | "products"
  | "delivery"
  | "tracking"
  | "occasion"
  | "giftMessage"
  | "bundle"
  | "checkout";

export interface ChatItem {
  id: string;
  type: ChatItemType;
  text?: string;
  products?: Product[];
  checkoutUrl?: string;
  delivery?: DeliveryInfo;
  tracking?: TrackingInfo;
  occasion?: OccasionInfo;
  giftMessage?: GiftMessageInfo;
  bundle?: BundleInfo;
}
