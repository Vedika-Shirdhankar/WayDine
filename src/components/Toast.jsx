import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { CheckCircle, AlertTriangle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

import { showToast, registerGlobalToast } from '../services/toastBus.js';
export { showToast, registerGlobalToast };

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', duration = 3500) => {
    setToasts(prev => {
      // Prevent duplicate identical toasts from flooding the screen
      if (prev.some(t => t.message === message)) {
        return prev;
      }
      const id = Date.now() + Math.random();
      setTimeout(() => {
        setToasts(current => current.filter(t => t.id !== id));
      }, duration);
      // Keep maximum 3 toasts visible at once
      const next = [...prev, { id, message, type }];
      return next.slice(-3);
    });
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  useEffect(() => {
    const unregister = registerGlobalToast(addToast);
    const handleCustomToast = (e) => {
      if (e.detail?.message) {
        addToast(e.detail.message, e.detail.type || 'info', e.detail.duration || 3500);
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('waydine:toast', handleCustomToast);
    }
    return () => {
      unregister();
      if (typeof window !== 'undefined') {
        window.removeEventListener('waydine:toast', handleCustomToast);
      }
    };
  }, [addToast]);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div
        role="region"
        aria-live="polite"
        aria-label="Notifications"
        className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 max-w-sm pointer-events-none"
      >
        {toasts.map(toast => (
          <div
            key={toast.id}
            role="alert"
            className={`pointer-events-auto flex items-center justify-between p-3.5 rounded-xl border shadow-xl backdrop-blur-md transition-all duration-300 animate-slide-up ${
              toast.type === 'success'
                ? 'bg-[#102a1e]/90 border-success/40 text-success'
                : toast.type === 'warning'
                ? 'bg-[#2b1f0c]/90 border-warning/40 text-warning'
                : toast.type === 'danger'
                ? 'bg-[#2d1115]/90 border-danger/40 text-danger'
                : 'bg-card/90 border-borderStrong text-textMain'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {toast.type === 'success' && <CheckCircle className="w-4 h-4 shrink-0 text-success" />}
              {toast.type === 'warning' && <AlertTriangle className="w-4 h-4 shrink-0 text-warning" />}
              {toast.type === 'danger' && <AlertTriangle className="w-4 h-4 shrink-0 text-danger" />}
              {toast.type === 'info' && <Info className="w-4 h-4 shrink-0 text-accent" />}
              <span className="text-xs font-medium leading-relaxed">{toast.message}</span>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              aria-label="Dismiss notification"
              className="ml-3 p-1 rounded hover:bg-white/10 text-muted hover:text-white transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}
