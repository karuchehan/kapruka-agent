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

export type ChatItemType = "user" | "agent" | "typing" | "skeleton" | "products";

export interface ChatItem {
  id: string;
  type: ChatItemType;
  text?: string;
  products?: Product[];
  checkoutUrl?: string;
}
