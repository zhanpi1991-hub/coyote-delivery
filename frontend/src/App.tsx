import React, { useState, useEffect } from 'react';
import type { Product, CartItem, Order } from './types';
import { api } from './services/api';
import { Navbar } from './components/Navbar';
import { CustomerMenu } from './components/CustomerMenu';
import { CartDrawer } from './components/CartDrawer';
import { OrderTracking } from './components/OrderTracking';
import { CoffeeShopDashboard } from './components/CoffeeShopDashboard';
import { CourierDashboard } from './components/CourierDashboard';
import { Logo } from './components/Logo';
import { ToastContainer, type ToastMessage } from './components/Toast';

export const App: React.FC = () => {
  const [activeRole, setActiveRole] = useState<'customer' | 'admin' | 'courier'>('customer');
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Persistent cart in localStorage
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('coyote_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [trackedOrderId, setTrackedOrderId] = useState<number | null>(null);

  const addToast = (type: 'success' | 'info' | 'error', title: string, description?: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, title, description }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Sync cart to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('coyote_cart', JSON.stringify(cart));
    } catch (e) {
      console.error(e);
    }
  }, [cart]);

  // Load products from API
  useEffect(() => {
    const loadProducts = async () => {
      setLoadingProducts(true);
      try {
        const data = await api.getProducts();
        setProducts(data);
      } catch (err) {
        console.error('Failed to load products', err);
        addToast('error', 'Failed to load menu', 'Could not connect to roastery backend.');
      } finally {
        setLoadingProducts(false);
      }
    };
    loadProducts();
  }, []);

  const handleAddToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
    addToast('success', 'Added to Bag', `${product.name} is in your coffee bag.`);
  };

  const handleUpdateQuantity = (productId: number, delta: number) => {
    setCart((prev) => {
      return prev
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[];
    });
  };

  const handleRemoveItem = (productId: number) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const handleClearCart = () => {
    setCart([]);
  };

  const handleOrderSuccess = (newOrder: Order) => {
    setTrackedOrderId(newOrder.id);
    setActiveRole('customer');
    addToast('success', `Order #${newOrder.id} Placed!`, 'Your order has been sent to the coffee shop.');
  };

  const handleTrackOrder = (orderId: number) => {
    setTrackedOrderId(orderId);
    setActiveRole('customer');
  };

  const totalCartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="min-h-screen bg-[#FAFAF7] text-[#21150F] flex flex-col font-sans selection:bg-[#D98943]/20 selection:text-[#21150F]">
      {/* Top Navigation */}
      <Navbar
        activeRole={activeRole}
        setActiveRole={(role) => {
          setActiveRole(role);
        }}
        cartCount={totalCartCount}
        onOpenCart={() => setIsCartOpen(true)}
        onTrackOrder={handleTrackOrder}
      />

      {/* Brand & Demo Switcher Helper Banner */}
      <div className="bg-[#1A100B] border-b border-[#382216] text-[#A69689] text-xs py-2 px-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#D98943] animate-pulse" />
            <span className="font-mono uppercase tracking-wider text-[11px] text-[#FAFAF7]">
              Coyote Delivery System
            </span>
            <span className="hidden sm:inline text-[#8A7668]">•</span>
            <span className="text-[#8A7668] hidden sm:inline text-[11px]">
              One Connected Delivery Workflow
            </span>
          </div>

          <div className="flex items-center gap-2 text-[11px] font-mono">
            <span className="text-[#8A7668]">Role Sandbox:</span>
            <button
              onClick={() => { setActiveRole('customer'); setTrackedOrderId(null); }}
              className={`px-2.5 py-0.5 rounded-full transition-colors cursor-pointer ${
                activeRole === 'customer' && !trackedOrderId
                  ? 'bg-[#D98943] text-[#21150F] font-bold'
                  : 'text-[#A69689] hover:text-white'
              }`}
            >
              1. Guest Menu
            </button>
            <button
              onClick={() => setActiveRole('admin')}
              className={`px-2.5 py-0.5 rounded-full transition-colors cursor-pointer ${
                activeRole === 'admin'
                  ? 'bg-[#D98943] text-[#21150F] font-bold'
                  : 'text-[#A69689] hover:text-white'
              }`}
            >
              2. POS Kitchen
            </button>
            <button
              onClick={() => setActiveRole('courier')}
              className={`px-2.5 py-0.5 rounded-full transition-colors cursor-pointer ${
                activeRole === 'courier'
                  ? 'bg-[#D98943] text-[#21150F] font-bold'
                  : 'text-[#A69689] hover:text-white'
              }`}
            >
              3. Courier App
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-10">
        {activeRole === 'customer' && (
          trackedOrderId ? (
            <OrderTracking
              orderId={trackedOrderId}
              onBackToMenu={() => setTrackedOrderId(null)}
            />
          ) : (
            <CustomerMenu
              products={products}
              cart={cart}
              onAddToCart={handleAddToCart}
              onUpdateQuantity={handleUpdateQuantity}
              loading={loadingProducts}
              onOpenCart={() => setIsCartOpen(true)}
            />
          )
        )}

        {activeRole === 'admin' && <CoffeeShopDashboard />}

        {activeRole === 'courier' && <CourierDashboard />}
      </main>

      {/* Cart Drawer */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cart={cart}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveItem}
        onClearCart={handleClearCart}
        onOrderSuccess={handleOrderSuccess}
      />

      {/* Toast Notification Container */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />

      {/* Editorial Footer */}
      <footer className="border-t border-[#E8DAC8] bg-[#21150F] text-[#FAFAF7] py-12 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-8 border-b border-[#382216]">
            <div>
              <Logo variant="light" size="lg" />
              <p className="text-xs text-[#8A7668] mt-2 font-serif italic max-w-sm">
                Specialty coffee crafted to perfection and delivered directly by our dedicated courier fleet.
              </p>
            </div>

            <div className="flex items-center gap-6 text-xs text-[#A69689] font-mono">
              <span>FastAPI Backend</span>
              <span>•</span>
              <span>One Connected Delivery Workflow</span>
              <span>•</span>
              <span>React 19 & Tailwind</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 text-[11px] text-[#8A7668]">
            <p>© 2026 COYOTE DELIVERY. All rights reserved.</p>
            <p className="font-mono">Case 01 — Own Delivery Based on Coyote POS</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
