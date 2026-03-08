// Shared types for the application

export interface WebSocketMessage {
  type: string;
  data?: any;
  timestamp: number;
}

export interface WebSocketRequest {
  id?: string;
  type: string;
  data?: any;
}

export interface WebSocketResponse {
  id?: string;
  type: string;
  data?: any;
  error?: string;
}

export interface AppSettings {
  [key: string]: any;
}

export interface HealthStatus {
  status: string;
  timestamp: string;
  uptime: number;
  database: {
    connected: boolean;
  };
}
