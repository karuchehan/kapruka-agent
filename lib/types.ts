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
