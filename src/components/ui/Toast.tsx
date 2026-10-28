import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

interface Toast {
  id: number;
  message: string;
  action?: { label: string; run: () => void };
  error?: boolean;
}
type ShowToast = (t: Omit<Toast, 'id'>) => void;

const ToastContext = createContext<ShowToast>(() => {});

/** One toast at a time, at the bottom of the screen. Used for confirmations and errors. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const show = useCallback<ShowToast>((t) => setToast({ ...t, id: Date.now() }), []);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), toast.action ? 6000 : 3500);
    return () => clearTimeout(id);
  }, [toast]);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="toast-region" role="status" aria-live="polite">
        {toast && (
          <div key={toast.id} className={`toast${toast.error ? ' toast-error' : ''}`}>
            <span>{toast.message}</span>
            {toast.action && (
              <button type="button" className="link-button" onClick={() => { toast.action!.run(); setToast(null); }}>
                {toast.action.label}
              </button>
            )}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ShowToast {
  return useContext(ToastContext);
}
