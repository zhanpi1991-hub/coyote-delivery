import React, { useState } from 'react';
import type { CartItem, OrderCreatePayload, Order } from '../types';
import { X, Trash2, Plus, Minus, ShoppingBag, MapPin, Phone, User, FileText, ArrowRight, AlertCircle } from 'lucide-react';
import { api } from '../services/api';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  onUpdateQuantity: (productId: number, delta: number) => void;
  onRemoveItem: (productId: number) => void;
  onClearCart: () => void;
  onOrderSuccess: (order: Order) => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  onClose,
  cart,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onOrderSuccess,
}) => {
  const [name, setName] = useState('Dana Alimova');
  const [phone, setPhone] = useState('+7 (775) 432-1098');
  const [address, setAddress] = useState('Kabanbay Batyr Ave 53, Apt 104');
  const [instructions, setInstructions] = useState('Please leave outside apartment door and knock.');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      const payload: OrderCreatePayload = {
        customer_name: name.trim(),
        customer_phone: phone.trim(),
        delivery_address: address.trim(),
        delivery_instructions: instructions.trim() || undefined,
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
      {/* Backdrop with subtle blur */}
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
                <h2 className="font-serif font-bold text-lg text-white">Your Coffee Bag</h2>
                <p className="text-[#A69689] text-[11px] font-mono">
                  {cart.length} item{cart.length === 1 ? '' : 's'} • Direct Coffee Shop Delivery
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-full text-[#8A7668] hover:text-white hover:bg-[#382216] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Drawer Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">

            {/* Error Notification */}
            {error && (
              <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-red-800 text-xs">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-red-600" />
                <span className="leading-snug">{error}</span>
              </div>
            )}

            {/* Empty Bag State */}
            {cart.length === 0 ? (
              <div className="text-center py-16 text-[#8A7668]">
                <div className="w-16 h-16 rounded-full bg-[#FAF4EC] border border-[#E8DAC8] flex items-center justify-center mx-auto mb-4 text-[#D98943]">
                  <ShoppingBag className="w-6 h-6" />
                </div>
                <h3 className="font-serif font-bold text-[#21150F] text-base mb-1">Your bag is empty</h3>
                <p className="text-xs text-[#8A7668] max-w-xs mx-auto leading-relaxed">
                  Explore our single-origin roasts, signature drinks, and fresh pastries to begin your order.
                </p>
              </div>
            ) : (
              /* Selected Items List */
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#8A7668]">
                    Selected Beverages & Treats
                  </span>
                  <span className="text-xs text-[#8A7668] font-mono">Qty</span>
                </div>

                <div className="space-y-2.5">
                  {cart.map((item) => (
                    <div
                      key={item.product.id}
                      className="flex items-center gap-3.5 p-3.5 bg-white rounded-2xl border border-[#E8DAC8] shadow-2xl/1"
                    >
                      <img
                        src={item.product.image || 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=200&q=80'}
                        alt={item.product.name}
                        className="w-14 h-14 rounded-xl object-cover bg-[#FAF4EC] shrink-0"
                      />

                      <div className="flex-1 min-w-0">
                        <h4 className="font-serif font-bold text-[#21150F] text-sm truncate">
                          {item.product.name}
                        </h4>
                        <p className="text-[#8A7668] text-[11px] font-mono">
                          ${item.product.price.toFixed(2)} each
                        </p>
                        <p className="text-[#D98943] font-mono font-bold text-xs mt-0.5">
                          ${(item.product.price * item.quantity).toFixed(2)}
                        </p>
                      </div>

                      {/* Stepper controls */}
                      <div className="flex items-center gap-1 bg-[#FAF4EC] rounded-full p-1 border border-[#E8DAC8]">
                        <button
                          onClick={() => onUpdateQuantity(item.product.id, -1)}
                          className="w-6 h-6 rounded-full flex items-center justify-center text-[#21150F] hover:bg-[#F3E9DC] cursor-pointer"
                          title="Decrease"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-xs font-mono font-bold text-[#21150F] px-1.5">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => onUpdateQuantity(item.product.id, 1)}
                          className="w-6 h-6 rounded-full flex items-center justify-center bg-[#D98943] text-[#21150F] font-bold hover:bg-[#E8A264] cursor-pointer"
                          title="Increase"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <button
                        onClick={() => onRemoveItem(item.product.id)}
                        className="p-1.5 text-[#A69689] hover:text-red-700 transition-colors cursor-pointer"
                        title="Remove"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Delivery Details Form */}
            {cart.length > 0 && (
              <form id="order-form" onSubmit={handleSubmitOrder} className="space-y-4 pt-4 border-t border-[#E8DAC8]">
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#8A7668] block">
                  Delivery Destination
                </span>

                <div>
                  <label className="block text-xs font-semibold text-[#21150F] mb-1 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-[#D98943]" />
                    <span>Recipient Name *</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dana Alimova"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full text-xs sm:text-sm bg-white border border-[#E8DAC8] rounded-xl px-3.5 py-2.5 text-[#21150F] focus:outline-none focus:border-[#D98943] focus:ring-1 focus:ring-[#D98943] transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#21150F] mb-1 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-[#D98943]" />
                    <span>Contact Phone *</span>
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="+7 (701) 000-0000"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full text-xs sm:text-sm bg-white border border-[#E8DAC8] rounded-xl px-3.5 py-2.5 text-[#21150F] focus:outline-none focus:border-[#D98943] focus:ring-1 focus:ring-[#D98943] transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#21150F] mb-1 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[#D98943]" />
                    <span>Delivery Address *</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Street, building, entrance, apartment"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full text-xs sm:text-sm bg-white border border-[#E8DAC8] rounded-xl px-3.5 py-2.5 text-[#21150F] focus:outline-none focus:border-[#D98943] focus:ring-1 focus:ring-[#D98943] transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#21150F] mb-1 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-[#D98943]" />
                    <span>Special Instructions (Optional)</span>
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Door intercom code, contactless delivery note, etc."
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    className="w-full text-xs sm:text-sm bg-white border border-[#E8DAC8] rounded-xl px-3.5 py-2 text-[#21150F] focus:outline-none focus:border-[#D98943] focus:ring-1 focus:ring-[#D98943] transition-all resize-none"
                  />
                </div>
              </form>
            )}
          </div>

          {/* Drawer Footer & Checkout Action */}
          {cart.length > 0 && (
            <div className="p-6 border-t border-[#E8DAC8] bg-[#FAF4EC] space-y-4">
              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-[#8A7668]">
                  <span>Subtotal</span>
                  <span className="font-mono font-semibold text-[#21150F]">${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[#2D5A43] font-medium">
                  <span>Roastery Fleet Delivery</span>
                  <span className="font-mono uppercase tracking-wider font-bold">Complimentary</span>
                </div>
                <div className="flex justify-between text-base font-bold text-[#21150F] pt-2 border-t border-[#E8DAC8]">
                  <span className="font-serif">Total Amount</span>
                  <span className="font-mono text-[#D98943] text-lg font-bold">${total.toFixed(2)}</span>
                </div>
              </div>

              <button
                type="submit"
                form="order-form"
                disabled={submitting}
                className="w-full py-3.5 px-5 rounded-full bg-[#21150F] hover:bg-[#D98943] text-[#F3E9DC] hover:text-[#21150F] font-bold text-sm tracking-wide flex items-center justify-center gap-2.5 shadow-lg transition-all disabled:opacity-50 active:scale-98 cursor-pointer"
              >
                {submitting ? (
                  <span className="animate-pulse font-mono text-xs">Sending order to coffee shop...</span>
                ) : (
                  <>
                    <span>Place Order (${total.toFixed(2)})</span>
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
