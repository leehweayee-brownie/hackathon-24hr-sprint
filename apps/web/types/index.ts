import type { DocType, PaginationMeta, UserRole } from '@vp/shared';

export interface Paginated<T> {
  items: T[];
  meta: PaginationMeta;
}

export interface SupplierSummary {
  id: string;
  name: string;
  registrationNo: string | null;
  trustScore?: number | null;
  passportStatus?: string | null;
}

export interface AccessRequestView {
  id: string;
  buyerId: string;
  buyerName: string;
  supplierId: string;
  supplierName?: string;
  requestedByName?: string;
  message: string | null;
  status: 'PENDING' | 'GRANTED' | 'DECLINED';
  shareId: string | null;
  createdAt: string;
}

export interface ShareViewerView {
  id: string;
  viewerName: string | null;
  viewerOrganization: string | null;
  viewerIp: string | null;
  viewedAt: string;
}

export interface AuditLogView {
  id: string;
  actorId: string | null;
  actorName: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface AdminOrganizationView {
  id: string;
  type: 'SUPPLIER' | 'BUYER' | 'ADMIN';
  name: string;
  registrationNo: string | null;
  createdAt: string;
  users: Array<{
    id: string;
    name: string;
    email: string;
    role: UserRole;
    emailVerifiedAt: string | null;
    suspendedAt: string | null;
  }>;
}

export interface AdminDocTypeView {
  type: DocType;
  label: string;
  description: string;
  hasExpiry: boolean;
  scored: boolean;
  fields: Array<{ key: string; label: string; kind: string; required: boolean; description: string }>;
}

export interface AdminRulesView {
  weights: Record<string, number>;
  confidenceThreshold: number;
  expiryWarningDays: number;
}

export interface QueueHealthView {
  queue: string;
  counts: { waiting: number; active: number; completed: number; failed: number; delayed: number };
  failedDocuments: Array<{ id: string; fileName: string; supplierName?: string; error: string | null; attempts: number; updatedAt: string }>;
  redis: 'up' | 'down';
}

export interface AiUsageView {
  totals: { calls: number; inputTokens: number; outputTokens: number; costUsd: number; cached: number };
  byDay: Array<{ day: string; calls: number; costUsd: number }>;
  byCheck?: Array<{ vendorCheckId: string; supplierName: string; costUsd: number; calls: number }>;
  bySupplier?: Array<{ supplierId: string; supplierName: string; costUsd: number; calls: number }>;
  model?: string;
}

export interface UploadProgress {
  localId: string;
  fileName: string;
  size: number;
  progress: number;
  status: 'uploading' | 'done' | 'error';
  error?: string;
  documentId?: string;
}
