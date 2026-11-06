import React, { useState, useEffect } from 'react';
import type { Order, OrderStatus, Statistics, Courier } from '../types';
import { api } from '../services/api';
import {
  RefreshCw, CheckCircle2, XCircle, Clock, Coffee,
  PackageCheck, Bike, Phone, MapPin, DollarSign, Activity
} from 'lucide-react';

export const CoffeeShopDashboard: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [stats, setStats] = useState<Statistics | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const fetchData = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const [ordersData, statsData, couriersData] = await Promise.all([
        api.getOrders(filterStatus),
        api.getAdminStatistics(),
        api.getCouriers(),
      ]);
      setOrders(ordersData);
      setStats(statsData);
      setCouriers(couriersData);
      setLastUpdated(new Date());
    } catch (err: any) {
      console.error(err);
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filterStatus]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchData(true);
    }, 3000);
    return () => clearInterval(interval);
  }, [filterStatus]);

  const handleStatusChange = async (orderId: number, newStatus: OrderStatus, courierId?: number) => {
    setActionLoading(orderId);
    try {
      await api.updateOrderStatus(orderId, newStatus, courierId);
      await fetchData(true);
    } catch (err: any) {
      alert(`Action failed: ${err.message}`);
    } finally {
      setActionLoading(null);
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
      {/* Operations Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-serif font-bold text-[#21150F] tracking-tight">
              Coffee Shop Kitchen & Dispatch
            </h1>
            <span className="bg-[#21150F] text-[#D98943] font-mono font-bold text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full border border-[#382216]">
              Coffee Shop Operations
            </span>
          </div>
          <p className="text-xs text-[#8A7668] mt-1 font-sans">
            Central Station • Real-time Order Progression & Fleet Management
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

      {/* KPI Statistics Row */}
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
                        <span className="text-[#8A7668] text-[11px] font-mono">{order.courier.phone}</span>
                      </div>
                    ) : (
                      <select
                        disabled={isBusy || order.status === 'DELIVERED' || order.status === 'REJECTED'}
                        onChange={(e) => {
                          const courierId = parseInt(e.target.value, 10);
                          if (courierId) {
                            handleStatusChange(order.id, order.status, courierId);
                          }
                        }}
                        defaultValue=""
                        className="w-full bg-[#FAF4EC] border border-[#E8DAC8] rounded-xl text-xs py-2 px-3 text-[#21150F] focus:outline-none focus:border-[#D98943] cursor-pointer"
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
                          disabled={isBusy}
                          onClick={() => handleStatusChange(order.id, 'ACCEPTED')}
                          className="flex-1 py-2.5 px-3 bg-[#21150F] hover:bg-[#D98943] text-[#F3E9DC] hover:text-[#21150F] font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Accept Order</span>
                        </button>
                        <button
                          disabled={isBusy}
                          onClick={() => handleStatusChange(order.id, 'REJECTED')}
                          className="py-2.5 px-3 bg-white hover:bg-red-50 hover:text-red-800 text-[#8A7668] border border-[#E8DAC8] font-semibold rounded-xl text-xs transition-colors cursor-pointer"
                          title="Reject"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </>
                    )}

                    {order.status === 'ACCEPTED' && (
                      <button
                        disabled={isBusy}
                        onClick={() => handleStatusChange(order.id, 'PREPARING')}
                        className="w-full py-2.5 px-3 bg-[#21150F] hover:bg-[#382216] text-[#D98943] font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                      >
                        <Coffee className="w-3.5 h-3.5" />
                        <span>Start Brewing / Kitchen</span>
                      </button>
                    )}

                    {order.status === 'PREPARING' && (
                      <button
                        disabled={isBusy}
                        onClick={() => handleStatusChange(order.id, 'READY_FOR_PICKUP')}
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
    </div>
  );
};
