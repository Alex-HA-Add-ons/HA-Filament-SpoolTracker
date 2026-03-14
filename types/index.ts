// ── Data Models ──

export interface Printer {
  id: string;
  name: string;
  haDeviceId: string;
  entityPrefix: string;
  model: string | null;
  isActive: boolean;
  activeSpoolId: string | null;
  entityPrintStatus: string | null;
  entityTaskName: string | null;
  entityPrintWeight: string | null;
  entityCoverImage: string | null;
  entityPrintStart: string | null;
  createdAt: string;
  updatedAt: string;
  activeSpool?: Spool | null;
}

export interface Spool {
  id: string;
  name: string;
  filamentType: string;
  color: string;
  colorHex: string | null;
  manufacturer: string | null;
  initialWeight: number;
  remainingWeight: number;
  spoolWeight: number | null;
  diameter: number;
  isActive: boolean;
  isArchived: boolean;
  expirationDate: string | null;
  purchaseDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  /** Set when this spool is the active (loaded) spool on a printer. */
  loadedOnPrinter?: { id: string; name: string } | null;
}

export interface PrintJob {
  id: string;
  printerId: string | null;
  spoolId: string | null;
  projectName: string;
  projectImage: string | null;
  filamentUsed: number | null;
  status: PrintJobStatus;
  startedAt: string;
  completedAt: string | null;
  progress: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  printer?: Printer | null;
  spool?: Spool | null;
}

export type PrintJobStatus = 'in_progress' | 'completed' | 'failed' | 'cancelled';

export type FilamentType = 'PLA' | 'PETG' | 'TPU' | 'ABS' | 'ASA' | 'Nylon' | 'PC' | 'PVA' | 'HIPS' | 'Other';

// ── API Request Types ──

export interface SpoolCreateRequest {
  name: string;
  filamentType: string;
  color: string;
  colorHex?: string;
  manufacturer?: string;
  initialWeight: number;
  remainingWeight?: number;
  spoolWeight?: number;
  diameter?: number;
  expirationDate?: string;
  purchaseDate?: string;
  notes?: string;
}

export interface SpoolUpdateRequest extends Partial<SpoolCreateRequest> {
  isActive?: boolean;
  isArchived?: boolean;
}

export interface DeductionRequest {
  amount: number;
  reason?: string;
}

export interface PrinterCreateRequest {
  name: string;
  haDeviceId: string;
  entityPrefix: string;
  model?: string;
  activeSpoolId?: string | null;
  entityPrintStatus?: string | null;
  entityTaskName?: string | null;
  entityPrintWeight?: string | null;
  entityCoverImage?: string | null;
  entityPrintStart?: string | null;
}

export interface PrinterUpdateRequest extends Partial<PrinterCreateRequest> {
  isActive?: boolean;
  activeSpoolId?: string | null;
}

export interface PrintJobCreateRequest {
  projectName: string;
  printerId?: string | null;
  spoolId?: string | null;
  projectImage?: string | null;
  filamentUsed?: number | null;
  status?: PrintJobStatus;
  notes?: string | null;
}

export interface PrintJobUpdateRequest {
  spoolId?: string | null;
  status?: PrintJobStatus;
  notes?: string;
}

export interface SettingsUpdateRequest {
  [key: string]: string;
}

// ── API Response Types ──

export interface DashboardStats {
  totalSpools: number;
  activeSpools: number;
  totalFilamentStock: number;
  registeredPrinters: number;
  activePrintJobs: number;
  lowFilamentAlerts: number;
  recentPrintJobs: PrintJob[];
  lowFilamentSpools: Spool[];
  activeSpoolsList: Spool[];
  /** Printers with activeSpool for dashboard "loaded spool" quick update */
  printersList: Printer[];
  /** Non-archived spools (id, name, filamentType) for loaded-spool dropdowns */
  spoolsList: Pick<Spool, 'id' | 'name' | 'filamentType' | 'color' | 'colorHex'>[];
}

export interface HAConnectionStatus {
  connected: boolean;
  printerCount: number;
}

export interface HADiscoveredEntity {
  entityId: string;
  deviceId: string;
  deviceName: string;
  model: string | null;
  entities: string[];
}

export interface HealthStatus {
  status: string;
  timestamp: string;
  uptime: number;
  database: {
    connected: boolean;
  };
}

export interface AppSettings {
  [key: string]: string;
}
