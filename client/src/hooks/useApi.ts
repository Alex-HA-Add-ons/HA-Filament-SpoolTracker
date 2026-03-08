import api, { healthApi } from '@services/api';

export function useApi() {
  return { api, healthApi } as const;
}
