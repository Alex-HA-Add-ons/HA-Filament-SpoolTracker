import axios, { AxiosRequestConfig } from 'axios';

const getApiBaseURL = () => {
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
    console.error('API Error:', error);

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
