'use client';

import {
  SOCKET_EVENTS,
  type DocumentClassifiedEvent,
  type DocumentExtractedEvent,
  type DocumentStatusEvent,
  type FindingsUpdatedEvent,
  type SocketErrorEvent,
} from '@vp/shared';
import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/store/auth';
import { getSocket } from './client';

export interface IntakeHandlers {
  onStatus?: (e: DocumentStatusEvent) => void;
  onClassified?: (e: DocumentClassifiedEvent) => void;
  onExtracted?: (e: DocumentExtractedEvent) => void;
  onFindings?: (e: FindingsUpdatedEvent) => void;
  onError?: (e: SocketErrorEvent) => void;
  onConnect?: (connected: boolean) => void;
}

/** Subscribes to the /intake namespace; optionally joins a supplier room (buyers). */
export function useIntakeSocket(handlers: IntakeHandlers, opts: { supplierId?: string | null } = {}): void {
  const ref = useRef(handlers);
  ref.current = handlers;
  const token = useAuthStore((s) => s.tokens?.accessToken);

  useEffect(() => {
    if (!token) return;
    const socket = getSocket();
    if (!socket) return;
    const onStatus = (e: DocumentStatusEvent) => ref.current.onStatus?.(e);
    const onClassified = (e: DocumentClassifiedEvent) => ref.current.onClassified?.(e);
    const onExtracted = (e: DocumentExtractedEvent) => ref.current.onExtracted?.(e);
    const onFindings = (e: FindingsUpdatedEvent) => ref.current.onFindings?.(e);
    const onError = (e: SocketErrorEvent) => ref.current.onError?.(e);
    const onConnect = () => {
      ref.current.onConnect?.(true);
      if (opts.supplierId) socket.emit('subscribe:supplier', { supplierId: opts.supplierId });
    };
    const onDisconnect = () => ref.current.onConnect?.(false);
    socket.on(SOCKET_EVENTS.documentStatus, onStatus);
    socket.on(SOCKET_EVENTS.documentClassified, onClassified);
    socket.on(SOCKET_EVENTS.documentExtracted, onExtracted);
    socket.on(SOCKET_EVENTS.findingsUpdated, onFindings);
    socket.on(SOCKET_EVENTS.error, onError);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    if (socket.connected) onConnect();
    return () => {
      socket.off(SOCKET_EVENTS.documentStatus, onStatus);
      socket.off(SOCKET_EVENTS.documentClassified, onClassified);
      socket.off(SOCKET_EVENTS.documentExtracted, onExtracted);
      socket.off(SOCKET_EVENTS.findingsUpdated, onFindings);
      socket.off(SOCKET_EVENTS.error, onError);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, [token, opts.supplierId]);
}
