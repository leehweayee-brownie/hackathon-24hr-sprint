export const DOCUMENTS_QUEUE = 'documents';
export const PROCESS_DOCUMENT_JOB = 'process';
export const QUEUE_PREFIX = 'vp';

export interface ProcessDocumentJob {
  documentId: string;
}
