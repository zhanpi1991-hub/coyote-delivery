import React, { useEffect } from 'react';
import { Check, Info, AlertTriangle, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'info' | 'error';
  title: string;
  description?: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
};

const ToastItem: React.FC<{ toast: ToastMessage; onDismiss: (id: string) => void }> = ({
  toast,
  onDismiss,
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, 3800);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const icons = {
    success: <Check className="w-4 h-4 text-[#D98943]" strokeWidth={2.5} />,
    info: <Info className="w-4 h-4 text-[#8A7668]" strokeWidth={2} />,
    error: <AlertTriangle className="w-4 h-4 text-red-500" strokeWidth={2} />,
  };

  return (
    <div className="pointer-events-auto bg-[#21150F] text-[#FAFAF7] border border-[#382216] rounded-xl p-3.5 shadow-2xl flex items-start gap-3 animate-fade-in">
      <div className="mt-0.5 shrink-0 bg-[#382216] p-1 rounded-lg">
        {icons[toast.type]}
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-xs font-bold text-white tracking-wide">{toast.title}</h4>
        {toast.description && (
          <p className="text-[11px] text-[#A69689] mt-0.5 leading-snug">{toast.description}</p>
        )}
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="text-[#8A7668] hover:text-[#FAFAF7] transition-colors p-1"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
