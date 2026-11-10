import React, { useState, useEffect } from 'react';
import type { Order, OrderStatus, Statistics, Courier, Product, User } from '../types';
import { api } from '../services/api';
import {
  RefreshCw, CheckCircle2, XCircle, Clock, Coffee,
  PackageCheck, Bike, Phone, MapPin, DollarSign, Activity,
  Sliders, Plus, Trash2, Shield, Lock
} from 'lucide-react';

interface CoffeeShopDashboardProps {
  currentUser?: User | null;
  onOpenAuthModal?: () => void;
}

export const CoffeeShopDashboard: React.FC<CoffeeShopDashboardProps> = ({
  currentUser,
  onOpenAuthModal,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'orders' | 'products' | 'fleet'>('orders');
  const [orders, setOrders] = useState<Order[]>([]);
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [adminUsers, setAdminUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<Statistics | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Product modal / edit state
  const [newProductName, setNewProductName] = useState('');
  const [newProductCategory, setNewProductCategory] = useState('Hot Coffee');
  const [newProductPrice, setNewProductPrice] = useState('4.50');
  const [newProductDesc, setNewProductDesc] = useState('');
  const [isAddingProduct, setIsAddingProduct] = useState(false);

  // New courier form state
  const [newCourierName, setNewCourierName] = useState('');
  const [newCourierPhone, setNewCourierPhone] = useState('');
  const [isAddingCourier, setIsAddingCourier] = useState(false);

  const isStaffOrAdmin = currentUser && ['staff', 'admin'].includes(currentUser.role);
  const isAdmin = currentUser && currentUser.role === 'admin';

  const fetchData = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const [ordersData, statsData, couriersData] = await Promise.all([
        api.getAdminOrders(filterStatus).catch(() => api.getOrders(filterStatus)),
        api.getAdminStatistics().catch(() => null),
        api.getCouriers().catch(() => []),
      ]);
      setOrders(ordersData);
      if (statsData) setStats(statsData);
      setCouriers(couriersData);

      if (activeSubTab === 'products') {
        const prodData = await api.getProducts();
        setProducts(prodData);
      } else if (activeSubTab === 'fleet' && isAdmin) {
        const usersData = await api.getAdminUsers();
        setAdminUsers(usersData);
      }

      setLastUpdated(new Date());
    } catch (err: any) {
      console.error('Failed to sync dashboard data', err);
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filterStatus, activeSubTab]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchData(true);
    }, 3500);
    return () => clearInterval(interval);
  }, [filterStatus, activeSubTab]);

  const handleStatusChange = async (orderId: number, newStatus: OrderStatus) => {
    setActionLoading(orderId);
    try {
      await api.updateOrderStatus(orderId, newStatus);
      await fetchData(true);
    } catch (err: any) {
      alert(`Action failed: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleAssignCourier = async (orderId: number, courierId: number) => {
    setActionLoading(orderId);
    try {
      await api.assignCourier(orderId, courierId);
      await fetchData(true);
    } catch (err: any) {
      alert(`Courier assignment failed: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  // Product management actions
  const handleToggleProductAvailability = async (product: Product) => {
    try {
      await api.adminUpdateProduct(product.id, { available: !product.available });
      const updated = await api.getProducts();
      setProducts(updated);
    } catch (err: any) {
      alert(`Update failed: ${err.message}`);
    }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const priceNum = parseFloat(newProductPrice);
      if (isNaN(priceNum) || priceNum <= 0) throw new Error('Invalid price');
      await api.adminCreateProduct({
        name: newProductName.trim(),
        category: newProductCategory,
        price: priceNum,
        description: newProductDesc.trim() || undefined,
        available: true,
      });
      setIsAddingProduct(false);
      setNewProductName('');
      setNewProductDesc('');
      const updated = await api.getProducts();
      setProducts(updated);
    } catch (err: any) {
      alert(`Failed to add product: ${err.message}`);
    }
  };

  const handleDeleteProduct = async (productId: number) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    try {
      await api.adminDeleteProduct(productId);
      const updated = await api.getProducts();
      setProducts(updated);
    } catch (err: any) {
      alert(`Failed to delete product: ${err.message}`);
    }
  };

  // Courier registration action
  const handleCreateCourier = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.adminCreateCourier({
        name: newCourierName.trim(),
        phone: newCourierPhone.trim(),
        password: 'coyote2026',
      });
      setIsAddingCourier(false);
      setNewCourierName('');
      setNewCourierPhone('');
      await fetchData(true);
    } catch (err: any) {
      alert(`Failed to register courier: ${err.message}`);
    }
  };

  const handleToggleUserActive = async (user: User) => {
    try {
      await api.updateAdminUser(user.id, { is_active: !user.is_active });
      const usersData = await api.getAdminUsers();
      setAdminUsers(usersData);
    } catch (err: any) {
      alert(`Update failed: ${err.message}`);
    }
  };

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="bg-[#FAF4EC] text-[#D98943] border border-[#D98943]/40 font-mono font-bold px-2.5 py-1 rounded-full text-[11px] animate-pulse">
            PENDING ACTION
          </span>
        );
      case 'ACCEPTED':
        return (
          <span className="bg-[#EDF2F7] text-[#32465A] border border-[#CBD5E1] font-mono font-bold px-2.5 py-1 rounded-full text-[11px]">
            ACCEPTED
          </span>
        );
      case 'PREPARING':
        return (
          <span className="bg-[#FAF4EC] text-[#8A7668] border border-[#E8DAC8] font-mono font-bold px-2.5 py-1 rounded-full text-[11px]">
            PREPARING
          </span>
        );
      case 'READY_FOR_PICKUP':
        return (
          <span className="bg-[#F5EEF8] text-[#6C3483] border border-[#D7BDE2] font-mono font-bold px-2.5 py-1 rounded-full text-[11px]">
            READY FOR PICKUP
          </span>
        );
      case 'COURIER_ASSIGNED':
        return (
          <span className="bg-[#FAF4EC] text-[#D98943] border border-[#D98943]/30 font-mono font-bold px-2.5 py-1 rounded-full text-[11px]">
            COURIER ASSIGNED
          </span>
        );
      case 'PICKED_UP':
        return (
          <span className="bg-[#EBF5FB] text-[#2471A3] border border-[#AED6F1] font-mono font-bold px-2.5 py-1 rounded-full text-[11px]">
            IN TRANSIT
          </span>
        );
      case 'DELIVERED':
        return (
          <span className="bg-[#E8F2EC] text-[#2D5A43] border border-[#2D5A43]/30 font-mono font-bold px-2.5 py-1 rounded-full text-[11px]">
            DELIVERED
          </span>
        );
      case 'REJECTED':
        return (
          <span className="bg-red-50 text-red-800 border border-red-200 font-mono font-bold px-2.5 py-1 rounded-full text-[11px]">
            REJECTED
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="pb-28">
      {/* Auth Notification Banner if not signed in as Staff/Admin */}
      {!isStaffOrAdmin && (
        <div className="mb-6 p-4 rounded-2xl bg-[#FAF4EC] border border-[#D98943]/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Lock className="w-5 h-5 text-[#D98943] shrink-0" />
            <div>
              <h4 className="font-serif font-bold text-sm text-[#21150F]">Staff / Admin Authentication Active</h4>
              <p className="text-xs text-[#8A7668]">
                Sign in with a Staff or Admin account to unlock order action buttons, status progression, and catalog editing.
              </p>
            </div>
          </div>
          {onOpenAuthModal && (
            <button
              onClick={onOpenAuthModal}
              className="px-4 py-2 bg-[#21150F] hover:bg-[#382216] text-[#FAFAF7] rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer"
            >
              Sign In to Kitchen POS
            </button>
          )}
        </div>
      )}

      {/* Operations Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-serif font-bold text-[#21150F] tracking-tight">
              Coffee Shop Operations
            </h1>
            <span className="bg-[#21150F] text-[#D98943] font-mono font-bold text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full border border-[#382216]">
              {currentUser ? `${currentUser.role.toUpperCase()} MODE` : 'GUEST PREVIEW'}
            </span>
          </div>
          <p className="text-xs text-[#8A7668] mt-1 font-sans">
            Central Station • Real-time Order Progression, POS Synchronization & Fleet Dispatch
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-mono text-[#8A7668] bg-white px-3.5 py-1.5 rounded-full border border-[#E8DAC8] shadow-xs">
            <span className="w-2 h-2 rounded-full bg-[#2D5A43] animate-pulse" />
            <span>Sync: {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
          </div>

          <button
            onClick={() => fetchData()}
            className="p-2 rounded-full bg-white border border-[#E8DAC8] text-[#21150F] hover:bg-[#FAF4EC] transition-colors cursor-pointer"
            title="Manual Sync"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs: Orders vs Menu Management vs Fleet */}
      <div className="flex items-center gap-2 border-b border-[#E8DAC8] pb-3 mb-6">
        <button
          onClick={() => setActiveSubTab('orders')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'orders'
              ? 'bg-[#21150F] text-[#FAFAF7] shadow-sm'
              : 'bg-white text-[#8A7668] hover:text-[#21150F] border border-[#E8DAC8]'
          }`}
        >
          <Coffee className="w-4 h-4" />
          <span>Kitchen Ticket Queue</span>
        </button>

        <button
          onClick={() => setActiveSubTab('products')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'products'
              ? 'bg-[#21150F] text-[#FAFAF7] shadow-sm'
              : 'bg-white text-[#8A7668] hover:text-[#21150F] border border-[#E8DAC8]'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Product Menu Catalog</span>
        </button>

        {isAdmin && (
          <button
            onClick={() => setActiveSubTab('fleet')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === 'fleet'
                ? 'bg-[#21150F] text-[#FAFAF7] shadow-sm'
                : 'bg-white text-[#8A7668] hover:text-[#21150F] border border-[#E8DAC8]'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Admin Fleet & User RBAC</span>
          </button>
        )}
      </div>

      {/* KPI Statistics Row (always visible) */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <div className="bg-white rounded-2xl p-5 border border-[#E8DAC8] shadow-xs">
            <div className="flex items-center justify-between text-[#8A7668] mb-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest">Total Orders</span>
              <Activity className="w-4 h-4 text-[#8A7668]" />
            </div>
            <div className="text-3xl font-serif font-bold text-[#21150F]">{stats.total_orders}</div>
            <span className="text-[11px] text-[#A69689]">Cumulative volume</span>
          </div>

          <div className="bg-[#FAF4EC] rounded-2xl p-5 border border-[#D98943]/40 shadow-xs">
            <div className="flex items-center justify-between text-[#D98943] mb-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest">Urgent Incoming</span>
              <Clock className="w-4 h-4 text-[#D98943]" />
            </div>
            <div className="text-3xl font-serif font-bold text-[#D98943]">{stats.pending_orders}</div>
            <span className="text-[11px] text-[#8A7668]">Awaiting barista acceptance</span>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-[#E8DAC8] shadow-xs">
            <div className="flex items-center justify-between text-[#8A7668] mb-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest">In Kitchen</span>
              <Coffee className="w-4 h-4 text-[#8A7668]" />
            </div>
            <div className="text-3xl font-serif font-bold text-[#21150F]">{stats.active_orders}</div>
            <span className="text-[11px] text-[#A69689]">Brewing & In Transit</span>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-[#E8DAC8] shadow-xs">
            <div className="flex items-center justify-between text-[#8A7668] mb-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest">Completed</span>
              <CheckCircle2 className="w-4 h-4 text-[#2D5A43]" />
            </div>
            <div className="text-3xl font-serif font-bold text-[#2D5A43]">{stats.completed_orders}</div>
            <span className="text-[11px] text-[#A69689]">Delivered by fleet</span>
          </div>

          <div className="col-span-2 lg:col-span-1 bg-[#21150F] text-[#FAFAF7] rounded-2xl p-5 border border-[#382216] shadow-md">
            <div className="flex items-center justify-between text-[#D98943] mb-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest">Sales Revenue</span>
              <DollarSign className="w-4 h-4" />
            </div>
            <div className="text-3xl font-mono font-bold text-white">${stats.total_revenue.toFixed(2)}</div>
            <span className="text-[11px] text-[#A69689]">Direct fulfillment</span>
          </div>
        </div>
      )}

      {/* ================= SUB-TAB 1: ORDERS QUEUE ================= */}
      {activeSubTab === 'orders' && (
        <>
          {/* Filter Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-6 no-scrollbar">
            {[
              { label: 'All Orders', value: 'ALL' },
              { label: 'Pending Review', value: 'PENDING' },
              { label: 'Accepted', value: 'ACCEPTED' },
              { label: 'In Preparation', value: 'PREPARING' },
              { label: 'Ready for Pickup', value: 'READY_FOR_PICKUP' },
              { label: 'In Delivery', value: 'PICKED_UP' },
              { label: 'Delivered', value: 'DELIVERED' },
            ].map((tab) => (
              <button
                key={tab.value}
                onClick={() => setFilterStatus(tab.value)}
                className={`whitespace-nowrap px-4 py-2 rounded-full text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                  filterStatus === tab.value
                    ? 'bg-[#21150F] text-[#F3E9DC] shadow-sm'
                    : 'bg-white text-[#8A7668] hover:text-[#21150F] hover:bg-[#FAF4EC] border border-[#E8DAC8]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* POS Orders Ticket Grid */}
          {loading && orders.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-3xl border border-[#E8DAC8]">
              <RefreshCw className="w-8 h-8 text-[#D98943] animate-spin mx-auto mb-3" />
              <p className="text-xs font-mono text-[#8A7668]">Syncing kitchen tickets...</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-3xl border border-[#E8DAC8] p-8 max-w-md mx-auto">
              <Coffee className="w-12 h-12 text-[#E8DAC8] mx-auto mb-3" />
              <h3 className="text-lg font-serif font-bold text-[#21150F] mb-1">Queue is Clear</h3>
              <p className="text-xs text-[#8A7668] mb-5 leading-relaxed">
                No active orders matching this filter. New customer orders will appear automatically.
              </p>
              <button
                onClick={() => setFilterStatus('ALL')}
                className="px-5 py-2 bg-[#21150F] text-[#F3E9DC] text-xs font-bold rounded-full hover:bg-[#D98943] hover:text-[#21150F] transition-all cursor-pointer"
              >
                Show All Tickets
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {orders.map((order) => {
                const isBusy = actionLoading === order.id;
                const isPending = order.status === 'PENDING';

                return (
                  <div
                    key={order.id}
                    className={`bg-white rounded-2xl overflow-hidden border transition-all duration-200 flex flex-col justify-between shadow-xs hover:shadow-md ${
                      isPending ? 'border-[#D98943] ring-1 ring-[#D98943]/30' : 'border-[#E8DAC8]'
                    }`}
                  >
                    {/* Ticket Header */}
                    <div className="p-4 bg-[#FAF4EC] border-b border-[#E8DAC8] flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono font-bold text-[#21150F] text-base">
                          #{order.id}
                        </span>
                        <span className="text-[11px] font-mono text-[#8A7668]">
                          {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <div>{getStatusBadge(order.status)}</div>
                    </div>

                    {/* Ticket Body Details */}
                    <div className="p-5 flex-1 space-y-4">
                      {/* Guest Information */}
                      <div className="space-y-1.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-serif font-bold text-[#21150F] text-base">{order.customer_name}</span>
                          <a
                            href={`tel:${order.customer_phone}`}
                            className="text-[#D98943] font-mono font-semibold flex items-center gap-1 hover:underline"
                          >
                            <Phone className="w-3 h-3" />
                            <span>{order.customer_phone}</span>
                          </a>
                        </div>
                        <div className="flex items-start gap-1.5 text-[#8A7668]">
                          <MapPin className="w-3.5 h-3.5 text-[#D98943] mt-0.5 shrink-0" />
                          <span className="leading-snug text-[11px]">{order.delivery_address}</span>
                        </div>
                        {order.delivery_instructions && (
                          <p className="text-[11px] text-[#8A7668] bg-[#FAF4EC] p-2 rounded-xl italic font-serif">
                            "{order.delivery_instructions}"
                          </p>
                        )}
                      </div>

                      {/* Order Items */}
                      <div className="pt-3 border-t border-[#FAF4EC]">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#8A7668] block mb-2">
                          Recipe Checklist ({order.items.length})
                        </span>
                        <div className="space-y-1.5">
                          {order.items.map((item) => (
                            <div key={item.id} className="flex justify-between items-center text-xs">
                              <span className="text-[#21150F]">
                                <strong className="font-mono text-[#D98943] mr-2">{item.quantity}×</strong>
                                {item.product_name}
                              </span>
                              <span className="font-mono text-[#8A7668]">
                                ${(item.unit_price * item.quantity).toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Courier Assignment */}
                      <div className="pt-3 border-t border-[#FAF4EC] text-xs">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#8A7668] block mb-1.5">
                          Fleet Courier Assignment
                        </span>
                        {order.courier ? (
                          <div className="flex items-center justify-between bg-[#FAF4EC] p-2.5 rounded-xl border border-[#E8DAC8]">
                            <div className="flex items-center gap-2">
                              <Bike className="w-3.5 h-3.5 text-[#D98943]" />
                              <span className="font-bold text-[#21150F] text-xs">{order.courier.name}</span>
                            </div>
                            <span className="text-[#8A7668] text-[11px] font-mono">{'phone' in order.courier ? (order.courier as { phone?: string }).phone : ''}</span>
                          </div>
                        ) : (
                          <select
                            disabled={isBusy || order.status === 'DELIVERED' || order.status === 'REJECTED' || !isStaffOrAdmin}
                            onChange={(e) => {
                              const courierId = parseInt(e.target.value, 10);
                              if (courierId) {
                                handleAssignCourier(order.id!, courierId);
                              }
                            }}
                            defaultValue=""
                            className="w-full bg-[#FAF4EC] border border-[#E8DAC8] rounded-xl text-xs py-2 px-3 text-[#21150F] focus:outline-none focus:border-[#D98943] cursor-pointer disabled:opacity-60"
                          >
                            <option value="" disabled>-- Assign Delivery Courier --</option>
                            {couriers.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name} ({c.availability_status})
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>

                    {/* Footer with Amount & Actions */}
                    <div className="p-4 bg-[#FAF4EC] border-t border-[#E8DAC8] space-y-3">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-[#8A7668] font-mono text-[10px] uppercase tracking-wider">Ticket Total</span>
                        <span className="text-base font-mono font-bold text-[#21150F]">
                          ${order.total_price.toFixed(2)}
                        </span>
                      </div>

                      {/* Action Workflow Buttons */}
                      <div className="flex items-center gap-2 pt-1">
                        {order.status === 'PENDING' && (
                          <>
                            <button
                              disabled={isBusy || !isStaffOrAdmin}
                              onClick={() => handleStatusChange(order.id!, 'ACCEPTED')}
                              className="flex-1 py-2.5 px-3 bg-[#21150F] hover:bg-[#D98943] text-[#F3E9DC] hover:text-[#21150F] font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Accept Order</span>
                            </button>
                            <button
                              disabled={isBusy || !isStaffOrAdmin}
                              onClick={() => handleStatusChange(order.id!, 'REJECTED')}
                              className="py-2.5 px-3 bg-white hover:bg-red-50 hover:text-red-800 text-[#8A7668] border border-[#E8DAC8] font-semibold rounded-xl text-xs transition-colors cursor-pointer disabled:opacity-50"
                              title="Reject"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </>
                        )}

                        {order.status === 'ACCEPTED' && (
                          <button
                            disabled={isBusy || !isStaffOrAdmin}
                            onClick={() => handleStatusChange(order.id!, 'PREPARING')}
                            className="w-full py-2.5 px-3 bg-[#21150F] hover:bg-[#382216] text-[#D98943] font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                          >
                            <Coffee className="w-3.5 h-3.5" />
                            <span>Start Brewing / Kitchen</span>
                          </button>
                        )}

                        {order.status === 'PREPARING' && (
                          <button
                            disabled={isBusy || !isStaffOrAdmin}
                            onClick={() => handleStatusChange(order.id!, 'READY_FOR_PICKUP')}
                            className="w-full py-2.5 px-3 bg-[#D98943] hover:bg-[#E8A264] text-[#21150F] font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                          >
                            <PackageCheck className="w-3.5 h-3.5" />
                            <span>Ready for Courier Pickup</span>
                          </button>
                        )}

                        {order.status === 'READY_FOR_PICKUP' && (
                          <div className="w-full py-2 px-3 bg-white border border-[#E8DAC8] text-[#8A7668] rounded-xl text-xs font-mono text-center">
                            Waiting for Courier Pickup
                          </div>
                        )}

                        {order.status === 'COURIER_ASSIGNED' && (
                          <div className="w-full py-2 px-3 bg-white border border-[#E8DAC8] text-[#D98943] rounded-xl text-xs font-mono text-center">
                            Courier En Route to Coffee Shop
                          </div>
                        )}

                        {order.status === 'PICKED_UP' && (
                          <div className="w-full py-2 px-3 bg-white border border-[#E8DAC8] text-[#2471A3] rounded-xl text-xs font-mono text-center">
                            In Transit to Guest
                          </div>
                        )}

                        {order.status === 'DELIVERED' && (
                          <div className="w-full py-2 px-3 bg-[#E8F2EC] border border-[#2D5A43]/30 text-[#2D5A43] rounded-xl text-xs font-mono text-center flex items-center justify-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Delivered to Guest</span>
                          </div>
                        )}

                        {order.status === 'REJECTED' && (
                          <div className="w-full py-2 px-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs font-mono text-center">
                            Rejected
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ================= SUB-TAB 2: PRODUCT MENU CATALOG ================= */}
      {activeSubTab === 'products' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-[#E8DAC8]">
            <div>
              <h3 className="font-serif font-bold text-xl text-[#21150F]">Product & Roastery Menu</h3>
              <p className="text-xs text-[#8A7668] mt-1">
                Toggle live availability or edit prices across the storefront.
              </p>
            </div>

            {isAdmin && (
              <button
                onClick={() => setIsAddingProduct(!isAddingProduct)}
                className="flex items-center gap-2 px-4 py-2.5 bg-[#21150F] hover:bg-[#382216] text-[#FAFAF7] rounded-xl text-xs font-bold transition-all cursor-pointer self-start sm:self-auto"
              >
                <Plus className="w-4 h-4 text-[#D98943]" />
                <span>{isAddingProduct ? 'Cancel' : 'Add New Item'}</span>
              </button>
            )}
          </div>

          {/* Add Product Form */}
          {isAddingProduct && (
            <form onSubmit={handleCreateProduct} className="p-6 bg-white rounded-2xl border border-[#D98943] shadow-md space-y-4">
              <h4 className="font-serif font-bold text-base text-[#21150F]">Create New Menu Item</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-mono text-[#8A7668] mb-1">Product Name</label>
                  <input
                    type="text"
                    required
                    value={newProductName}
                    onChange={(e) => setNewProductName(e.target.value)}
                    placeholder="e.g. Geisha Honey Reserve"
                    className="w-full p-2.5 rounded-lg border border-[#E8DAC8] text-xs focus:ring-1 focus:ring-[#D98943]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-[#8A7668] mb-1">Category</label>
                  <select
                    value={newProductCategory}
                    onChange={(e) => setNewProductCategory(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-[#E8DAC8] text-xs focus:ring-1 focus:ring-[#D98943]"
                  >
                    <option value="Hot Coffee">Hot Coffee</option>
                    <option value="Cold Brew">Cold Brew</option>
                    <option value="Espresso">Espresso</option>
                    <option value="Pastry">Pastry</option>
                    <option value="Beans">Beans</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-mono text-[#8A7668] mb-1">Price ($)</label>
                  <input
                    type="number"
                    step="0.10"
                    required
                    value={newProductPrice}
                    onChange={(e) => setNewProductPrice(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-[#E8DAC8] text-xs focus:ring-1 focus:ring-[#D98943]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-mono text-[#8A7668] mb-1">Description (Optional)</label>
                <input
                  type="text"
                  value={newProductDesc}
                  onChange={(e) => setNewProductDesc(e.target.value)}
                  placeholder="Notes of jasmine, bergamot, orange blossom..."
                  className="w-full p-2.5 rounded-lg border border-[#E8DAC8] text-xs focus:ring-1 focus:ring-[#D98943]"
                />
              </div>
              <button
                type="submit"
                className="px-5 py-2.5 bg-[#21150F] text-[#FAFAF7] rounded-xl text-xs font-bold hover:bg-[#382216] transition-all cursor-pointer"
              >
                Save Product to Menu
              </button>
            </form>
          )}

          {/* Product Items Table */}
          <div className="bg-white rounded-2xl border border-[#E8DAC8] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAF4EC] text-[#8A7668] font-mono uppercase tracking-wider border-b border-[#E8DAC8]">
                  <tr>
                    <th className="py-3 px-4">Product</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Price</th>
                    <th className="py-3 px-4">Status</th>
                    {isAdmin && <th className="py-3 px-4 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8DAC8]">
                  {products.map((prod) => (
                    <tr key={prod.id} className="hover:bg-[#FAF4EC]/40 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-[#21150F]">{prod.name}</div>
                        {prod.description && <div className="text-[11px] text-[#8A7668] truncate max-w-xs">{prod.description}</div>}
                      </td>
                      <td className="py-3 px-4 font-mono text-[#8A7668]">{prod.category}</td>
                      <td className="py-3 px-4 font-mono font-bold text-[#21150F]">${prod.price.toFixed(2)}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                          prod.available ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
                        }`}>
                          {prod.available ? 'AVAILABLE' : 'OUT OF STOCK'}
                        </span>
                      </td>
                      {isAdmin && (
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleToggleProductAvailability(prod)}
                              className="px-2.5 py-1 rounded-lg border border-[#E8DAC8] hover:bg-[#FAF4EC] text-[#21150F] cursor-pointer"
                              title="Toggle Availability"
                            >
                              {prod.available ? 'Mark Out' : 'Mark In Stock'}
                            </button>
                            <button
                              onClick={() => handleDeleteProduct(prod.id)}
                              className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 cursor-pointer"
                              title="Delete Item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================= SUB-TAB 3: FLEET & USER RBAC (ADMIN ONLY) ================= */}
      {activeSubTab === 'fleet' && isAdmin && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-[#E8DAC8]">
            <div>
              <h3 className="font-serif font-bold text-xl text-[#21150F]">Fleet & User Management (RBAC)</h3>
              <p className="text-xs text-[#8A7668] mt-1">
                Admin controls for system user accounts, roles, and courier assignments.
              </p>
            </div>

            <button
              onClick={() => setIsAddingCourier(!isAddingCourier)}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#21150F] hover:bg-[#382216] text-[#FAFAF7] rounded-xl text-xs font-bold transition-all cursor-pointer self-start sm:self-auto"
            >
              <Bike className="w-4 h-4 text-[#D98943]" />
              <span>{isAddingCourier ? 'Cancel' : 'Register New Courier'}</span>
            </button>
          </div>

          {/* New Courier Form */}
          {isAddingCourier && (
            <form onSubmit={handleCreateCourier} className="p-6 bg-white rounded-2xl border border-[#D98943] shadow-md space-y-4">
              <h4 className="font-serif font-bold text-base text-[#21150F]">Onboard Courier Fleet Member</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono text-[#8A7668] mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={newCourierName}
                    onChange={(e) => setNewCourierName(e.target.value)}
                    placeholder="e.g. Timur K."
                    className="w-full p-2.5 rounded-lg border border-[#E8DAC8] text-xs focus:ring-1 focus:ring-[#D98943]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-[#8A7668] mb-1">Phone Number</label>
                  <input
                    type="text"
                    required
                    value={newCourierPhone}
                    onChange={(e) => setNewCourierPhone(e.target.value)}
                    placeholder="+7 (777) 000-0000"
                    className="w-full p-2.5 rounded-lg border border-[#E8DAC8] text-xs focus:ring-1 focus:ring-[#D98943] font-mono"
                  />
                </div>
              </div>
              <p className="text-[11px] text-[#8A7668]">
                New couriers are initialized with default secure password <strong className="text-[#21150F]">coyote2026</strong>.
              </p>
              <button
                type="submit"
                className="px-5 py-2.5 bg-[#21150F] text-[#FAFAF7] rounded-xl text-xs font-bold hover:bg-[#382216] transition-all cursor-pointer"
              >
                Onboard Courier
              </button>
            </form>
          )}

          {/* Users Table */}
          <div className="bg-white rounded-2xl border border-[#E8DAC8] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAF4EC] text-[#8A7668] font-mono uppercase tracking-wider border-b border-[#E8DAC8]">
                  <tr>
                    <th className="py-3 px-4">User</th>
                    <th className="py-3 px-4">Phone</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Access Control</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8DAC8]">
                  {adminUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-[#FAF4EC]/40 transition-colors">
                      <td className="py-3 px-4 font-bold text-[#21150F]">{u.name}</td>
                      <td className="py-3 px-4 font-mono text-[#8A7668]">{u.phone}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${
                          u.role === 'admin' ? 'bg-purple-50 text-purple-700 border border-purple-200' :
                          u.role === 'staff' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                          u.role === 'courier' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                          'bg-stone-100 text-stone-700 border border-stone-200'
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                          u.is_active ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                        }`}>
                          {u.is_active ? 'ACTIVE' : 'DEACTIVATED'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleToggleUserActive(u)}
                          className={`px-2.5 py-1 rounded-lg border text-[11px] font-mono transition-colors cursor-pointer ${
                            u.is_active
                              ? 'border-red-200 text-red-700 hover:bg-red-50'
                              : 'border-green-200 text-green-700 hover:bg-green-50'
                          }`}
                        >
                          {u.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
