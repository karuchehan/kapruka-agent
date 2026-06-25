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

export type ChatItemType =
  | "user"
  | "agent"
  | "typing"
  | "skeleton"
  | "products"
  | "delivery"
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
  occasion?: OccasionInfo;
  giftMessage?: GiftMessageInfo;
  bundle?: BundleInfo;
}
