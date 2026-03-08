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
            <div className="fixed inset-0 z-50 grid place-items-center p-4 sm:p-6">
                <DialogPrimitive.Content asChild forceMount>
                  <motion.div
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    className={cn(
                      "relative grid h-[min(92dvh,960px)] w-full max-w-[720px] min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-[28px] border border-border bg-white p-6 shadow-lift outline-none sm:h-[min(88dvh,920px)]",
                      className
                    )}
                    exit={{ opacity: 0, y: 12, scale: 0.98 }}
                    initial={{ opacity: 0, y: 12, scale: 0.98 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                  >
                    <div className="shrink-0">
                      <DialogPrimitive.Title className="text-lg font-semibold text-foreground">
                        {title}
                      </DialogPrimitive.Title>
                      {description ? (
                        <DialogPrimitive.Description className="mt-2 text-sm text-muted-foreground">
                          {description}
                        </DialogPrimitive.Description>
                      ) : null}
                    </div>
                    <div className="mt-5 min-h-0 overflow-hidden">
                      {children}
                    </div>
                  </motion.div>
                </DialogPrimitive.Content>
            </div>
          </DialogPrimitive.Portal>
        ) : null}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}
