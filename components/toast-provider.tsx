"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import { useJobDeskStore } from "@/lib/store";
import { cn } from "@/lib/utils";

function ToastItem({
  id,
  title,
  tone
}: {
  id: string;
  title: string;
  tone: "success" | "warning" | "error";
}) {
  const dismissToast = useJobDeskStore((state) => state.dismissToast);

  useEffect(() => {
    const timer = window.setTimeout(() => dismissToast(id), 2600);
    return () => window.clearTimeout(timer);
  }, [dismissToast, id]);

  return (
    <motion.div
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className={cn(
        "w-[280px] rounded-2xl border px-4 py-3 text-sm shadow-lift backdrop-blur",
        tone === "success" && "border-emerald-200 bg-emerald-50 text-emerald-900",
        tone === "warning" && "border-amber-200 bg-amber-50 text-amber-900",
        tone === "error" && "border-rose-200 bg-rose-50 text-rose-900"
      )}
      exit={{ opacity: 0, y: 10, scale: 0.98 }}
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      layout
    >
      {title}
    </motion.div>
  );
}

export function ToastProvider() {
  const toasts = useJobDeskStore((state) => state.toasts);

  return (
    <div className="pointer-events-none fixed right-6 top-6 z-[60] flex flex-col gap-2">
      <AnimatePresence>
        {toasts.map((toast) => (
          <ToastItem
            id={toast.id}
            key={toast.id}
            title={toast.title}
            tone={toast.tone}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
