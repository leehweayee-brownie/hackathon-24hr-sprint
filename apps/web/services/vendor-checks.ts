import type { DocType, VendorCheckView } from '@vp/shared';
import type { AuditLogView, SupplierSummary } from '@/types';
import { get, getPaged, patch, post } from './http';

export interface CreateVendorCheckInput {
  supplierId: string;
  tenderTitle: string;
  contractValue: number;
  requiredDocTypes: DocType[];
}

export const vendorChecksService = {
  list: (params: { status?: string; page?: number; pageSize?: number } = {}) =>
    getPaged<VendorCheckView>('/vendor-checks', { pageSize: 100, ...params }),
  get: (id: string) => get<VendorCheckView>(`/vendor-checks/${id}`),
  create: (input: CreateVendorCheckInput) => post<VendorCheckView>('/vendor-checks', input),
  update: (id: string, input: Partial<Pick<CreateVendorCheckInput, 'tenderTitle' | 'contractValue' | 'requiredDocTypes'>>) =>
    patch<VendorCheckView>(`/vendor-checks/${id}`, input),
  requestInfo: (id: string, note: string) => post<VendorCheckView>(`/vendor-checks/${id}/request-info`, { note }),
  approve: (id: string, note?: string) => post<VendorCheckView>(`/vendor-checks/${id}/approve`, { note }),
  reject: (id: string, note: string) => post<VendorCheckView>(`/vendor-checks/${id}/reject`, { note }),
  suppliers: (q?: string) => get<SupplierSummary[]>('/suppliers', q ? { q } : undefined),
  audit: (entity: string, entityId: string) => get<AuditLogView[]>('/audit', { entity, entityId }),
};
