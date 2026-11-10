import React, { useState } from 'react';
import { Logo } from './Logo';
import { ShoppingBag, Search, Store, Bike, Coffee, LogIn, LogOut } from 'lucide-react';
import type { User } from '../types';

interface NavbarProps {
  activeRole: 'customer' | 'admin' | 'courier';
  setActiveRole: (role: 'customer' | 'admin' | 'courier') => void;
  cartCount: number;
  currentUser: User | null;
  onOpenCart: () => void;
  onTrackOrder: (identifier: string) => void;
  onOpenAuth: () => void;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeRole,
  setActiveRole,
  cartCount,
  currentUser,
  onOpenCart,
  onTrackOrder,
  onOpenAuth,
  onLogout,
}) => {
  const [trackInput, setTrackInput] = useState('');

  const handleTrackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = trackInput.trim();
    if (query) {
      onTrackOrder(query);
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
              type="text"
              placeholder="Track by Order # or Token"
              value={trackInput}
              onChange={(e) => setTrackInput(e.target.value)}
              className="w-full bg-[#2C1E17] border border-[#382216] rounded-full py-2 pl-9 pr-14 text-xs text-[#FAFAF7] placeholder-[#8A7668] focus:outline-none focus:border-[#D98943] focus:ring-1 focus:ring-[#D98943] transition-all font-sans"
            />
            <Search className="w-3.5 h-3.5 text-[#8A7668] absolute left-3.5 pointer-events-none" />
            {trackInput && (
              <button
                type="submit"
                className="absolute right-1 text-[11px] bg-[#D98943] hover:bg-[#E8A264] text-[#21150F] font-bold px-2.5 py-1 rounded-full transition-colors cursor-pointer"
              >
                Track
              </button>
            )}
          </form>

          {/* Role Navigation, Auth & Cart */}
          <div className="flex items-center gap-2 sm:gap-3">

            {/* Role Switcher Pill */}
            <div className="flex items-center bg-[#2C1E17] p-1 rounded-full border border-[#382216] text-xs">
              <button
                onClick={() => setActiveRole('customer')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all cursor-pointer ${
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
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all cursor-pointer ${
                  activeRole === 'admin'
                    ? 'bg-[#D98943] text-[#21150F] font-bold shadow-sm'
                    : 'text-[#A69689] hover:text-[#FAFAF7]'
                }`}
              >
                <Store className="w-3.5 h-3.5" />
                <span className="hidden sm:inline font-sans">Kitchen</span>
              </button>

              <button
                onClick={() => setActiveRole('courier')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all cursor-pointer ${
                  activeRole === 'courier'
                    ? 'bg-[#D98943] text-[#21150F] font-bold shadow-sm'
                    : 'text-[#A69689] hover:text-[#FAFAF7]'
                }`}
              >
                <Bike className="w-3.5 h-3.5" />
                <span className="hidden sm:inline font-sans">Courier</span>
              </button>
            </div>

            {/* User Auth Pill */}
            {currentUser ? (
              <div className="flex items-center gap-2 bg-[#2C1E17] pl-3 pr-1 py-1 rounded-full border border-[#382216] text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="font-medium text-[#FAFAF7] truncate max-w-[90px] sm:max-w-[130px]">
                    {currentUser.name.split(' ')[0]}
                  </span>
                  <span className="px-1.5 py-0.5 rounded-full bg-[#382216] text-[#D98943] text-[10px] font-mono uppercase font-bold">
                    {currentUser.role}
                  </span>
                </div>

                <button
                  onClick={onLogout}
                  className="p-1 rounded-full text-[#8A7668] hover:text-white hover:bg-[#382216] transition-colors cursor-pointer"
                  title="Sign Out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={onOpenAuth}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#2C1E17] hover:bg-[#382216] border border-[#382216] text-xs text-[#FAFAF7] transition-all cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5 text-[#D98943]" />
                <span className="font-sans">Sign In</span>
              </button>
            )}

            {/* Cart Button */}
            <button
              onClick={onOpenCart}
              className="relative flex items-center justify-center h-9 px-3 rounded-full bg-[#382216] hover:bg-[#D98943] text-[#F3E9DC] hover:text-[#21150F] border border-[#8A7668]/30 transition-all active:scale-95 cursor-pointer group"
              title="View Cart"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span className="ml-1.5 font-bold text-xs font-mono">
                {cartCount}
              </span>
            </button>
          </div>
        </div>

        {/* Mobile Track Order Search Row */}
        <div className="lg:hidden pb-3 pt-1">
          <form onSubmit={handleTrackSubmit} className="relative w-full">
            <input
              type="text"
              placeholder="Track by Order # or Token"
              value={trackInput}
              onChange={(e) => setTrackInput(e.target.value)}
              className="w-full bg-[#2C1E17] border border-[#382216] rounded-full py-1.5 pl-8 pr-14 text-xs text-[#FAFAF7] placeholder-[#8A7668] focus:outline-none focus:border-[#D98943]"
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
