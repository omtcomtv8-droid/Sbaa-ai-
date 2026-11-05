import { AccountInfo, AssetInfo, Candle, ConnectionStatus } from './types';

/**
 * Authoritative Market Data Provider Interface.
 * Standard contract for broker integrations.
 */
export interface MarketDataProvider {
  connect(): Promise<void> | void;
  disconnect(): void;
  authenticate(): Promise<boolean> | boolean;
  getAccount(): AccountInfo;
  getAssets(): AssetInfo[];
  subscribeTicks(symbol: string): void;
  unsubscribeTicks(symbol: string): void;
  getHistoricalCandles(symbol: string, timeframe: number): Promise<Candle[]> | Candle[];
  getCurrentPrice(symbol: string): number | null;
  getConnectionStatus(): ConnectionStatus;
}
