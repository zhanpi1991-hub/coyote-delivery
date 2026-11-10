import React, { useState, useEffect } from 'react';
import type { Order, User } from '../types';
import { api } from '../services/api';
import {
  Bike, CheckCircle2, RefreshCw,
  Navigation, PackageCheck, Phone, Check, Lock, ShieldCheck
} from 'lucide-react';

interface CourierDashboardProps {
  currentUser?: User | null;
  onOpenAuthModal?: () => void;
}

export const CourierDashboard: React.FC<CourierDashboardProps> = ({
  currentUser,
  onOpenAuthModal,
}) => {
  const [activeTab, setActiveTab] = useState<'available' | 'active' | 'completed'>('available');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const isCourierUser = currentUser && currentUser.role === 'courier';

  const fetchCouriersAndOrders = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      if (isCourierUser) {
        const ordersList = await api.getCourierOrders();
        setOrders(ordersList);
      } else {
        setOrders([]);
      }
    } catch (err: any) {
      console.error('Failed to sync courier orders', err);
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  useEffect(() => {
    fetchCouriersAndOrders();
  }, [currentUser]);

  useEffect(() => {
    if (!isCourierUser) return;
    const interval = setInterval(() => {
      fetchCouriersAndOrders(true);
    }, 3000);
    return () => clearInterval(interval);
  }, [currentUser]);

  const handleAcceptOrder = async (orderId: number) => {
    setActionLoading(orderId);
    try {
      await api.courierAcceptOrder(orderId);
      setActiveTab('active');
      await fetchCouriersAndOrders(true);
    } catch (err: any) {
      alert(`Accept failed: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handlePickupOrder = async (orderId: number) => {
    setActionLoading(orderId);
    try {
      await api.courierPickupOrder(orderId);
      await fetchCouriersAndOrders(true);
    } catch (err: any) {
      alert(`Pickup failed: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeliverOrder = async (orderId: number) => {
    setActionLoading(orderId);
    try {
      await api.courierDeliverOrder(orderId);
      setActiveTab('completed');
      await fetchCouriersAndOrders(true);
    } catch (err: any) {
      alert(`Deliver failed: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  // Filter orders for the authenticated courier
  const myCourierId = currentUser?.courier_id;

  const availableOrders = orders.filter(
    (o) => !o.courier_id && ['READY_FOR_PICKUP', 'ACCEPTED', 'PREPARING'].includes(o.status)
  );

  const activeOrders = orders.filter(
    (o) => o.courier_id === myCourierId && ['COURIER_ASSIGNED', 'PICKED_UP', 'READY_FOR_PICKUP'].includes(o.status)
  );

  const completedOrders = orders.filter(
    (o) => o.courier_id === myCourierId && o.status === 'DELIVERED'
  );

  const displayedOrders =
    activeTab === 'available' ? availableOrders :
    activeTab === 'active' ? activeOrders : completedOrders;

  // If not signed in as a courier, require sign in
  if (!isCourierUser) {
    return (
      <div className="max-w-xl mx-auto py-16 px-6 text-center bg-white rounded-3xl border border-[#E8DAC8] shadow-sm">
        <div className="w-16 h-16 rounded-2xl bg-[#21150F] text-[#D98943] flex items-center justify-center mx-auto mb-4 shadow-md">
          <Bike className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-serif font-bold text-[#21150F] mb-2">Courier Fleet Authentication Required</h2>
        <p className="text-xs text-[#8A7668] mb-6 leading-relaxed max-w-md mx-auto">
          To protect customer privacy and prevent unauthorized delivery claims, the courier field interface requires signing in with a verified courier fleet account.
        </p>

        {onOpenAuthModal && (
          <button
            onClick={onOpenAuthModal}
            className="px-6 py-3 bg-[#21150F] hover:bg-[#382216] text-[#FAFAF7] rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer inline-flex items-center gap-2"
          >
            <Lock className="w-4 h-4 text-[#D98943]" />
            <span>Sign In as Courier Fleet Member</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto pb-28">
      {/* Mobile-First Courier Header */}
      <div className="bg-[#21150F] text-[#FAFAF7] rounded-3xl p-6 mb-6 shadow-xl border border-[#382216]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#382216]">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#382216] border border-[#D98943]/30 flex items-center justify-center text-[#D98943] shrink-0">
              <Bike className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#D98943] block">
                Coyote Fleet • Field App
              </span>
              <h1 className="text-2xl font-serif font-bold text-[#FAFAF7]">
                {currentUser.name}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1.5 rounded-full bg-[#382216] border border-[#D98943]/40 text-[#D98943] font-mono text-xs font-bold flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Courier #{currentUser.courier_id}</span>
            </span>

            <button
              onClick={() => fetchCouriersAndOrders()}
              className="p-2 rounded-xl bg-[#2C1E17] border border-[#382216] text-[#A69689] hover:text-[#FAFAF7] transition-colors cursor-pointer"
              title="Refresh Queue"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Courier Quick Stats Bar */}
        <div className="grid grid-cols-3 gap-3 pt-5 text-center">
          <div className="bg-[#2C1E17] rounded-xl p-3 border border-[#382216]">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#8A7668] block">Available</span>
            <span className="text-xl font-serif font-bold text-[#D98943]">{availableOrders.length}</span>
          </div>
          <div className="bg-[#2C1E17] rounded-xl p-3 border border-[#382216]">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#8A7668] block">My Active</span>
            <span className="text-xl font-serif font-bold text-white">{activeOrders.length}</span>
          </div>
          <div className="bg-[#2C1E17] rounded-xl p-3 border border-[#382216]">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#8A7668] block">Completed</span>
            <span className="text-xl font-serif font-bold text-[#2D5A43]">{completedOrders.length}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#E8DAC8] mb-6">
        <button
          onClick={() => setActiveTab('available')}
          className={`flex-1 py-3 text-xs font-mono font-bold uppercase tracking-wider transition-all border-b-2 cursor-pointer ${
            activeTab === 'available'
              ? 'border-[#D98943] text-[#21150F] bg-white rounded-t-xl'
              : 'border-transparent text-[#8A7668] hover:text-[#21150F]'
          }`}
        >
          Available ({availableOrders.length})
        </button>
        <button
          onClick={() => setActiveTab('active')}
          className={`flex-1 py-3 text-xs font-mono font-bold uppercase tracking-wider transition-all border-b-2 cursor-pointer ${
            activeTab === 'active'
              ? 'border-[#D98943] text-[#21150F] bg-white rounded-t-xl'
              : 'border-transparent text-[#8A7668] hover:text-[#21150F]'
          }`}
        >
          In Transit ({activeOrders.length})
        </button>
        <button
          onClick={() => setActiveTab('completed')}
          className={`flex-1 py-3 text-xs font-mono font-bold uppercase tracking-wider transition-all border-b-2 cursor-pointer ${
            activeTab === 'completed'
              ? 'border-[#D98943] text-[#21150F] bg-white rounded-t-xl'
              : 'border-transparent text-[#8A7668] hover:text-[#21150F]'
          }`}
        >
          Delivered ({completedOrders.length})
        </button>
      </div>

      {/* Order Cards List */}
      {loading && orders.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-3xl border border-[#E8DAC8]">
          <RefreshCw className="w-7 h-7 text-[#D98943] animate-spin mx-auto mb-2" />
          <p className="text-xs font-mono text-[#8A7668]">Syncing deliveries...</p>
        </div>
      ) : displayedOrders.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-3xl border border-[#E8DAC8] p-8">
          <Bike className="w-12 h-12 text-[#E8DAC8] mx-auto mb-3" />
          <h3 className="text-base font-serif font-bold text-[#21150F] mb-1">
            {activeTab === 'available' ? 'No Available Orders' :
             activeTab === 'active' ? 'No Deliveries In Progress' : 'No Completed Deliveries Yet'}
          </h3>
          <p className="text-xs text-[#8A7668] max-w-sm mx-auto">
            {activeTab === 'available'
              ? 'When the coffee shop marks orders ready for pickup, they will appear here.'
              : 'Accept orders from the Available tab to start delivery transit.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {displayedOrders.map((order) => {
            const isBusy = actionLoading === (order.id || 0);

            return (
              <div
                key={order.id}
                className="bg-white rounded-2xl p-5 border border-[#E8DAC8] shadow-xs hover:shadow-md transition-shadow"
              >
                {/* Header */}
                <div className="flex items-center justify-between pb-3 border-b border-[#FAF4EC]">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-base text-[#21150F]">#{order.id}</span>
                    <span className="text-[11px] font-mono text-[#8A7668]">
                      {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-[#FAF4EC] text-[#D98943] border border-[#D98943]/30">
                    {order.status.replace(/_/g, ' ')}
                  </span>
                </div>

                {/* Details */}
                <div className="py-3 space-y-2.5 text-xs">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-serif font-bold text-[#21150F] text-base">{order.customer_name}</div>
                      <div className="flex items-start gap-1.5 text-[#8A7668] mt-1">
                        <Navigation className="w-3.5 h-3.5 text-[#D98943] mt-0.5 shrink-0" />
                        <span className="text-xs text-[#21150F] font-medium leading-snug">{order.delivery_address}</span>
                      </div>
                    </div>

                    {order.customer_phone && (
                      <a
                        href={`tel:${order.customer_phone}`}
                        className="p-2 rounded-xl bg-[#FAF4EC] text-[#D98943] hover:bg-[#D98943] hover:text-[#21150F] transition-colors"
                        title="Call Customer"
                      >
                        <Phone className="w-4 h-4" />
                      </a>
                    )}
                  </div>

                  {order.delivery_instructions && (
                    <div className="text-[11px] text-[#8A7668] bg-[#FAF4EC] p-2.5 rounded-xl font-serif italic border border-[#E8DAC8]/60">
                      Note: "{order.delivery_instructions}"
                    </div>
                  )}

                  {/* Checklist Summary */}
                  <div className="pt-2 text-[11px] text-[#8A7668] flex items-center justify-between font-mono">
                    <span>{order.items.length} items in thermal seal</span>
                    <span className="font-bold text-[#21150F]">${order.total_price.toFixed(2)}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-3 border-t border-[#FAF4EC]">
                  {/* Action 1: Accept Order */}
                  {activeTab === 'available' && order.id && (
                    <button
                      disabled={isBusy}
                      onClick={() => handleAcceptOrder(order.id!)}
                      className="w-full py-3 bg-[#21150F] hover:bg-[#D98943] text-[#FAFAF7] hover:text-[#21150F] font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer disabled:opacity-50"
                    >
                      <Bike className="w-4 h-4" />
                      <span>Accept Delivery Order</span>
                    </button>
                  )}

                  {/* Action 2: Pickup Order */}
                  {activeTab === 'active' && ['COURIER_ASSIGNED', 'READY_FOR_PICKUP'].includes(order.status) && order.id && (
                    <button
                      disabled={isBusy}
                      onClick={() => handlePickupOrder(order.id!)}
                      className="w-full py-3 bg-[#D98943] hover:bg-[#E8A264] text-[#21150F] font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer disabled:opacity-50"
                    >
                      <PackageCheck className="w-4 h-4" />
                      <span>Confirm Package Pickup at Coffee Shop</span>
                    </button>
                  )}

                  {/* Action 3: Complete Delivery */}
                  {activeTab === 'active' && order.status === 'PICKED_UP' && order.id && (
                    <button
                      disabled={isBusy}
                      onClick={() => handleDeliverOrder(order.id!)}
                      className="w-full py-3 bg-[#2D5A43] hover:bg-[#3B7558] text-[#FAFAF7] font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Confirm Delivered to Customer</span>
                    </button>
                  )}

                  {/* Completed Badge */}
                  {activeTab === 'completed' && (
                    <div className="flex items-center justify-center gap-2 text-xs font-mono font-bold text-[#2D5A43] py-2 bg-[#E8F2EC] rounded-xl border border-[#2D5A43]/20">
                      <Check className="w-4 h-4" />
                      <span>Delivery Successfully Completed</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
