import React, { useState, useEffect } from 'react';
import type { CartItem, OrderCreatePayload, Order, User } from '../types';
import { X, Trash2, Plus, Minus, ShoppingBag, MapPin, Phone, User as UserIcon, FileText, ArrowRight, AlertCircle, ShieldCheck } from 'lucide-react';
import { api } from '../services/api';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  currentUser?: User | null;
  onUpdateQuantity: (productId: number, delta: number) => void;
  onRemoveItem: (productId: number) => void;
  onClearCart: () => void;
  onOrderSuccess: (order: Order) => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  onClose,
  cart,
  currentUser,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onOrderSuccess,
}) => {
  const [name, setName] = useState(currentUser?.name || 'Dana Alimova');
  const [phone, setPhone] = useState(currentUser?.phone || '+7 (775) 432-1098');
  const [address, setAddress] = useState('Kabanbay Batyr Ave 53, Apt 104');
  const [instructions, setInstructions] = useState('Please leave outside apartment door and knock.');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync user info if user logs in
  useEffect(() => {
    if (currentUser) {
      if (currentUser.name) setName(currentUser.name);
      if (currentUser.phone) setPhone(currentUser.phone);
    }
  }, [currentUser]);

  if (!isOpen) return null;

  const subtotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const deliveryFee = 0.00; // Complimentary own delivery
  const total = subtotal + deliveryFee;

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (cart.length === 0) {
      setError('Your shopping bag is empty.');
      return;
    }

    if (!name.trim()) {
      setError('Please provide your name.');
      return;
    }
    if (!phone.trim()) {
      setError('Please provide a contact phone number.');
      return;
    }
    if (!address.trim()) {
      setError('Please provide a delivery address.');
      return;
    }

    setSubmitting(true);

    try {
      // Generate unique idempotency key for this checkout request
      const idempotencyKey = 'ord_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();

      const payload: OrderCreatePayload = {
        customer_name: name.trim(),
        customer_phone: phone.trim(),
        delivery_address: address.trim(),
        delivery_instructions: instructions.trim() || undefined,
        idempotency_key: idempotencyKey,
        items: cart.map((item) => ({
          product_id: item.product.id,
          quantity: item.quantity,
        })),
      };

      const newOrder = await api.createOrder(payload);
      onClearCart();
      onClose();
      onOrderSuccess(newOrder);
    } catch (err: any) {
      setError(err.message || 'Failed to place order. Please check inputs and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-[#21150F]/70 backdrop-blur-xs transition-opacity duration-300"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-8 sm:pl-10">
        <div className="w-screen max-w-md bg-[#FAFAF7] shadow-2xl flex flex-col border-l border-[#E8DAC8]">

          {/* Drawer Header in Espresso */}
          <div className="p-6 border-b border-[#382216] flex items-center justify-between bg-[#21150F] text-[#FAFAF7]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#382216] border border-[#8A7668]/30 flex items-center justify-center text-[#D98943]">
                <ShoppingBag className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-serif font-bold text-lg leading-tight">Your Coffee Bag</h2>
                <span className="text-[11px] font-mono text-[#8A7668]">
                  {cart.length} {cart.length === 1 ? 'item' : 'items'} selected
                </span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-[#382216] text-[#A69689] hover:text-[#FAFAF7] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {error && (
              <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{error}</span>
              </div>
            )}

            {/* Bag Items List */}
            {cart.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 rounded-full bg-[#FAF4EC] flex items-center justify-center mx-auto mb-4 text-[#8A7668]">
                  <ShoppingBag className="w-7 h-7" />
                </div>
                <h3 className="font-serif font-bold text-base text-[#21150F] mb-1">Your bag is empty</h3>
                <p className="text-xs text-[#8A7668] max-w-xs mx-auto">
                  Browse our seasonal roasts and freshly prepared espresso menu to place your delivery.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-[#8A7668] pb-1 border-b border-[#E8DAC8]">
                  <span className="font-mono uppercase tracking-wider text-[10px]">Products</span>
                  <button
                    onClick={onClearCart}
                    className="text-[11px] hover:text-red-700 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Clear all</span>
                  </button>
                </div>

                {cart.map((item) => (
                  <div
                    key={item.product.id}
                    className="p-3.5 rounded-2xl bg-white border border-[#E8DAC8] flex items-center justify-between gap-3 shadow-xs"
                  >
                    <div className="flex-1 min-w-0">
                      <h4 className="font-serif font-bold text-sm text-[#21150F] truncate">
                        {item.product.name}
                      </h4>
                      <div className="flex items-center gap-2 text-xs font-mono text-[#8A7668] mt-0.5">
                        <span className="text-[#D98943] font-semibold">${item.product.price.toFixed(2)}</span>
                        <span>•</span>
                        <span>{item.product.category}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center border border-[#E8DAC8] rounded-xl bg-[#FAF4EC] p-0.5">
                        <button
                          onClick={() => onUpdateQuantity(item.product.id, -1)}
                          className="p-1 rounded-lg text-[#21150F] hover:bg-white transition-colors cursor-pointer"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-6 text-center text-xs font-mono font-bold text-[#21150F]">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => onUpdateQuantity(item.product.id, 1)}
                          className="p-1 rounded-lg text-[#21150F] hover:bg-white transition-colors cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <button
                        onClick={() => onRemoveItem(item.product.id)}
                        className="p-1.5 text-[#8A7668] hover:text-red-700 transition-colors cursor-pointer"
                        title="Remove item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Delivery Details Form */}
            {cart.length > 0 && (
              <form id="checkout-form" onSubmit={handleSubmitOrder} className="space-y-4 pt-4 border-t border-[#E8DAC8]">
                <div className="flex items-center justify-between">
                  <span className="font-mono uppercase tracking-wider text-[10px] text-[#8A7668] block">
                    Delivery Destination
                  </span>
                  <div className="flex items-center gap-1 text-[10px] text-[#2D5A43] font-mono">
                    <ShieldCheck className="w-3 h-3" />
                    <span>Direct Shop Courier</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#21150F] mb-1">Full Name</label>
                  <div className="relative">
                    <UserIcon className="w-3.5 h-3.5 text-[#8A7668] absolute left-3 top-3" />
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Dana Alimova"
                      className="w-full bg-white border border-[#E8DAC8] rounded-xl pl-9 pr-3 py-2 text-xs text-[#21150F] placeholder-[#8A7668] focus:outline-none focus:border-[#D98943]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#21150F] mb-1">Phone Number</label>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 text-[#8A7668] absolute left-3 top-3" />
                    <input
                      type="text"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+7 (775) 000-0000"
                      className="w-full bg-white border border-[#E8DAC8] rounded-xl pl-9 pr-3 py-2 text-xs text-[#21150F] placeholder-[#8A7668] focus:outline-none focus:border-[#D98943] font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#21150F] mb-1">Street Address & Apartment</label>
                  <div className="relative">
                    <MapPin className="w-3.5 h-3.5 text-[#8A7668] absolute left-3 top-3" />
                    <input
                      type="text"
                      required
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Kabanbay Batyr Ave 53, Apt 104"
                      className="w-full bg-white border border-[#E8DAC8] rounded-xl pl-9 pr-3 py-2 text-xs text-[#21150F] placeholder-[#8A7668] focus:outline-none focus:border-[#D98943]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#21150F] mb-1">Instructions for Courier (Optional)</label>
                  <div className="relative">
                    <FileText className="w-3.5 h-3.5 text-[#8A7668] absolute left-3 top-3" />
                    <input
                      type="text"
                      value={instructions}
                      onChange={(e) => setInstructions(e.target.value)}
                      placeholder="e.g. Leave at door, call on arrival"
                      className="w-full bg-white border border-[#E8DAC8] rounded-xl pl-9 pr-3 py-2 text-xs text-[#21150F] placeholder-[#8A7668] focus:outline-none focus:border-[#D98943]"
                    />
                  </div>
                </div>
              </form>
            )}
          </div>

          {/* Drawer Footer with Calculation & Submit */}
          {cart.length > 0 && (
            <div className="p-6 bg-[#FAF4EC] border-t border-[#E8DAC8] space-y-3">
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-[#8A7668]">
                  <span>Subtotal</span>
                  <span className="font-mono text-[#21150F]">${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[#8A7668]">
                  <span>Direct Coffee Shop Courier Delivery</span>
                  <span className="font-mono text-[#2D5A43] font-semibold">Complimentary</span>
                </div>
                <div className="flex justify-between text-base font-serif font-bold text-[#21150F] pt-2 border-t border-[#E8DAC8]">
                  <span>Total</span>
                  <span className="font-mono text-[#D98943]">${total.toFixed(2)}</span>
                </div>
              </div>

              <button
                type="submit"
                form="checkout-form"
                disabled={submitting}
                className="w-full py-3.5 bg-[#21150F] hover:bg-[#382216] text-[#FAFAF7] font-medium text-xs uppercase tracking-wider rounded-xl shadow-md transition-all flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50 cursor-pointer"
              >
                {submitting ? (
                  <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                ) : (
                  <>
                    <span>Confirm Order & Dispatch</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
