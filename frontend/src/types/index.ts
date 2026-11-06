export type OrderStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'PREPARING'
  | 'READY_FOR_PICKUP'
  | 'COURIER_ASSIGNED'
  | 'PICKED_UP'
  | 'DELIVERED'
  | 'REJECTED';

export interface Product {
  id: number;
  name: string;
  description?: string;
  price: number;
  image?: string;
  category: string;
  available: boolean;
}

export interface Courier {
  id: number;
  name: string;
  phone: string;
  availability_status: string;
}

export interface OrderItem {
  id: number;
  product_id: number;
  product_name: string;
  quantity: number;
  unit_price: number;
}

export interface Order {
  id: number;
  customer_name: string;
  customer_phone: string;
  delivery_address: string;
  delivery_instructions?: string;
  status: OrderStatus;
  total_price: number;
  courier_id?: number | null;
  courier?: Courier | null;
  items: OrderItem[];
  created_at: string;
  updated_at: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface OrderCreatePayload {
  customer_name: string;
  customer_phone: string;
  delivery_address: string;
  delivery_instructions?: string;
  items: {
    product_id: number;
    quantity: number;
  }[];
}

export interface Statistics {
  total_orders: number;
  pending_orders: number;
  active_orders: number;
  completed_orders: number;
  cancelled_orders: number;
  total_revenue: number;
}
