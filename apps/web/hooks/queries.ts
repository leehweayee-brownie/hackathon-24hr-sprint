'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { documentsService, type DocumentFilters } from '@/services/documents';
import { notificationsService } from '@/services/notifications';
import { passportService } from '@/services/passport';
import { vendorChecksService } from '@/services/vendor-checks';

export const keys = {
  documents: (filters?: DocumentFilters) => ['documents', filters ?? {}] as const,
  document: (id: string) => ['document', id] as const,
  documentFile: (id: string) => ['document-file', id] as const,
  passport: ['passport'] as const,
  shares: ['passport-shares'] as const,
  shareViews: (id: string) => ['passport-share-views', id] as const,
  accessRequests: (status?: string) => ['access-requests', status ?? 'all'] as const,
  checks: (status?: string) => ['vendor-checks', status ?? 'all'] as const,
  check: (id: string) => ['vendor-check', id] as const,
  suppliers: ['suppliers'] as const,
  audit: (entity: string, id: string) => ['audit', entity, id] as const,
  notifications: ['notifications'] as const,
};

export const useDocuments = (filters?: DocumentFilters) =>
  useQuery({ queryKey: keys.documents(filters), queryFn: () => documentsService.list(filters) });

export const useDocument = (id: string) => useQuery({ queryKey: keys.document(id), queryFn: () => documentsService.get(id), enabled: !!id });

export const useDocumentFile = (id: string, enabled = true) =>
  useQuery({ queryKey: keys.documentFile(id), queryFn: () => documentsService.fileUrl(id), enabled: !!id && enabled, staleTime: 2 * 60_000 });

export const usePassport = () => useQuery({ queryKey: keys.passport, queryFn: passportService.mine });
export const useShares = () => useQuery({ queryKey: keys.shares, queryFn: passportService.shares });
export const useAccessRequests = (status?: string) =>
  useQuery({ queryKey: keys.accessRequests(status), queryFn: () => passportService.accessRequests(status ? { status } : undefined) });

export const useVendorChecks = (status?: string) =>
  useQuery({ queryKey: keys.checks(status), queryFn: () => vendorChecksService.list(status ? { status } : {}) });
export const useVendorCheck = (id: string) => useQuery({ queryKey: keys.check(id), queryFn: () => vendorChecksService.get(id), enabled: !!id });
export const useSuppliers = () => useQuery({ queryKey: keys.suppliers, queryFn: () => vendorChecksService.suppliers() });
export const useAudit = (entity: string, id: string) =>
  useQuery({ queryKey: keys.audit(entity, id), queryFn: () => vendorChecksService.audit(entity, id), enabled: !!id });

export const useNotifications = (enabled = true) =>
  useQuery({ queryKey: keys.notifications, queryFn: notificationsService.list, enabled, refetchInterval: 30_000 });

export function useFieldMutations(documentId: string) {
  const qc = useQueryClient();
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: keys.document(documentId) });
    void qc.invalidateQueries({ queryKey: ['vendor-check'] });
    void qc.invalidateQueries({ queryKey: keys.passport });
    void qc.invalidateQueries({ queryKey: ['documents'] });
  };
  const confirm = useMutation({ mutationFn: (fieldId: string) => documentsService.confirmField(fieldId), onSuccess: invalidate });
  const correct = useMutation({
    mutationFn: ({ fieldId, value }: { fieldId: string; value: string }) => documentsService.correctField(fieldId, value),
    onSuccess: invalidate,
  });
  return { confirm, correct };
}
