import { useState, useEffect, useCallback, createContext, useContext, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle, AlertCircle, X } from "lucide-react";

type ToastVariant = "success" | "error" | "info";

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface ToastOptions {
  action?: ToastAction;
  duration?: number;  // ms; defaults to 3000, or 6000 when an action is present
}

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
  action?: ToastAction;
  duration: number;
}

interface ToastContextValue {
  toast: (
    message: string,
    variant?: ToastVariant,
    options?: ToastOptions
  ) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const toast = useCallback(
    (message: string, variant: ToastVariant = "success", options?: ToastOptions) => {
      const id = ++nextId;
      const duration = options?.duration ?? (options?.action ? 6000 : 3000);
      setToasts((prev) => [
        ...prev,
        { id, message, variant, action: options?.action, duration },
      ]);
    },
    []
  );

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed top-[env(safe-area-inset-top)] left-0 right-0 z-[100] flex flex-col items-center gap-2 px-4 pt-3 pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => (
            <ToastItem key={t.id} item={t} onDismiss={dismiss} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ item, onDismiss }: { item: ToastItem; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(item.id), item.duration);
    return () => clearTimeout(timer);
  }, [item.id, item.duration, onDismiss]);

  const Icon = item.variant === "error" ? AlertCircle : item.variant === "success" ? CheckCircle : null;
  const colors =
    item.variant === "error"
      ? "bg-red-600 text-white"
      : item.variant === "success"
        ? "bg-gray-900 text-white"
        : "bg-gray-900 text-white";

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      transition={{ duration: 0.15 }}
      drag="y"
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={0.6}
      onDragEnd={(_e, info) => {
        if (info.offset.y < -40) onDismiss(item.id);
      }}
      className={`pointer-events-auto flex w-full max-w-sm items-center gap-2 rounded-xl px-4 py-3 shadow-lg ${colors}`}
    >
      {Icon && <Icon className="h-4 w-4 shrink-0" />}
      <p className="flex-1 text-sm font-medium">{item.message}</p>
      {item.action && (
        <button
          type="button"
          onClick={() => {
            item.action?.onClick();
            onDismiss(item.id);
          }}
          className="shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold uppercase tracking-wide underline-offset-2 hover:underline"
        >
          {item.action.label}
        </button>
      )}
      <button
        type="button"
        onClick={() => onDismiss(item.id)}
        className="shrink-0 rounded-md p-0.5 opacity-60 hover:opacity-100"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </motion.div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
