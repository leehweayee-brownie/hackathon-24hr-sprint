import type { NotificationView } from '@vp/shared';
import { get, patch, post } from './http';

export const notificationsService = {
  list: () => get<NotificationView[]>('/notifications'),
  markRead: (id: string) => patch<NotificationView>(`/notifications/${id}/read`),
  markAllRead: () => post<null>('/notifications/read-all'),
};
