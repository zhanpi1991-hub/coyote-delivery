import React, { useState, useEffect } from 'react';
import type { Order, Courier } from '../types';
import { api } from '../services/api';
import {
  Bike, CheckCircle2, RefreshCw,
  Navigation, PackageCheck, Phone, Check
} from 'lucide-react';

export const CourierDashboard: React.FC = () => {
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [selectedCourierId, setSelectedCourierId] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<'available' | 'active' | 'completed'>('available');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const fetchCouriersAndOrders = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const [couriersList, ordersList] = await Promise.all([
        api.getCouriers(),
        api.getCourierOrders(selectedCourierId),
      ]);
      setCouriers(couriersList);
      if (couriersList.length > 0 && !selectedCourierId) {
        setSelectedCourierId(couriersList[0].id);
      }
      setOrders(ordersList);
    } catch (err: any) {
      console.error(err);
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  useEffect(() => {
    fetchCouriersAndOrders();
  }, [selectedCourierId]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchCouriersAndOrders(true);
    }, 3000);
    return () => clearInterval(interval);
  }, [selectedCourierId]);

  const handleAcceptOrder = async (orderId: number) => {
    setActionLoading(orderId);
    try {
      await api.courierAcceptOrder(orderId, selectedCourierId);
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
      await api.courierPickupOrder(orderId, selectedCourierId);
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
      await api.courierDeliverOrder(orderId, selectedCourierId);
      setActiveTab('completed');
      await fetchCouriersAndOrders(true);
    } catch (err: any) {
      alert(`Deliver failed: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  // Filter orders
  const availableOrders = orders.filter(
    (o) => !o.courier_id && ['READY_FOR_PICKUP', 'ACCEPTED', 'PREPARING'].includes(o.status)
  );

  const activeOrders = orders.filter(
    (o) => o.courier_id === selectedCourierId && ['COURIER_ASSIGNED', 'PICKED_UP', 'READY_FOR_PICKUP'].includes(o.status)
  );

  const completedOrders = orders.filter(
    (o) => o.courier_id === selectedCourierId && o.status === 'DELIVERED'
  );

  const displayedOrders =
    activeTab === 'available' ? availableOrders :
    activeTab === 'active' ? activeOrders : completedOrders;

  return (
    <div className="pb-28">
      {/* Mobile-first Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-serif font-bold text-[#21150F] tracking-tight">
              Courier Companion
            </h1>
            <span className="bg-[#FAF4EC] text-[#D98943] border border-[#D98943]/30 font-mono font-bold text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full">
              Fleet View
            </span>
          </div>
          <p className="text-xs text-[#8A7668] mt-1 font-sans">
            Direct Coffee Shop Pickups & Doorstep Fulfillment
          </p>
        </div>

        {/* Courier Profile Switcher */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full border border-[#E8DAC8] shadow-xs">
            <Bike className="w-4 h-4 text-[#D98943]" />
            <span className="text-xs font-mono text-[#8A7668]">Courier:</span>
            <select
              value={selectedCourierId}
              onChange={(e) => setSelectedCourierId(parseInt(e.target.value, 10))}
              className="font-serif font-bold text-xs text-[#21150F] bg-transparent focus:outline-none cursor-pointer"
            >
              {couriers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.phone})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => fetchCouriersAndOrders()}
            className="p-2.5 rounded-full bg-white border border-[#E8DAC8] text-[#21150F] hover:bg-[#FAF4EC] transition-colors cursor-pointer"
            title="Refresh Deliveries"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2.5 mb-8 overflow-x-auto pb-1 no-scrollbar">
        <button
          onClick={() => setActiveTab('available')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-semibold tracking-wide transition-all cursor-pointer ${
            activeTab === 'available'
              ? 'bg-[#21150F] text-[#F3E9DC] shadow-sm'
              : 'bg-white text-[#8A7668] hover:text-[#21150F] hover:bg-[#FAF4EC] border border-[#E8DAC8]'
          }`}
        >
          <span>Available Orders</span>
          {availableOrders.length > 0 && (
            <span className="bg-[#D98943] text-[#21150F] text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full">
              {availableOrders.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('active')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-semibold tracking-wide transition-all cursor-pointer ${
            activeTab === 'active'
              ? 'bg-[#21150F] text-[#F3E9DC] shadow-sm'
              : 'bg-white text-[#8A7668] hover:text-[#21150F] hover:bg-[#FAF4EC] border border-[#E8DAC8]'
          }`}
        >
          <span>My Active Deliveries</span>
          {activeOrders.length > 0 && (
            <span className="bg-[#D98943] text-[#21150F] text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full">
              {activeOrders.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('completed')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-semibold tracking-wide transition-all cursor-pointer ${
            activeTab === 'completed'
              ? 'bg-[#21150F] text-[#F3E9DC] shadow-sm'
              : 'bg-white text-[#8A7668] hover:text-[#21150F] hover:bg-[#FAF4EC] border border-[#E8DAC8]'
          }`}
        >
          <span>Completed ({completedOrders.length})</span>
        </button>
      </div>

      {/* Orders List */}
      {loading && displayedOrders.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-[#E8DAC8]">
          <RefreshCw className="w-8 h-8 text-[#D98943] animate-spin mx-auto mb-3" />
          <p className="text-xs font-mono text-[#8A7668]">Checking delivery queue...</p>
        </div>
      ) : displayedOrders.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-[#E8DAC8] p-8 max-w-md mx-auto">
          <Bike className="w-12 h-12 text-[#E8DAC8] mx-auto mb-3" />
          <h3 className="text-lg font-serif font-bold text-[#21150F] mb-1">
            {activeTab === 'available' ? 'No orders awaiting pickup' :
             activeTab === 'active' ? 'No active deliveries assigned' : 'No completed deliveries yet'}
          </h3>
          <p className="text-xs text-[#8A7668] mb-5 leading-relaxed">
            {activeTab === 'available' ? 'New orders prepared by the coffee shop will appear here.' :
             activeTab === 'active' ? 'Accept orders from the Available tab to begin transit.' : 'Fulfilled deliveries will be archived here.'}
          </p>
          {activeTab !== 'available' && (
            <button
              onClick={() => setActiveTab('available')}
              className="px-5 py-2.5 bg-[#21150F] text-[#F3E9DC] text-xs font-bold rounded-full hover:bg-[#D98943] hover:text-[#21150F] transition-all cursor-pointer"
            >
              Check Available Orders
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayedOrders.map((order) => {
            const isBusy = actionLoading === order.id;

            return (
              <div
                key={order.id}
                className="bg-white rounded-2xl overflow-hidden border border-[#E8DAC8] shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
              >
                {/* Header */}
                <div className="p-4 bg-[#FAF4EC] border-b border-[#E8DAC8] flex items-center justify-between">
                  <div>
                    <span className="font-mono font-bold text-[#21150F] text-base">
                      Order #{order.id}
                    </span>
                    <span className="text-[11px] font-mono text-[#8A7668] block">
                      ${order.total_price.toFixed(2)} • {order.items.length} item{order.items.length === 1 ? '' : 's'}
                    </span>
                  </div>

                  <span className={`text-[10px] font-mono font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                    order.status === 'DELIVERED' ? 'bg-[#E8F2EC] text-[#2D5A43] border border-[#2D5A43]/30' :
                    order.status === 'PICKED_UP' ? 'bg-[#EBF5FB] text-[#2471A3] border border-[#AED6F1]' :
                    'bg-[#FAF4EC] text-[#D98943] border border-[#D98943]/30'
                  }`}>
                    {order.status.replace(/_/g, ' ')}
                  </span>
                </div>

                {/* Content */}
                <div className="p-5 space-y-4 flex-1">

                  {/* Guest and Route Card */}
                  <div className="space-y-3 text-xs">
                    <div>
                      <span className="text-[#8A7668] font-mono text-[10px] uppercase tracking-wider block">Customer</span>
                      <p className="font-serif font-bold text-[#21150F] text-base mt-0.5">{order.customer_name}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <a
                        href={`tel:${order.customer_phone}`}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-[#FAF4EC] hover:bg-[#F3E9DC] text-[#21150F] font-bold text-xs border border-[#E8DAC8] transition-colors cursor-pointer"
                      >
                        <Phone className="w-3.5 h-3.5 text-[#D98943]" />
                        <span className="font-mono">{order.customer_phone}</span>
                      </a>

                      <a
                        href={`https://maps.google.com/?q=${encodeURIComponent(order.delivery_address)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-1.5 py-2.5 px-3.5 rounded-xl bg-[#21150F] hover:bg-[#D98943] text-[#F3E9DC] hover:text-[#21150F] font-bold text-xs transition-colors cursor-pointer"
                      >
                        <Navigation className="w-3.5 h-3.5" />
                        <span>Map</span>
                      </a>
                    </div>

                    <div className="pt-2 border-t border-[#FAF4EC]">
                      <span className="text-[#8A7668] font-mono text-[10px] uppercase tracking-wider block">Delivery Destination</span>
                      <p className="font-semibold text-[#21150F] leading-snug mt-0.5">{order.delivery_address}</p>
                    </div>

                    {order.delivery_instructions && (
                      <div className="bg-[#FAF4EC] p-2.5 rounded-xl border border-[#E8DAC8]">
                        <span className="text-[#8A7668] block text-[10px] font-mono uppercase tracking-wider">Note:</span>
                        <p className="text-[#21150F] text-xs italic font-serif mt-0.5">"{order.delivery_instructions}"</p>
                      </div>
                    )}
                  </div>

                  {/* Items list */}
                  <div className="pt-3 border-t border-[#FAF4EC]">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#8A7668] block mb-2">
                      Manifest Contents
                    </span>
                    <ul className="text-xs space-y-1.5 text-[#21150F]">
                      {order.items.map((item) => (
                        <li key={item.id} className="flex justify-between items-center">
                          <span>
                            <strong className="font-mono text-[#D98943] mr-1.5">{item.quantity}×</strong> {item.product_name}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                </div>

                {/* Tactile Big Action Buttons */}
                <div className="p-4 bg-[#FAF4EC] border-t border-[#E8DAC8]">
                  {activeTab === 'available' && (
                    <button
                      disabled={isBusy}
                      onClick={() => handleAcceptOrder(order.id)}
                      className="w-full h-12 bg-[#21150F] hover:bg-[#D98943] text-[#F3E9DC] hover:text-[#21150F] font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                    >
                      <Bike className="w-4 h-4" />
                      <span>Accept Delivery Order</span>
                    </button>
                  )}

                  {activeTab === 'active' && (
                    <>
                      {order.status !== 'PICKED_UP' ? (
                        <button
                          disabled={isBusy}
                          onClick={() => handlePickupOrder(order.id)}
                          className="w-full h-12 bg-[#D98943] hover:bg-[#E8A264] text-[#21150F] font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                        >
                          <PackageCheck className="w-4 h-4" />
                          <span>Confirm Picked Up from Coffee Shop</span>
                        </button>
                      ) : (
                        <button
                          disabled={isBusy}
                          onClick={() => handleDeliverOrder(order.id)}
                          className="w-full h-12 bg-[#21150F] hover:bg-[#2D5A43] text-[#F3E9DC] font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                        >
                          <CheckCircle2 className="w-4 h-4 text-[#D98943]" />
                          <span>Confirm Handed to Guest</span>
                        </button>
                      )}
                    </>
                  )}

                  {activeTab === 'completed' && (
                    <div className="w-full py-3 bg-[#E8F2EC] border border-[#2D5A43]/30 text-[#2D5A43] text-xs font-mono font-bold rounded-xl text-center flex items-center justify-center gap-2">
                      <Check className="w-4 h-4" />
                      <span>Delivered Successfully</span>
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
