import React, { useEffect, useState } from 'react';
import type { Order, OrderStatus } from '../types';
import { api } from '../services/api';
import {
  CheckCircle2, Clock, Coffee, PackageCheck, Bike, Home,
  AlertCircle, RefreshCw, Phone, MapPin, ArrowLeft, Copy, Check, ShieldCheck
} from 'lucide-react';

interface OrderTrackingProps {
  orderId?: number | null;
  trackingToken?: string | null;
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

export const OrderTracking: React.FC<OrderTrackingProps> = ({
  orderId,
  trackingToken,
  onBackToMenu,
}) => {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const fetchOrder = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      let data: Order;
      if (trackingToken) {
        data = await api.trackOrderByToken(trackingToken);
      } else if (orderId) {
        data = await api.getOrder(orderId);
      } else {
        throw new Error('No order reference provided');
      }
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
  }, [orderId, trackingToken]);

  // Polling every 3.5 seconds for live status synchronization
  useEffect(() => {
    const interval = setInterval(() => {
      fetchOrder(true);
    }, 3500);
    return () => clearInterval(interval);
  }, [orderId, trackingToken]);

  const copyTrackingToken = () => {
    const token = order?.tracking_token || trackingToken;
    if (token) {
      navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else if (order?.id) {
      navigator.clipboard.writeText(order.id.toString());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getActiveStepIndex = (status?: OrderStatus): number => {
    if (!status) return 0;
    if (status === 'REJECTED') return -1;
    const index = STEPS.findIndex((s) => s.status === status);
    return index !== -1 ? index : 0;
  };

  if (loading && !order) {
    return (
      <div className="max-w-2xl mx-auto py-20 text-center">
        <RefreshCw className="w-8 h-8 text-[#D98943] animate-spin mx-auto mb-4" />
        <p className="font-mono text-xs uppercase tracking-wider text-[#8A7668]">
          Retrieving live order status...
        </p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="max-w-md mx-auto py-16 px-6 text-center bg-white rounded-3xl border border-[#E8DAC8] shadow-sm">
        <AlertCircle className="w-12 h-12 text-[#D98943] mx-auto mb-3" />
        <h2 className="text-xl font-serif font-bold text-[#21150F] mb-2">Order Not Located</h2>
        <p className="text-xs text-[#8A7668] mb-6 leading-relaxed">
          {error || `Unable to locate order. Please verify your tracking token.`}
        </p>
        <button
          onClick={onBackToMenu}
          className="px-6 py-2.5 rounded-full bg-[#21150F] text-[#FAFAF7] font-sans text-xs font-semibold hover:bg-[#382216] transition-colors cursor-pointer"
        >
          Return to Menu
        </button>
      </div>
    );
  }

  const currentStepIdx = getActiveStepIndex(order.status);
  const isRejected = order.status === 'REJECTED';
  const effectiveToken = order.tracking_token || trackingToken;

  return (
    <div className="max-w-3xl mx-auto pb-24 animate-fade-in">
      {/* Back button & Live status header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onBackToMenu}
          className="flex items-center gap-2 text-xs font-medium text-[#8A7668] hover:text-[#21150F] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Menu</span>
        </button>

        <div className="flex items-center gap-2 text-xs font-mono text-[#8A7668]">
          <span className="w-2 h-2 rounded-full bg-[#2D5A43] animate-pulse" />
          <span>Sync: {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
        </div>
      </div>

      {/* Main Order Card */}
      <div className="bg-white rounded-3xl border border-[#E8DAC8] p-6 sm:p-8 shadow-sm mb-6">
        {/* Ticket Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#FAF4EC]">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#D98943] font-bold">
                Live Delivery Tracking
              </span>
              <span className="text-[#8A7668]">•</span>
              <span className="text-[11px] font-mono text-[#8A7668]">
                {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <h1 className="text-3xl font-serif font-bold text-[#21150F] mt-1">
              {order.id ? `Order #${order.id}` : 'Your Coffee Order'}
            </h1>
          </div>

          {/* Secure Tracking Token Badge */}
          {effectiveToken && (
            <div className="flex flex-col sm:items-end gap-1.5">
              <div className="flex items-center gap-2 bg-[#FAF4EC] px-3 py-1.5 rounded-full border border-[#E8DAC8]">
                <ShieldCheck className="w-3.5 h-3.5 text-[#D98943]" />
                <span className="text-[11px] font-mono text-[#21150F]">
                  Token: {effectiveToken.substring(0, 10)}...
                </span>
                <button
                  onClick={copyTrackingToken}
                  className="p-1 hover:text-[#D98943] transition-colors cursor-pointer"
                  title="Copy Tracking Token"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-[#2D5A43]" /> : <Copy className="w-3.5 h-3.5 text-[#8A7668]" />}
                </button>
              </div>
              <span className="text-[10px] font-mono text-[#8A7668]">
                {copied ? 'Copied to clipboard!' : 'Unguessable Tracking Security'}
              </span>
            </div>
          )}
        </div>

        {/* Rejection Alert */}
        {isRejected ? (
          <div className="my-8 p-6 rounded-2xl bg-red-50 border border-red-200 text-center">
            <AlertCircle className="w-10 h-10 text-red-600 mx-auto mb-2" />
            <h3 className="font-serif font-bold text-lg text-red-900 mb-1">Order Could Not Be Fulfilled</h3>
            <p className="text-xs text-red-700 max-w-sm mx-auto">
              The coffee shop was unable to accept this order at this time. Please contact the roastery team.
            </p>
          </div>
        ) : (
          /* Visual Journey Progress Steps */
          <div className="py-8">
            <div className="relative">
              {/* Desktop Progress Bar Line */}
              <div className="hidden sm:block absolute top-6 left-8 right-8 h-0.5 bg-[#FAF4EC] -z-0">
                <div
                  className="h-full bg-[#D98943] transition-all duration-700 ease-in-out"
                  style={{
                    width: `${Math.min(100, Math.max(0, (currentStepIdx / (STEPS.length - 1)) * 100))}%`,
                  }}
                />
              </div>

              {/* Step Icons Row */}
              <div className="grid grid-cols-1 sm:grid-cols-7 gap-4 sm:gap-2 relative z-10">
                {STEPS.map((step, idx) => {
                  const Icon = step.icon;
                  const isDone = idx < currentStepIdx;
                  const isCurrent = idx === currentStepIdx;

                  return (
                    <div
                      key={step.status}
                      className={`flex sm:flex-col items-center gap-3 sm:gap-2 text-left sm:text-center p-2 rounded-xl transition-all ${
                        isCurrent ? 'bg-[#FAF4EC] sm:bg-transparent' : ''
                      }`}
                    >
                      <div
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all shrink-0 ${
                          isDone
                            ? 'bg-[#2D5A43] text-white shadow-xs'
                            : isCurrent
                            ? 'bg-[#D98943] text-[#21150F] ring-4 ring-[#D98943]/20 shadow-md animate-pulse'
                            : 'bg-[#FAF4EC] text-[#A69689] border border-[#E8DAC8]'
                        }`}
                      >
                        {isDone ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                      </div>

                      <div className="sm:max-w-[90px]">
                        <span
                          className={`block text-xs font-serif font-bold leading-tight ${
                            isCurrent ? 'text-[#21150F]' : isDone ? 'text-[#2D5A43]' : 'text-[#8A7668]'
                          }`}
                        >
                          {step.label}
                        </span>
                        <span className="hidden sm:block text-[9px] text-[#A69689] mt-0.5 leading-tight">
                          {step.description}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Assigned Courier Details if available */}
        {order.courier && (
          <div className="mt-4 p-4 rounded-2xl bg-[#FAF4EC] border border-[#E8DAC8] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#21150F] text-[#D98943] flex items-center justify-center">
                <Bike className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#8A7668] block">
                  Dedicated Courier
                </span>
                <span className="font-serif font-bold text-sm text-[#21150F]">
                  {order.courier.name}
                </span>
              </div>
            </div>

            {'phone' in order.courier && order.courier.phone && (
              <a
                href={`tel:${order.courier.phone}`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-[#E8DAC8] text-xs font-mono font-semibold text-[#21150F] hover:bg-[#FAF4EC] transition-colors"
              >
                <Phone className="w-3 h-3 text-[#D98943]" />
                <span>{order.courier.phone}</span>
              </a>
            )}
          </div>
        )}
      </div>

      {/* Order Summary & Destination Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Destination Card */}
        <div className="bg-white rounded-3xl border border-[#E8DAC8] p-6 shadow-xs">
          <div className="flex items-center gap-2 mb-4 text-[#8A7668]">
            <MapPin className="w-4 h-4 text-[#D98943]" />
            <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-[#21150F]">
              Delivery Destination
            </h3>
          </div>

          <div className="space-y-2 text-xs">
            <div className="font-serif font-bold text-base text-[#21150F]">
              {order.customer_name || 'Specialty Coffee Delivery'}
            </div>
            <p className="text-[#8A7668] leading-relaxed">
              {order.delivery_address || 'Confirmed Delivery Address (Sealed for Customer Privacy)'}
            </p>
            {order.delivery_instructions && (
              <div className="p-3 bg-[#FAF4EC] rounded-xl text-[11px] text-[#8A7668] font-serif italic border border-[#E8DAC8]/60 mt-3">
                Instructions: "{order.delivery_instructions}"
              </div>
            )}
          </div>
        </div>

        {/* Items Summary Card */}
        <div className="bg-white rounded-3xl border border-[#E8DAC8] p-6 shadow-xs">
          <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-[#21150F] mb-4">
            Items in Order ({order.items.length})
          </h3>

          <div className="divide-y divide-[#FAF4EC]">
            {order.items.map((item, idx) => (
              <div key={item.id || idx} className="py-2.5 flex justify-between items-center text-xs">
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

          <div className="pt-4 mt-3 border-t border-[#E8DAC8] flex justify-between items-center text-xs">
            <span className="font-mono uppercase tracking-wider text-[#8A7668]">Total Price</span>
            <span className="font-mono font-bold text-base text-[#21150F]">
              ${order.total_price.toFixed(2)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
