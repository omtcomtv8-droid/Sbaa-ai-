import { Candle, MarketTick, buildCandleId, getCandleOpenTime } from '../types';

export interface CandleStoreDiagnostics {
  asset: string;
  timeframe: number;
  storedCount: number;
  closedCount: number;
  hasFormingCandle: boolean;
  formingTime: number | null;
  firstCandleTime: number | null;
  lastCandleTime: number | null;
  uniqueIdsCount: number;
  duplicatesRejected: number;
  ticksProcessed: number;
  candlesCreated: number;
  candlesUpdated: number;
  candlesFinalized: number;
  candlesPersisted: number;
  chartDataCount: number;
  desyncWarning: boolean;
  lastUpdateTimestamp: number;
}

export interface CandleHistoryBucket {
  closed: Map<string, Candle>; // key: candleId
  forming: Candle | null;
  timeOrder: string[]; // candleIds in ascending time order
}

export type CandleStoreListener = (
  event: 'candle_updated' | 'candle_closed' | 'history_loaded' | 'cleared',
  candles: Candle[],
  updatedCandle?: Candle
) => void;

const DB_NAME = 'PocketOptionCandleDB';
const DB_VERSION = 1;
const STORE_NAME = 'candleHistory';

class CandleStoreService {
  // Nested structure: Map<asset, Map<timeframe, CandleHistoryBucket>>
  private storage: Map<string, Map<number, CandleHistoryBucket>> = new Map();
  private listeners: Set<CandleStoreListener> = new Set();

  // Metrics & diagnostics
  private ticksProcessed = 0;
  private duplicatesRejected = 0;
  private candlesCreated = 0;
  private candlesUpdated = 0;
  private candlesFinalized = 0;
  private candlesPersisted = 0;
  private chartDataCount = 0;

  private dbPromise: Promise<IDBDatabase | null> | null = null;
  private initializedAssets: Set<string> = new Set();

  constructor() {
    if (typeof window !== 'undefined' && 'indexedDB' in window) {
      this.initIndexedDB();
    }
  }

  private initIndexedDB(): Promise<IDBDatabase | null> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve) => {
      try {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e: any) => {
          const db = e.target.result as IDBDatabase;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            const store = db.createObjectStore(STORE_NAME, { keyPath: 'candleId' });
            store.createIndex('asset_tf', ['asset', 'timeframe'], { unique: false });
            store.createIndex('time', 'time', { unique: false });
          }
        };
        req.onsuccess = (e: any) => {
          resolve(e.target.result as IDBDatabase);
        };
        req.onerror = (e) => {
          console.warn('[CandleStore] IndexedDB open error, falling back to in-memory:', e);
          resolve(null);
        };
      } catch (err) {
        console.warn('[CandleStore] IndexedDB init exception:', err);
        resolve(null);
      }
    });

    return this.dbPromise;
  }

  private getBucket(asset: string, timeframe: number): CandleHistoryBucket {
    const normAsset = (asset || 'EURUSD_otc').toLowerCase();
    const normTf = Math.floor(Number(timeframe) || 60);

    let assetMap = this.storage.get(normAsset);
    if (!assetMap) {
      assetMap = new Map();
      this.storage.set(normAsset, assetMap);
    }

    let bucket = assetMap.get(normTf);
    if (!bucket) {
      bucket = {
        closed: new Map(),
        forming: null,
        timeOrder: [],
      };
      assetMap.set(normTf, bucket);
    }

    return bucket;
  }

  /**
   * Load stored candles from IndexedDB for a specific asset and timeframe.
   */
  public async loadFromPersistence(asset: string, timeframe: number): Promise<Candle[]> {
    const normAsset = (asset || '').toLowerCase();
    const normTf = Math.floor(Number(timeframe) || 60);
    const key = `${normAsset}:${normTf}`;

    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      return this.getCandles(asset, timeframe);
    }

    try {
      const db = await this.initIndexedDB();
      if (!db) return this.getCandles(asset, timeframe);

      return new Promise<Candle[]>((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const index = store.index('asset_tf');
        const req = index.getAll(IDBKeyRange.only([normAsset, normTf]));

        req.onsuccess = () => {
          const records: Candle[] = req.result || [];
          if (records.length > 0) {
            this.upsertCandles(records, false);
            console.log(`[CandleStore] Hydrated ${records.length} persistent candles for ${asset} (${normTf}s)`);
          }
          this.initializedAssets.add(key);
          resolve(this.getCandles(asset, timeframe));
        };

        req.onerror = () => {
          resolve(this.getCandles(asset, timeframe));
        };
      });
    } catch (err) {
      console.warn('[CandleStore] Failed to read from IndexedDB:', err);
      return this.getCandles(asset, timeframe);
    }
  }

  /**
   * Asynchronously persist closed candles to IndexedDB.
   */
  private async persistCandles(candles: Candle[]): Promise<void> {
    if (candles.length === 0 || typeof window === 'undefined' || !('indexedDB' in window)) return;

    try {
      const db = await this.initIndexedDB();
      if (!db) return;

      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      for (const c of candles) {
        if (!c.isClosed) continue;
        const normAsset = (c.asset || '').toLowerCase();
        const normTf = Math.floor(Number(c.timeframe) || 60);
        const openTime = Math.floor(Number(c.time));
        const candleId = c.candleId || buildCandleId(normAsset, normTf, openTime);

        store.put({
          ...c,
          candleId,
          asset: normAsset,
          timeframe: normTf,
          time: openTime,
          isClosed: true,
        });
        this.candlesPersisted++;
      }
    } catch (err) {
      console.warn('[CandleStore] Error persisting candles to IndexedDB:', err);
    }
  }

  /**
   * Deterministic upsert for a single candle.
   * - Never overwrites closed confirmed candles.
   * - Finalizes candles when new bucket arrived.
   * - Preserves immutable history.
   */
  public upsertCandle(candle: Candle, shouldNotify = true): { type: 'created' | 'updated' | 'finalized' | 'ignored'; candle: Candle } {
    if (!candle) return { type: 'ignored', candle };

    const normAsset = (candle.asset || 'EURUSD_otc').toLowerCase();
    const normTf = Math.floor(Number(candle.timeframe) || 60);
    let openTime = Number(candle.time);
    if (openTime > 1e11) openTime = Math.floor(openTime / 1000);
    openTime = Math.floor(openTime);

    // Round openTime cleanly to timeframe boundary
    const bucketTime = Math.floor(openTime / normTf) * normTf;
    const candleId = candle.candleId || buildCandleId(normAsset, normTf, bucketTime);

    const open = Number(candle.open);
    const close = Number(candle.close);
    let high = Number(candle.high);
    let low = Number(candle.low);
    const volume = Number(candle.volume) > 0 ? Number(candle.volume) : 1;

    if (isNaN(open) || isNaN(close) || open <= 0 || close <= 0) {
      this.duplicatesRejected++;
      return { type: 'ignored', candle };
    }
    if (isNaN(high) || high < Math.max(open, close)) high = Math.max(open, close);
    if (isNaN(low) || low > Math.min(open, close) || low <= 0) low = Math.min(open, close);

    const bucket = this.getBucket(normAsset, normTf);
    const existingClosed = bucket.closed.get(candleId);

    // Rule: Closed confirmed candles are IMMUTABLE. Never overwrite with a non-closed or older candle.
    if (existingClosed) {
      if (!candle.isClosed) {
        this.duplicatesRejected++;
        return { type: 'ignored', candle: existingClosed };
      }
      // If authoritative closed update, preserve closed state
      bucket.closed.set(candleId, {
        ...existingClosed,
        ...candle,
        candleId,
        asset: normAsset,
        timeframe: normTf,
        time: bucketTime,
        isClosed: true,
      });
      return { type: 'updated', candle: bucket.closed.get(candleId)! };
    }

    if (candle.isClosed) {
      // Confirmed closed candle
      const finalizedCandle: Candle = {
        ...candle,
        candleId,
        asset: normAsset,
        timeframe: normTf,
        time: bucketTime,
        open,
        high,
        low,
        close,
        volume,
        isClosed: true,
        source: candle.source || 'Pocket Option Real History',
      };

      bucket.closed.set(candleId, finalizedCandle);
      this.insertTimeOrder(bucket, candleId, bucketTime);
      this.candlesCreated++;

      // If this was our current forming candle, clear forming
      if (bucket.forming && bucket.forming.time === bucketTime) {
        bucket.forming = null;
      }

      this.persistCandles([finalizedCandle]);

      if (shouldNotify) {
        this.notify('candle_closed', this.getCandles(normAsset, normTf), finalizedCandle);
      }
      return { type: 'finalized', candle: finalizedCandle };
    }

    // Mutable forming candle logic
    if (!bucket.forming) {
      bucket.forming = {
        candleId,
        asset: normAsset,
        timeframe: normTf,
        time: bucketTime,
        open,
        high,
        low,
        close,
        volume,
        isClosed: false,
        source: candle.source || 'forming',
      };
      this.candlesCreated++;
      if (shouldNotify) {
        this.notify('candle_updated', this.getCandles(normAsset, normTf), bucket.forming);
      }
      return { type: 'created', candle: bucket.forming };
    }

    if (bucket.forming.time === bucketTime) {
      // In-place forming candle update
      bucket.forming.high = Math.max(bucket.forming.high, high);
      bucket.forming.low = Math.min(bucket.forming.low, low);
      bucket.forming.close = close;
      bucket.forming.volume = Math.max(bucket.forming.volume, volume);
      bucket.forming.isClosed = false;
      this.candlesUpdated++;

      if (shouldNotify) {
        this.notify('candle_updated', this.getCandles(normAsset, normTf), bucket.forming);
      }
      return { type: 'updated', candle: bucket.forming };
    }

    if (bucketTime > bucket.forming.time) {
      // Forming candle closed and new candle started!
      const prevForming = bucket.forming;
      const closedCandle: Candle = {
        ...prevForming,
        candleId: buildCandleId(normAsset, normTf, prevForming.time),
        isClosed: true,
      };

      bucket.closed.set(closedCandle.candleId!, closedCandle);
      this.insertTimeOrder(bucket, closedCandle.candleId!, prevForming.time);
      this.candlesFinalized++;
      this.persistCandles([closedCandle]);

      // Start new forming candle
      bucket.forming = {
        candleId,
        asset: normAsset,
        timeframe: normTf,
        time: bucketTime,
        open,
        high,
        low,
        close,
        volume,
        isClosed: false,
        source: candle.source || 'forming',
      };
      this.candlesCreated++;

      if (shouldNotify) {
        this.notify('candle_closed', this.getCandles(normAsset, normTf), closedCandle);
        this.notify('candle_updated', this.getCandles(normAsset, normTf), bucket.forming);
      }
      return { type: 'finalized', candle: closedCandle };
    }

    // Older tick/forming arriving out of order - ignore or merge
    this.duplicatesRejected++;
    return { type: 'ignored', candle };
  }

  /**
   * Batch upsert candles (e.g. from history load or API response).
   * Never truncates or replaces existing closed candles!
   */
  public upsertCandles(incomingCandles: Candle[], shouldNotify = true): Candle[] {
    if (!Array.isArray(incomingCandles) || incomingCandles.length === 0) return [];

    let sampleAsset = '';
    let sampleTf = 60;
    const closedToPersist: Candle[] = [];

    for (const c of incomingCandles) {
      if (!c) continue;
      sampleAsset = c.asset || sampleAsset;
      sampleTf = c.timeframe || sampleTf;

      const res = this.upsertCandle(c, false);
      if (res.type === 'finalized' || (c.isClosed && res.type !== 'ignored')) {
        closedToPersist.push(res.candle);
      }
    }

    if (closedToPersist.length > 0) {
      this.persistCandles(closedToPersist);
    }

    const all = this.getCandles(sampleAsset || 'EURUSD_otc', sampleTf);
    if (shouldNotify) {
      this.notify('history_loaded', all);
    }
    return all;
  }

  /**
   * Process a single price tick directly.
   */
  public ingestTick(tick: MarketTick, timeframe: number): Candle | null {
    if (!tick || typeof tick.price !== 'number' || isNaN(tick.price) || tick.price <= 0) return null;

    this.ticksProcessed++;
    const asset = tick.asset || 'EURUSD_otc';
    const normTf = Math.floor(Number(timeframe) || 60);

    let sec = Number(tick.timestamp);
    if (sec > 1e11) sec = Math.floor(sec / 1000);
    sec = Math.floor(sec);
    const bucketTime = Math.floor(sec / normTf) * normTf;
    const candleId = buildCandleId(asset, normTf, bucketTime);

    const bucket = this.getBucket(asset, normTf);

    if (!bucket.forming) {
      bucket.forming = {
        candleId,
        asset,
        timeframe: normTf,
        time: bucketTime,
        open: tick.price,
        high: tick.price,
        low: tick.price,
        close: tick.price,
        volume: 1,
        isClosed: false,
        source: 'POCKET_OPTION_OTC',
      };
      this.candlesCreated++;
      this.notify('candle_updated', this.getCandles(asset, normTf), bucket.forming);
      return bucket.forming;
    }

    if (bucket.forming.time === bucketTime) {
      bucket.forming.high = Math.max(bucket.forming.high, tick.price);
      bucket.forming.low = Math.min(bucket.forming.low, tick.price);
      bucket.forming.close = tick.price;
      bucket.forming.volume = (bucket.forming.volume || 0) + 1;
      bucket.forming.isClosed = false;
      this.candlesUpdated++;
      this.notify('candle_updated', this.getCandles(asset, normTf), bucket.forming);
      return bucket.forming;
    }

    if (bucketTime > bucket.forming.time) {
      const closedCandle: Candle = {
        ...bucket.forming,
        candleId: buildCandleId(asset, normTf, bucket.forming.time),
        isClosed: true,
      };

      bucket.closed.set(closedCandle.candleId!, closedCandle);
      this.insertTimeOrder(bucket, closedCandle.candleId!, bucket.forming.time);
      this.candlesFinalized++;
      this.persistCandles([closedCandle]);

      bucket.forming = {
        candleId,
        asset,
        timeframe: normTf,
        time: bucketTime,
        open: tick.price,
        high: tick.price,
        low: tick.price,
        close: tick.price,
        volume: 1,
        isClosed: false,
        source: 'POCKET_OPTION_OTC',
      };
      this.candlesCreated++;

      this.notify('candle_closed', this.getCandles(asset, normTf), closedCandle);
      this.notify('candle_updated', this.getCandles(asset, normTf), bucket.forming);
      return bucket.forming;
    }

    return bucket.forming;
  }

  private insertTimeOrder(bucket: CandleHistoryBucket, candleId: string, time: number): void {
    if (bucket.timeOrder.includes(candleId)) return;

    // Fast path: append if newer than last
    if (bucket.timeOrder.length === 0) {
      bucket.timeOrder.push(candleId);
    } else {
      const lastId = bucket.timeOrder[bucket.timeOrder.length - 1];
      const lastCandle = bucket.closed.get(lastId);
      if (lastCandle && time >= lastCandle.time) {
        bucket.timeOrder.push(candleId);
      } else {
        bucket.timeOrder.push(candleId);
        bucket.timeOrder.sort((a, b) => {
          const ca = bucket.closed.get(a);
          const cb = bucket.closed.get(b);
          return (ca?.time || 0) - (cb?.time || 0);
        });
      }
    }

    // Cap in-memory candles to 1,000 per timeframe to prevent memory exhaustion
    const MAX_CANDLES_PER_BUCKET = 1000;
    while (bucket.timeOrder.length > MAX_CANDLES_PER_BUCKET) {
      const oldestId = bucket.timeOrder.shift();
      if (oldestId) {
        bucket.closed.delete(oldestId);
      }
    }
  }

  /**
   * Returns all candles for an asset and timeframe: all closed + forming candle.
   */
  public getCandles(asset: string, timeframe: number): Candle[] {
    const bucket = this.getBucket(asset, timeframe);
    const result: Candle[] = [];

    for (const id of bucket.timeOrder) {
      const c = bucket.closed.get(id);
      if (c) result.push(c);
    }

    if (bucket.forming) {
      result.push(bucket.forming);
    }

    return result;
  }

  /**
   * Returns immutable confirmed closed candles only.
   */
  public getClosedCandles(asset: string, timeframe: number): Candle[] {
    const bucket = this.getBucket(asset, timeframe);
    const result: Candle[] = [];
    for (const id of bucket.timeOrder) {
      const c = bucket.closed.get(id);
      if (c && c.isClosed) result.push(c);
    }
    return result;
  }

  /**
   * Returns current mutable forming candle.
   */
  public getFormingCandle(asset: string, timeframe: number): Candle | null {
    const bucket = this.getBucket(asset, timeframe);
    return bucket.forming ? { ...bucket.forming } : null;
  }

  /**
   * Set chart data count for diagnostics desync assertions.
   */
  public setChartDataCount(count: number): void {
    this.chartDataCount = count;
  }

  /**
   * Diagnostics snapshot for UI & monitoring.
   */
  public getDiagnostics(asset: string, timeframe: number): CandleStoreDiagnostics {
    const bucket = this.getBucket(asset, timeframe);
    const candles = this.getCandles(asset, timeframe);
    const closedCount = bucket.closed.size;
    const storedCount = candles.length;
    const hasForming = bucket.forming !== null;
    const formingTime = bucket.forming ? bucket.forming.time : null;
    const firstTime = candles.length > 0 ? candles[0].time : null;
    const lastTime = candles.length > 0 ? candles[candles.length - 1].time : null;

    const desync = this.chartDataCount > 0 && Math.abs(this.chartDataCount - storedCount) > 2;

    return {
      asset,
      timeframe,
      storedCount,
      closedCount,
      hasFormingCandle: hasForming,
      formingTime,
      firstCandleTime: firstTime,
      lastCandleTime: lastTime,
      uniqueIdsCount: bucket.closed.size + (hasForming ? 1 : 0),
      duplicatesRejected: this.duplicatesRejected,
      ticksProcessed: this.ticksProcessed,
      candlesCreated: this.candlesCreated,
      candlesUpdated: this.candlesUpdated,
      candlesFinalized: this.candlesFinalized,
      candlesPersisted: this.candlesPersisted,
      chartDataCount: this.chartDataCount,
      desyncWarning: desync,
      lastUpdateTimestamp: Date.now(),
    };
  }

  public subscribe(listener: CandleStoreListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(event: 'candle_updated' | 'candle_closed' | 'history_loaded' | 'cleared', candles: Candle[], candle?: Candle): void {
    for (const listener of this.listeners) {
      try {
        listener(event, candles, candle);
      } catch (err) {
        console.error('[CandleStore] Listener notification error:', err);
      }
    }
  }
}

export const candleStore = new CandleStoreService();
