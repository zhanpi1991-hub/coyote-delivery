import React, { useEffect, useState } from 'react';
import type { Order, OrderStatus } from '../types';
import { api } from '../services/api';
import {
  CheckCircle2, Clock, Coffee, PackageCheck, Bike, Home,
  AlertCircle, RefreshCw, Phone, MapPin, ArrowLeft, Copy, Check
} from 'lucide-react';

interface OrderTrackingProps {
  orderId: number;
  onBackToMenu: () => void;
}

interface StepConfig {
  status: OrderStatus;
  label: string;
  description: string;
  icon: React.ElementType;
}

const STEPS: StepConfig[] = [
  {
    status: 'PENDING',
    label: 'Order Placed',
    description: 'Order placed in system',
    icon: Clock,
  },
  {
    status: 'ACCEPTED',
    label: 'Confirmed',
    description: 'Queued at coffee shop',
    icon: CheckCircle2,
  },
  {
    status: 'PREPARING',
    label: 'Brewing & Baking',
    description: 'Barista extraction in progress',
    icon: Coffee,
  },
  {
    status: 'READY_FOR_PICKUP',
    label: 'Ready for Pickup',
    description: 'Thermal packaging sealed',
    icon: PackageCheck,
  },
  {
    status: 'COURIER_ASSIGNED',
    label: 'Courier Dispatched',
    description: 'Courier en route to shop',
    icon: Bike,
  },
  {
    status: 'PICKED_UP',
    label: 'Out for Delivery',
    description: 'Direct transit to your door',
    icon: Bike,
  },
  {
    status: 'DELIVERED',
    label: 'Delivered',
    description: 'Enjoy your specialty coffee',
    icon: Home,
  },
];

export const OrderTracking: React.FC<OrderTrackingProps> = ({ orderId, onBackToMenu }) => {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const fetchOrder = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const data = await api.getOrder(orderId);
      setOrder(data);
      setError(null);
      setLastRefreshed(new Date());
    } catch (err: any) {
      setError(err.message || 'Order not found');
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrder();
  }, [orderId]);

  // Polling every 3 seconds for live synchronization
  useEffect(() => {
    const interval = setInterval(() => {
      fetchOrder(true);
    }, 3000);
    return () => clearInterval(interval);
  }, [orderId]);

  const copyTrackingId = () => {
    navigator.clipboard.writeText(orderId.toString());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading && !order) {
    return (
      <div className="max-w-3xl mx-auto py-20 px-4 text-center">
        <RefreshCw className="w-8 h-8 text-[#D98943] animate-spin mx-auto mb-4" />
        <h2 className="text-xl font-serif font-bold text-[#21150F]">Tracking Coffee Journey...</h2>
        <p className="text-xs text-[#8A7668] mt-1 font-mono">Updating order status...</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="max-w-md mx-auto py-16 px-6 text-center bg-white rounded-3xl shadow-sm border border-[#E8DAC8]">
        <AlertCircle className="w-12 h-12 text-[#8A7668] mx-auto mb-3" />
        <h2 className="text-xl font-serif font-bold text-[#21150F] mb-1">Order Not Found</h2>
        <p className="text-xs text-[#8A7668] mb-6">{error || `No record found for ID #${orderId}`}</p>
        <button
          onClick={onBackToMenu}
          className="px-6 py-2.5 rounded-full bg-[#21150F] text-[#F3E9DC] text-xs font-bold hover:bg-[#D98943] hover:text-[#21150F] transition-all cursor-pointer"
        >
          Return to Catalog
        </button>
      </div>
    );
  }

  const getStepIndex = (status: OrderStatus): number => {
    switch (status) {
      case 'PENDING': return 0;
      case 'ACCEPTED': return 1;
      case 'PREPARING': return 2;
      case 'READY_FOR_PICKUP': return 3;
      case 'COURIER_ASSIGNED': return 4;
      case 'PICKED_UP': return 5;
      case 'DELIVERED': return 6;
      case 'REJECTED': return -1;
      default: return 0;
    }
  };

  const currentStepIdx = getStepIndex(order.status);
  const isRejected = order.status === 'REJECTED';
  const isDelivered = order.status === 'DELIVERED';

  return (
    <div className="max-w-3xl mx-auto pb-28">

      {/* Top Bar with Navigation & Live Sync Pill */}
      <div className="flex items-center justify-between mb-8">
        <button
          onClick={onBackToMenu}
          className="inline-flex items-center gap-2 text-xs font-semibold text-[#8A7668] hover:text-[#21150F] bg-white px-4 py-2 rounded-full border border-[#E8DAC8] shadow-xs transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Menu</span>
        </button>

        <div className="flex items-center gap-2 text-[11px] font-mono text-[#8A7668] bg-[#FAF4EC] px-3.5 py-1.5 rounded-full border border-[#E8DAC8]">
          <span className="w-2 h-2 rounded-full bg-[#2D5A43] animate-pulse" />
          <span>Live Status • {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
        </div>
      </div>

      {/* Main Order Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-10 shadow-sm border border-[#E8DAC8] mb-8 relative overflow-hidden">

        {/* Order Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#FAF4EC]">
          <div>
            <div className="flex items-center gap-3 mb-1.5">
              <span className="text-xs font-mono font-bold uppercase tracking-widest text-[#8A7668]">Order</span>
              <h1 className="text-3xl font-serif font-bold text-[#21150F] tracking-tight">
                #{order.id}
              </h1>
              <button
                onClick={copyTrackingId}
                className="p-1.5 rounded-lg text-[#8A7668] hover:text-[#21150F] hover:bg-[#FAF4EC] transition-colors cursor-pointer"
                title="Copy Order ID"
              >
                {copied ? <Check className="w-4 h-4 text-[#2D5A43]" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-[#8A7668] font-mono">
              Submitted at {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>

          <div className="flex items-center">
            <span
              className={`px-4 py-1.5 rounded-full text-xs font-mono font-bold uppercase tracking-wider ${
                isRejected
                  ? 'bg-red-50 text-red-800 border border-red-200'
                  : isDelivered
                  ? 'bg-[#E8F2EC] text-[#2D5A43] border border-[#2D5A43]/30'
                  : 'bg-[#FAF4EC] text-[#D98943] border border-[#D98943]/40'
              }`}
            >
              {order.status.replace(/_/g, ' ')}
            </span>
          </div>
        </div>

        {/* Rejection notice */}
        {isRejected ? (
          <div className="mt-8 p-4 bg-red-50 rounded-2xl border border-red-200 flex items-start gap-3 text-red-800">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-600" />
            <div>
              <h3 className="font-serif font-bold text-sm">Order Unable to be Fulfilled</h3>
              <p className="text-xs mt-0.5 text-red-700">
                The coffee shop unfortunately could not accept this order at this time. Please contact support or place a new order.
              </p>
            </div>
          </div>
        ) : (
          /* Step Timeline */
          <div className="mt-10">
            <h3 className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#8A7668] mb-8">
              Live Order Progress
            </h3>

            <div className="relative">
              {/* Connecting line on desktop */}
              <div className="hidden md:block absolute top-1/2 left-6 right-6 h-0.5 bg-[#E8DAC8] -translate-y-1/2 z-0" />

              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-4 relative z-10">
                {STEPS.map((step, idx) => {
                  const Icon = step.icon;
                  const isCompleted = idx < currentStepIdx || isDelivered;
                  const isCurrent = idx === currentStepIdx && !isDelivered;

                  return (
                    <div key={step.status} className="flex flex-col items-center text-center">
                      <div
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                          isCompleted
                            ? 'bg-[#21150F] text-[#D98943] shadow-sm'
                            : isCurrent
                            ? 'bg-[#D98943] text-[#21150F] ring-4 ring-[#FAF4EC] shadow-md scale-110'
                            : 'bg-[#FAF4EC] text-[#A69689] border border-[#E8DAC8]'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <span className={`text-xs font-serif font-bold mt-3 leading-tight ${
                        isCurrent ? 'text-[#D98943]' : isCompleted ? 'text-[#21150F]' : 'text-[#A69689]'
                      }`}>
                        {step.label}
                      </span>
                      <span className="text-[10px] text-[#8A7668] mt-0.5 hidden sm:block font-sans">
                        {step.description}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Courier Details Card */}
      {order.courier && (
        <div className="bg-[#FAF4EC] rounded-3xl p-6 border border-[#E8DAC8] mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#21150F] text-[#D98943] flex items-center justify-center font-bold">
              <Bike className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#8A7668] block">
                Assigned Coyote Fleet Courier
              </span>
              <h3 className="font-serif font-bold text-[#21150F] text-lg">
                {order.courier.name}
              </h3>
              <p className="text-xs text-[#8A7668]">
                Dedicated courier assigned to delivery
              </p>
            </div>
          </div>

          <a
            href={`tel:${order.courier.phone}`}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-[#21150F] hover:bg-[#D98943] text-[#F3E9DC] hover:text-[#21150F] font-bold text-xs tracking-wide transition-all shadow-xs"
          >
            <Phone className="w-3.5 h-3.5" />
            <span>Call Courier ({order.courier.phone})</span>
          </a>
        </div>
      )}

      {/* Receipt Breakdown & Destination Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

        {/* Destination Card */}
        <div className="bg-white rounded-3xl p-6 border border-[#E8DAC8]">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#FAF4EC]">
            <MapPin className="w-4 h-4 text-[#D98943]" />
            <h3 className="font-serif font-bold text-base text-[#21150F]">Destination Details</h3>
          </div>
          <div className="space-y-3 text-xs">
            <div>
              <span className="text-[#8A7668] font-mono text-[10px] uppercase tracking-wider block">Recipient</span>
              <p className="font-bold text-[#21150F] text-sm mt-0.5">{order.customer_name}</p>
              <p className="text-[#8A7668] font-mono">{order.customer_phone}</p>
            </div>

            <div className="pt-2 border-t border-[#FAF4EC]">
              <span className="text-[#8A7668] font-mono text-[10px] uppercase tracking-wider block">Address</span>
              <p className="font-semibold text-[#21150F] text-xs leading-relaxed mt-0.5">{order.delivery_address}</p>
            </div>

            {order.delivery_instructions && (
              <div className="pt-2 border-t border-[#FAF4EC]">
                <span className="text-[#8A7668] font-mono text-[10px] uppercase tracking-wider block">Instructions</span>
                <p className="text-[#8A7668] italic mt-0.5 font-serif">"{order.delivery_instructions}"</p>
              </div>
            )}
          </div>
        </div>

        {/* Items Summary Card */}
        <div className="bg-white rounded-3xl p-6 border border-[#E8DAC8]">
          <h3 className="font-serif font-bold text-base text-[#21150F] mb-4 pb-3 border-b border-[#FAF4EC]">
            Items Ordered
          </h3>
          <div className="space-y-2.5 mb-4">
            {order.items.map((item) => (
              <div key={item.id} className="flex justify-between items-center text-xs">
                <span className="text-[#21150F]">
                  <span className="font-mono font-bold text-[#D98943] mr-2">{item.quantity}×</span>
                  {item.product_name}
                </span>
                <span className="font-mono font-bold text-[#21150F]">
                  ${(item.unit_price * item.quantity).toFixed(2)}
                </span>
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-[#FAF4EC] space-y-1.5 text-xs">
            <div className="flex justify-between text-[#8A7668]">
              <span>Delivery Fee</span>
              <span className="font-mono text-[#2D5A43] font-bold">FREE</span>
            </div>
            <div className="flex justify-between text-[#21150F] text-base font-bold pt-2 border-t border-[#E8DAC8]">
              <span className="font-serif">Total Amount</span>
              <span className="font-mono text-[#D98943]">${order.total_price.toFixed(2)}</span>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};
