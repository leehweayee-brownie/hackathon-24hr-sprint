import type { PassportShareView, PassportView } from '@vp/shared';
import type { AccessRequestView, ShareViewerView } from '@/types';
import { del, get, patch, post } from './http';

export const passportService = {
  mine: () => get<PassportView>('/passport'),
  shares: () => get<PassportShareView[]>('/passport/shares'),
  createShare: (input: { label?: string; expiresAt?: string | null; buyerId?: string | null }) =>
    post<PassportShareView>('/passport/shares', input),
  revokeShare: (id: string) => del<null>(`/passport/shares/${id}`),
  shareViews: (id: string) => get<ShareViewerView[]>(`/passport/shares/${id}/views`),
  public: (token: string) => get<PassportView & { share?: { label: string | null; expiresAt: string | null } }>(`/p/${token}`),
  publicFileUrl: (token: string, documentId: string) => get<{ url: string }>(`/p/${token}/documents/${documentId}/file`),
  accessRequests: (params?: { status?: string }) => get<AccessRequestView[]>('/access-requests', params),
  createAccessRequest: (input: { supplierId: string; message?: string }) => post<AccessRequestView>('/access-requests', input),
  respondAccessRequest: (id: string, action: 'grant' | 'decline') => patch<AccessRequestView>(`/access-requests/${id}`, { action }),
};
