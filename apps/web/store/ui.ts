'use client';

import { create } from 'zustand';

export interface ToastItem {
  id: string;
  title: string;
  description?: string;
  tone: 'neutral' | 'success' | 'warning' | 'danger';
}

interface UiState {
  toasts: ToastItem[];
  toast: (t: Omit<ToastItem, 'id'>) => void;
  dismiss: (id: string) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  /** Desktop only: sidebar shrunk to an icon rail. Remembered per browser. */
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
}

const COLLAPSED_KEY = 'vp-sidebar-collapsed';
export const readSidebarCollapsed = () => {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
};

export const useUiStore = create<UiState>()((set) => ({
  toasts: [],
  toast: (t) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    set((s) => ({ toasts: [...s.toasts, { ...t, id }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), 5000);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
  sidebarOpen: false,
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  sidebarCollapsed: false,
  setSidebarCollapsed: (sidebarCollapsed) => {
    try {
      localStorage.setItem(COLLAPSED_KEY, sidebarCollapsed ? '1' : '0');
    } catch {
      /* storage unavailable: keep it for this session only */
    }
    set({ sidebarCollapsed });
  },
}));

export const toast = (t: Omit<ToastItem, 'id'>) => useUiStore.getState().toast(t);
