import { DetailedTradeRecord } from '../components/TradeDetailModal';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, doc, setDoc, getDocs, query, where, limit, writeBatch } from 'firebase/firestore';

const STORAGE_KEY = 'sbaa_detailed_trades_history';

type TradeListener = (trades: DetailedTradeRecord[]) => void;
const listeners = new Set<TradeListener>();

function loadLocalTrades(): DetailedTradeRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

function saveLocalTrades(trades: DetailedTradeRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trades.slice(0, 200)));
  } catch {}
  notify(trades);
}

function notify(trades: DetailedTradeRecord[]): void {
  listeners.forEach((fn) => {
    try {
      fn(trades);
    } catch {}
  });
}

function formatTradeRecord(deal: any): DetailedTradeRecord {
  const dealId = String(deal.id || deal.ticketId || `deal_${Date.now()}`);
  const openTimestamp = Number(deal.openTime || deal.openTimestamp || Math.floor(Date.now() / 1000));
  const closeTimestamp = deal.closeTime || deal.closeTimestamp ? Number(deal.closeTime || deal.closeTimestamp) : undefined;
  const duration = deal.durationSec || (closeTimestamp ? Math.max(1, closeTimestamp - openTimestamp) : Number(deal.timeframe) || 60);

  return {
    id: dealId,
    ticketId: String(deal.ticketId || deal.id || dealId),
    asset: deal.asset || 'EURUSD_otc',
    accountMode: deal.isDemo === 1 || deal.isDemo === true || deal.accountMode === 'DEMO' ? 'DEMO' : 'REAL',
    timeframe: Number(deal.timeframe) || 60,
    strategyName: deal.strategyName || 'توافق الاستراتيجيات (Confluence Matrix)',
    action: String(deal.action || deal.command || 'call').toLowerCase() === 'put' ? 'put' : 'call',
    amount: Number(deal.amount) || 1,
    openTime: openTimestamp,
    closeTime: closeTimestamp,
    openPrice: Number(deal.openPrice ?? deal.entryPrice ?? 0),
    entryPrice: Number(deal.entryPrice ?? deal.openPrice ?? 0),
    closePrice: deal.closePrice !== undefined ? Number(deal.closePrice) : deal.exitPrice !== undefined ? Number(deal.exitPrice) : undefined,
    exitPrice: deal.exitPrice !== undefined ? Number(deal.exitPrice) : deal.closePrice !== undefined ? Number(deal.closePrice) : undefined,
    profit: deal.profit !== undefined ? Number(deal.profit) : undefined,
    payout: deal.payout || deal.percentProfit || 88,
    result: deal.result || deal.status || 'PENDING',
    durationSec: duration,
    reasons: Array.isArray(deal.reasons) ? deal.reasons : [
      `إشارة مؤكدة من استراتيجية ${deal.strategyName || 'توافق الاستراتيجيات'}`,
      `فريم التحليل: ${deal.timeframe || 60} ثانية`,
    ],
    confluenceScore: deal.confluenceScore || 85,
  };
}

export interface AuditedPerformanceStats {
  todayNetProfit: number;
  wonCount: number;
  lostCount: number;
  drawCount: number;
  pendingCount: number;
  evaluatedCount: number;
  totalTrades: number;
  winRate: number; // won / (won + lost) * 100
}

export function calculatePerformanceStats(trades: DetailedTradeRecord[]): AuditedPerformanceStats {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  let todayNetProfit = 0;
  let wonCount = 0;
  let lostCount = 0;
  let drawCount = 0;
  let pendingCount = 0;

  for (const t of trades) {
    const isWon = t.result === 'WIN' || (t as any).status === 'WON';
    const isLost = t.result === 'LOSS' || (t as any).status === 'LOST';
    const isDraw = t.result === 'DRAW' || (t as any).status === 'DRAW';
    const isPending = !isWon && !isLost && !isDraw;

    if (isWon) wonCount++;
    else if (isLost) lostCount++;
    else if (isDraw) drawCount++;
    else pendingCount++;

    // Only closed deals from today contribute to daily net profit
    const tradeTimestampMs = t.openTime ? (t.openTime > 1e11 ? t.openTime : t.openTime * 1000) : 0;
    if (tradeTimestampMs >= startOfDay) {
      if (isWon) {
        const profit = t.profit !== undefined ? t.profit : (t.amount * 0.88);
        todayNetProfit += profit;
      } else if (isLost) {
        const loss = t.profit !== undefined && t.profit < 0 ? Math.abs(t.profit) : t.amount;
        todayNetProfit -= loss;
      }
      // Draws (profit = 0) do not add or deduct
    }
  }

  const evaluatedCount = wonCount + lostCount;
  const winRate = evaluatedCount > 0 ? Number(((wonCount / evaluatedCount) * 100).toFixed(1)) : 0;

  return {
    todayNetProfit: Number(todayNetProfit.toFixed(2)),
    wonCount,
    lostCount,
    drawCount,
    pendingCount,
    evaluatedCount,
    totalTrades: trades.length,
    winRate,
  };
}

export const tradeHistoryStorage = {
  getTrades(): DetailedTradeRecord[] {
    return loadLocalTrades();
  },

  calculatePerformanceStats,

  subscribe(fn: TradeListener): () => void {
    listeners.add(fn);
    fn(loadLocalTrades());
    return () => listeners.delete(fn);
  },

  formatTradeRecord,

  addOrUpdateBulkTrades(deals: any[], firebaseUid?: string | null): DetailedTradeRecord[] {
    if (!Array.isArray(deals) || deals.length === 0) return loadLocalTrades();
    const current = loadLocalTrades();
    const map = new Map<string, DetailedTradeRecord>();

    // Load existing items first
    for (const item of current) {
      if (item && item.id) {
        map.set(item.id, item);
      }
    }

    // Merge incoming items in batch
    const newRecords: DetailedTradeRecord[] = [];
    for (const deal of deals) {
      if (!deal) continue;
      const record = formatTradeRecord(deal);
      const existing = map.get(record.id);
      map.set(record.id, existing ? { ...existing, ...record } : record);
      newRecords.push(record);
    }

    const merged = Array.from(map.values())
      .sort((a, b) => (b.openTime || 0) - (a.openTime || 0))
      .slice(0, 200);

    saveLocalTrades(merged);

    // Sync recent records asynchronously in background without UI blocking
    if (firebaseUid && db) {
      const firestoreInstance = db;
      setTimeout(async () => {
        const sliceToSync = newRecords.slice(0, 5);
        for (const rec of sliceToSync) {
          const docId = `${firebaseUid}_${rec.id}`;
          try {
            const userTradeRef = doc(firestoreInstance, 'userTrades', docId);
            const sanitized: Record<string, any> = {};
            for (const [k, v] of Object.entries(rec)) {
              if (v !== undefined) {
                sanitized[k] = v;
              }
            }
            await setDoc(
              userTradeRef,
              {
                ...sanitized,
                userId: firebaseUid,
                updatedAt: new Date().toISOString(),
              },
              { merge: true }
            );
          } catch (err) {
            try {
              handleFirestoreError(err, OperationType.WRITE, `userTrades/${docId}`);
            } catch {
              // Structured error logged via handleFirestoreError
            }
          }
        }
      }, 50);
    }

    return merged;
  },

  async addOrUpdateTrade(deal: any, firebaseUid?: string | null): Promise<DetailedTradeRecord> {
    const record = formatTradeRecord(deal);
    this.addOrUpdateBulkTrades([deal], firebaseUid);
    return record;
  },

  async loadFromFirestore(firebaseUid: string): Promise<DetailedTradeRecord[]> {
    if (!firebaseUid || !db) return loadLocalTrades();
    try {
      const q = query(
        collection(db, 'userTrades'),
        where('userId', '==', firebaseUid),
        limit(50)
      );
      const snap = await getDocs(q);
      const remoteTrades: DetailedTradeRecord[] = [];
      snap.forEach((d) => {
        const data = d.data() as any;
        if (data.userId === firebaseUid) {
          remoteTrades.push(data as DetailedTradeRecord);
        }
      });

      if (remoteTrades.length > 0) {
        this.addOrUpdateBulkTrades(remoteTrades, null);
        return loadLocalTrades();
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'userTrades');
    }
    return loadLocalTrades();
  },

  async clearTrades(firebaseUid?: string | null): Promise<void> {
    saveLocalTrades([]);
    const uid = auth.currentUser?.uid || firebaseUid;
    if (!uid || !db || !auth.currentUser) return;
    try {
      const q = query(
        collection(db, 'userTrades'),
        where('userId', '==', auth.currentUser.uid),
        limit(200)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        const batch = writeBatch(db);
        snap.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.DELETE, 'userTrades');
      } catch {
        // Structured Firestore error already logged via handleFirestoreError
      }
    }
  },
};

