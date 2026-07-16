export type Product = {
  id: string;
  slug: string;
  name: string;
  category: string;
  price: number;
  compareAt?: number;
  image: string;
  images: string[];
  color: string;
  rating: number;
  sold: number;
  tag?: string;
  description: string;
  material: string;
  care: string[];
  sizes: string[];
  stock: number;
  hasVariants: boolean;
  option1Name?: string;
  option2Name?: string;
  shopeeLink?: string;
  tiktokLink?: string;
  tokopediaLink?: string;
  variants: StoreVariant[];
};

export type StoreVariant = {
  id: string;
  sku: string;
  option1Value?: string;
  option2Value?: string;
  price: number;
  compareAt?: number;
  stock: number;
  weight: number;
  length?: number;
  width?: number;
  height?: number;
  imageKey?: string;
};

export type OrderStatus =
  | "awaiting_payment"
  | "awaiting_processing"
  | "processing"
  | "handover_pending"
  | "in_transit"
  | "delivered"
  | "completed"
  | "cancelled"
  | "finished";

export type AdminOrder = {
  number: string;
  customer: string;
  createdAt: string;
  total: number;
  payment: "paid" | "pending" | "refund_pending";
  fulfillment: OrderStatus;
  courier: string;
  sla: string;
  item: string;
  image: string;
  issueOrder?: boolean;
};
