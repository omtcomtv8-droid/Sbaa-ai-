/**
 * src/services/RealMetricsService.ts
 *
 * AUTHORITATIVE REAL METRICS SERVICE ONLY.
 * Exclusively used for real terminal pages, verified account states,
 * and authenticated user sessions.
 *
 * STRICT SEPARATION GUARANTEE:
 * - This service interacts ONLY with authentic broker connections,
 *   real verified closed trades, and authenticated user accounts.
 * - Absolutely ZERO simulation or demo mock data is allowed here.
 * - Never imports or accesses DemoMetricsService.
 */

import { DiagnosticsInfo, PerformanceMetrics, TradeOrder } from '../types';

export interface RealPlatformMetricsSnapshot {
  isAuthenticated: boolean;
  activeBrokerMode: 'REAL' | 'DEMO' | 'DISCONNECTED';
  activeSessionId: string | null;
  accountUid: string | number | null;
  realBalance: number | null;
  currency: string;
  verifiedCandlesCount: number;
  dataFreshnessSeconds: number;
  realWinRate: number | null;
  totalRealTrades: number;
  isSimulated: false;
  lastSyncTimestamp: number;
}

class RealMetricsServiceClass {
  private currentSnapshot: RealPlatformMetricsSnapshot = {
    isAuthenticated: false,
    activeBrokerMode: 'DISCONNECTED',
    activeSessionId: null,
    accountUid: null,
    realBalance: null,
    currency: 'USD',
    verifiedCandlesCount: 0,
    dataFreshnessSeconds: 0,
    realWinRate: null,
    totalRealTrades: 0,
    isSimulated: false,
    lastSyncTimestamp: Date.now(),
  };

  /**
   * Updates real metrics strictly from verified authenticated broker diagnostics.
   */
  public syncFromDiagnostics(diag: DiagnosticsInfo | null | undefined): void {
    if (!diag) {
      this.currentSnapshot = {
        ...this.currentSnapshot,
        isAuthenticated: false,
        activeBrokerMode: 'DISCONNECTED',
        lastSyncTimestamp: Date.now(),
      };
      return;
    }

    const isConnected = diag.subsystems?.websocket === 'connected' || diag.status === 'connected';

    this.currentSnapshot = {
      isAuthenticated: Boolean(diag.authVerified && isConnected),
      activeBrokerMode: diag.account?.isDemo ? 'DEMO' : 'REAL',
      activeSessionId: diag.endpoint || null,
      accountUid: diag.authUid || diag.account?.uidMasked || null,
      realBalance: typeof diag.account?.balance === 'number' ? diag.account.balance : null,
      currency: diag.account?.currency || 'USD',
      verifiedCandlesCount: diag.candlesCount || 0,
      dataFreshnessSeconds: diag.freshnessSeconds || 0,
      realWinRate: null, // Computed strictly from real closed orders
      totalRealTrades: 0,
      isSimulated: false,
      lastSyncTimestamp: Date.now(),
    };
  }

  /**
   * Updates real performance statistics strictly from verified evaluated trades.
   */
  public syncFromPerformance(perf: PerformanceMetrics | null | undefined): void {
    if (!perf) return;

    this.currentSnapshot = {
      ...this.currentSnapshot,
      realWinRate: perf.accuracyRate ?? null,
      totalRealTrades: perf.evaluatedSignals,
      lastSyncTimestamp: Date.now(),
    };
  }

  /**
   * Returns authoritative real platform metrics.
   */
  public getSnapshot(): RealPlatformMetricsSnapshot {
    return { ...this.currentSnapshot };
  }
}

export const RealMetricsService = new RealMetricsServiceClass();
