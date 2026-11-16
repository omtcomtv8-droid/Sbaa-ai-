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

  // --- MARKET SCANNER ---
  public getScannerData(activeAssetPrice?: number): any[] {
    const assets = [
      { symbol: 'EURUSD_otc', label: 'EUR / USD', basePrice: 1.0854 },
      { symbol: 'GBPUSD_otc', label: 'GBP / USD', basePrice: 1.2942 },
      { symbol: 'USDJPY_otc', label: 'USD / JPY', basePrice: 153.25 },
      { symbol: 'AUDUSD_otc', label: 'AUD / USD', basePrice: 0.6585 },
      { symbol: 'BTCUSD', label: 'BTC / USD', basePrice: 94500.0 },
      { symbol: 'ETHUSD', label: 'ETH / USD', basePrice: 2840.5 },
      { symbol: 'XAUUSD', label: 'Gold (XAU/USD)', basePrice: 2715.4 },
      { symbol: 'US500', label: 'S&P 500 Index', basePrice: 5980.2 },
    ];

    const now = Date.now();
    return assets.map((a, i) => {
      let currentPrice = a.basePrice;
      if (a.symbol === 'EURUSD_otc' && activeAssetPrice && activeAssetPrice > 0) {
        currentPrice = activeAssetPrice;
      } else {
        // slight deterministic drift
        const phase = Math.sin((now / 15000) + i);
        currentPrice = Number((a.basePrice * (1 + phase * 0.0015)).toFixed(a.symbol.includes('JPY') ? 3 : a.symbol.includes('BTC') || a.symbol.includes('US500') ? 2 : 5));
      }

      const change24h = Number((Math.sin(i * 1.5) * 1.25).toFixed(2));
      const rsi = Math.round(42 + Math.cos(i + now / 30000) * 26);
      const isBullish = rsi > 52 && change24h > 0;
      const isBearish = rsi < 48 && change24h < 0;

      const score = isBullish ? 4 : isBearish ? -4 : 0;
      const signal = score >= 4 ? 'BUY' : score <= -4 ? 'SELL' : 'WAIT';

      return {
        symbol: a.symbol,
        label: a.label,
        currentPrice,
        change24h,
        trend: isBullish ? 'BULLISH' : isBearish ? 'BEARISH' : 'NEUTRAL',
        rsi,
        macd: isBullish ? 'BULLISH' : isBearish ? 'BEARISH' : 'NEUTRAL',
        score,
        signal,
        lastUpdated: now,
      };
    });
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
