import { Candle, MarketTick, buildCandleId } from './types';

export class CandleBuilder {
  // Map of `${asset}:${timeframe}` -> Candle[]
  private candleStorage: Map<string, Candle[]> = new Map();
  // Map of asset -> last tick info
  private lastTicks: Map<string, MarketTick> = new Map();
  // Configurable max candles to retain per timeframe (default 50000)
  private maxCandles = 50000;

  /**
   * Sets the rolling buffer size (clamped between 500 and 50000).
   */
  public setMaxCandles(size: number): void {
    this.maxCandles = Math.max(500, Math.min(50000, size));
  }

  /**
   * Validates candle integrity according to strict OHLC physical market rules.
   */
  public static isValidCandle(candle: Candle): boolean {
    if (!candle || typeof candle !== 'object') return false;
    if (typeof candle.time !== 'number' || isNaN(candle.time) || candle.time <= 0) return false;
    if (typeof candle.open !== 'number' || isNaN(candle.open) || candle.open <= 0) return false;
    if (typeof candle.high !== 'number' || isNaN(candle.high) || candle.high <= 0) return false;
    if (typeof candle.low !== 'number' || isNaN(candle.low) || candle.low <= 0) return false;
    if (typeof candle.close !== 'number' || isNaN(candle.close) || candle.close <= 0) return false;

    // Mathematical integrity constraints:
    // high >= max(open, close), low <= min(open, close), high >= low
    const maxOC = Math.max(candle.open, candle.close);
    const minOC = Math.min(candle.open, candle.close);

    // Use a tiny epsilon for float comparisons
    if (candle.high < maxOC - 1e-8) return false;
    if (candle.low > minOC + 1e-8) return false;
    if (candle.high < candle.low - 1e-8) return false;

    return true;
  }

  /**
   * Process a single incoming price tick from Pocket Option stream.
   */
  public addTick(
    asset: string,
    timestamp: number,
    price: number,
    timeframes: number[] = [5, 15, 30, 60, 300, 900, 1800, 3600, 14400, 86400]
  ): void {
    if (typeof price !== 'number' || isNaN(price) || price <= 0) return;
    if (typeof timestamp !== 'number' || isNaN(timestamp) || timestamp <= 0) return;

    const now = Date.now();
    const tick: MarketTick = {
      asset,
      timestamp,
      price,
      receivedAt: now,
    };
    this.lastTicks.set(asset, tick);

    // Update candles for each supported timeframe
    for (const tf of timeframes) {
      this.updateCandleForTimeframe(asset, tf, timestamp, price);
    }
  }

  private updateCandleForTimeframe(asset: string, timeframe: number, timestamp: number, price: number): void {
    const key = `${asset}:${timeframe}`;
    let list = this.candleStorage.get(key);
    if (!list) {
      list = [];
      this.candleStorage.set(key, list);
    }

    let sec = Number(timestamp);
    if (sec > 1e11) sec = Math.floor(sec / 1000);
    sec = Math.floor(sec);
    const tf = Math.floor(Number(timeframe) || 60);
    const bucketTime = Math.floor(sec / tf) * tf;
    const candleId = buildCandleId(asset, tf, bucketTime);

    if (list.length === 0) {
      // First candle
      const firstCandle: Candle = {
        candleId,
        asset,
        timeframe: tf,
        time: bucketTime,
        open: price,
        high: price,
        low: price,
        close: price,
        volume: 1,
        isClosed: false,
        source: 'pocket_option',
      };
      if (CandleBuilder.isValidCandle(firstCandle)) {
        list.push(firstCandle);
      }
      return;
    }

    const last = list[list.length - 1];

    if (last.time === bucketTime) {
      // Update forming candle
      last.high = Math.max(last.high, price);
      last.low = Math.min(last.low, price);
      last.close = price;
      last.volume += 1;
      last.isClosed = false;
    } else if (bucketTime > last.time) {
      // Finalize previous candle cleanly as CLOSED
      last.isClosed = true;
      last.candleId = buildCandleId(asset, tf, last.time);

      // Create new forming candle bucket
      const newCandle: Candle = {
        candleId,
        asset,
        timeframe: tf,
        time: bucketTime,
        open: price,
        high: price,
        low: price,
        close: price,
        volume: 1,
        isClosed: false,
        source: 'pocket_option',
      };

      if (CandleBuilder.isValidCandle(newCandle)) {
        list.push(newCandle);

        if (list.length > this.maxCandles) {
          list.shift();
        }
      }
    }
  }

  /**
   * Loads bulk historical candles (e.g. from loadHistoryPeriodFast response).
   * Validates each candle and removes duplicates/out-of-order candles.
   */
  public loadHistoricalCandles(asset: string, timeframe: number, rawCandles: Candle[]): void {
    const tf = Math.floor(Number(timeframe) || 60);
    const key = `${asset}:${tf}`;

    // Preserve existing forming candle if newer than historical candles
    const existing = this.candleStorage.get(key) || [];
    const existingForming =
      existing.length > 0 && !existing[existing.length - 1].isClosed
        ? existing[existing.length - 1]
        : null;

    // Filter valid candles
    const validCandles = rawCandles.filter(CandleBuilder.isValidCandle);

    // Deduplicate by time and sort ascending
    const timeMap = new Map<number, Candle>();
    for (const c of validCandles) {
      let t = Number(c.time);
      if (t > 1e11) t = Math.floor(t / 1000);
      t = Math.floor(t);
      const bucketTime = Math.floor(t / tf) * tf;
      const candleId = c.candleId || buildCandleId(asset, tf, bucketTime);
      timeMap.set(bucketTime, {
        ...c,
        candleId,
        time: bucketTime,
        timeframe: tf,
        isClosed: true,
        source: c.source || 'Pocket Option Real History',
      });
    }

    const sorted = Array.from(timeMap.values()).sort((a, b) => a.time - b.time);
    if (
      existingForming &&
      (sorted.length === 0 || existingForming.time > sorted[sorted.length - 1].time)
    ) {
      sorted.push(existingForming);
    }
    this.candleStorage.set(key, sorted.slice(-this.maxCandles));
  }

  /**
   * Retrieves all closed candles for an asset and timeframe (Strictly Anti-Repainting).
   * This excludes the currently forming incomplete candle.
   */
  public getClosedCandles(asset: string, timeframe: number): Candle[] {
    const key = `${asset}:${timeframe}`;
    const list = this.candleStorage.get(key) || [];
    return list.filter((c) => c.isClosed);
  }

  /**
   * Retrieves the current forming (live open) candle, if any.
   */
  public getFormingCandle(asset: string, timeframe: number): Candle | null {
    const key = `${asset}:${timeframe}`;
    const list = this.candleStorage.get(key) || [];
    if (list.length === 0) return null;
    const last = list[list.length - 1];
    return last.isClosed ? null : last;
  }

  /**
   * Retrieves all candles (closed + forming) for display on the chart.
   */
  public getCandles(asset: string, timeframe: number): Candle[] {
    const key = `${asset}:${timeframe}`;
    return this.candleStorage.get(key) || [];
  }

  /**
   * Gets the latest tick for an asset.
   */
  public getLastTick(asset: string): MarketTick | null {
    return this.lastTicks.get(asset) || null;
  }

  /**
   * Check if incoming data for an asset is stale.
   * Returns true if no tick received within staleThresholdSeconds.
   */
  public isStale(asset: string, staleThresholdSeconds: number = 8): { isStale: boolean; secondsSinceLastTick: number } {
    const tick = this.lastTicks.get(asset);
    if (!tick) {
      return { isStale: true, secondsSinceLastTick: 999 };
    }

    const diffSeconds = (Date.now() - tick.receivedAt) / 1000;
    return {
      isStale: diffSeconds > staleThresholdSeconds,
      secondsSinceLastTick: Number(diffSeconds.toFixed(1)),
    };
  }

  public getCandleCount(asset: string, timeframe: number): number {
    const key = `${asset}:${timeframe}`;
    return (this.candleStorage.get(key) || []).length;
  }

  /**
   * Resets ticks and optionally candle storage.
   * By default keeps historical candles intact so calculations never drop back to 0.
   */
  public clear(keepHistorical: boolean = true): void {
    this.lastTicks.clear();
    if (!keepHistorical) {
      this.candleStorage.clear();
    }
  }
}
