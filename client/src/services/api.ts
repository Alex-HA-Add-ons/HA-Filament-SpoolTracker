import axios, { AxiosRequestConfig } from 'axios';
import type {
  Spool, PrintJob, Printer, DashboardStats,
  SpoolCreateRequest, SpoolUpdateRequest, DeductionRequest,
  PrinterCreateRequest, PrinterUpdateRequest,
  PrintJobCreateRequest, PrintJobUpdateRequest,
  HAConnectionStatus, HADiscoveredEntity, AppSettings,
} from '@ha-addon/types';

export const getApiBaseURL = () => {
  const isIngress = window.location.pathname.includes('/api/hassio_ingress/');

  if (isIngress) {
    const ingressPath = window.location.pathname.replace('/api/hassio_ingress/', '').replace(/\/$/, '');
    return `/api/hassio_ingress/${ingressPath}/api`;
  }
  return '/api';
};

const API_TIMEOUT_MS: number = (() => {
  const raw = import.meta.env?.VITE_API_TIMEOUT_MS as string | undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 30000;
})();

const api = axios.create({
  baseURL: getApiBaseURL(),
  timeout: API_TIMEOUT_MS,
  headers: { 'Content-Type': 'application/json' },
});

interface RetryConfig extends AxiosRequestConfig {
  __retryCount?: number;
}

api.interceptors.response.use(
  (response) => response,
  async (error: { code?: string; message?: string; response?: unknown; config?: RetryConfig }) => {
    const config: RetryConfig = error.config || {};
    const method: string = (config.method || 'get').toLowerCase();
    const isTimeout = error.code === 'ECONNABORTED' || /timeout/i.test(error.message || '');
    const isNetwork = !error.response;
    const isGet = method === 'get';

    if ((isTimeout || isNetwork) && isGet) {
      config.__retryCount = config.__retryCount || 0;
      if (config.__retryCount < 2) {
        config.__retryCount += 1;
        await new Promise((r) => setTimeout(r, 300 * config.__retryCount!));
        return api.request(config);
      }
    }

    return Promise.reject(error);
  }
);

export default api;

export const healthApi = {
  getHealth: () => api.get('/health'),
  getStatus: () => api.get('/status'),
};

export const spoolsApi = {
  getAll: (status?: string) => api.get<Spool[]>('/spools', { params: { status } }),
  getById: (id: string) => api.get<Spool>(`/spools/${id}`),
  create: (data: SpoolCreateRequest) => api.post<Spool>('/spools', data),
  update: (id: string, data: SpoolUpdateRequest) => api.put<Spool>(`/spools/${id}`, data),
  delete: (id: string) => api.delete(`/spools/${id}`),
  deduct: (id: string, data: DeductionRequest) => api.post<Spool>(`/spools/${id}/deduct`, data),
  archive: (id: string) => api.post<Spool>(`/spools/${id}/archive`),
  activate: (id: string) => api.post<Spool>(`/spools/${id}/activate`),
};

export const printJobsApi = {
  getAll: (params?: { printerId?: string; spoolId?: string; status?: string; limit?: number; offset?: number }) =>
    api.get<PrintJob[]>('/print-jobs', { params }),
  getById: (id: string) => api.get<PrintJob>(`/print-jobs/${id}`),
  create: (data: PrintJobCreateRequest) => api.post<PrintJob>('/print-jobs', data),
  update: (id: string, data: PrintJobUpdateRequest) => api.put<PrintJob>(`/print-jobs/${id}`, data),
  delete: (id: string) => api.delete(`/print-jobs/${id}`),
};

export const printersApi = {
  getAll: () => api.get<Printer[]>('/printers'),
  create: (data: PrinterCreateRequest) => api.post<Printer>('/printers', data),
  update: (id: string, data: PrinterUpdateRequest) => api.put<Printer>(`/printers/${id}`, data),
  delete: (id: string) => api.delete(`/printers/${id}`),
};

export const dashboardApi = {
  getStats: () => api.get<DashboardStats>('/dashboard/stats'),
};

export const haApi = {
  getStatus: () => api.get<HAConnectionStatus>('/ha/status'),
  getEntities: () => api.get<HADiscoveredEntity[]>('/ha/entities'),
  /** Fetch state or attribute. Use id[attribute] in ids for an attribute (e.g. image.x_cover_image[entity_picture]). */
  getEntityStates: (ids: string[]) =>
    api.get<Record<string, string | null>>('/ha/entities/states', {
      params: { ids: ids.filter(Boolean).join(',') },
    }),
};

export const settingsApi = {
  getAll: () => api.get<AppSettings>('/settings'),
  update: (data: Record<string, string>) => api.put<AppSettings>('/settings', data),
};
