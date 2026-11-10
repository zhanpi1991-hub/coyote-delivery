export type UserRole = 'customer' | 'staff' | 'admin' | 'courier';

export interface User {
  id: number;
  name: string;
  phone: string;
  role: UserRole;
  is_active: boolean;
  courier_id?: number | null;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface LoginPayload {
  phone: string;
  password: string;
}

export interface RegisterPayload {
  name: string;
  phone: string;
  password: string;
}

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
  phone?: string;
  availability_status: string;
  user_id?: number | null;
}

export interface OrderItem {
  id?: number;
  product_id?: number;
  product_name: string;
  quantity: number;
  unit_price: number;
}

export interface Order {
  id?: number;
  customer_id?: number | null;
  customer_name?: string;
  customer_phone?: string;
  delivery_address?: string;
  delivery_instructions?: string;
  status: OrderStatus;
  total_price: number;
  courier_id?: number | null;
  courier?: Courier | { name: string } | null;
  items: OrderItem[];
  tracking_token?: string;
  idempotency_key?: string;
  created_at: string;
  updated_at: string;
}

export interface OrderTrackResponse {
  tracking_token: string;
  status: OrderStatus;
  total_price: number;
  created_at: string;
  updated_at: string;
  items: OrderItem[];
  courier?: { name: string } | null;
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
  idempotency_key?: string;
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
