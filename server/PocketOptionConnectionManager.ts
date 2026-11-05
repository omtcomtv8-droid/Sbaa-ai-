import WebSocket from 'ws';
import { ConnectionStatus, OverallConnectionState } from './types';

export type DetailedConnectionState =
  | 'DISCONNECTED'
  | 'CONNECTING'
  | 'TRANSPORT_CONNECTED'
  | 'ENGINE_IO_READY'
  | 'SOCKET_IO_READY'
  | 'AUTHENTICATING'
  | 'AUTHENTICATED'
  | 'LOADING_ACCOUNT'
  | 'LOADING_ASSETS'
  | 'SUBSCRIBING'
  | 'WAITING_FOR_MARKET_DATA'
  | 'MARKET_DATA_READY'
  | 'CANDLE_ENGINE_READY'
  | 'READY'
  | 'AUTH_FAILED'
  | 'NETWORK_ERROR'
  | 'STALE'
  | 'DATA_UNAVAILABLE';

export interface ConnectionManagerCallbacks {
  onStateChange: (state: DetailedConnectionState) => void;
  onOpen: (connectionId: string, generation: number) => void;
  onMessage: (data: WebSocket.RawData, isBinary: boolean, connectionId: string, generation: number) => void;
  onError: (error: Error, connectionId: string, generation: number) => void;
  onClose: (code: number, reason: Buffer, connectionId: string, generation: number) => void;
  onPingLatency: (latencyMs: number) => void;
}

export class PocketOptionConnectionManager {
  private ws: WebSocket | null = null;
  private endpoint: string;
  private activeConnectionId: string | null = null;
  private currentGeneration = 0;
  private state: DetailedConnectionState = 'DISCONNECTED';
  private callbacks: ConnectionManagerCallbacks;

  private pingInterval: NodeJS.Timeout | null = null;
  private pingStartTime = 0;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private isExplicitlyClosed = false;
  private autoReconnectAllowed = true;

  constructor(endpoint: string, callbacks: ConnectionManagerCallbacks) {
    this.endpoint = endpoint;
    this.callbacks = callbacks;
  }

  public setEndpoint(endpoint: string): void {
    this.endpoint = endpoint;
  }

  public getEndpoint(): string {
    return this.endpoint;
  }

  public getState(): DetailedConnectionState {
    return this.state;
  }

  public getConnectionId(): string | null {
    return this.activeConnectionId;
  }

  public getGeneration(): number {
    return this.currentGeneration;
  }

  public setState(newState: DetailedConnectionState): void {
    if (this.state !== newState) {
      this.state = newState;
      this.callbacks.onStateChange(newState);
    }
  }

  public lockAutoReconnect(reason: string): void {
    this.autoReconnectAllowed = false;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    console.log(`[ConnectionManager] Auto-reconnect locked: ${reason}`);
  }

  public unlockAutoReconnect(): void {
    this.autoReconnectAllowed = true;
    this.reconnectAttempts = 0;
  }

  public connect(generation: number): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.currentGeneration = generation;
    this.isExplicitlyClosed = false;
    this.cleanSocket();

    const connectionId = 'po_' + Date.now() + '_' + crypto.randomUUID().slice(0, 8);
    this.activeConnectionId = connectionId;

    this.setState('CONNECTING');

    try {
      this.ws = new WebSocket(this.endpoint, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
          Origin: 'https://pocketoption.com',
        },
        handshakeTimeout: 10000,
      });

      this.ws.on('open', () => {
        if (this.activeConnectionId !== connectionId) return;
        this.setState('TRANSPORT_CONNECTED');
        this.startHeartbeat();
        this.callbacks.onOpen(connectionId, generation);
      });

      this.ws.on('message', (data: WebSocket.RawData, isBinary: boolean) => {
        if (this.activeConnectionId !== connectionId) return;
        this.callbacks.onMessage(data, isBinary, connectionId, generation);
      });

      this.ws.on('error', (err: Error) => {
        if (this.activeConnectionId !== connectionId) return;
        this.setState('NETWORK_ERROR');
        this.callbacks.onError(err, connectionId, generation);
      });

      this.ws.on('close', (code: number, reason: Buffer) => {
        if (this.activeConnectionId !== connectionId) return;
        this.stopHeartbeat();
        this.callbacks.onClose(code, reason, connectionId, generation);

        if (!this.isExplicitlyClosed && this.autoReconnectAllowed) {
          this.scheduleReconnect(generation);
        } else {
          this.setState('DISCONNECTED');
        }
      });
    } catch (err: any) {
      this.setState('NETWORK_ERROR');
      this.callbacks.onError(err, connectionId, generation);
    }
  }

  public send(data: string | Buffer): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return false;
    }
    try {
      this.ws.send(data);
      return true;
    } catch (err) {
      console.error('[ConnectionManager] Send error:', err);
      return false;
    }
  }

  public disconnect(manual: boolean = true): void {
    this.isExplicitlyClosed = manual;
    this.stopHeartbeat();
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.cleanSocket();
    this.activeConnectionId = null;
    this.setState('DISCONNECTED');
  }

  private cleanSocket(): void {
    if (this.ws) {
      const sock = this.ws;
      this.ws = null;
      sock.removeAllListeners();
      sock.on('error', () => {});
      try {
        if (sock.readyState === WebSocket.CONNECTING) {
          sock.terminate();
        } else if (sock.readyState === WebSocket.OPEN) {
          sock.close(1000, 'Clean Teardown');
        }
      } catch {
        // ignore
      }
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.pingStartTime = Date.now();
        // Send Engine.IO ping packet '2'
        this.send('2');
      }
    }, 25000);
  }

  public onPongReceived(): void {
    if (this.pingStartTime > 0) {
      const latency = Date.now() - this.pingStartTime;
      this.pingStartTime = 0;
      this.callbacks.onPingLatency(latency);
    }
  }

  private stopHeartbeat(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private scheduleReconnect(generation: number): void {
    if (this.isExplicitlyClosed || !this.autoReconnectAllowed) return;

    this.reconnectAttempts++;
    if (this.reconnectAttempts > this.maxReconnectAttempts) {
      this.setState('STALE');
      return;
    }

    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 20000);
    this.setState('CONNECTING');

    this.reconnectTimeout = setTimeout(() => {
      if (!this.isExplicitlyClosed && this.autoReconnectAllowed) {
        this.connect(generation);
      }
    }, delay);
  }
}
