"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

type ToastType = "success" | "error" | "warning" | "info" | "loading" | "default";

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration?: number;
  action?: { label: string; onClick: () => void };
}

type ToastOptions = Omit<Toast, "id">;

interface ToastContextValue {
  toast: (options: ToastOptions) => string;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

let _toast: ToastContextValue["toast"] | null = null;
let _dismiss: ToastContextValue["dismiss"] | null = null;

export const toast = Object.assign(
  (options: ToastOptions) => _toast?.(options) ?? "",
  {
    success: (title: string, opts?: Partial<ToastOptions>) => _toast?.({ ...opts, type: "success", title }) ?? "",
    error: (title: string, opts?: Partial<ToastOptions>) => _toast?.({ ...opts, type: "error", title }) ?? "",
    warning: (title: string, opts?: Partial<ToastOptions>) => _toast?.({ ...opts, type: "warning", title }) ?? "",
    info: (title: string, opts?: Partial<ToastOptions>) => _toast?.({ ...opts, type: "info", title }) ?? "",
    loading: (title: string, opts?: Partial<ToastOptions>) => _toast?.({ ...opts, type: "loading", title }) ?? "",
    dismiss: (id: string) => _dismiss?.(id),
  },
);

function ToastItem({ toast }: { toast: Toast }) {
  return (
    <div className="ui-simple-toast rounded-2xl bg-neutral-700 px-4 py-3 text-center text-sm font-medium leading-snug text-white">
      {toast.title}
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [currentToast, setCurrentToast] = useState<Toast | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearCurrentTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const addToast = useCallback((options: ToastOptions): string => {
    const id = Math.random().toString(36).slice(2);
    clearCurrentTimer();
    setCurrentToast({ ...options, id });
    timeoutRef.current = setTimeout(() => {
      setCurrentToast((prev) => (prev?.id === id ? null : prev));
      timeoutRef.current = null;
    }, options.duration ?? 1000);
    return id;
  }, [clearCurrentTimer]);

  const dismiss = useCallback((id: string) => {
    clearCurrentTimer();
    setCurrentToast((prev) => (prev?.id === id ? null : prev));
  }, [clearCurrentTimer]);

  useEffect(() => {
    _toast = addToast;
    _dismiss = dismiss;
    return () => {
      _toast = null;
      _dismiss = null;
      clearCurrentTimer();
    };
  }, [addToast, clearCurrentTimer, dismiss]);

  return (
    <ToastContext.Provider value={{ toast: addToast, dismiss }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-0 z-[9999] flex items-center justify-center px-4"
      >
        {currentToast ? <ToastItem toast={currentToast} /> : null}
      </div>
      <style>{`
        .ui-simple-toast {
          animation: ui-simple-toast-in 180ms cubic-bezier(0.22, 1, 0.36, 1),
            ui-simple-toast-out 180ms cubic-bezier(0.4, 0, 0.2, 1) 820ms forwards;
          will-change: transform, opacity;
        }

        @keyframes ui-simple-toast-in {
          from {
            opacity: 0;
            transform: translateY(8px) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes ui-simple-toast-out {
          from {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
          to {
            opacity: 0;
            transform: translateY(-6px) scale(0.98);
          }
        }
      `}</style>
    </ToastContext.Provider>
  );
}

export function Toaster({ children }: { children?: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}
