import type { DocumentFieldView, DocumentView } from '@vp/shared';
import type { AxiosProgressEvent } from 'axios';
import { del, get, getPaged, patch, post } from './http';

export interface DocumentFilters {
  status?: string;
  docType?: string;
  page?: number;
  pageSize?: number;
  includeSuperseded?: boolean;
}

export const documentsService = {
  list: (filters: DocumentFilters = {}) => getPaged<DocumentView>('/documents', { pageSize: 100, ...filters }),
  get: (id: string) => get<DocumentView>(`/documents/${id}`),
  fileUrl: (id: string) => get<{ url: string; expiresAt?: string; mimeType?: string }>(`/documents/${id}/file`),
  upload: (files: File[], onProgress?: (e: AxiosProgressEvent) => void) => {
    const form = new FormData();
    for (const f of files) form.append('files', f, (f as File & { path?: string }).path?.replace(/^\.?\//, '') || f.name);
    return post<DocumentView[]>('/documents', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: onProgress,
      timeout: 10 * 60_000,
    });
  },
  remove: (id: string) => del<null>(`/documents/${id}`),
  reprocess: (id: string) => post<DocumentView>(`/documents/${id}/reprocess`),
  confirmField: (fieldId: string) => patch<DocumentFieldView>(`/fields/${fieldId}`, { action: 'confirm' }),
  correctField: (fieldId: string, value: string) => patch<DocumentFieldView>(`/fields/${fieldId}`, { action: 'correct', value }),
};
