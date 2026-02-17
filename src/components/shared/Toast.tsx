"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle, AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface ToastMessage {
  id: string;
  type: "success" | "error" | "info" | "achievement";
  title: string;
  description?: string;
  icon?: string;
  duration?: number;
}

let toastListeners: ((toast: ToastMessage) => void)[] = [];

export function showToast(toast: Omit<ToastMessage, "id">) {
  const id = Date.now().toString() + Math.random().toString(36).slice(2);
  toastListeners.forEach((fn) => fn({ ...toast, id }));
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const listener = (toast: ToastMessage) => {
      setToasts((prev) => [...prev, toast]);
    };
    toastListeners.push(listener);
    return () => {
      toastListeners = toastListeners.filter((l) => l !== listener);
    };
  }, []);

  useEffect(() => {
    if (toasts.length === 0) return;
    const timer = setTimeout(() => {
      setToasts((prev) => prev.slice(1));
    }, toasts[0]?.duration || 3000);
    return () => clearTimeout(timer);
  }, [toasts]);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const icons = {
    success: <CheckCircle size={20} className="text-green-500" />,
    error: <AlertCircle size={20} className="text-red-500" />,
    info: <Info size={20} className="text-blue-500" />,
    achievement: null,
  };

  return (
    <div className="fixed top-4 left-0 right-0 z-[100] flex flex-col items-center gap-2 pointer-events-none px-4">
      <AnimatePresence mode="sync">
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 350, damping: 30 }}
            className={cn(
              "pointer-events-auto w-full max-w-sm rounded-2xl p-4 shadow-lg border",
              "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700",
              toast.type === "achievement" &&
                "bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 border-amber-200 dark:border-amber-700"
            )}
          >
            <div className="flex items-start gap-3">
              {toast.type === "achievement" ? (
                <span className="text-2xl">{toast.icon || "🏆"}</span>
              ) : (
                icons[toast.type]
              )}
              <div className="flex-1 min-w-0">
                <p
                  className={cn(
                    "font-semibold text-sm",
                    toast.type === "achievement" && "text-amber-800 dark:text-amber-200"
                  )}
                >
                  {toast.title}
                </p>
                {toast.description && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {toast.description}
                  </p>
                )}
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="p-0.5 text-gray-400 hover:text-gray-600"
              >
                <X size={16} />
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
