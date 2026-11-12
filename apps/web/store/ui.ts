'use client';

import { create } from 'zustand';
import { CURSOR_STORAGE_KEY, applyCursorTheme, isCursorTheme, type CursorThemeId } from '@/features/cursor/themes';

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
  /** Mouse cursor theme. Remembered per browser and applied before first paint by the root layout script. */
  cursorTheme: CursorThemeId;
  setCursorTheme: (theme: CursorThemeId) => void;
  /** Role picked on the login or sign-up form; drives the "Vendor / Buyer onboarding" label beside it. */
  authRole: 'vendor' | 'buyer';
  setAuthRole: (role: 'vendor' | 'buyer') => void;
}

export const readCursorTheme = (): CursorThemeId => {
  try {
    const v = localStorage.getItem(CURSOR_STORAGE_KEY);
    return isCursorTheme(v) ? v : 'none';
  } catch {
    return 'none';
  }
};

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
  authRole: 'vendor',
  setAuthRole: (authRole) => set({ authRole }),
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
  cursorTheme: 'none',
  setCursorTheme: (cursorTheme) => {
    try {
      localStorage.setItem(CURSOR_STORAGE_KEY, cursorTheme);
    } catch {
      /* storage unavailable: keep it for this session only */
    }
    applyCursorTheme(cursorTheme);
    set({ cursorTheme });
  },
}));

export const toast = (t: Omit<ToastItem, 'id'>) => useUiStore.getState().toast(t);
