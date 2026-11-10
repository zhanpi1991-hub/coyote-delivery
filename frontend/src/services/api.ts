import type {
  Product,
  Order,
  Courier,
  Statistics,
  OrderCreatePayload,
  OrderStatus,
  User,
  AuthResponse,
  LoginPayload,
  RegisterPayload,
  OrderTrackResponse,
} from '../types';

const API_BASE = '/api';

function getStoredToken(): string | null {
  try {
    return localStorage.getItem('coyote_auth_token');
  } catch {
    return null;
  }
}

function getStoredUser(): User | null {
  try {
    const raw = localStorage.getItem('coyote_auth_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setStoredAuth(token: string | null, user: User | null) {
  try {
    if (token) {
      localStorage.setItem('coyote_auth_token', token);
    } else {
      localStorage.removeItem('coyote_auth_token');
    }

    if (user) {
      localStorage.setItem('coyote_auth_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('coyote_auth_user');
    }
  } catch (err) {
    console.error('Failed to update local storage', err);
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    // If unauthorized or token expired, cleanly log out and notify UI
    if (res.status === 401 && token) {
      setStoredAuth(null, null);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('coyote:unauthorized'));
      }
    }

    let errorMsg = `Request failed (${res.status})`;
    try {
      const errData = await res.json();
      if (errData.detail) {
        errorMsg = typeof errData.detail === 'string' ? errData.detail : JSON.stringify(errData.detail);
      }
    } catch {
      // ignore JSON parse error
    }
    throw new Error(errorMsg);
  }

  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return res.json();
  }
  return {} as T;
}

export const api = {
  // Auth State Helpers
  getToken: getStoredToken,
  getCurrentUser: getStoredUser,
  logout: () => {
    setStoredAuth(null, null);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('coyote:unauthorized'));
    }
  },

  // Auth Endpoints
  async register(payload: RegisterPayload): Promise<AuthResponse> {
    const res = await request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setStoredAuth(res.access_token, res.user);
    return res;
  },

  async login(payload: LoginPayload): Promise<AuthResponse> {
    const res = await request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setStoredAuth(res.access_token, res.user);
    return res;
  },

  async getMe(): Promise<User> {
    const user = await request<User>('/auth/me');
    const token = getStoredToken();
    setStoredAuth(token, user);
    return user;
  },

  // Products
  async getProducts(category?: string): Promise<Product[]> {
    const url = category && category !== 'All'
      ? `/products?category=${encodeURIComponent(category)}`
      : '/products';
    return request<Product[]>(url);
  },

  async getProduct(id: number): Promise<Product> {
    return request<Product>(`/products/${id}`);
  },

  async adminCreateProduct(payload: Partial<Product>): Promise<Product> {
    return request<Product>('/admin/products', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async adminUpdateProduct(id: number, payload: Partial<Product>): Promise<Product> {
    return request<Product>(`/admin/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async adminDeleteProduct(id: number): Promise<{ message: string }> {
    return request<{ message: string }>(`/admin/products/${id}`, {
      method: 'DELETE',
    });
  },

  // Orders
  async createOrder(payload: OrderCreatePayload): Promise<Order> {
    return request<Order>('/orders', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async getOrder(id: number): Promise<Order> {
    return request<Order>(`/orders/${id}`);
  },

  async trackOrderByToken(trackingToken: string): Promise<OrderTrackResponse> {
    return request<OrderTrackResponse>(`/orders/track/${encodeURIComponent(trackingToken)}`);
  },

  async getMyOrders(): Promise<Order[]> {
    return request<Order[]>('/orders/my-orders');
  },

  async getOrders(status?: string): Promise<Order[]> {
    const url = status && status !== 'ALL'
      ? `/orders?status=${encodeURIComponent(status)}`
      : '/orders';
    return request<Order[]>(url);
  },

  async updateOrderStatus(id: number, status: OrderStatus, courierId?: number): Promise<Order> {
    return request<Order>(`/orders/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, courier_id: courierId }),
    });
  },

  async assignCourier(orderId: number, courierId: number): Promise<Order> {
    return request<Order>(`/orders/${orderId}/assign-courier`, {
      method: 'POST',
      body: JSON.stringify({ courier_id: courierId }),
    });
  },

  // Coffee Shop & Admin
  async getAdminOrders(status?: string): Promise<Order[]> {
    const url = status && status !== 'ALL'
      ? `/admin/orders?status=${encodeURIComponent(status)}`
      : '/admin/orders';
    return request<Order[]>(url);
  },

  async getAdminStatistics(): Promise<Statistics> {
    return request<Statistics>('/admin/statistics');
  },

  async getAdminUsers(role?: string): Promise<User[]> {
    const url = role ? `/admin/users?role=${encodeURIComponent(role)}` : '/admin/users';
    return request<User[]>(url);
  },

  async updateAdminUser(userId: number, update: Partial<User>): Promise<User> {
    return request<User>(`/admin/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(update),
    });
  },

  // Couriers
  async getCouriers(): Promise<Courier[]> {
    return request<Courier[]>('/couriers');
  },

  async adminCreateCourier(payload: { name: string; phone: string; password: string }): Promise<Courier> {
    return request<Courier>('/admin/couriers', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async getCourierOrders(): Promise<Order[]> {
    return request<Order[]>('/couriers/orders');
  },

  async courierAcceptOrder(orderId: number): Promise<Order> {
    return request<Order>(`/couriers/orders/${orderId}/accept`, {
      method: 'POST',
    });
  },

  async courierPickupOrder(orderId: number): Promise<Order> {
    return request<Order>(`/couriers/orders/${orderId}/pickup`, {
      method: 'POST',
    });
  },

  async courierDeliverOrder(orderId: number): Promise<Order> {
    return request<Order>(`/couriers/orders/${orderId}/deliver`, {
      method: 'POST',
    });
  },
};
