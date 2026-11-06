import type { Product, Order, Courier, Statistics, OrderCreatePayload, OrderStatus } from '../types';

const API_BASE = '/api';

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errorMsg = `Request failed with status ${res.status}`;
    try {
      const errData = await res.json();
      if (errData.detail) {
        errorMsg = typeof errData.detail === 'string' ? errData.detail : JSON.stringify(errData.detail);
      }
    } catch {
      // ignore json parse error
    }
    throw new Error(errorMsg);
  }
  return res.json();
}

export const api = {
  async getProducts(category?: string): Promise<Product[]> {
    const url = category && category !== 'All'
      ? `${API_BASE}/products?category=${encodeURIComponent(category)}`
      : `${API_BASE}/products`;
    const res = await fetch(url);
    return handleResponse<Product[]>(res);
  },

  async getProduct(id: number): Promise<Product> {
    const res = await fetch(`${API_BASE}/products/${id}`);
    return handleResponse<Product>(res);
  },

  async createOrder(payload: OrderCreatePayload): Promise<Order> {
    const res = await fetch(`${API_BASE}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse<Order>(res);
  },

  async getOrder(id: number): Promise<Order> {
    const res = await fetch(`${API_BASE}/orders/${id}`);
    return handleResponse<Order>(res);
  },

  async getOrders(status?: string): Promise<Order[]> {
    const url = status && status !== 'ALL'
      ? `${API_BASE}/orders?status=${encodeURIComponent(status)}`
      : `${API_BASE}/orders`;
    const res = await fetch(url);
    return handleResponse<Order[]>(res);
  },

  async updateOrderStatus(id: number, status: OrderStatus, courierId?: number): Promise<Order> {
    const res = await fetch(`${API_BASE}/orders/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, courier_id: courierId }),
    });
    return handleResponse<Order>(res);
  },

  async getAdminStatistics(): Promise<Statistics> {
    const res = await fetch(`${API_BASE}/admin/statistics`);
    return handleResponse<Statistics>(res);
  },

  async getCouriers(): Promise<Courier[]> {
    const res = await fetch(`${API_BASE}/couriers`);
    return handleResponse<Courier[]>(res);
  },

  async getCourierOrders(courierId?: number): Promise<Order[]> {
    const url = courierId
      ? `${API_BASE}/couriers/orders?courier_id=${courierId}`
      : `${API_BASE}/couriers/orders`;
    const res = await fetch(url);
    return handleResponse<Order[]>(res);
  },

  async courierAcceptOrder(orderId: number, courierId: number): Promise<Order> {
    const res = await fetch(`${API_BASE}/couriers/orders/${orderId}/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courier_id: courierId }),
    });
    return handleResponse<Order>(res);
  },

  async courierPickupOrder(orderId: number, courierId: number): Promise<Order> {
    const res = await fetch(`${API_BASE}/couriers/orders/${orderId}/pickup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courier_id: courierId }),
    });
    return handleResponse<Order>(res);
  },

  async courierDeliverOrder(orderId: number, courierId: number): Promise<Order> {
    const res = await fetch(`${API_BASE}/couriers/orders/${orderId}/deliver`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courier_id: courierId }),
    });
    return handleResponse<Order>(res);
  },
};
