'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { authService } from '@/services/auth';
import { disconnectSocket } from '@/socket/client';
import { useAuthStore } from '@/store/auth';
import { homeForUser } from '@/utils/roles';

export function useAuth() {
  const user = useAuthStore((s) => s.user);
  const tokens = useAuthStore((s) => s.tokens);
  const hydrated = useAuthStore((s) => s.hydrated);
  return { user, tokens, hydrated, isAuthenticated: !!user && !!tokens };
}

export function useLogin() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) => authService.login(email, password),
    onSuccess: ({ user, tokens }) => {
      setSession(user, tokens);
      router.replace(homeForUser(user));
    },
  });
}

export function useLogout() {
  const router = useRouter();
  const qc = useQueryClient();
  const clear = useAuthStore((s) => s.clear);
  return async () => {
    const refreshToken = useAuthStore.getState().tokens?.refreshToken;
    try {
      await authService.logout(refreshToken);
    } catch {
      // the session is cleared locally regardless
    }
    clear();
    disconnectSocket();
    qc.clear();
    router.replace('/login');
  };
}
