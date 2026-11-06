import React, { useState } from 'react';
import { Logo } from './Logo';
import { ShoppingBag, Search, Store, Bike, Coffee } from 'lucide-react';

interface NavbarProps {
  activeRole: 'customer' | 'admin' | 'courier';
  setActiveRole: (role: 'customer' | 'admin' | 'courier') => void;
  cartCount: number;
  onOpenCart: () => void;
  onTrackOrder: (orderId: number) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeRole,
  setActiveRole,
  cartCount,
  onOpenCart,
  onTrackOrder,
}) => {
  const [trackInput, setTrackInput] = useState('');

  const handleTrackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const id = parseInt(trackInput.trim(), 10);
    if (!isNaN(id) && id > 0) {
      onTrackOrder(id);
      setTrackInput('');
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-[#21150F]/95 backdrop-blur-md text-[#FAFAF7] border-b border-[#382216] transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-18 sm:h-20 gap-4">

          {/* Brand Logo Component */}
          <div
            onClick={() => setActiveRole('customer')}
            className="cursor-pointer group flex items-center py-2"
          >
            <Logo variant="light" size="md" showSecondary={true} />
          </div>

          {/* Quick Track Order Search (Desktop) */}
          <form onSubmit={handleTrackSubmit} className="hidden lg:flex items-center relative max-w-xs w-full">
            <input
              type="number"
              placeholder="Track Order # (e.g. 1)"
              value={trackInput}
              onChange={(e) => setTrackInput(e.target.value)}
              className="w-full bg-[#2C1E17] border border-[#382216] rounded-full py-2 pl-9 pr-12 text-xs text-[#FAFAF7] placeholder-[#8A7668] focus:outline-none focus:border-[#D98943] focus:ring-1 focus:ring-[#D98943] transition-all font-sans"
            />
            <Search className="w-3.5 h-3.5 text-[#8A7668] absolute left-3.5 pointer-events-none" />
            {trackInput && (
              <button
                type="submit"
                className="absolute right-1 text-[11px] bg-[#D98943] hover:bg-[#E8A264] text-[#21150F] font-bold px-2.5 py-1 rounded-full transition-colors cursor-pointer"
              >
                Go
              </button>
            )}
          </form>

          {/* Role Switcher Pill & Cart Button */}
          <div className="flex items-center gap-2.5 sm:gap-4">

            {/* Elegant Role Switcher */}
            <div className="flex items-center bg-[#2C1E17] p-1 rounded-full border border-[#382216] text-xs">
              <button
                onClick={() => setActiveRole('customer')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full transition-all cursor-pointer ${
                  activeRole === 'customer'
                    ? 'bg-[#D98943] text-[#21150F] font-bold shadow-sm'
                    : 'text-[#A69689] hover:text-[#FAFAF7]'
                }`}
              >
                <Coffee className="w-3.5 h-3.5" />
                <span className="hidden sm:inline font-sans">Menu</span>
              </button>

              <button
                onClick={() => setActiveRole('admin')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full transition-all cursor-pointer ${
                  activeRole === 'admin'
                    ? 'bg-[#D98943] text-[#21150F] font-bold shadow-sm'
                    : 'text-[#A69689] hover:text-[#FAFAF7]'
                }`}
              >
                <Store className="w-3.5 h-3.5" />
                <span className="hidden sm:inline font-sans">Coffee Shop</span>
                <span className="sm:hidden font-sans">Shop</span>
              </button>

              <button
                onClick={() => setActiveRole('courier')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full transition-all cursor-pointer ${
                  activeRole === 'courier'
                    ? 'bg-[#D98943] text-[#21150F] font-bold shadow-sm'
                    : 'text-[#A69689] hover:text-[#FAFAF7]'
                }`}
              >
                <Bike className="w-3.5 h-3.5" />
                <span className="hidden sm:inline font-sans">Courier</span>
              </button>
            </div>

            {/* Cart Button */}
            <button
              onClick={onOpenCart}
              className="relative flex items-center justify-center h-10 px-3.5 rounded-full bg-[#382216] hover:bg-[#D98943] text-[#F3E9DC] hover:text-[#21150F] border border-[#8A7668]/30 transition-all active:scale-95 cursor-pointer group"
              title="View Cart"
            >
              <ShoppingBag className="w-4 h-4" />
              <span className="ml-2 font-bold text-xs font-mono">
                {cartCount}
              </span>
            </button>
          </div>
        </div>

        {/* Mobile Track Order Search Row */}
        <div className="lg:hidden pb-3 pt-1">
          <form onSubmit={handleTrackSubmit} className="relative w-full">
            <input
              type="number"
              placeholder="Track Order # (e.g. 1)"
              value={trackInput}
              onChange={(e) => setTrackInput(e.target.value)}
              className="w-full bg-[#2C1E17] border border-[#382216] rounded-full py-1.5 pl-8 pr-12 text-xs text-[#FAFAF7] placeholder-[#8A7668] focus:outline-none focus:border-[#D98943]"
            />
            <Search className="w-3 h-3 text-[#8A7668] absolute left-3 top-2.5 pointer-events-none" />
            <button
              type="submit"
              className="absolute right-1 top-1 text-[11px] bg-[#D98943] text-[#21150F] font-bold px-2.5 py-0.5 rounded-full cursor-pointer"
            >
              Track
            </button>
          </form>
        </div>

      </div>
    </header>
  );
};
