"use client";

import { create } from "zustand";
import type { ToastMessage } from "@/lib/types";
import { createId } from "@/lib/utils";

interface JobDeskState {
  toasts: ToastMessage[];
  pushToast: (title: string, tone: ToastMessage["tone"]) => void;
  dismissToast: (id: string) => void;
}

export const useJobDeskStore = create<JobDeskState>((set) => ({
  toasts: [],
  pushToast: (title, tone) => {
    const id = createId();
    set((state) => ({
      toasts: [...state.toasts, { id, title, tone }]
    }));
  },
  dismissToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id)
    }));
  }
}));
