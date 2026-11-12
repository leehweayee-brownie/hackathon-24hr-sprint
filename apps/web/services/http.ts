'use client';

import type { ApiError, ApiSuccess, AuthTokens, PaginationMeta } from '@vp/shared';
import axios, { AxiosError, type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/store/auth';
import { API_BASE } from './config';

export class HttpError extends Error {
  readonly status: number;
  readonly code: string | undefined;
  readonly errors: ApiError['errors'];

  constructor(status: number, body: Partial<ApiError> | undefined, fallback: string) {
    super(body?.message ?? fallback);
    this.status = status;
    this.code = body?.code;
    this.errors = body?.errors ?? [];
  }
}

export const http = axios.create({ baseURL: API_BASE, timeout: 60_000 });

http.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().tokens?.accessToken;
  if (token && !config.headers.Authorization) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshing: Promise<AuthTokens | null> | null = null;

async function refreshTokens(): Promise<AuthTokens | null> {
  const current = useAuthStore.getState().tokens;
  if (!current?.refreshToken) return null;
  try {
    const res = await axios.post<ApiSuccess<{ tokens: AuthTokens } | AuthTokens>>(`${API_BASE}/auth/refresh`, {
      refreshToken: current.refreshToken,
    });
    const data = res.data.data;
    const tokens = 'tokens' in data ? data.tokens : data;
    useAuthStore.getState().setTokens(tokens);
    return tokens;
  } catch {
    useAuthStore.getState().clear();
    return null;
  }
}

http.interceptors.response.use(
  (res) => res,
  async (error: AxiosError<ApiError>) => {
    const original = error.config as (AxiosRequestConfig & { _retried?: boolean }) | undefined;
    const isAuthRoute = original?.url?.startsWith('/auth/login') || original?.url?.startsWith('/auth/refresh');
    if (error.response?.status === 401 && original && !original._retried && !isAuthRoute && useAuthStore.getState().tokens) {
      original._retried = true;
      refreshing = refreshing ?? refreshTokens().finally(() => (refreshing = null));
      const tokens = await refreshing;
      if (tokens) {
        original.headers = { ...(original.headers ?? {}), Authorization: `Bearer ${tokens.accessToken}` };
        return http.request(original);
      }
    }
    const status = error.response?.status ?? 0;
    const fallback = status === 0 ? 'Cannot reach the API. Is it running?' : `Request failed (${status})`;
    throw new HttpError(status, error.response?.data, fallback);
  },
);

export async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  const res = await http.get<ApiSuccess<T>>(url, { params });
  return res.data.data;
}

export async function getPaged<T>(url: string, params?: Record<string, unknown>): Promise<{ items: T[]; meta: PaginationMeta }> {
  const res = await http.get<ApiSuccess<T[]>>(url, { params });
  const meta = res.data.meta ?? { page: 1, pageSize: res.data.data.length, total: res.data.data.length, totalPages: 1 };
  return { items: res.data.data, meta };
}

export async function post<T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> {
  const res = await http.post<ApiSuccess<T>>(url, body, config);
  return res.data.data;
}

export async function patch<T>(url: string, body?: unknown): Promise<T> {
  const res = await http.patch<ApiSuccess<T>>(url, body);
  return res.data.data;
}

export async function put<T>(url: string, body?: unknown): Promise<T> {
  const res = await http.put<ApiSuccess<T>>(url, body);
  return res.data.data;
}

export async function del<T>(url: string): Promise<T> {
  const res = await http.delete<ApiSuccess<T>>(url);
  return res.data.data;
}

export function errorMessage(err: unknown): string {
  if (err instanceof HttpError) {
    const first = err.errors[0]?.message;
    return first && first !== err.message ? `${err.message}: ${first}` : err.message;
  }
  if (err instanceof Error) return err.message;
  return 'Something went wrong';
}
