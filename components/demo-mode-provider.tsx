"use client";

import { createContext, useContext, type ReactNode } from "react";

const DemoModeContext = createContext(false);

export function DemoModeProvider({
  publicDemo,
  children
}: {
  publicDemo: boolean;
  children: ReactNode;
}) {
  return (
    <DemoModeContext.Provider value={publicDemo}>{children}</DemoModeContext.Provider>
  );
}

/** True when the deployment runs with JOB_DESK_PUBLIC_DEMO=true (read-only). */
export function useDemoMode() {
  return useContext(DemoModeContext);
}
