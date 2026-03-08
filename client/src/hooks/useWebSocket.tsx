import React, { createContext, useContext, useEffect, useRef, useState, ReactNode, useCallback, useMemo } from 'react';

export type WsEventType = 'connection' | 'error' | 'pong';

export type EventPayloadMap = {
  connection: { status: string; clientId: string; timestamp: number };
  error: { error: string; errorType?: string };
  pong: { timestamp: number };
};

export type EventMessage<E extends WsEventType = WsEventType> = {
  id?: string;
  type: E;
  data: EventPayloadMap[E];
  timestamp?: number;
};

interface WebSocketContextType {
  socket: WebSocket | null;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
  sendMessage: (message: string | object) => void;
  subscribe: <E extends WsEventType | '*'>(
    type: E,
    handler: (message: E extends '*' ? any : EventMessage<Extract<E, WsEventType>>) => void
  ) => () => void;
  request: <T = any>(message: { type: string; data?: any }, timeoutMs?: number) => Promise<T>;
}

const WebSocketContext = createContext<WebSocketContextType>({
  socket: null,
  connectionStatus: 'disconnected',
  sendMessage: () => {},
  subscribe: () => () => {},
  request: async () => (undefined as any),
});

interface WebSocketProviderProps {
  url: string;
  children: ReactNode;
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({ url, children }) => {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const reconnectTimeoutRef = useRef<number | null>(null);
  const shouldReconnectRef = useRef<boolean>(true);
  const currentSocketRef = useRef<WebSocket | null>(null);
  const listenersRef = useRef<Map<string, Set<(message: any) => void>>>(new Map());
  const pendingRequestsRef = useRef<Map<string, { resolve: (v: any) => void; reject: (e: any) => void; t: number }>>(new Map());

  useEffect(() => {
    shouldReconnectRef.current = true;

    const connectWebSocket = () => {
      setConnectionStatus('connecting');
      const ws = new WebSocket(url);
      currentSocketRef.current = ws;

      ws.addEventListener('open', () => {
        setConnectionStatus('connected');
        setSocket(ws);
      });

      ws.addEventListener('message', (event: MessageEvent) => {
        try {
          const parsed = JSON.parse(event.data) as EventMessage;
          const type = parsed?.type;
          const msgId = (parsed as any)?.id as string | undefined;

          if (msgId && pendingRequestsRef.current.has(msgId)) {
            const entry = pendingRequestsRef.current.get(msgId)!;
            pendingRequestsRef.current.delete(msgId);
            entry.resolve(parsed);
          }

          if (type) {
            const listeners = listenersRef.current.get(type);
            if (listeners) listeners.forEach(fn => { try { fn(parsed); } catch { /* handler error */ } });
          }
          const anyLs = listenersRef.current.get('*');
          if (anyLs) anyLs.forEach(fn => { try { fn(parsed); } catch { /* handler error */ } });
        } catch { /* parse error */ }
      });

      ws.addEventListener('close', () => {
        setConnectionStatus('disconnected');
        setSocket(null);
        if (shouldReconnectRef.current) {
          reconnectTimeoutRef.current = window.setTimeout(connectWebSocket, 3000);
        }
      });

      ws.addEventListener('error', () => {
        setConnectionStatus('error');
      });
    };

    connectWebSocket();

    return () => {
      shouldReconnectRef.current = false;
      if (reconnectTimeoutRef.current != null) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (currentSocketRef.current) {
        currentSocketRef.current.close();
        currentSocketRef.current = null;
      }
      setSocket(null);
      setConnectionStatus('disconnected');
    };
  }, [url]);

  const sendMessage = useCallback((message: string | object) => {
    const ws = currentSocketRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(typeof message === 'string' ? message : JSON.stringify(message));
    }
  }, []);

  const subscribe = useCallback(<E extends WsEventType | '*'>(
    type: E,
    handler: (message: any) => void
  ) => {
    let setForType = listenersRef.current.get(type);
    if (!setForType) {
      setForType = new Set();
      listenersRef.current.set(type, setForType);
    }
    setForType.add(handler);
    return () => {
      const current = listenersRef.current.get(type);
      if (!current) return;
      current.delete(handler);
      if (current.size === 0) listenersRef.current.delete(type);
    };
  }, []);

  const request = useCallback(async <T = any>(message: { type: string; data?: any }, timeoutMs: number = 10000): Promise<T> => {
    const ws = currentSocketRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }
    const id = `req_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const payload = { ...message, id };
    const p = new Promise<T>((resolve, reject) => {
      const timeoutAt = window.setTimeout(() => {
        pendingRequestsRef.current.delete(id);
        reject(new Error(`WebSocket request timed out: ${message.type}`));
      }, timeoutMs);
      pendingRequestsRef.current.set(id, { resolve, reject, t: timeoutAt as unknown as number });
    });
    ws.send(JSON.stringify(payload));
    try {
      return await p as T;
    } finally {
      const entry = pendingRequestsRef.current.get(id);
      if (entry) {
        clearTimeout(entry.t);
        pendingRequestsRef.current.delete(id);
      }
    }
  }, []);

  const contextValue = useMemo<WebSocketContextType>(() => ({
    socket,
    connectionStatus,
    sendMessage,
    subscribe,
    request,
  }), [socket, connectionStatus, sendMessage, subscribe, request]);

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};

export const useWebSocketEvent = <E extends WsEventType>(type: E, handler: (message: EventMessage<E>) => void) => {
  const { subscribe } = useWebSocket();
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  });
  useEffect(() => {
    return subscribe(type, (msg: EventMessage<WsEventType>) => handlerRef.current(msg as EventMessage<E>));
  }, [type, subscribe]);
};

export const useWebSocketRequest = () => {
  const { request } = useWebSocket();
  return request;
};
