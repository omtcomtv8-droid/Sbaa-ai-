import { AccountMode, Candle, MarketTick, buildCandleId } from './types';
import { HistoricalCandleService } from './HistoricalCandleService';
import { OTCCandleStore } from './OTCCandleStore';

export type MarketDataState =
  | 'CONNECTING'
  | 'LOADING_HISTORY'
  | 'COLLECTING_DATA'
  | 'CALCULATING'
  | 'READY'
  | 'ERROR';

export interface MarketDataValidationResult {
  isValid: boolean;
  errors: string[];
  candleCount: number;
  minRequired: number;
}

export interface MarketDataDiagnostics {
  dataSource: string;
  state: MarketDataState;
  webSocketStatus: string;
  historicalCandlesLoaded: number;
  closedCandlesCount: number;
  currentCandleStatus: 'ACTIVE' | 'FINALIZING' | 'NONE';
  lastCandleTimestamp: number | null;
  indicatorCalculationStatus: string;
  lastSuccessfulCalculationTime: number | null;
  validationErrors: string[];
  activeAsset: string;
  timeframe: number;
}

export class MarketDataStore {
  private activeAsset: string = 'EURUSD_otc';
  private timeframe: number = 60;
  private state: MarketDataState = 'CONNECTING';
  private stateMessage: string = 'Initializing connection...';

  // Dedicated OTCCandleStore for zero-leakage, zero-TradingView broker persistence
  private otcCandleStore: OTCCandleStore;
  private activeMode: AccountMode = 'DEMO';

  // Separated candle storage: closed historical candles vs current live forming candle
  private closedCandles: Candle[] = [];
  private formingCandle: Candle | null = null;
  private lastTick: MarketTick | null = null;

  // Multi-asset / multi-timeframe cache to prevent losing historical candles on switch
  private candleCache: Map<string, { closed: Candle[]; forming: Candle | null }> = new Map();

  // Diagnostics tracking
  private dataSource: string = 'POCKET OPTION OTC';
  private webSocketStatus: string = 'CONNECTING';
  private historicalCandlesLoaded: number = 0;
  private lastSuccessfulCalculationTime: number | null = null;
  private validationErrors: string[] = [];
  private indicatorCalculationStatus: string = 'INITIALIZING';

  // Listeners
  private onCandleClosedListeners: Array<(closedCandle: Candle, allClosed: Candle[]) => void> = [];
  private onTickListeners: Array<(tick: MarketTick) => void> = [];
  private onCandlesLoadedListeners: Array<(asset: string, timeframe: number, candles: Candle[]) => void> = [];

  // Services
  private historicalService = new HistoricalCandleService();
  private isLoadingHistory = false;
  private historyRetryTimer: NodeJS.Timeout | null = null;

  constructor(initialAsset: string = 'EURUSD_otc', initialTimeframe: number = 60) {
    this.activeAsset = initialAsset;
    this.timeframe = initialTimeframe;
    this.otcCandleStore = new OTCCandleStore(initialAsset, initialTimeframe);

    // Synchronize OTC candle close events directly to store listeners
    this.otcCandleStore.onCandleClosed((closed, allClosed) => {
      if (HistoricalCandleService.isOtcAsset(this.activeAsset)) {
        this.closedCandles = allClosed;
        for (const listener of this.onCandleClosedListeners) {
          listener(closed, allClosed);
        }
      }
    });

    if (HistoricalCandleService.isOtcAsset(initialAsset)) {
      this.dataSource = 'POCKET OPTION OTC';
    } else {
      this.dataSource = 'WebSocket + Institutional Spot Feed';
    }
  }

  public getOTCCandleStore(): OTCCandleStore {
    return this.otcCandleStore;
  }

  public setAccountMode(mode: AccountMode, generation?: number): void {
    this.activeMode = mode;
    this.otcCandleStore.setActiveContext(this.activeAsset, this.timeframe, mode, generation);
    if (HistoricalCandleService.isOtcAsset(this.activeAsset)) {
      this.closedCandles = this.otcCandleStore.getClosedCandles(this.activeAsset, this.timeframe, mode);
      this.formingCandle = this.otcCandleStore.getFormingCandle(this.activeAsset, this.timeframe, mode);
      this.historicalCandlesLoaded = this.closedCandles.length;
    }
  }

  public getAccountMode(): AccountMode {
    return this.activeMode;
  }

  public getActiveAsset(): string {
    return this.activeAsset;
  }

  public getTimeframe(): number {
    return this.timeframe;
  }

  public getState(): MarketDataState {
    return this.state;
  }

  public getStateMessage(): string {
    return this.stateMessage;
  }

  public setState(state: MarketDataState, message: string = ''): void {
    this.state = state;
    this.stateMessage = message;
  }

  public setWebSocketStatus(status: string): void {
    this.webSocketStatus = status;
    if (status === 'CONNECTED' && this.state === 'CONNECTING') {
      this.setState('LOADING_HISTORY', 'WebSocket connected. Loading historical candles...');
    }
  }

  public setIndicatorStatus(status: string, lastCalcTime?: number): void {
    this.indicatorCalculationStatus = status;
    if (lastCalcTime) {
      this.lastSuccessfulCalculationTime = lastCalcTime;
    }
  }

  public onCandleClosed(fn: (closedCandle: Candle, allClosed: Candle[]) => void): void {
    this.onCandleClosedListeners.push(fn);
  }

  public onTick(fn: (tick: MarketTick) => void): void {
    this.onTickListeners.push(fn);
  }

  public onCandlesLoaded(fn: (asset: string, timeframe: number, candles: Candle[]) => void): void {
    this.onCandlesLoadedListeners.push(fn);
  }

  private brokerHistoryRequester: ((asset: string, timeframe: number) => boolean) | null = null;

  public setBrokerHistoryRequester(fn: (asset: string, timeframe: number) => boolean): void {
    this.brokerHistoryRequester = fn;
  }

  /**
   * Loads 100-200 real historical OHLC candles before indicator calculation.
   * Auto-retries upon failure with exponential backoff for public assets.
   * OTC symbols are routed to the active Pocket Option broker feed.
   */
  public async initHistoricalData(asset: string = this.activeAsset, timeframe: number = this.timeframe): Promise<boolean> {
    if (this.isLoadingHistory) return false;
    this.isLoadingHistory = true;

    // 1. Check if asset is OTC or proprietary broker symbol
    const isOtc = HistoricalCandleService.isOtcAsset(asset) || !HistoricalCandleService.hasExternalExchangeMapping(asset);

    if (isOtc) {
      this.isLoadingHistory = false;
      this.dataSource = 'POCKET OPTION OTC';

      const closed = this.otcCandleStore.getClosedCandles(asset, timeframe);
      if (closed.length > 0) {
        if (asset === this.activeAsset && timeframe === this.timeframe) {
          this.closedCandles = closed;
          this.formingCandle = this.otcCandleStore.getFormingCandle(asset, timeframe);
          this.historicalCandlesLoaded = closed.length;
          this.validationErrors = [];
          this.setState('COLLECTING_DATA', `Using ${closed.length} verified broker candles for ${asset}`);
        }

        const all = this.otcCandleStore.getAllCandles(asset, timeframe);
        for (const listener of this.onCandlesLoadedListeners) {
          listener(asset, timeframe, all);
        }
        return true;
      }

      // If active broker requester is hooked, request historical candles from broker
      if (this.brokerHistoryRequester) {
        this.brokerHistoryRequester(asset, timeframe);
      }

      if (asset === this.activeAsset) {
        this.setState('CONNECTING', `Awaiting live OTC candles for ${asset} from Pocket Option broker feed.`);
      }

      return false;
    }

    // 2. Non-OTC assets: load from public exchange spot feeds
    this.setState('LOADING_HISTORY', `Loading historical OHLC candles for ${asset} (${timeframe}s)...`);

    try {
      const result = await this.historicalService.loadHistoricalCandles(asset, timeframe, 150);
      
      if (!result || result.candles.length === 0) {
        this.isLoadingHistory = false;
        if (this.brokerHistoryRequester) {
          this.brokerHistoryRequester(asset, timeframe);
        }
        this.setState('CONNECTING', `Awaiting real market candles for ${asset} from active broker feed.`);
        return false;
      }

      // Save to multi-asset cache
      this.candleCache.set(`${asset}:${timeframe}`, {
        closed: result.candles,
        forming: null,
      });

      if (asset === this.activeAsset && timeframe === this.timeframe) {
        this.closedCandles = result.candles;
        this.historicalCandlesLoaded = result.candles.length;
        this.dataSource = result.source;
      }

      this.isLoadingHistory = false;

      // Validate loaded historical candles
      const validation = this.validateMarketData(asset, timeframe);
      if (validation.isValid) {
        this.validationErrors = [];
        this.setState('COLLECTING_DATA', `Loaded ${result.candles.length} verified closed candles from ${result.source}`);
        console.log(`[MarketDataStore] Successfully loaded ${result.candles.length} historical candles for ${asset} from ${result.source}`);

        // Notify candles loaded listeners for SSE broadcast
        const all = this.getCandles(asset, timeframe);
        for (const listener of this.onCandlesLoadedListeners) {
          listener(asset, timeframe, all);
        }

        return true;
      } else {
        this.validationErrors = validation.errors;
        this.setState('COLLECTING_DATA', `Historical candles loaded: ${validation.errors.join('; ')}`);
        return false;
      }
    } catch (err: any) {
      this.isLoadingHistory = false;
      const msg = err?.message || String(err);
      this.validationErrors = [`Historical data pending for ${asset}: ${msg}`];
      this.setState('CONNECTING', `Awaiting historical candles for ${asset}...`);
      console.warn(`[MarketDataStore] External historical candle fetch pending for ${asset}:`, msg);

      // Schedule retry with backoff only for non-OTC assets
      if (this.historyRetryTimer) clearTimeout(this.historyRetryTimer);
      this.historyRetryTimer = setTimeout(() => {
        if (!HistoricalCandleService.isOtcAsset(asset)) {
          this.initHistoricalData(asset, timeframe);
        }
      }, 10000);

      return false;
    }
  }

  /**
   * Directly ingests verified historical candles from Pocket Option broker WebSocket feed.
   */
  public loadHistoricalCandles(asset: string, timeframe: number, rawCandles: Candle[], source: string = 'Pocket Option Real Feed'): void {
    if (HistoricalCandleService.isOtcAsset(asset)) {
      this.otcCandleStore.loadBrokerCandles(asset, timeframe, rawCandles);
      if (asset === this.activeAsset && timeframe === this.timeframe) {
        this.closedCandles = this.otcCandleStore.getClosedCandles(asset, timeframe);
        this.formingCandle = this.otcCandleStore.getFormingCandle(asset, timeframe);
        this.historicalCandlesLoaded = this.closedCandles.length;
        this.dataSource = 'POCKET OPTION OTC';
        this.validationErrors = [];
        this.setState('COLLECTING_DATA', `Loaded ${this.closedCandles.length} real broker candles for ${asset}`);
        const all = this.otcCandleStore.getAllCandles(asset, timeframe);
        for (const listener of this.onCandlesLoadedListeners) {
          listener(asset, timeframe, all);
        }
      }
      return;
    }

    const valid = rawCandles.filter(
      (c) =>
        c &&
        typeof c.time === 'number' &&
        c.time > 0 &&
        c.open > 0 &&
        c.close > 0 &&
        c.high > 0 &&
        c.low > 0 &&
        c.high >= Math.max(c.open, c.close) - 1e-8 &&
        c.low <= Math.min(c.open, c.close) + 1e-8 &&
        c.high >= c.low
    );
    const timeMap = new Map<number, Candle>();
    for (const c of valid) {
      timeMap.set(c.time, { ...c, asset, timeframe, isClosed: true, source });
    }
    const sorted = Array.from(timeMap.values()).sort((a, b) => a.time - b.time);

    const activeForming =
      this.formingCandle &&
      (sorted.length === 0 || this.formingCandle.time > sorted[sorted.length - 1].time)
        ? this.formingCandle
        : null;

    this.candleCache.set(`${asset}:${timeframe}`, {
      closed: sorted,
      forming: activeForming,
    });

    if (asset === this.activeAsset && timeframe === this.timeframe) {
      this.closedCandles = sorted;
      this.formingCandle = activeForming;
      this.historicalCandlesLoaded = sorted.length;
      this.dataSource = source;
      this.validationErrors = [];
      this.setState('COLLECTING_DATA', `Loaded ${sorted.length} real broker candles for ${asset}`);
    }

    const all = this.getCandles(asset, timeframe);
    for (const listener of this.onCandlesLoadedListeners) {
      listener(asset, timeframe, all);
    }
  }

  /**
   * Ingest incoming tick from live WebSocket stream.
   * Separates live forming candle from confirmed closed candles.
   */
  public processTick(asset: string, timestamp: number, price: number): void {
    if (asset !== this.activeAsset) return;
    if (typeof price !== 'number' || isNaN(price) || price <= 0) return;
    if (typeof timestamp !== 'number' || isNaN(timestamp) || timestamp <= 0) return;

    const now = Date.now();
    const tick: MarketTick = {
      asset,
      timestamp,
      price,
      receivedAt: now,
    };
    this.lastTick = tick;

    // Notify tick listeners
    for (const listener of this.onTickListeners) {
      listener(tick);
    }

    // Strict OTC Processing: Isolated OTCCandleStore single source of truth
    if (HistoricalCandleService.isOtcAsset(asset)) {
      this.otcCandleStore.processTick(asset, timestamp, price);
      this.closedCandles = this.otcCandleStore.getClosedCandles(asset, this.timeframe);
      this.formingCandle = this.otcCandleStore.getFormingCandle(asset, this.timeframe);
      this.dataSource = 'POCKET OPTION OTC';
      return;
    }

    // Determine candle bucket boundary: for 60s, bucketTime = Math.floor(timestamp / 60) * 60
    let sec = Number(timestamp);
    if (sec > 1e11) sec = Math.floor(sec / 1000);
    sec = Math.floor(sec);
    const tf = Math.floor(Number(this.timeframe) || 60);
    const bucketTime = Math.floor(sec / tf) * tf;
    const candleId = buildCandleId(asset, tf, bucketTime);

    if (!this.formingCandle) {
      // First forming candle
      this.formingCandle = {
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
        source: 'live_stream',
      };
      return;
    }

    if (this.formingCandle.time === bucketTime) {
      // Update currently forming live candle (without repainting closed historical indicators)
      this.formingCandle.high = Math.max(this.formingCandle.high, price);
      this.formingCandle.low = Math.min(this.formingCandle.low, price);
      this.formingCandle.close = price;
      this.formingCandle.volume += 1;
      this.formingCandle.isClosed = false;
    } else if (bucketTime > this.formingCandle.time) {
      // Candle boundary crossed! Finalize forming candle as CLOSED
      const finalizedCandle: Candle = {
        ...this.formingCandle,
        candleId: buildCandleId(asset, tf, this.formingCandle.time),
        isClosed: true,
      };

      // Validate integrity of finalized candle
      if (
        finalizedCandle.open > 0 &&
        finalizedCandle.high >= Math.max(finalizedCandle.open, finalizedCandle.close) - 1e-8 &&
        finalizedCandle.low <= Math.min(finalizedCandle.open, finalizedCandle.close) + 1e-8 &&
        finalizedCandle.high >= finalizedCandle.low
      ) {
        // Prevent duplicate timestamp in closedCandles
        const lastClosed = this.closedCandles[this.closedCandles.length - 1];
        if (!lastClosed || lastClosed.time < finalizedCandle.time) {
          this.closedCandles.push(finalizedCandle);
          // Retain up to 50,000 candles
          if (this.closedCandles.length > 50000) {
            this.closedCandles.shift();
          }

          console.log(
            `[MarketDataStore] Finalized candle at ${finalizedCandle.time} (O:${finalizedCandle.open} H:${finalizedCandle.high} L:${finalizedCandle.low} C:${finalizedCandle.close}). Total closed: ${this.closedCandles.length}`
          );

          // Trigger confirmed indicator & signal recalculation ONLY on candle close!
          for (const listener of this.onCandleClosedListeners) {
            listener(finalizedCandle, this.closedCandles);
          }
        }
      }

      // Start new forming candle bucket
      this.formingCandle = {
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
        source: 'live_stream',
      };
    }
  }

  /**
   * Comprehensive market data validation function required by Item 10.
   */
  public validateMarketData(asset: string = this.activeAsset, timeframe: number = this.timeframe): MarketDataValidationResult {
    const errors: string[] = [];
    const minRequired = 50;

    // 1. Symbol valid
    if (!asset || typeof asset !== 'string' || asset.trim().length === 0) {
      errors.push('Symbol is missing or invalid');
    }

    // 2. Timeframe valid
    if (!timeframe || typeof timeframe !== 'number' || timeframe <= 0) {
      errors.push('Timeframe must be a positive integer');
    }

    // 3. Check closed candles count
    const count = this.closedCandles.length;
    if (count < minRequired) {
      errors.push(`Insufficient closed candles: ${count} available, ${minRequired} required for SMA 50 and stable indicators`);
    }

    // 4. Validate chronological order, non-duplication, and OHLC physics
    for (let i = 0; i < this.closedCandles.length; i++) {
      const c = this.closedCandles[i];

      // Physical OHLC values
      if (
        typeof c.open !== 'number' ||
        typeof c.high !== 'number' ||
        typeof c.low !== 'number' ||
        typeof c.close !== 'number' ||
        isNaN(c.open) ||
        isNaN(c.high) ||
        isNaN(c.low) ||
        isNaN(c.close) ||
        c.open <= 0 ||
        c.high <= 0 ||
        c.low <= 0 ||
        c.close <= 0 ||
        c.high < Math.max(c.open, c.close) - 1e-8 ||
        c.low > Math.min(c.open, c.close) + 1e-8 ||
        c.high < c.low - 1e-8
      ) {
        errors.push(`Candle at index ${i} has invalid OHLC physics: O=${c.open} H=${c.high} L=${c.low} C=${c.close}`);
        break;
      }

      // Chronological & duplication checks
      if (i > 0) {
        const prev = this.closedCandles[i - 1];
        if (c.time <= prev.time) {
          errors.push(`Chronological timestamp violation: candle at ${c.time} <= previous candle at ${prev.time}`);
          break;
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      candleCount: count,
      minRequired,
    };
  }

  /**
   * Strictly returns verified CLOSED candles for confirmed indicator calculations.
   * Never includes the currently forming candle.
   */
  public getClosedCandles(): Candle[] {
    if (HistoricalCandleService.isOtcAsset(this.activeAsset)) {
      return this.otcCandleStore.getClosedCandles(this.activeAsset, this.timeframe, this.activeMode);
    }
    return this.closedCandles;
  }

  /**
   * Returns current forming live candle if active.
   */
  public getFormingCandle(): Candle | null {
    if (HistoricalCandleService.isOtcAsset(this.activeAsset)) {
      return this.otcCandleStore.getFormingCandle(this.activeAsset, this.timeframe, this.activeMode);
    }
    return this.formingCandle;
  }

  /**
   * Returns all candles (closed + forming) for chart display.
   */
  public getAllCandles(): Candle[] {
    if (HistoricalCandleService.isOtcAsset(this.activeAsset)) {
      return this.otcCandleStore.getAllCandles(this.activeAsset, this.timeframe, this.activeMode);
    }
    if (this.formingCandle) {
      return [...this.closedCandles, this.formingCandle];
    }
    return this.closedCandles;
  }

  /**
   * Authoritative getter for any asset & timeframe.
   * Returns all candles (closed + forming) for the specified asset and timeframe.
   */
  public getCandles(asset: string, timeframe: number): Candle[] {
    if (HistoricalCandleService.isOtcAsset(asset)) {
      return this.otcCandleStore.getAllCandles(asset, timeframe, this.activeMode);
    }
    if (asset === this.activeAsset && timeframe === this.timeframe) {
      return this.getAllCandles();
    }
    const cached = this.candleCache.get(`${asset}:${timeframe}`);
    if (cached) {
      return cached.forming ? [...cached.closed, cached.forming] : cached.closed;
    }
    return [];
  }

  /**
   * Authoritative getter for closed candles of any asset & timeframe.
   */
  public getClosedCandlesFor(asset: string, timeframe: number): Candle[] {
    if (HistoricalCandleService.isOtcAsset(asset)) {
      return this.otcCandleStore.getClosedCandles(asset, timeframe, this.activeMode);
    }
    if (asset === this.activeAsset && timeframe === this.timeframe) {
      return this.closedCandles;
    }
    const cached = this.candleCache.get(`${asset}:${timeframe}`);
    return cached ? cached.closed : [];
  }

  public getLastTick(): MarketTick | null {
    return this.lastTick;
  }

  public getCurrentPrice(): number | null {
    if (this.lastTick) return this.lastTick.price;
    if (this.formingCandle) return this.formingCandle.close;
    if (this.closedCandles.length > 0) return this.closedCandles[this.closedCandles.length - 1].close;
    return null;
  }

  /**
   * Provides full debugging and diagnostic information required by Item 18.
   */
  public getDiagnostics(): MarketDataDiagnostics {
    if (HistoricalCandleService.isOtcAsset(this.activeAsset)) {
      const otcDiag = this.otcCandleStore.getDiagnostics(this.activeAsset, this.timeframe);
      return {
        dataSource: 'POCKET OPTION OTC',
        state: this.state,
        webSocketStatus: this.webSocketStatus,
        historicalCandlesLoaded: otcDiag.closedCount,
        closedCandlesCount: otcDiag.closedCount,
        currentCandleStatus: otcDiag.formingAvailable ? 'ACTIVE' : 'NONE',
        lastCandleTimestamp: otcDiag.lastTickTime,
        indicatorCalculationStatus: this.indicatorCalculationStatus,
        lastSuccessfulCalculationTime: this.lastSuccessfulCalculationTime,
        validationErrors: this.validationErrors,
        activeAsset: this.activeAsset,
        timeframe: this.timeframe,
      };
    }

    const lastCandle = this.closedCandles[this.closedCandles.length - 1];
    return {
      dataSource: this.dataSource,
      state: this.state,
      webSocketStatus: this.webSocketStatus,
      historicalCandlesLoaded: this.historicalCandlesLoaded,
      closedCandlesCount: this.closedCandles.length,
      currentCandleStatus: this.formingCandle ? 'ACTIVE' : 'NONE',
      lastCandleTimestamp: lastCandle ? lastCandle.time : null,
      indicatorCalculationStatus: this.indicatorCalculationStatus,
      lastSuccessfulCalculationTime: this.lastSuccessfulCalculationTime,
      validationErrors: this.validationErrors,
      activeAsset: this.activeAsset,
      timeframe: this.timeframe,
    };
  }

  /**
   * Change active asset or timeframe with clean re-initialization.
   * Leverages cache for zero-latency UI transition and fetches fresh background data.
   */
  public async switchAsset(newAsset: string, newTimeframe: number = this.timeframe): Promise<void> {
    // 1. Save current active candles to cache
    this.candleCache.set(`${this.activeAsset}:${this.timeframe}`, {
      closed: this.closedCandles,
      forming: this.formingCandle,
    });

    if (this.activeAsset === newAsset && this.timeframe === newTimeframe && this.closedCandles.length >= 50) {
      return;
    }

    this.activeAsset = newAsset;
    this.timeframe = newTimeframe;

    // Handle OTC Symbol Switch
    if (HistoricalCandleService.isOtcAsset(newAsset)) {
      this.otcCandleStore.setActiveContext(newAsset, newTimeframe);
      this.closedCandles = this.otcCandleStore.getClosedCandles(newAsset, newTimeframe);
      this.formingCandle = this.otcCandleStore.getFormingCandle(newAsset, newTimeframe);
      this.dataSource = 'POCKET OPTION OTC';
      this.historicalCandlesLoaded = this.closedCandles.length;
      this.validationErrors = [];

      if (this.closedCandles.length === 0) {
        this.setState('CONNECTING', `Awaiting live OTC candles for ${newAsset} from Pocket Option feed.`);
      } else {
        this.setState('COLLECTING_DATA', `Using ${this.closedCandles.length} real OTC candles for ${newAsset}`);
      }

      const all = this.otcCandleStore.getAllCandles(newAsset, newTimeframe);
      for (const listener of this.onCandlesLoadedListeners) {
        listener(newAsset, newTimeframe, all);
      }
      return;
    }

    // 2. Non-OTC: Check if new asset/timeframe has cached historical candles
    const cached = this.candleCache.get(`${newAsset}:${newTimeframe}`);
    if (cached && cached.closed.length >= 10) {
      this.closedCandles = cached.closed;
      this.formingCandle = cached.forming;
      this.historicalCandlesLoaded = cached.closed.length;
      this.validationErrors = [];
      this.setState('COLLECTING_DATA', `Using cached ${cached.closed.length} candles for ${newAsset}`);
      
      // Notify listeners immediately
      const all = this.getAllCandles();
      for (const listener of this.onCandlesLoadedListeners) {
        listener(newAsset, newTimeframe, all);
      }
    } else {
      this.formingCandle = null;
      this.closedCandles = [];
      this.historicalCandlesLoaded = 0;
      this.validationErrors = [];
    }

    await this.initHistoricalData(newAsset, newTimeframe);
  }
}

// Single Source of Truth CandleStore Alias
export { MarketDataStore as CandleStore };
