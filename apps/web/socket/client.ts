'use client';

import { io, type Socket } from 'socket.io-client';
import { API_URL } from '@/services/config';
import { useAuthStore } from '@/store/auth';

let socket: Socket | null = null;
let socketToken: string | null = null;

export function getSocket(): Socket | null {
  const token = useAuthStore.getState().tokens?.accessToken ?? null;
  if (!token) return null;
  if (socket && socketToken === token) return socket;
  socket?.disconnect();
  socketToken = token;
  socket = io(`${API_URL}/intake`, {
    auth: { token },
    // WebSocket only: long-polling cannot work when requests land on different serverless instances (Vercel).
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelayMax: 5000,
  });
  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
  socketToken = null;
}
