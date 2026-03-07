"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  title: string;
  description?: string;
  className?: string;
}

export function Dialog({
  open,
  onOpenChange,
  children,
  title,
  description,
  className
}: DialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open ? (
          <DialogPrimitive.Portal forceMount>
            <DialogPrimitive.Overlay asChild forceMount>
              <motion.div
                animate={{ opacity: 1 }}
                className="fixed inset-0 z-40 bg-slate-950/20 backdrop-blur-sm"
                exit={{ opacity: 0 }}
                initial={{ opacity: 0 }}
              />
            </DialogPrimitive.Overlay>
            <DialogPrimitive.Content asChild forceMount>
              <motion.div
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className={cn(
                  "fixed left-1/2 top-1/2 z-50 max-h-[85vh] w-[min(720px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[28px] border border-border bg-white p-6 shadow-lift outline-none",
                  className
                )}
                exit={{ opacity: 0, y: 12, scale: 0.98 }}
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              >
                <DialogPrimitive.Title className="text-lg font-semibold text-foreground">
                  {title}
                </DialogPrimitive.Title>
                {description ? (
                  <DialogPrimitive.Description className="mt-2 text-sm text-muted-foreground">
                    {description}
                  </DialogPrimitive.Description>
                ) : null}
                <div className="mt-5">{children}</div>
              </motion.div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        ) : null}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}
