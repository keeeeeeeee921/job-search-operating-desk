"use client";

import type { ReactNode } from "react";
import { DemoModeProvider } from "@/components/demo-mode-provider";
import { ToastProvider } from "@/components/toast-provider";

export function AppProviders({
  publicDemo = false,
  children
}: {
  publicDemo?: boolean;
  children: ReactNode;
}) {
  return (
    <DemoModeProvider publicDemo={publicDemo}>
      {children}
      <ToastProvider />
    </DemoModeProvider>
  );
}
