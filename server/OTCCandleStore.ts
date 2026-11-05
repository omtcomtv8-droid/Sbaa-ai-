import { Candle, MarketTick, AccountMode, buildCandleId } from './types';

export interface SessionCandleContext {
  key: string;
  symbol: string;
  timeframe: number;
  mode: AccountMode;
  generation: number;
  connectionId: string;
  closedCandles: Candle[];
  formingCandle: Candle | null;
  lastTick: MarketTick | null;
  createdAt: number;
  updatedAt: number;
}

export interface OTCDiagnostics {
  marketSource: 'POCKET OPTION OTC';
  candleSource: 'POCKET_OPTION_OTC';
  activeSymbol: string;
  timeframe: number;
  mode: AccountMode;
  generation: number;
  closedCount: number;
  formingAvailable: boolean;
  totalCandles: number;
  lastTickTime: number | null;
  lastPrice: number | null;
  isRecording: boolean;
}

/**
 * OTCCandleStore
 * 
 * Strict Single-Source-of-Truth store for Pocket Option OTC Market Data.
 * 
 * Directives Enforced:
 * 1. ZERO external/TradingView data injection for OTC symbols.
 * 2. Starts with empty session history when session opens.
 * 3. Records every valid real OTC candle from the moment live stream is active.
 * 4. In-place forming candle updates without repainting closed bars.
 * 5. Immutable closed candle preservation — older closed candles NEVER disappear.
 * 6. Strict context separation per (accountMode, symbol, timeframe).
 * 7. Generation isolation — rejects ticks from stale connection generations.
 */
export class OTCCandleStore {
  private contexts: Map<string, SessionCandleContext> = new Map();
  private activeSymbol: string = 'EURUSD_otc';
  private activeTimeframe: number = 60;
  private activeMode: AccountMode = 'DEMO';
  private activeGeneration: number = 1;
  private activeConnectionId: string = '';

  private onCandleClosedListeners: ((candle: Candle, allClosed: Candle[]) => void)[] = [];
  private onCandleUpdatedListeners: ((candle: Candle, allCandles: Candle[]) => void)[] = [];

  constructor(
    initialSymbol: string = 'EURUSD_otc',
    initialTimeframe: number = 60,
    initialMode: AccountMode = 'DEMO',
    initialGeneration: number = 1
  ) {
    this.activeSymbol = initialSymbol;
    this.activeTimeframe = initialTimeframe;
    this.activeMode = initialMode;
    this.activeGeneration = initialGeneration;

    // Initialize initial active session context with empty session history
    this.getContext(this.activeSymbol, this.activeTimeframe, this.activeMode, true);
  }

  public static buildContextKey(symbol: string, timeframe: number, mode: AccountMode): string {
    return `${mode.toUpperCase()}:${symbol.toUpperCase()}:${timeframe}`;
  }

  public static isOtcSymbol(symbol: string): boolean {
    return Boolean(symbol && symbol.toLowerCase().includes('otc'));
  }

  /**
   * Sets active tracking context.
   */
  public setActiveContext(
    symbol: string,
    timeframe: number,
    mode: AccountMode = this.activeMode,
    generation: number = this.activeGeneration,
    connectionId: string = this.activeConnectionId
  ): SessionCandleContext {
    this.activeSymbol = symbol;
    this.activeTimeframe = timeframe;
    this.activeMode = mode;
    this.activeGeneration = generation;
    if (connectionId) this.activeConnectionId = connectionId;

    return this.getContext(symbol, timeframe, mode, true);
  }

  /**
   * Switches connection generation (e.g. on reconnect or re-auth).
   */
  public setConnectionGeneration(generation: number, connectionId: string = ''): void {
    this.activeGeneration = generation;
    this.activeConnectionId = connectionId;
  }

  /**
   * Retrieves or initializes session context.
   */
  public getContext(
    symbol: string = this.activeSymbol,
    timeframe: number = this.activeTimeframe,
    mode: AccountMode = this.activeMode,
    createIfMissing: boolean = true
  ): SessionCandleContext | null {
    const key = OTCCandleStore.buildContextKey(symbol, timeframe, mode);
    let ctx = this.contexts.get(key);

    if (!ctx && createIfMissing) {
      ctx = {
        key,
        symbol,
        timeframe,
        mode,
        generation: this.activeGeneration,
        connectionId: this.activeConnectionId,
        closedCandles: [],
        formingCandle: null,
        lastTick: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      this.contexts.set(key, ctx);
      console.log(`[OTCCandleStore] Initialized clean session context for ${key} (0 initial candles)`);
    }

    return ctx || null;
  }

  /**
   * Ingest incoming tick from authorized Pocket Option OTC WebSocket stream.
   */
  public processTick(
    symbol: string,
    timestamp: number,
    price: number,
    generation: number = this.activeGeneration,
    connectionId: string = this.activeConnectionId
  ): boolean {
    // 1. Symbol check: must be OTC symbol
    if (!OTCCandleStore.isOtcSymbol(symbol)) {
      return false;
    }

    // 2. Active generation check: drop ticks from previous stale connection generations
    if (generation && generation !== this.activeGeneration) {
      return false;
    }

    // 3. Price validation
    if (typeof price !== 'number' || isNaN(price) || price <= 0) {
      return false;
    }

    // 4. Timestamp normalization: Pocket Option can emit seconds or milliseconds
    let secTime = typeof timestamp === 'number' ? timestamp : Number(timestamp);
    if (isNaN(secTime) || secTime <= 0) {
      secTime = Math.floor(Date.now() / 1000);
    } else if (secTime > 1e11) {
      secTime = Math.floor(secTime / 1000);
    }

    // 5. Update context for active timeframe
    const ctx = this.getContext(symbol, this.activeTimeframe, this.activeMode, true);
    if (!ctx) return false;

    const tick: MarketTick = {
      asset: symbol,
      price,
      timestamp: secTime,
      receivedAt: Date.now(),
    };
    ctx.lastTick = tick;
    ctx.updatedAt = Date.now();

    const timeframe = Math.floor(Number(ctx.timeframe) || 60);
    const bucketTime = Math.floor(Math.floor(secTime) / timeframe) * timeframe;
    const candleId = buildCandleId(symbol, timeframe, bucketTime);

    // CASE A: No forming candle exists yet -> First real candle of session (Candle #1)
    if (!ctx.formingCandle) {
      ctx.formingCandle = {
        candleId,
        asset: symbol,
        timeframe,
        time: bucketTime,
        open: price,
        high: price,
        low: price,
        close: price,
        volume: 1,
        isClosed: false,
        source: 'POCKET_OPTION_OTC',
      };

      console.log(`[OTCCandleStore] [${symbol}] Started Candle #1 at ${new Date(bucketTime * 1000).toISOString()} (price: ${price})`);
      this.notifyCandleUpdated(ctx.formingCandle, this.getAllCandles(symbol, timeframe, ctx.mode));
      return true;
    }

    // CASE B: Tick belongs to currently forming timeframe interval -> in-place update
    if (ctx.formingCandle.time === bucketTime) {
      ctx.formingCandle.high = Math.max(ctx.formingCandle.high, price);
      ctx.formingCandle.low = Math.min(ctx.formingCandle.low, price);
      ctx.formingCandle.close = price;
      ctx.formingCandle.volume = (ctx.formingCandle.volume || 0) + 1;
      ctx.formingCandle.isClosed = false;

      this.notifyCandleUpdated(ctx.formingCandle, this.getAllCandles(symbol, timeframe, ctx.mode));
      return true;
    }

    // CASE C: Bucket boundary crossed -> Finalize forming candle and begin next interval
    if (bucketTime > ctx.formingCandle.time) {
      const finalized: Candle = {
        ...ctx.formingCandle,
        candleId: buildCandleId(symbol, timeframe, ctx.formingCandle.time),
        isClosed: true,
        source: 'POCKET_OPTION_OTC',
      };

      // Strict OHLC physical verification
      const isValidOhlc =
        finalized.open > 0 &&
        finalized.close > 0 &&
        finalized.high >= Math.max(finalized.open, finalized.close) - 1e-8 &&
        finalized.low <= Math.min(finalized.open, finalized.close) + 1e-8 &&
        finalized.high >= finalized.low;

      if (isValidOhlc) {
        // Prevent duplicate timestamps in closed candle history
        const lastClosed = ctx.closedCandles[ctx.closedCandles.length - 1];
        if (!lastClosed || lastClosed.time < finalized.time) {
          ctx.closedCandles.push(finalized);
          // Retain closed candles permanently for current session (up to 50,000 candles)
          if (ctx.closedCandles.length > 50000) {
            ctx.closedCandles.shift();
          }

          console.log(
            `[OTCCandleStore] [${symbol}] Closed Candle #${ctx.closedCandles.length} at ${new Date(finalized.time * 1000).toISOString()} (O:${finalized.open} H:${finalized.high} L:${finalized.low} C:${finalized.close})`
          );

          this.notifyCandleClosed(finalized, ctx.closedCandles);
        }
      } else {
        console.warn(`[OTCCandleStore] Rejected malformed candle OHLC:`, finalized);
      }

      // Start new forming candle bucket
      ctx.formingCandle = {
        candleId,
        asset: symbol,
        timeframe,
        time: bucketTime,
        open: price,
        high: price,
        low: price,
        close: price,
        volume: 1,
        isClosed: false,
        source: 'POCKET_OPTION_OTC',
      };

      this.notifyCandleUpdated(ctx.formingCandle, this.getAllCandles(symbol, timeframe, ctx.mode));
      return true;
    }

    return false;
  }

  /**
   * Returns immutable confirmed closed candles for the requested context.
   * Strictly isolated per account mode (REAL vs DEMO).
   */
  public getClosedCandles(
    symbol: string = this.activeSymbol,
    timeframe: number = this.activeTimeframe,
    mode: AccountMode = this.activeMode
  ): Candle[] {
    const ctx = this.getContext(symbol, timeframe, mode, false);
    return ctx ? [...ctx.closedCandles] : [];
  }

  /**
   * Returns current mutable forming candle for the requested context.
   * Strictly isolated per account mode (REAL vs DEMO).
   */
  public getFormingCandle(
    symbol: string = this.activeSymbol,
    timeframe: number = this.activeTimeframe,
    mode: AccountMode = this.activeMode
  ): Candle | null {
    const ctx = this.getContext(symbol, timeframe, mode, false);
    return ctx && ctx.formingCandle ? { ...ctx.formingCandle } : null;
  }

  /**
   * Returns full sequence: all closed candles + forming candle (if active).
   * Strictly isolated per account mode (REAL vs DEMO).
   */
  public getAllCandles(
    symbol: string = this.activeSymbol,
    timeframe: number = this.activeTimeframe,
    mode: AccountMode = this.activeMode
  ): Candle[] {
    const ctx = this.getContext(symbol, timeframe, mode, false);
    if (!ctx) return [];
    if (ctx.formingCandle) {
      return [...ctx.closedCandles, { ...ctx.formingCandle }];
    }
    return [...ctx.closedCandles];
  }

  /**
   * Alias for compatibility.
   */
  public getCandles(
    symbol: string = this.activeSymbol,
    timeframe: number = this.activeTimeframe,
    mode: AccountMode = this.activeMode
  ): Candle[] {
    return this.getAllCandles(symbol, timeframe, mode);
  }

  /**
   * Direct ingestion of verified candles from Pocket Option broker protocol.
   * Strictly applied only to the targeted account mode.
   */
  public loadBrokerCandles(
    symbol: string,
    timeframe: number,
    rawCandles: Candle[],
    mode: AccountMode = this.activeMode
  ): void {
    if (!OTCCandleStore.isOtcSymbol(symbol)) return;
    const ctx = this.getContext(symbol, timeframe, mode, true);
    if (!ctx) return;

    const valid = rawCandles.filter(
      (c) =>
        c &&
        typeof c.time === 'number' &&
        c.time > 0 &&
        c.open > 0 &&
        c.close > 0 &&
        c.high >= Math.max(c.open, c.close) - 1e-8 &&
        c.low <= Math.min(c.open, c.close) + 1e-8
    );

    if (valid.length === 0) return;

    // Deduplicate and merge into closedCandles for requested mode
    const existingTimes = new Set(ctx.closedCandles.map((c) => c.time));
    for (const c of valid) {
      let t = Number(c.time);
      if (t > 1e11) t = Math.floor(t / 1000);
      t = Math.floor(t);
      const bucketTime = Math.floor(t / timeframe) * timeframe;
      const candleId = c.candleId || buildCandleId(symbol, timeframe, bucketTime);

      const normalized: Candle = {
        ...c,
        candleId,
        asset: symbol,
        timeframe,
        time: bucketTime,
        isClosed: true,
        source: c.source || 'POCKET_OPTION_OTC',
      };
      if (!existingTimes.has(normalized.time)) {
        ctx.closedCandles.push(normalized);
        existingTimes.add(normalized.time);
      }
    }

    ctx.closedCandles.sort((a, b) => (a.time as number) - (b.time as number));
    if (ctx.closedCandles.length > 50000) {
      ctx.closedCandles = ctx.closedCandles.slice(-50000);
    }

    console.log(`[OTCCandleStore] Merged ${valid.length} real broker candles for ${symbol} [${mode}]. Total closed: ${ctx.closedCandles.length}`);
  }

  /**
   * Clears active session context on SSD/session reset (Requirement 38).
   */
  public clearSessionContext(symbol: string, timeframe: number, mode: AccountMode): void {
    const key = OTCCandleStore.buildContextKey(symbol, timeframe, mode);
    this.contexts.delete(key);
    this.getContext(symbol, timeframe, mode, true);
  }

  public onCandleClosed(fn: (closedCandle: Candle, allClosed: Candle[]) => void): void {
    this.onCandleClosedListeners.push(fn);
  }

  public onCandleUpdated(fn: (candle: Candle, allCandles: Candle[]) => void): void {
    this.onCandleUpdatedListeners.push(fn);
  }

  private notifyCandleClosed(candle: Candle, allClosed: Candle[]): void {
    for (const listener of this.onCandleClosedListeners) {
      try {
        listener(candle, allClosed);
      } catch (err) {
        console.error('[OTCCandleStore] Error in onCandleClosed listener:', err);
      }
    }
  }

  private notifyCandleUpdated(candle: Candle, allCandles: Candle[]): void {
    for (const listener of this.onCandleUpdatedListeners) {
      try {
        listener(candle, allCandles);
      } catch (err) {
        console.error('[OTCCandleStore] Error in onCandleUpdated listener:', err);
      }
    }
  }

  public getDiagnostics(
    symbol: string = this.activeSymbol,
    timeframe: number = this.activeTimeframe,
    mode: AccountMode = this.activeMode
  ): OTCDiagnostics {
    const ctx = this.getContext(symbol, timeframe, mode, false);
    return {
      marketSource: 'POCKET OPTION OTC',
      candleSource: 'POCKET_OPTION_OTC',
      activeSymbol: symbol,
      timeframe,
      mode,
      generation: this.activeGeneration,
      closedCount: ctx ? ctx.closedCandles.length : 0,
      formingAvailable: ctx ? ctx.formingCandle !== null : false,
      totalCandles: ctx ? ctx.closedCandles.length + (ctx.formingCandle ? 1 : 0) : 0,
      lastTickTime: ctx && ctx.lastTick ? ctx.lastTick.timestamp : null,
      lastPrice: ctx && ctx.lastTick ? ctx.lastTick.price : null,
      isRecording: ctx ? ctx.lastTick !== null : false,
    };
  }
}
