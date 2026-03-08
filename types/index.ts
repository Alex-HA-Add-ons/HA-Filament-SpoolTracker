// Shared types for the application

export interface WebSocketMessage {
  type: string;
  data?: Record<string, unknown>;
  timestamp: number;
}

export interface WebSocketRequest {
  id?: string;
  type: string;
  data?: Record<string, unknown>;
}

export interface WebSocketResponse {
  id?: string;
  type: string;
  data?: Record<string, unknown>;
  error?: string;
}

export interface AppSettings {
  [key: string]: unknown;
}

export interface HealthStatus {
  status: string;
  timestamp: string;
  uptime: number;
  database: {
    connected: boolean;
  };
}
