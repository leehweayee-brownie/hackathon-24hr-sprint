import type { AdminDocTypeView, AdminOrganizationView, AdminRulesView, AiUsageView, QueueHealthView } from '@/types';
import { del, get, patch, post, put } from './http';

export const adminService = {
  organizations: () => get<AdminOrganizationView[]>('/admin/organizations'),
  suspendUser: (id: string, suspended: boolean) => patch<null>(`/admin/users/${id}/suspend`, { suspended }),
  deleteUser: (id: string) => del<null>(`/admin/users/${id}`),
  documentTypes: () => get<AdminDocTypeView[]>('/admin/document-types'),
  rules: () => get<AdminRulesView>('/admin/rules'),
  saveRules: (input: AdminRulesView) => put<AdminRulesView>('/admin/rules', input),
  queue: () => get<QueueHealthView>('/admin/queue'),
  aiUsage: () => get<AiUsageView>('/admin/ai-usage'),
  runReminders: () => post<{ sent: number }>('/admin/reminders/run'),
};
