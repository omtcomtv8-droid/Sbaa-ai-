import { CandleBuilder } from './CandleBuilder';
import { StrategyEngine } from './StrategyEngine';
import { Candle } from './types';

export interface TradeOrderRecord {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  orderType: 'MARKET' | 'LIMIT' | 'STOP';
  volume: number;
  entryPrice: number;
  stopLoss?: number;
  takeProfit?: number;
  leverage: number;
  status: 'OPEN' | 'FILLED' | 'CLOSED' | 'CANCELLED';
  openTime: number;
  closeTime?: number;
  closePrice?: number;
  pnl?: number;
  riskAmount: number;
  potentialReward: number;
  riskRewardRatio: number;
  notes?: string;
}

export interface PositionRecord {
  id: string;
  orderId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  volume: number;
  entryPrice: number;
  currentPrice: number;
  stopLoss?: number;
  takeProfit?: number;
  leverage: number;
  margin: number;
  pnl: number;
  pnlPercent: number;
  openTime: number;
}

export interface SystemAuditLog {
  id: string;
  timestamp: number;
  level: 'INFO' | 'WARN' | 'ERROR' | 'SECURITY';
  category: 'ORDER' | 'AUTH' | 'DATA' | 'SYSTEM';
  message: string;
  details?: string;
}

export class SabaaService {
  private orders: TradeOrderRecord[] = [];
  private positions: PositionRecord[] = [];
  private auditLogs: SystemAuditLog[] = [];

  constructor() {
    this.initAuditLog('SYSTEM', 'INFO', 'SABAA QUANT Core Services initialized in Algorithmic Signal Engine Mode.');
  }

  public logAudit(category: SystemAuditLog['category'], level: SystemAuditLog['level'], message: string, details?: string) {
    this.initAuditLog(category, level, message, details);
  }

  private initAuditLog(category: SystemAuditLog['category'], level: SystemAuditLog['level'], message: string, details?: string) {
    const log: SystemAuditLog = {
      id: 'LOG-' + crypto.randomUUID().slice(0, 8).toUpperCase(),
      timestamp: Date.now(),
      level,
      category,
      message,
      details,
    };
    this.auditLogs.unshift(log);
    if (this.auditLogs.length > 300) {
      this.auditLogs.pop();
    }
  }

  public getAuditLogs(): SystemAuditLog[] {
    return [...this.auditLogs];
  }

  // --- SIGNAL-ONLY ARCHITECTURAL ENFORCEMENT ---
  public placeManualOrder(params: any): { success: boolean; order?: TradeOrderRecord; position?: PositionRecord; error?: string } {
    return {
      success: false,
      error: 'Signal-Only Architecture: Trade execution is disabled. The system generates analytical UP, DOWN, and WAIT signals only.',
    };
  }

  public closePosition(positionId: string, currentMarketPrice?: number): { success: boolean; closedOrder?: TradeOrderRecord; error?: string } {
    return {
      success: false,
      error: 'Signal-Only Architecture: Position execution is disabled.',
    };
  }

  public updatePositionsMarkToMarket(currentPrices: Record<string, number>) {
    for (const pos of this.positions) {
      const price = currentPrices[pos.symbol];
      if (price && price > 0) {
        pos.currentPrice = price;
        const diff = pos.side === 'BUY' ? price - pos.entryPrice : pos.entryPrice - price;
        pos.pnl = Number((diff * pos.volume * 100000).toFixed(2));
        if (pos.margin > 0) {
          pos.pnlPercent = Number(((pos.pnl / pos.margin) * 100).toFixed(2));
        }
      }
    }
  }

  public getOrders(): TradeOrderRecord[] {
    return [...this.orders];
  }

  public getPositions(): PositionRecord[] {
    return [...this.positions];
  }

  private scannerSpotCache = new Map<string, { candles: Candle[]; source: string; fetchedAt: number }>();

  // --- REAL MARKET SCANNER ---
  public async getRealScannerData(params: {
    poService: any;
    marketDataStore: any;
    candleBuilder: CandleBuilder;
    strategyEngine: StrategyEngine;
    historicalService: any;
  }): Promise<any[]> {
    const { poService, marketDataStore, candleBuilder, strategyEngine, historicalService } = params;
    const now = Date.now();
    const activeAsset = poService?.getActiveAsset?.() || 'EURUSD_otc';

    const baseList: Array<{ symbol: string; label: string }> = [
      { symbol: 'EURUSD', label: 'EUR / USD' },
      { symbol: 'GBPUSD', label: 'GBP / USD' },
      { symbol: 'USDJPY', label: 'USD / JPY' },
      { symbol: 'AUDUSD', label: 'AUD / USD' },
      { symbol: 'BTCUSD', label: 'BTC / USD' },
      { symbol: 'ETHUSD', label: 'ETH / USD' },
    ];

    if (activeAsset && !baseList.some((a) => a.symbol === activeAsset)) {
      baseList.unshift({
        symbol: activeAsset,
        label: activeAsset.replace(/_otc$/i, ' (OTC)'),
      });
    }

    const getDecimals = (sym: string) => {
      if (sym.includes('JPY')) return 3;
      if (sym.includes('BTC') || sym.includes('ETH')) return 2;
      return 5;
    };

    const rows = await Promise.all(
      baseList.map(async (item) => {
        const sym = item.symbol;
        const decimals = getDecimals(sym);
        let candles: Candle[] = [];
        let dataSource = 'AWAITING_FEED';

        // 1. Check live broker MarketDataStore / CandleBuilder first
        const mdsCandles = marketDataStore?.getCandles?.(sym, 60) || [];
        const cbCandles = candleBuilder?.getCandles?.(sym, 60) || [];
        candles = mdsCandles.length >= cbCandles.length ? mdsCandles : cbCandles;

        if (candles.length > 0) {
          dataSource = 'BROKER_LIVE';
        } else if (historicalService && typeof historicalService.loadHistoricalCandles === 'function') {
          const isOtc = typeof historicalService.constructor?.isOtcAsset === 'function'
            ? historicalService.constructor.isOtcAsset(sym)
            : sym.toLowerCase().includes('otc');

          if (!isOtc) {
            const cached = this.scannerSpotCache.get(sym);
            if (cached && now - cached.fetchedAt < 30_000) {
              candles = cached.candles;
              dataSource = cached.source;
            } else {
              try {
                const loaded = await historicalService.loadHistoricalCandles(sym, 60, 60);
                if (loaded?.candles?.length > 0) {
                  candles = loaded.candles;
                  dataSource = loaded.source || 'SPOT_FEED';
                  this.scannerSpotCache.set(sym, {
                    candles,
                    source: dataSource,
                    fetchedAt: now,
                  });
                }
              } catch {
                if (cached?.candles?.length) {
                  candles = cached.candles;
                  dataSource = cached.source;
                }
              }
            }
          }
        }

        const lastTick = candleBuilder?.getLastTick?.(sym);
        const latestCandle = candles.length > 0 ? candles[candles.length - 1] : null;
        const rawPrice = lastTick?.price ?? latestCandle?.close ?? null;
        const currentPrice =
          typeof rawPrice === 'number' && rawPrice > 0
            ? Number(rawPrice.toFixed(decimals))
            : null;

        let change24h: number | null = null;
        if (currentPrice !== null && candles.length >= 2) {
          const refOpen = candles[0].open;
          if (refOpen > 0) {
            change24h = Number((((currentPrice - refOpen) / refOpen) * 100).toFixed(2));
          }
        }

        const closes = candles.map((c) => c.close);
        let rsiVal: number | null = null;
        let macdStatus: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'AWAITING_DATA' = 'AWAITING_DATA';
        let trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
        let score = 0;
        let confluenceScore: number | null = null;
        let signal: 'STRONG_BUY' | 'BUY' | 'WAIT' | 'SELL' | 'STRONG_SELL' = 'WAIT';

        if (closes.length >= 15) {
          const { calculateRSI, calculateMACD } = await import('./indicators');
          rsiVal = calculateRSI(closes, 14);
          const macdObj = calculateMACD(closes, 12, 26, 9);
          if (macdObj) {
            macdStatus = macdObj.histogram > 0 ? 'BULLISH' : macdObj.histogram < 0 ? 'BEARISH' : 'NEUTRAL';
          } else {
            macdStatus = 'NEUTRAL';
          }
        }

        if (candles.length >= 25 && strategyEngine) {
          const evalResults = strategyEngine.evaluateStrategiesOnCandles(candles, sym, 60);
          const validStrats = evalResults.filter((s) => s.dataValid !== false);
          const upStrats = validStrats.filter((s) => s.qualified && s.signal === 'UP');
          const downStrats = validStrats.filter((s) => s.qualified && s.signal === 'DOWN');

          score = upStrats.length - downStrats.length;
          const totalDir = upStrats.length + downStrats.length;

          if (upStrats.length > downStrats.length && upStrats.length >= 3) {
            trend = 'BULLISH';
            const avgUp = Math.round(
              upStrats.reduce((acc, s) => acc + (s.normalizedScore ?? s.rawScore ?? 65), 0) / upStrats.length
            );
            confluenceScore = Math.min(100, Math.max(0, avgUp));
            signal = upStrats.length >= 6 && confluenceScore >= 75 ? 'STRONG_BUY' : 'BUY';
          } else if (downStrats.length > upStrats.length && downStrats.length >= 3) {
            trend = 'BEARISH';
            const avgDown = Math.round(
              downStrats.reduce((acc, s) => acc + (s.normalizedScore ?? s.rawScore ?? 65), 0) / downStrats.length
            );
            confluenceScore = Math.min(100, Math.max(0, avgDown));
            signal = downStrats.length >= 6 && confluenceScore >= 75 ? 'STRONG_SELL' : 'SELL';
          } else {
            trend = change24h !== null && change24h > 0.05 ? 'BULLISH' : change24h !== null && change24h < -0.05 ? 'BEARISH' : 'NEUTRAL';
            confluenceScore = validStrats.length > 0 && totalDir > 0
              ? Math.round((Math.max(upStrats.length, downStrats.length) / Math.max(1, validStrats.length)) * 100)
              : 0;
            signal = 'WAIT';
          }
        }

        return {
          symbol: sym,
          label: item.label,
          currentPrice,
          change24h,
          trend,
          rsi: rsiVal,
          macd: macdStatus === 'BULLISH' || macdStatus === 'BEARISH' ? macdStatus : 'NEUTRAL',
          macdStatus,
          score,
          confluenceScore,
          signal,
          dataStatus: currentPrice !== null ? 'LIVE' : 'AWAITING_FEED',
          dataSource,
          lastUpdated: lastTick?.receivedAt || (latestCandle ? latestCandle.time * 1000 : now),
        };
      })
    );

    return rows;
  }

  // --- SYSTEM HEALTH TELEMETRY ---
  public getHealthTelemetry(activeSocketsCount: number, memoryUsage: NodeJS.MemoryUsage) {
    return {
      status: 'OPERATIONAL',
      serviceName: 'SABAA QUANT Backend Gateway',
      uptimeSeconds: Math.floor(process.uptime()),
      activeSockets: activeSocketsCount,
      memory: {
        heapUsedMb: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        heapTotalMb: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        rssMb: Math.round(memoryUsage.rss / 1024 / 1024),
      },
      stats: {
        totalOrders: this.orders.length,
        openPositions: this.positions.length,
        auditLogsStored: this.auditLogs.length,
      },
      nodeVersion: process.version,
    };
  }
}
