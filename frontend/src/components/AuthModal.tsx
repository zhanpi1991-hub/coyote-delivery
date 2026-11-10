import React, { useState } from 'react';
import { X, Lock, Phone, User as UserIcon, ArrowRight, ShieldCheck, Coffee } from 'lucide-react';
import { api } from '../services/api';
import type { User } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (user: User) => void;
  initialMode?: 'login' | 'register';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onAuthSuccess,
  initialMode = 'login',
}) => {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'register') {
        if (!name.trim()) throw new Error('Please enter your full name');
        if (!phone.trim()) throw new Error('Please enter your phone number');
        if (password.length < 6) throw new Error('Password must be at least 6 characters');

        const res = await api.register({
          name: name.trim(),
          phone: phone.trim(),
          password,
        });
        onAuthSuccess(res.user);
        onClose();
      } else {
        if (!phone.trim()) throw new Error('Please enter your phone number');
        if (!password) throw new Error('Please enter your password');

        const res = await api.login({
          phone: phone.trim(),
          password,
        });
        onAuthSuccess(res.user);
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemoLogin = async (demoPhone: string, roleLabel: string) => {
    setError(null);
    setLoading(true);
    setPhone(demoPhone);
    setPassword('coyote2026');

    try {
      const res = await api.login({
        phone: demoPhone,
        password: 'coyote2026',
      });
      onAuthSuccess(res.user);
      onClose();
    } catch (err: any) {
      setError(`Failed to sign in as ${roleLabel}: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md bg-[#FAFAF7] rounded-2xl shadow-2xl border border-[#E8DAC8] overflow-hidden text-[#21150F]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8DAC8] bg-[#F2EDE4]">
          <div className="flex items-center gap-2">
            <Coffee className="w-5 h-5 text-[#D98943]" />
            <h2 className="font-serif text-lg font-bold tracking-tight text-[#21150F]">
              {mode === 'login' ? 'Sign In to Coyote' : 'Create Customer Account'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-[#8A7668] hover:text-[#21150F] hover:bg-[#E8DAC8]/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-[#E8DAC8] bg-[#FAFAF7]">
          <button
            onClick={() => { setMode('login'); setError(null); }}
            className={`flex-1 py-3 text-sm font-medium transition-colors border-b-2 ${
              mode === 'login'
                ? 'border-[#D98943] text-[#21150F] font-bold bg-[#F2EDE4]/50'
                : 'border-transparent text-[#8A7668] hover:text-[#21150F]'
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => { setMode('register'); setError(null); }}
            className={`flex-1 py-3 text-sm font-medium transition-colors border-b-2 ${
              mode === 'register'
                ? 'border-[#D98943] text-[#21150F] font-bold bg-[#F2EDE4]/50'
                : 'border-transparent text-[#8A7668] hover:text-[#21150F]'
            }`}
          >
            Register
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 text-xs bg-red-50 border border-red-200 text-red-700 rounded-lg">
              {error}
            </div>
          )}

          {mode === 'register' && (
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-[#8A7668] mb-1">
                Full Name
              </label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-3 w-4 h-4 text-[#8A7668]" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Alikhan Talgat"
                  className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-[#E8DAC8] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#D98943] focus:border-transparent"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-mono uppercase tracking-wider text-[#8A7668] mb-1">
              Phone Number
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-3 w-4 h-4 text-[#8A7668]" />
              <input
                type="text"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+7 (701) 000-0000"
                className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-[#E8DAC8] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#D98943] focus:border-transparent font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono uppercase tracking-wider text-[#8A7668] mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 w-4 h-4 text-[#8A7668]" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-[#E8DAC8] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#D98943] focus:border-transparent"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 bg-[#21150F] hover:bg-[#382216] text-[#FAFAF7] rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all shadow-md disabled:opacity-50 cursor-pointer"
          >
            {loading ? (
              <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <>
                <span>{mode === 'login' ? 'Sign In' : 'Create Customer Account'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Demo Fast Logins Section for Hackathon Reviewers */}
        <div className="p-4 bg-[#F2EDE4] border-t border-[#E8DAC8]">
          <div className="flex items-center gap-1.5 mb-2.5">
            <ShieldCheck className="w-4 h-4 text-[#D98943]" />
            <span className="text-[11px] font-mono uppercase tracking-wider text-[#8A7668] font-bold">
              Judge & Demo Fast Access (Pre-seeded Accounts)
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              type="button"
              onClick={() => handleQuickDemoLogin('+7 (701) 333-4455', 'Barista Sarah (Staff)')}
              className="p-2 text-left bg-white border border-[#E8DAC8] rounded-lg hover:border-[#D98943] hover:bg-[#FAFAF7] transition-all cursor-pointer"
            >
              <div className="font-bold text-[#21150F]">☕ Barista Sarah</div>
              <div className="text-[10px] text-[#8A7668] font-mono">Role: staff</div>
            </button>

            <button
              type="button"
              onClick={() => handleQuickDemoLogin('+7 (701) 555-6677', 'Manager Elena (Admin)')}
              className="p-2 text-left bg-white border border-[#E8DAC8] rounded-lg hover:border-[#D98943] hover:bg-[#FAFAF7] transition-all cursor-pointer"
            >
              <div className="font-bold text-[#21150F]">👑 Manager Elena</div>
              <div className="text-[10px] text-[#8A7668] font-mono">Role: admin</div>
            </button>

            <button
              type="button"
              onClick={() => handleQuickDemoLogin('+7 (777) 123-4567', 'Damir S. (Courier)')}
              className="p-2 text-left bg-white border border-[#E8DAC8] rounded-lg hover:border-[#D98943] hover:bg-[#FAFAF7] transition-all cursor-pointer"
            >
              <div className="font-bold text-[#21150F]">🚴 Damir S.</div>
              <div className="text-[10px] text-[#8A7668] font-mono">Role: courier</div>
            </button>

            <button
              type="button"
              onClick={() => handleQuickDemoLogin('+7 (701) 111-2233', 'Alikhan T. (Customer)')}
              className="p-2 text-left bg-white border border-[#E8DAC8] rounded-lg hover:border-[#D98943] hover:bg-[#FAFAF7] transition-all cursor-pointer"
            >
              <div className="font-bold text-[#21150F]">👤 Alikhan T.</div>
              <div className="text-[10px] text-[#8A7668] font-mono">Role: customer</div>
            </button>
          </div>
          <div className="mt-2 text-[10px] text-center text-[#8A7668] font-mono">
            Default test password: <span className="font-bold text-[#21150F]">coyote2026</span>
          </div>
        </div>
      </div>
    </div>
  );
};
