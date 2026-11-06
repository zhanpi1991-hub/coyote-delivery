import React, { useState, useMemo } from 'react';
import type { Product, CartItem } from '../types';
import { Plus, Minus, Search, ArrowDown, Sparkles, Clock, Coffee } from 'lucide-react';

interface CustomerMenuProps {
  products: Product[];
  cart: CartItem[];
  onAddToCart: (product: Product) => void;
  onUpdateQuantity: (productId: number, delta: number) => void;
  loading: boolean;
  onOpenCart: () => void;
}

const CATEGORIES = ['All', 'Coffee Classics', 'Signatures', 'Tea & More', 'Bakery & Treats'];

export const CustomerMenu: React.FC<CustomerMenuProps> = ({
  products,
  cart,
  onAddToCart,
  onUpdateQuantity,
  loading,
  onOpenCart,
}) => {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Map product id to quantity in cart
  const cartQuantityMap = useMemo(() => {
    const map = new Map<number, number>();
    cart.forEach((item) => map.set(item.product.id, item.quantity));
    return map;
  }, [cart]);

  // Total items in cart
  const totalCartCount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  }, [cart]);

  const totalCartPrice = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  }, [cart]);

  const filteredProducts = useMemo(() => {
    return products.filter((prod) => {
      const matchCategory = selectedCategory === 'All' || prod.category === selectedCategory;
      const matchSearch =
        prod.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (prod.description && prod.description.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchCategory && matchSearch;
    });
  }, [products, selectedCategory, searchQuery]);

  const scrollToMenu = () => {
    const el = document.getElementById('menu-section');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="pb-28">
      {/* Editorial Hero Section */}
      <section className="relative overflow-hidden rounded-3xl bg-[#21150F] text-[#FAFAF7] p-8 sm:p-12 lg:p-16 mb-12 border border-[#382216] shadow-xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">

          {/* Left Narrative Column */}
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#382216] border border-[#8A7668]/30 text-[#D98943] text-xs font-semibold tracking-wider uppercase">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Direct Coffee Shop Delivery</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-serif tracking-tight leading-[1.08] text-white">
              Great Coffee. <br />
              <span className="italic font-normal text-[#D98943]">Delivered.</span>
            </h1>

            <p className="text-[#A69689] text-base sm:text-lg leading-relaxed max-w-xl font-sans font-normal">
              Direct from the espresso bar to your doorstep. Handcrafted drinks, signature coffee classics, and fresh morning bakery items delivered by our dedicated courier fleet.
            </p>

            {/* Action & Features */}
            <div className="pt-2 flex flex-wrap items-center gap-4">
              <button
                onClick={scrollToMenu}
                className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-full bg-[#D98943] hover:bg-[#E8A264] text-[#21150F] font-bold text-sm tracking-wide transition-all shadow-md active:scale-98 cursor-pointer"
              >
                <span>Explore the Menu</span>
                <ArrowDown className="w-4 h-4" />
              </button>

              <div className="text-xs text-[#8A7668] flex items-center gap-2 border-l border-[#382216] pl-4">
                <Clock className="w-4 h-4 text-[#D98943]" />
                <span>20–30 min direct courier dispatch</span>
              </div>
            </div>

            {/* Key Value Props Bar */}
            <div className="grid grid-cols-3 gap-4 pt-6 border-t border-[#382216]/80 text-xs">
              <div>
                <span className="block text-[#D98943] font-serif text-sm font-bold">Specialty</span>
                <span className="text-[#8A7668] text-[11px] uppercase tracking-wider">Coffee Experience</span>
              </div>
              <div>
                <span className="block text-[#D98943] font-serif text-sm font-bold">Direct</span>
                <span className="text-[#8A7668] text-[11px] uppercase tracking-wider">Coffee Shop Delivery</span>
              </div>
              <div>
                <span className="block text-[#D98943] font-serif text-sm font-bold">One Connected</span>
                <span className="text-[#8A7668] text-[11px] uppercase tracking-wider">Delivery Workflow</span>
              </div>
            </div>
          </div>

          {/* Right Visual Imagery Column */}
          <div className="lg:col-span-5 relative">
            <div className="relative rounded-2xl overflow-hidden aspect-4/3 lg:aspect-square border border-[#382216] shadow-2xl group">
              <img
                src="https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=800&q=80"
                alt="Artisanal pour over and espresso extraction"
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#21150F]/80 via-transparent to-transparent pointer-events-none" />

              <div className="absolute bottom-4 left-4 right-4 p-4 rounded-xl bg-[#21150F]/85 backdrop-blur-md border border-[#382216]">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Coffee className="w-4 h-4 text-[#D98943]" />
                    <span className="font-semibold text-white">House Signature</span>
                  </div>
                  <span className="text-[#D98943] font-mono font-bold">$5.80</span>
                </div>
                <p className="text-[11px] text-[#A69689] mt-1">Coyote Salted Caramel Raf • Whipped with Himalayan salt</p>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* Menu Header, Filter Pills & Search */}
      <div id="menu-section" className="pt-4 mb-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-[#E8DAC8]">
          <div>
            <span className="text-xs font-mono font-semibold uppercase tracking-widest text-[#8A7668] block mb-1">
              Curated Daily Menu
            </span>
            <h2 className="text-3xl sm:text-4xl font-serif text-[#21150F] tracking-tight">
              Beverages & Kitchen
            </h2>
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-72">
            <input
              type="text"
              placeholder="Search beans, roast, pastries..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#FAF4EC] border border-[#E8DAC8] rounded-full py-2 pl-9 pr-4 text-xs text-[#21150F] placeholder-[#8A7668] focus:outline-none focus:border-[#D98943] focus:ring-1 focus:ring-[#D98943] transition-all"
            />
            <Search className="w-3.5 h-3.5 text-[#8A7668] absolute left-3.5 top-3 pointer-events-none" />
          </div>
        </div>

        {/* Categories Bar */}
        <div className="flex items-center gap-2 overflow-x-auto py-4 no-scrollbar">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`whitespace-nowrap px-4 py-2 rounded-full text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-[#21150F] text-[#F3E9DC] shadow-sm'
                  : 'bg-[#FAF4EC] text-[#8A7668] hover:text-[#21150F] hover:bg-[#F3E9DC] border border-[#E8DAC8]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Loading Skeleton State */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="bg-white rounded-2xl p-5 border border-[#E8DAC8] shadow-xs animate-pulse">
              <div className="w-full h-52 bg-[#FAF4EC] rounded-xl mb-4" />
              <div className="h-5 bg-[#FAF4EC] rounded w-2/3 mb-2" />
              <div className="h-3.5 bg-[#FAF4EC] rounded w-full mb-4" />
              <div className="flex justify-between items-center pt-2">
                <div className="h-6 bg-[#FAF4EC] rounded w-16" />
                <div className="h-9 bg-[#FAF4EC] rounded-full w-24" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Products Grid */}
      {!loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredProducts.map((product) => {
            const quantityInCart = cartQuantityMap.get(product.id) || 0;

            return (
              <div
                key={product.id}
                className="bg-white rounded-2xl overflow-hidden border border-[#E8DAC8] hover:border-[#D98943]/60 transition-all duration-300 shadow-xs hover:shadow-lg flex flex-col group"
              >
                {/* Product Imagery */}
                <div className="relative h-56 sm:h-60 w-full overflow-hidden bg-[#FAF4EC]">
                  <img
                    src={product.image || 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=600&q=80'}
                    alt={product.name}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    loading="lazy"
                  />
                  <div className="absolute top-3.5 left-3.5">
                    <span className="text-[10px] font-mono uppercase tracking-widest font-bold px-2.5 py-1 rounded-full bg-[#21150F]/85 backdrop-blur-sm text-[#F3E9DC] border border-[#382216]">
                      {product.category}
                    </span>
                  </div>
                  {!product.available && (
                    <div className="absolute inset-0 bg-[#21150F]/80 backdrop-blur-xs flex items-center justify-center">
                      <span className="text-[#FAFAF7] font-sans font-bold text-xs uppercase tracking-widest bg-red-800/90 px-3.5 py-1.5 rounded-full border border-red-700">
                        Sold Out
                      </span>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                  <div>
                    <h3 className="font-serif font-bold text-[#21150F] text-xl mb-1.5 leading-snug group-hover:text-[#D98943] transition-colors">
                      {product.name}
                    </h3>
                    <p className="text-[#8A7668] text-xs leading-relaxed line-clamp-2">
                      {product.description}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-[#FAF4EC]">
                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-widest text-[#8A7668] block">Price</span>
                      <span className="text-xl font-bold font-mono text-[#21150F]">
                        ${product.price.toFixed(2)}
                      </span>
                    </div>

                    {/* Add to Cart / Quantity Stepper */}
                    {product.available ? (
                      quantityInCart > 0 ? (
                        <div className="flex items-center gap-1.5 bg-[#FAF4EC] rounded-full p-1 border border-[#E8DAC8]">
                          <button
                            onClick={() => onUpdateQuantity(product.id, -1)}
                            className="w-7 h-7 rounded-full bg-white hover:bg-[#F3E9DC] text-[#21150F] flex items-center justify-center transition-colors cursor-pointer"
                            title="Decrease"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="font-mono font-bold text-xs px-2 text-[#21150F]">
                            {quantityInCart}
                          </span>
                          <button
                            onClick={() => onUpdateQuantity(product.id, 1)}
                            className="w-7 h-7 rounded-full bg-[#D98943] hover:bg-[#E8A264] text-[#21150F] font-bold flex items-center justify-center transition-colors cursor-pointer"
                            title="Increase"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => onAddToCart(product)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#21150F] hover:bg-[#D98943] text-[#F3E9DC] hover:text-[#21150F] font-semibold text-xs transition-all shadow-xs active:scale-95 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add to Bag</span>
                        </button>
                      )
                    ) : (
                      <span className="text-xs text-[#8A7668] italic font-serif">Unavailable</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredProducts.length === 0 && (
        <div className="text-center py-20 bg-white rounded-3xl border border-[#E8DAC8] p-8 max-w-md mx-auto">
          <div className="w-14 h-14 rounded-full bg-[#FAF4EC] text-[#D98943] flex items-center justify-center mx-auto mb-4 border border-[#E8DAC8]">
            <Search className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-serif font-bold text-[#21150F] mb-1">No items match your search</h3>
          <p className="text-xs text-[#8A7668] mb-5 leading-relaxed">
            Try adjusting your search criteria or explore our other handcrafted roast selections.
          </p>
          <button
            onClick={() => {
              setSelectedCategory('All');
              setSearchQuery('');
            }}
            className="px-5 py-2 rounded-full bg-[#21150F] text-[#F3E9DC] text-xs font-bold hover:bg-[#D98943] hover:text-[#21150F] transition-all cursor-pointer"
          >
            Reset Catalog
          </button>
        </div>
      )}

      {/* Floating Bottom Cart Pill */}
      {totalCartCount > 0 && (
        <div className="fixed bottom-6 left-4 right-4 max-w-md mx-auto z-40">
          <button
            onClick={onOpenCart}
            className="w-full bg-[#21150F] hover:bg-[#2C1E17] text-[#FAFAF7] rounded-full p-3.5 px-6 shadow-2xl flex items-center justify-between border border-[#382216] transition-all transform active:scale-98 cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <span className="w-7 h-7 rounded-full bg-[#D98943] text-[#21150F] font-mono font-bold text-xs flex items-center justify-center">
                {totalCartCount}
              </span>
              <div className="text-left">
                <span className="text-xs font-bold text-white block">View Coffee Bag</span>
                <span className="text-[11px] text-[#A69689]">Free Delivery • 20–30 min</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm font-bold font-mono text-[#D98943]">
                ${totalCartPrice.toFixed(2)}
              </span>
              <span className="text-xs bg-[#D98943] text-[#21150F] font-bold px-3 py-1 rounded-full group-hover:bg-[#E8A264] transition-colors">
                Checkout →
              </span>
            </div>
          </button>
        </div>
      )}
    </div>
  );
};
