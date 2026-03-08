import api, { healthApi, spoolsApi, printJobsApi, printersApi, dashboardApi, haApi, settingsApi } from '@services/api';

export function useApi() {
  return { api, healthApi, spoolsApi, printJobsApi, printersApi, dashboardApi, haApi, settingsApi } as const;
}
