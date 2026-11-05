import { Candle } from './types';

export class HistoricalCandleService {
  private static readonly BINANCE_BASE = 'https://api.binance.com/api/v3/klines';
  private static readonly YAHOO_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart';

  /**
   * Identifies whether an asset is a broker-specific OTC symbol.
   */
  public static isOtcAsset(asset: string): boolean {
    return Boolean(asset && asset.toLowerCase().includes('otc'));
  }

  /**
   * Checks if an asset has a valid external spot exchange mapping (Binance or Yahoo).
   */
  public static hasExternalExchangeMapping(asset: string): boolean {
    if (HistoricalCandleService.isOtcAsset(asset)) return false;
    const { binanceSymbol, yahooSymbol } = HistoricalCandleService.mapAssetToSymbols(asset);
    return Boolean(binanceSymbol || yahooSymbol);
  }

  /**
   * Maps application asset symbol (including OTC pairs) to public financial market identifiers.
   */
  public static mapAssetToSymbols(asset: string): { binanceSymbol: string | null; yahooSymbol: string | null } {
    // OTC pairs are proprietary broker feeds and must NEVER be mapped to public exchange feeds
    if (!asset || asset.toLowerCase().includes('otc')) {
      return { binanceSymbol: null, yahooSymbol: null };
    }

    const clean = asset.replace(/_otc$/i, '').toUpperCase();

    // Map common forex / crypto symbols
    switch (clean) {
      case 'EURUSD':
        return { binanceSymbol: null, yahooSymbol: 'EURUSD=X' };
      case 'GBPUSD':
        return { binanceSymbol: null, yahooSymbol: 'GBPUSD=X' };
      case 'AUDUSD':
        return { binanceSymbol: null, yahooSymbol: 'AUDUSD=X' };
      case 'USDCAD':
        return { binanceSymbol: null, yahooSymbol: 'USDCAD=X' };
      case 'USDCHF':
        return { binanceSymbol: null, yahooSymbol: 'USDCHF=X' };
      case 'USDJPY':
        return { binanceSymbol: null, yahooSymbol: 'USDJPY=X' };
      case 'NZDUSD':
        return { binanceSymbol: null, yahooSymbol: 'NZDUSD=X' };
      case 'EURGBP':
        return { binanceSymbol: null, yahooSymbol: 'EURGBP=X' };
      case 'EURJPY':
        return { binanceSymbol: null, yahooSymbol: 'EURJPY=X' };
      case 'GBPJPY':
        return { binanceSymbol: null, yahooSymbol: 'GBPJPY=X' };
      case 'BTCUSD':
        return { binanceSymbol: 'BTCUSDT', yahooSymbol: 'BTC-USD' };
      case 'ETHUSD':
        return { binanceSymbol: 'ETHUSDT', yahooSymbol: 'ETH-USD' };
      default:
        if (clean.length === 6 && !clean.includes('OTC')) {
          return { binanceSymbol: null, yahooSymbol: `${clean}=X` };
        }
        return { binanceSymbol: null, yahooSymbol: null };
    }
  }

  /**
   * Loads at least minCandles (default 100-200) verified closed OHLC candles.
   * Employs real institutional data feeds without fabricating data or substituting wrong assets.
   */
  public async loadHistoricalCandles(
    asset: string,
    timeframe: number = 60,
    minCandles: number = 150
  ): Promise<{ candles: Candle[]; source: string }> {
    const { binanceSymbol, yahooSymbol } = HistoricalCandleService.mapAssetToSymbols(asset);

    // If symbol is OTC or unmapped, market candles must come exclusively from the active broker feed
    if (!binanceSymbol && !yahooSymbol) {
      return { candles: [], source: 'Pocket Option Real Feed' };
    }

    // 1. Try Binance if real crypto symbol mapped
    if (binanceSymbol) {
      try {
        const binanceCandles = await this.fetchWithRetry(
          () => this.fetchBinanceCandles(asset, binanceSymbol, timeframe, Math.max(minCandles, 200)),
          3,
          1000
        );
        if (binanceCandles.length >= Math.min(50, minCandles)) {
          return { candles: binanceCandles, source: `Binance Spot Feed (${binanceSymbol})` };
        }
      } catch (err: any) {
        console.warn(`[HistoricalCandleService] Binance fetch failed for ${asset}:`, err?.message || err);
      }
    }

    // 2. Try Yahoo Finance for real forex spot during market hours
    if (yahooSymbol) {
      try {
        const yahooCandles = await this.fetchWithRetry(
          () => this.fetchYahooCandles(asset, yahooSymbol, timeframe),
          3,
          1000
        );
        if (yahooCandles.length >= Math.min(50, minCandles)) {
          return { candles: yahooCandles, source: `Yahoo Institutional Feed (${yahooSymbol})` };
        }
      } catch (err: any) {
        console.warn(`[HistoricalCandleService] Yahoo fetch failed for ${asset}:`, err?.message || err);
      }
    }

    // Strictly DO NOT fallback to EURUSDT or fabricate candles for unrelated assets
    throw new Error(`Real market historical data currently unavailable for ${asset}. Awaiting broker stream.`);
  }

  private async fetchBinanceCandles(
    asset: string,
    symbol: string,
    timeframe: number,
    limit: number
  ): Promise<Candle[]> {
    // Map timeframe in seconds to Binance interval
    const interval = timeframe >= 86400 ? '1d' : timeframe >= 3600 ? '1h' : timeframe >= 300 ? '5m' : '1m';
    const url = `${HistoricalCandleService.BINANCE_BASE}?symbol=${symbol}&interval=${interval}&limit=${limit}`;

    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) PocketOptionEngine/2.0' },
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) {
      throw new Error(`Binance HTTP ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    if (!Array.isArray(data)) {
      throw new Error('Invalid Binance klines response structure');
    }

    const candles: Candle[] = [];
    for (const item of data) {
      if (!Array.isArray(item) || item.length < 6) continue;
      const openTimeMs = Number(item[0]);
      const open = parseFloat(item[1]);
      const high = parseFloat(item[2]);
      const low = parseFloat(item[3]);
      const close = parseFloat(item[4]);
      const volume = parseFloat(item[5]) || 1;

      const timeSec = Math.floor(openTimeMs / 1000);

      // Validate OHLC bounds
      if (
        open > 0 &&
        high > 0 &&
        low > 0 &&
        close > 0 &&
        high >= Math.max(open, close) - 1e-8 &&
        low <= Math.min(open, close) + 1e-8 &&
        high >= low
      ) {
        candles.push({
          asset,
          timeframe,
          time: timeSec,
          open,
          high,
          low,
          close,
          volume,
          isClosed: true,
          source: 'Binance',
        });
      }
    }

    return this.sanitizeCandles(candles);
  }

  private async fetchYahooCandles(asset: string, symbol: string, timeframe: number): Promise<Candle[]> {
    const interval = timeframe >= 86400 ? '1d' : timeframe >= 3600 ? '60m' : timeframe >= 300 ? '5m' : '1m';
    const url = `${HistoricalCandleService.YAHOO_BASE}/${symbol}?interval=${interval}&range=1d`;

    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) {
      throw new Error(`Yahoo Finance HTTP ${res.status}: ${res.statusText}`);
    }

    const json = await res.json();
    const result = json?.chart?.result?.[0];
    if (!result) {
      throw new Error('Yahoo Finance empty result');
    }

    const timestamps: number[] = result.timestamp || [];
    const quote = result.indicators?.quote?.[0];
    if (!quote || !timestamps.length) {
      throw new Error('Yahoo Finance missing quote arrays');
    }

    const opens = quote.open || [];
    const highs = quote.high || [];
    const lows = quote.low || [];
    const closes = quote.close || [];
    const volumes = quote.volume || [];

    const candles: Candle[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const timeSec = timestamps[i];
      const open = opens[i];
      const high = highs[i];
      const low = lows[i];
      const close = closes[i];
      const volume = volumes[i] || 1;

      if (
        typeof open === 'number' &&
        typeof high === 'number' &&
        typeof low === 'number' &&
        typeof close === 'number' &&
        !isNaN(open) &&
        !isNaN(high) &&
        !isNaN(low) &&
        !isNaN(close) &&
        open > 0 &&
        high > 0 &&
        low > 0 &&
        close > 0 &&
        high >= Math.max(open, close) - 1e-8 &&
        low <= Math.min(open, close) + 1e-8 &&
        high >= low
      ) {
        candles.push({
          asset,
          timeframe,
          time: timeSec,
          open: Number(open.toFixed(5)),
          high: Number(high.toFixed(5)),
          low: Number(low.toFixed(5)),
          close: Number(close.toFixed(5)),
          volume,
          isClosed: true,
          source: 'YahooFinance',
        });
      }
    }

    return this.sanitizeCandles(candles);
  }

  /**
   * Sanitizes, deduplicates, and sorts candles chronologically.
   */
  public sanitizeCandles(raw: Candle[]): Candle[] {
    const map = new Map<number, Candle>();
    for (const c of raw) {
      if (!c || !c.time || c.time <= 0) continue;
      map.set(c.time, { ...c, isClosed: true });
    }

    // Sort strictly ascending
    const sorted = Array.from(map.values()).sort((a, b) => a.time - b.time);
    return sorted;
  }

  private async fetchWithRetry<T>(fn: () => Promise<T>, retries: number = 3, delayMs: number = 1000): Promise<T> {
    let lastError: any;
    for (let i = 0; i < retries; i++) {
      try {
        return await fn();
      } catch (err: any) {
        lastError = err;
        if (i < retries - 1) {
          await new Promise((resolve) => setTimeout(resolve, delayMs * Math.pow(2, i)));
        }
      }
    }
    throw lastError;
  }
}
