export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/$/, '');
export const API_PREFIX = '/api/v1';
export const API_BASE = `${API_URL}${API_PREFIX}`;
