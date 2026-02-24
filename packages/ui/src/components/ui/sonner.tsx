"use client"

import React, { createContext, useContext, useCallback, useState, useEffect, useRef } from "react"
import { CircleCheck, Info, OctagonX, TriangleAlert, LoaderCircle, X } from "lucide-react"

type ToastType = "success" | "error" | "warning" | "info" | "loading" | "default"
type Phase = "thread" | "expand" | "visible" | "exit"

interface Toast {
  id: string
  type: ToastType
  title: string
  description?: string
  duration?: number
  action?: { label: string; onClick: () => void }
}

type ToastOptions = Omit<Toast, "id">

interface ToastContextValue {
  toast: (options: ToastOptions) => string
  dismiss: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>")
  return ctx
}

let _toast: ToastContextValue["toast"] | null = null
let _dismiss: ToastContextValue["dismiss"] | null = null

export const toast = Object.assign(
  (options: ToastOptions) => _toast?.(options) ?? "",
  {
    success: (title: string, opts?: Partial<ToastOptions>) => _toast?.({ ...opts, type: "success", title }) ?? "",
    error: (title: string, opts?: Partial<ToastOptions>) => _toast?.({ ...opts, type: "error", title }) ?? "",
    warning: (title: string, opts?: Partial<ToastOptions>) => _toast?.({ ...opts, type: "warning", title }) ?? "",
    info: (title: string, opts?: Partial<ToastOptions>) => _toast?.({ ...opts, type: "info", title }) ?? "",
    loading: (title: string, opts?: Partial<ToastOptions>) => _toast?.({ ...opts, type: "loading", title }) ?? "",
    dismiss: (id: string) => _dismiss?.(id),
  }
)

const ICONS: Record<ToastType, React.ReactNode> = {
  success: <CircleCheck className="h-4 w-4" />,
  error: <OctagonX className="h-4 w-4" />,
  warning: <TriangleAlert className="h-4 w-4" />,
  info: <Info className="h-4 w-4" />,
  loading: <LoaderCircle className="h-4 w-4 animate-spin" />,
  default: <Info className="h-4 w-4" />,
}

const ICON_COLORS: Record<ToastType, string> = {
  success: "text-emerald-500",
  error: "text-red-500",
  warning: "text-amber-500",
  info: "text-blue-500",
  loading: "text-muted-foreground",
  default: "text-muted-foreground",
}

const PHASE_STYLES: Record<Phase, React.CSSProperties> = {
  thread: {
    opacity: 0.42,
    transform: "translateY(-10px) scaleY(0.06) scaleX(0.56)",
    borderRadius: "99px",
    maxHeight: "6px",
    marginBottom: "0px",
  },
  expand: {
    opacity: 1,
    transform: "translateY(1px) scaleY(1.035) scaleX(1.01)",
    borderRadius: "12px",
    maxHeight: "140px",
    marginBottom: "8px",
  },
  visible: {
    opacity: 1,
    transform: "translateY(0) scaleY(1) scaleX(1)",
    borderRadius: "12px",
    maxHeight: "140px",
    marginBottom: "8px",
  },
  exit: {
    opacity: 0,
    transform: "translateY(-10px) scaleY(0.9) scaleX(0.97)",
    borderRadius: "16px",
    maxHeight: "0px",
    marginBottom: "0px",
  },
}

const PHASE_TRANSITIONS: Partial<Record<Phase, string>> = {
  expand: "opacity 0.66s cubic-bezier(0.22,1,0.36,1), transform 0.78s cubic-bezier(0.22,1,0.36,1), border-radius 0.58s cubic-bezier(0.22,1,0.36,1), max-height 0.78s cubic-bezier(0.22,1,0.36,1), margin-bottom 0.78s cubic-bezier(0.22,1,0.36,1)",
  visible: "transform 0.36s cubic-bezier(0.16,1,0.3,1), border-radius 0.32s cubic-bezier(0.16,1,0.3,1)",
  exit: "opacity 0.5s cubic-bezier(0.4,0,0.2,1), transform 0.56s cubic-bezier(0.4,0,0.2,1), border-radius 0.46s cubic-bezier(0.4,0,0.2,1), max-height 0.62s cubic-bezier(0.4,0,0.2,1), margin-bottom 0.62s cubic-bezier(0.4,0,0.2,1)",
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const [phase, setPhase] = useState<Phase>("thread")
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("expand"), 10)
    const t2 = setTimeout(() => setPhase("visible"), 760)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  useEffect(() => {
    if (toast.type === "loading") return
    timerRef.current = setTimeout(handleDismiss, toast.duration ?? 4000)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [])

  const handleDismiss = useCallback(() => {
    setPhase("exit")
    setTimeout(() => onDismiss(toast.id), 700)
  }, [toast.id, onDismiss])

  return (
    <div
      style={{
        ...PHASE_STYLES[phase],
        transition: PHASE_TRANSITIONS[phase],
        transformOrigin: "bottom center",
        overflow: "hidden",
        willChange: "transform, opacity, max-height, margin-bottom",
      }}
      className="group relative flex items-start gap-3 bg-background border border-border shadow-lg px-4 py-3 w-[360px] max-w-[calc(100vw-2rem)] cursor-pointer select-none hover:border-foreground/20 transition-[border-color] duration-200"
      onClick={handleDismiss}
    >
      <span className={`mt-0.5 shrink-0 ${ICON_COLORS[toast.type]}`}>
        {ICONS[toast.type]}
      </span>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground leading-snug">{toast.title}</p>
        {toast.description && (
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{toast.description}</p>
        )}
        {toast.action && (
          <button
            onClick={(e) => { e.stopPropagation(); toast.action!.onClick() }}
            className="mt-1.5 text-xs font-medium text-foreground underline underline-offset-2 hover:no-underline"
          >
            {toast.action.label}
          </button>
        )}
      </div>

      <button
        onClick={(e) => { e.stopPropagation(); handleDismiss() }}
        className="shrink-0 mt-0.5 text-muted-foreground hover:text-foreground transition-colors"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      {toast.type !== "loading" && phase === "visible" && (
        <div className="absolute bottom-0 left-0 h-[2px] bg-foreground/10 w-full">
          <div
            className="h-full bg-foreground/25"
            style={{ animation: `toast-progress ${toast.duration ?? 4000}ms linear forwards` }}
          />
        </div>
      )}
    </div>
  )
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((options: ToastOptions): string => {
    const id = Math.random().toString(36).slice(2)
    setToasts((prev) => [...prev, { ...options, id }])
    return id
  }, [])

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  useEffect(() => {
    _toast = addToast
    _dismiss = dismiss
    return () => { _toast = null; _dismiss = null }
  }, [addToast, dismiss])

  return (
    <ToastContext.Provider value={{ toast: addToast, dismiss }}>
      {children}
      <div
        aria-live="polite"
        style={{ position: "fixed", top: "1rem", left: "50%", transform: "translateX(-50%)", zIndex: 9999, display: "flex", flexDirection: "column", alignItems: "center", pointerEvents: "none" }}
      >
        <div style={{ pointerEvents: "auto" }}>
          {toasts.map((t) => (
            <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
          ))}
        </div>
      </div>
      <style>{`@keyframes toast-progress { from { width: 100%; } to { width: 0%; } }`}</style>
    </ToastContext.Provider>
  )
}

export function Toaster({ children }: { children?: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>
}
