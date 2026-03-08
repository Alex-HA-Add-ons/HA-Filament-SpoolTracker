import http from 'http';
import WebSocket from 'ws';
import { WebSocketMessage, WebSocketRequest, WebSocketResponse } from '@ha-addon/types';
import { LOG } from '../utils/logger';

const logger = LOG('WS');

interface WebSocketClient {
  ws: WebSocket;
  id: string;
  connectedAt: number;
  lastActivity: number;
}

export class WebSocketManager {
  private wss: WebSocket.Server;
  private clients: Map<string, WebSocketClient> = new Map();

  constructor(server: http.Server) {
    this.wss = new WebSocket.Server({ server });
    this.setupWebSocketServer();
  }

  private setupWebSocketServer(): void {
    this.wss.on('connection', (ws: WebSocket, _req: unknown) => {
      const clientId = this.generateClientId();
      const client: WebSocketClient = {
        ws,
        id: clientId,
        connectedAt: Date.now(),
        lastActivity: Date.now()
      };

      logger.debug('Client connected:', clientId);
      this.clients.set(clientId, client);

      const message: WebSocketMessage = {
        type: 'connection',
        data: { status: 'connected', clientId, timestamp: Date.now() },
        timestamp: Date.now()
      };
      ws.send(JSON.stringify(message));

      ws.on('message', (data: WebSocket.Data) => {
        try {
          this.handleMessage(clientId, data.toString());
        } catch (error) {
          logger.error('Error handling message:', error);
          this.sendError(clientId, 'message_processing_error', 'Failed to process message');
        }
      });

      ws.on('close', () => {
        logger.debug('Client disconnected:', clientId);
        this.clients.delete(clientId);
      });

      ws.on('error', (error: Error) => {
        logger.error('WebSocket error for client:', clientId, error);
        this.clients.delete(clientId);
      });
    });
  }

  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private handleMessage(clientId: string, messageData: string): void {
    let message: WebSocketRequest;
    try {
      message = JSON.parse(messageData);
    } catch {
      this.sendError(clientId, 'invalid_json', 'Invalid JSON format');
      return;
    }

    const client = this.clients.get(clientId);
    if (!client) return;

    client.lastActivity = Date.now();

    if (!message.id) {
      message.id = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    switch (message.type) {
      case 'ping':
        this.sendToClient(clientId, {
          id: message.id,
          type: 'pong',
          data: { timestamp: Date.now() }
        });
        break;
      default:
        this.sendError(clientId, 'unknown_message_type', `Unknown message type: ${message.type}`);
    }
  }

  private sendToClient(clientId: string, message: WebSocketResponse): void {
    const client = this.clients.get(clientId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(message));
    }
  }

  private sendError(clientId: string, errorType: string, message: string): void {
    this.sendToClient(clientId, {
      type: 'error',
      error: message,
      data: { errorType }
    });
  }

  public broadcast(data: WebSocketMessage): void {
    this.clients.forEach(client => {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify(data));
      }
    });
  }

  public getConnectedClientsCount(): number {
    return this.clients.size;
  }
}
