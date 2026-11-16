import fs from 'fs';
import path from 'path';
import { StrategyEngine } from './StrategyEngine';
import { PocketOptionService } from './PocketOptionService';
import { Signal, StrategyResult, Candle } from './types';
import { SbaaStrategyEngine } from './sbaa/SbaaStrategyEngine';
import { SbaaPatternDetector } from './sbaa/SbaaPatternDetector';
import { SbaaScoringEngine } from './sbaa/SbaaScoringEngine';

export interface AutoTraderConfig {
  strategyId: string;       // 'sbaa' (SBAA Pro Engine), 'auto', 'confluence', or any of the 26 quantitative strategies
  baseAmount: number;       // e.g. 5.0
  maxAmount: number;        // e.g. 1000.0
  stopLoss: number;         // e.g. 20.0 (Daily Stop Loss in $)
  takeProfit: number;       // e.g. 40.0 (Daily Take Profit in $)
  asset: string;            // e.g. 'EURUSD_otc'
  timeframe: number;        // e.g. 60
  isDemo: boolean;          // false for Real Live account
  enableMartingale: boolean;
  martingaleMultiplier: number;
  maxMartingaleDepth: number;
  tradesBeforeRest: number; // e.g. 10
  restMinMinutes: number;   // e.g. 15
  restMaxMinutes: number;   // e.g. 45
  maxConcurrentTrades: number; // e.g. 1
  cooldownBetweenTradesSec: number; // e.g. 30
  minSignalStrength?: number; // Minimum confidence threshold
}

export interface AutoTraderLog {
  id: string;
  timestamp: number;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  category: 'SECURITY' | 'HESITATION' | 'EXECUTION' | 'RISK' | 'REST' | 'SYSTEM' | 'ORDER';
}

export type OrderLifecycleState =
  | 'CREATED'
  | 'PENDING'
  | 'SUBMITTED'
  | 'ACCEPTED'
  | 'OPEN'
  | 'EXPIRING'
  | 'SETTLING'
  | 'COMPLETED'
  | 'REJECTED'
  | 'FAILED'
  | 'UNKNOWN';

export class TradeLifecycleManager {
  public static readonly VALID_TRANSITIONS: Record<OrderLifecycleState, OrderLifecycleState[]> = {
    CREATED: ['PENDING', 'SUBMITTED', 'REJECTED', 'FAILED'],
    PENDING: ['SUBMITTED', 'REJECTED', 'FAILED', 'UNKNOWN'],
    SUBMITTED: ['ACCEPTED', 'REJECTED', 'FAILED', 'UNKNOWN'],
    ACCEPTED: ['OPEN', 'EXPIRING', 'SETTLING', 'COMPLETED', 'UNKNOWN'],
    OPEN: ['EXPIRING', 'SETTLING', 'COMPLETED', 'UNKNOWN'],
    EXPIRING: ['SETTLING', 'COMPLETED', 'UNKNOWN'],
    SETTLING: ['COMPLETED', 'UNKNOWN'],
    COMPLETED: [], // Terminal state - no further transitions permitted
    REJECTED: [],  // Terminal state - rejected prior to execution
    FAILED: [],    // Terminal state - network/platform failure
    UNKNOWN: ['ACCEPTED', 'OPEN', 'COMPLETED', 'FAILED'],
  };

  public static canTransition(current: OrderLifecycleState, next: OrderLifecycleState): boolean {
    if (current === next) return true;
    const allowed = this.VALID_TRANSITIONS[current] || [];
    return allowed.includes(next);
  }

  public static isTerminal(state: OrderLifecycleState): boolean {
    return state === 'COMPLETED' || state === 'REJECTED' || state === 'FAILED';
  }

  public static isActive(state: OrderLifecycleState): boolean {
    return ['CREATED', 'PENDING', 'SUBMITTED', 'ACCEPTED', 'OPEN', 'EXPIRING', 'SETTLING'].includes(state);
  }
}

export interface AutoTraderTradeRecord {
  id: string;
  runCycleId: string;
  signalId?: string;
  timestamp: number;
  candleTimestamp?: number;
  ticketId?: string;
  idempotencyKey: string;
  asset: string;
  action: 'call' | 'put';
  amount: number;
  openPrice?: number;
  closePrice?: number;
  profit?: number;
  lifecycle: OrderLifecycleState;
  status: 'PENDING' | 'WON' | 'LOST' | 'DRAW' | 'FAILED';
  strategy: string;
  rejectionReason?: string;
  durationSeconds: number;
  createdAt: number;
  updatedAt: number;
}

export interface BacktestReport {
  strategyId: string;
  strategyName: string;
  asset: string;
  timeframe: number;
  totalCandles: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  drawTrades?: number;
  winRate: number;
  netProfit: number;
  profitFactor: number;
  maxDrawdownPercent: number;
  maxDrawdownUsd: number;
  avgWin: number;
  avgLoss: number;
  disclaimer: string;
  trades: Array<{
    entryTime: number;
    exitTime: number;
    action: string;
    entryPrice: number;
    exitPrice: number;
    stake: number;
    pnl: number;
    isWin: boolean;
    isDraw?: boolean;
  }>;
}

const STATE_FILE_PATH = path.resolve(process.cwd(), '.data', 'bot_state.json');

export class AutoTraderEngine {
  private config: AutoTraderConfig = {
    strategyId: 'sbaa',
    baseAmount: 5.0,
    maxAmount: 1000.0,
    stopLoss: 20.0,
    takeProfit: 40.0,
    asset: 'EURUSD_otc',
    timeframe: 60,
    isDemo: false,
    enableMartingale: false,
    martingaleMultiplier: 2.0,
    maxMartingaleDepth: 2,
    tradesBeforeRest: 10,
    restMinMinutes: 15,
    restMaxMinutes: 45,
    maxConcurrentTrades: 1,
    cooldownBetweenTradesSec: 30,
  };

  private isRunning: boolean = false;
  private isEmergencyStopped: boolean = false;
  private runCycleId: string = 'rc_' + Date.now();
  private executionLock: boolean = false;
  private duplicateOrdersPreventedCount: number = 0;
  private lastExecutionBlockedReason: string = '';

  private consecutiveTradesCount: number = 0;
  private totalTrades: number = 0;
  private winningTrades: number = 0;
  private losingTrades: number = 0;
  private drawTrades: number = 0;
  private dailyPnL: number = 0;
  private circuitBreakerTripped: boolean = false;
  private circuitBreakerReason: string = '';
  private isInRestBreak: boolean = false;
  private restBreakUntil: number = 0;
  private currentMartingaleStep: number = 0;
  private isExecutingTrade: boolean = false;
  private lastTradeSignalTime: number = 0;

  // Order idempotency and deal closure deduplication cache
  private processedOrderTokens = new Set<string>();
  private processedDealIds = new Set<string>();
  private reconcilingTrades: boolean = false;
  private lastFailedOrderTime: number = 0;

  private logs: AutoTraderLog[] = [];
  private trades: AutoTraderTradeRecord[] = [];
  private onBroadcast?: (event: string, data: any) => void;

  private candleBuilder?: any;
  private marketDataStore?: any;
  private persistToDisk: boolean = true;

  constructor(
    private strategyEngine: StrategyEngine,
    private poService: PocketOptionService,
    onBroadcast?: (event: string, data: any) => void,
    private sbaaEngine?: SbaaStrategyEngine,
    _reserved?: unknown,
    candleBuilder?: any,
    persistToDisk: boolean = true,
    marketDataStore?: any
  ) {
    this.onBroadcast = onBroadcast;
    this.candleBuilder = candleBuilder;
    this.persistToDisk = persistToDisk;
    this.marketDataStore = marketDataStore;

    // Load persisted state across server restarts (Rule 16)
    this.loadPersistedState();

    // Listen to deals opened from PocketOptionService
    if (typeof this.poService?.onDealOpened === 'function') {
      this.poService.onDealOpened((deal) => {
        this.handleDealOpened(deal);
      });
    }

    // Listen to deals closed from PocketOptionService
    if (typeof this.poService?.onDealClosed === 'function') {
      this.poService.onDealClosed((deal) => {
        this.handleDealClosed(deal);
      });
    }
  }

  public setSbaaEngine(engine: SbaaStrategyEngine) {
    this.sbaaEngine = engine;
  }

  public setCandleBuilder(candleBuilder: any) {
    this.candleBuilder = candleBuilder;
  }

  public setMarketDataStore(marketDataStore: any) {
    this.marketDataStore = marketDataStore;
  }

  public setBroadcastHandler(handler: (event: string, data: any) => void) {
    this.onBroadcast = handler;
  }

  public getStatus() {
    this.reconcileActiveTrades();
    const now = Date.now();
    const restRemainingSec = this.isInRestBreak && this.restBreakUntil > now
      ? Math.ceil((this.restBreakUntil - now) / 1000)
      : 0;

    const brokerDiag = this.poService.getDiagnostics();
    const wsStatus = brokerDiag?.subsystems?.websocket || 'disconnected';
    const authStatus = brokerDiag?.subsystems?.auth || 'none';
    const isBrokerConnected = wsStatus === 'connected' && authStatus === 'success';

    const activeTrade = this.trades.find((t) => TradeLifecycleManager.isActive(t.lifecycle)) || null;

    return {
      isRunning: this.isRunning,
      isEmergencyStopped: this.isEmergencyStopped,
      runCycleId: this.runCycleId,
      activeTrade,
      duplicateOrdersPreventedCount: this.duplicateOrdersPreventedCount,
      lastExecutionBlockedReason: this.lastExecutionBlockedReason,
      config: this.config,
      totalTrades: this.totalTrades,
      winningTrades: this.winningTrades,
      losingTrades: this.losingTrades,
      drawTrades: this.drawTrades,
      acceptedTradesCount: this.trades.filter((t) => ['ACCEPTED', 'OPEN', 'EXPIRING', 'SETTLING', 'COMPLETED'].includes(t.lifecycle)).length,
      rejectedTradesCount: this.trades.filter((t) => ['REJECTED', 'FAILED'].includes(t.lifecycle)).length,
      winRate: (this.winningTrades + this.losingTrades) > 0
        ? Number(((this.winningTrades / (this.winningTrades + this.losingTrades)) * 100).toFixed(1))
        : 0,
      dailyPnL: Number(this.dailyPnL.toFixed(2)),
      circuitBreakerTripped: this.circuitBreakerTripped,
      circuitBreakerReason: this.circuitBreakerReason,
      isInRestBreak: this.isInRestBreak,
      restRemainingSec,
      consecutiveTradesCount: this.consecutiveTradesCount,
      tradesBeforeRest: this.config.tradesBeforeRest,
      isExecutingTrade: this.isExecutingTrade,
      currentMartingaleStep: this.currentMartingaleStep,
      brokerStatus: {
        websocket: wsStatus,
        auth: authStatus,
        isConnected: isBrokerConnected,
        endpoint: brokerDiag?.endpoint,
        latencyMs: brokerDiag?.latencyMs ?? 0,
        mode: this.poService.getAccountMode(),
        balance: brokerDiag?.account?.balance ?? null,
        isDemo: brokerDiag?.account?.isDemo ?? false,
      },
      recentTrades: this.trades.slice(-25).reverse(),
      recentLogs: this.logs.slice(-40).reverse(),
    };
  }

  public hasActiveOpenTrade(): boolean {
    this.reconcileActiveTrades();
    return this.trades.some((t) => TradeLifecycleManager.isActive(t.lifecycle));
  }

  public reconcileActiveTrades(): void {
    if (this.reconcilingTrades) return;
    this.reconcilingTrades = true;
    try {
      const now = Date.now();
      const brokerHistory = typeof this.poService?.getDealsHistory === 'function' ? this.poService.getDealsHistory() : [];
      const brokerActive = typeof this.poService?.getActiveDeals === 'function' ? this.poService.getActiveDeals() : [];

      for (const trade of this.trades) {
        if (!TradeLifecycleManager.isActive(trade.lifecycle)) continue;

        // 1. Recover trades stuck in pre-submission states when no execution pipeline is running
        if (['CREATED', 'PENDING', 'SUBMITTED'].includes(trade.lifecycle)) {
          if (!this.isExecutingTrade && !this.executionLock && now - (trade.updatedAt || trade.createdAt) > 30_000) {
            this.transitionTradeState(trade.id, 'FAILED', {
              rejectionReason: 'انتهت مهلة تنفيذ الطلب قبل التأكيد من الخادم',
            });
            if (trade.idempotencyKey) {
              this.processedOrderTokens.delete(trade.idempotencyKey);
            }
          }
          continue;
        }

        // 2. Reconcile open/accepted/expiring/settling trades against broker closed deals history first
        const histMatch = brokerHistory.find((d: any) => {
          const dId = String(d?.id || d?.ticketId || '');
          // If both the active trade and history entry have ticket IDs, require an exact ID match
          if (trade.ticketId && dId) {
            return dId === String(trade.ticketId);
          }
          // Never reuse a history record already processed or owned by another trade
          if (dId && (this.processedDealIds.has(dId) || this.trades.some((other) => other.id !== trade.id && other.ticketId === dId))) {
            return false;
          }
          const dOpenMs = Number(d?.openTime || 0) * 1000;
          const dCloseMs = Number(d?.closeTime || 0) * 1000;
          return (
            d?.asset === trade.asset &&
            Math.abs(Number(d?.amount || 0) - Number(trade.amount || 0)) < 0.01 &&
            dOpenMs > 0 &&
            Math.abs(dOpenMs - trade.createdAt) <= 15_000 &&
            (!dCloseMs || dCloseMs >= trade.createdAt)
          );
        });

        if (histMatch) {
          this.handleDealClosed({
            ...histMatch,
            id: trade.ticketId || histMatch.id,
            ticketId: trade.ticketId || histMatch.ticketId,
          });
          continue;
        }

        // 3. Expiry-based reconciliation so a missed WebSocket close event never deadlocks subsequent trades
        const durationMs = Math.max(5, Number(trade.durationSeconds || this.config.timeframe || 60)) * 1000;
        const expiryAtMs = (trade.createdAt || trade.timestamp) + durationMs;
        const stillInBrokerActive = trade.ticketId
          ? brokerActive.some((d: any) => String(d?.id || d?.ticketId || '') === String(trade.ticketId))
          : false;

        if ((now >= expiryAtMs + 15_000 && !stillInBrokerActive) || now >= expiryAtMs + 45_000) {
          if (trade.lifecycle !== 'SETTLING') {
            this.transitionTradeState(trade.id, 'SETTLING');
          }
          this.drawTrades++;
          this.transitionTradeState(trade.id, 'COMPLETED', {
            profit: 0,
            status: 'DRAW',
            rejectionReason: 'انتهت مدة الصفقة دون استلام إشعار الإغلاق من الخادم؛ تمت التسوية التلقائية لإتاحة الصفقات التالية',
          });
          this.addLog(
            'ORDER',
            'warn',
            `⏱️ تمت تسوية الصفقة المنتهية #${trade.ticketId || trade.id} تلقائياً بعد انتهاء مدتها (${trade.durationSeconds}s) لإتاحة استمرار الصفقات التالية.`
          );
        }
      }
    } finally {
      this.reconcilingTrades = false;
    }
  }

  public transitionTradeState(
    tradeIdOrTicket: string,
    nextState: OrderLifecycleState,
    extraData?: Partial<AutoTraderTradeRecord>
  ): boolean {
    const trade = this.trades.find((t) => t.id === tradeIdOrTicket || t.ticketId === tradeIdOrTicket);
    if (!trade) {
      return false;
    }

    if (!TradeLifecycleManager.canTransition(trade.lifecycle, nextState)) {
      this.addLog(
        'SYSTEM',
        'warn',
        `⚠️ محاولة انتقال حالة غير مصرح بها للصفقة (${trade.id}): لا يمكن الانتقال من ${trade.lifecycle} إلى ${nextState}`
      );
      return false;
    }

    const previousState = trade.lifecycle;
    trade.lifecycle = nextState;
    trade.updatedAt = Date.now();

    if (extraData) {
      if (extraData.ticketId && !trade.ticketId) trade.ticketId = extraData.ticketId;
      if (extraData.openPrice !== undefined) trade.openPrice = extraData.openPrice;
      if (extraData.closePrice !== undefined) trade.closePrice = extraData.closePrice;
      if (extraData.profit !== undefined) trade.profit = extraData.profit;
      if (extraData.status) trade.status = extraData.status;
      if (extraData.rejectionReason) trade.rejectionReason = extraData.rejectionReason;
    }

    this.addLog(
      'ORDER',
      'info',
      `🔄 تحديث حالة الصفقة #${trade.ticketId || trade.id}: ${previousState} ➔ ${nextState}`
    );

    this.persistState();
    this.notifyStatusChange();
    return true;
  }

  private handleDealOpened(deal: any) {
    if (!deal) return;
    const dealId = String(deal.id || deal.ticketId || '');
    const matchingTrade = this.trades.find((t) => t.ticketId === dealId || t.id === dealId);
    if (matchingTrade) {
      // Transition from SUBMITTED/ACCEPTED to OPEN in place - NEVER create duplicate trade!
      this.transitionTradeState(matchingTrade.id, 'OPEN', {
        openPrice: deal.openPrice || matchingTrade.openPrice,
      });
    }
  }

  public start(userConfig?: Partial<AutoTraderConfig>): { success: boolean; message: string } {
    if (this.isEmergencyStopped) {
      return {
        success: false,
        message: 'لا يمكن التشغيل: تم تفعيل الإيقاف الطارئ سابقاً. يرجى إلغاء الإيقاف الطارئ أولاً.',
      };
    }

    // Problem 5: Enforce single worker cycle per bot instance
    if (this.isRunning) {
      return {
        success: true,
        message: 'البوت الآلي قيد التشغيل بالفعل (دورة التشغيل نشطة).',
      };
    }

    if (userConfig) {
      const sanitizedConfig: any = { ...userConfig };
      delete sanitizedConfig.aiCode;
      delete sanitizedConfig.isAiActivated;
      delete sanitizedConfig.selectedAiModel;
      if (sanitizedConfig.strategyId === 'sbaa_ai' || sanitizedConfig.strategyId === 'sbaa-ai' || sanitizedConfig.strategyId === 'ai') {
        sanitizedConfig.strategyId = 'sbaa';
      }

      this.config = {
        ...this.config,
        ...sanitizedConfig,
        isDemo: false,
        maxAmount: Math.max(sanitizedConfig.maxAmount || 1000.0, sanitizedConfig.baseAmount || this.config.baseAmount || 1.0, 1000.0),
      };
    }

    if (this.circuitBreakerTripped) {
      return {
        success: false,
        message: `لا يمكن التشغيل: قاطع الدائرة مفعل (${this.circuitBreakerReason}). يرجى تصفير الإحصاءات اليومية للمتابعة.`,
      };
    }

    this.runCycleId = `rc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    this.executionLock = false;
    this.isExecutingTrade = false;
    this.isRunning = true;

    // Disarm any rogue dual-worker execution in SBAA Engine
    if (this.sbaaEngine) {
      this.sbaaEngine.updateConfig({ autoDemoExecution: false });
    }

    this.addLog('SYSTEM', 'success', `🚀 تم بدء تشغيل البوت الآلي على استراتيجية '${this.config.strategyId}' (دورة تشغيل: ${this.runCycleId})`);
    this.addLog('RISK', 'info', `🛑 إدارة المخاطر المعتمدة: حد الخسارة -$${this.config.stopLoss} | هدف الربح +$${this.config.takeProfit}`);
    this.addLog('SECURITY', 'info', `🛡️ تم تفعيل طبقات التحقق الفعلي من الحساب الحقيقي وتطابق الشموع الحقيقية`);

    this.persistState();
    this.notifyStatusChange();

    return { success: true, message: 'تم تشغيل البوت الآلي بنجاح' };
  }

  public stop(): { success: boolean; message: string } {
    this.isRunning = false;
    this.isInRestBreak = false;
    this.isExecutingTrade = false;
    this.executionLock = false;
    this.addLog('SYSTEM', 'warn', '🛑 تم إيقاف البوت الآلي يدوياً من قبل المستخدم');
    this.persistState();
    this.notifyStatusChange();
    return { success: true, message: 'تم إيقاف البوت الآلي بنجاح' };
  }

  /**
   * Emergency Stop: Immediately locks bot, halts workers, prevents orders, and clears queues (Rule 2, 20)
   */
  public emergencyStop(): { success: boolean; message: string } {
    this.isRunning = false;
    this.isEmergencyStopped = true;
    this.isInRestBreak = false;
    this.isExecutingTrade = false;
    this.addLog('RISK', 'error', '🚨 تم تفعيل الإيقاف الطارئ (Emergency Stop)! حظر إرسال أي أوامر جديدة فوراً وإيقاف كافة المهام.');
    this.persistState();
    this.notifyStatusChange();
    return { success: true, message: 'تم تفعيل الإيقاف الطارئ وإيقاف المحرك بنجاح' };
  }

  public clearEmergencyStop(): { success: boolean; message: string } {
    this.isEmergencyStopped = false;
    this.addLog('SYSTEM', 'info', '🔓 تم إلغاء حالة الإيقاف الطارئ، البوت جاهز للاستئناف');
    this.persistState();
    this.notifyStatusChange();
    return { success: true, message: 'تم إلغاء حالة الإيقاف الطارئ بنجاح' };
  }

  public resetPnL(): { success: boolean; message: string } {
    this.dailyPnL = 0;
    this.totalTrades = 0;
    this.winningTrades = 0;
    this.losingTrades = 0;
    this.drawTrades = 0;
    this.processedDealIds.clear();
    this.circuitBreakerTripped = false;
    this.circuitBreakerReason = '';
    this.currentMartingaleStep = 0;
    this.consecutiveTradesCount = 0;
    this.isEmergencyStopped = false;
    this.addLog('RISK', 'info', '🔄 تم تصفير سجلات PnL وقاطع الدائرة وإعادة تهيئة الحساب اليومي');
    this.persistState();
    this.notifyStatusChange();
    return { success: true, message: 'تم تصفير الإحصاءات بنجاح' };
  }

  public saveSettings(newConfig: Partial<AutoTraderConfig>): { success: boolean; message: string } {
    const sanitizedConfig: any = { ...newConfig };
    delete sanitizedConfig.aiCode;
    delete sanitizedConfig.isAiActivated;
    delete sanitizedConfig.selectedAiModel;
    if (sanitizedConfig.strategyId === 'sbaa_ai' || sanitizedConfig.strategyId === 'sbaa-ai' || sanitizedConfig.strategyId === 'ai') {
      sanitizedConfig.strategyId = 'sbaa';
    }

    this.config = {
      ...this.config,
      ...sanitizedConfig,
      isDemo: false,
      maxAmount: Math.max(sanitizedConfig.maxAmount || 1000.0, sanitizedConfig.baseAmount || this.config.baseAmount || 1.0, 1000.0),
    };

    if (sanitizedConfig.timeframe) {
      this.config.timeframe = sanitizedConfig.timeframe;
    }
    this.addLog('SYSTEM', 'info', `💾 تم حفظ إعدادات البوت بنجاح (الاستراتيجية: ${this.config.strategyId}, المبلغ: $${this.config.baseAmount}, الفريم: ${this.config.timeframe}s)`);
    this.persistState();
    this.notifyStatusChange();
    return { success: true, message: 'تم حفظ الإعدادات بنجاح' };
  }

  public setTimeframe(timeframe: number): void {
    const validTfs = [5, 15, 30, 60, 300, 900, 1800, 3600];
    const targetTf = validTfs.includes(timeframe) ? timeframe : (timeframe || 60);
    this.config.timeframe = targetTf;
    const tfLabel = targetTf >= 3600 ? `${Math.round(targetTf / 3600)}H` : targetTf >= 60 ? `${Math.round(targetTf / 60)}M` : `${targetTf}s`;
    this.addLog('SYSTEM', 'info', `⏱️ تم تحديث فريم التداول الآلي إلى: ${tfLabel}`);
    this.persistState();
    this.notifyStatusChange();
  }

  public setAsset(asset: string): void {
    if (asset && asset !== this.config.asset) {
      this.config.asset = asset;
      this.persistState();
      this.notifyStatusChange();
    }
  }

  /**
   * Safe connection and broker diagnostic test (Rule 2)
   */
  public testConnection(): {
    ok: boolean;
    status: string;
    endpoint?: string;
    mode: string;
    latencyMs: number;
    accountBalance: number | null;
    isDemo: boolean;
    message: string;
  } {
    const diag = this.poService.getDiagnostics();
    const wsConnected = diag?.subsystems?.websocket === 'connected';
    const authOk = diag?.subsystems?.auth === 'success';
    const ok = wsConnected && authOk;

    const msg = ok
      ? `الاتصال سليم وموثق بنجاح مع Pocket Option (${diag?.account?.isDemo ? 'حساب تجريبي' : 'حساب حقيقي'})، زمن الاستجابة: ${diag?.latencyMs ?? 0}ms.`
      : wsConnected
      ? 'قناة WebSocket مفتوحة ولكن بانتظار استكمال التوثيق (رمز الجلسة قد يحتاج للتحديث).'
      : 'القناة غير متصلة حالياً بخادم التداول.';

    this.addLog('SYSTEM', ok ? 'success' : 'warn', `📡 فحص الاتصال: ${msg}`);
    return {
      ok,
      status: ok ? 'CONNECTED' : wsConnected ? 'AUTHENTICATING' : 'DISCONNECTED',
      endpoint: diag?.endpoint,
      mode: this.poService.getAccountMode(),
      latencyMs: diag?.latencyMs ?? 0,
      accountBalance: diag?.account?.balance ?? null,
      isDemo: diag?.account?.isDemo ?? false,
      message: msg,
    };
  }

  /**
   * Chronological Backtesting without Look-Ahead Bias (Rule 11, 18)
   */
  public runBacktest(
    strategyId: string,
    candles: Candle[],
    stake: number = 10,
    payoutRatio: number = 0.88
  ): BacktestReport {
    if (!candles || candles.length < 30) {
      return {
        strategyId,
        strategyName: strategyId,
        asset: this.config.asset,
        timeframe: this.config.timeframe,
        totalCandles: candles?.length || 0,
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        winRate: 0,
        netProfit: 0,
        profitFactor: 0,
        maxDrawdownPercent: 0,
        maxDrawdownUsd: 0,
        avgWin: 0,
        avgLoss: 0,
        disclaimer: 'تنبيه: البيانات التاريخية غير كافية لتنفيذ اختبار موثوق (يشترط 30 شمعة على الأقل).',
        trades: [],
      };
    }

    let balance = 1000.0;
    let peakBalance = balance;
    let maxDrawdownUsd = 0;
    let maxDrawdownPct = 0;
    let grossProfit = 0;
    let grossLoss = 0;

    const tradesList: BacktestReport['trades'] = [];
    const minLookback = 25;

    const minThreshold = this.config.minSignalStrength || 70;

    for (let i = minLookback; i < candles.length - 1; i++) {
      const historicalSlice = candles.slice(0, i + 1);
      const currCandle = candles[i];
      const nextCandle = candles[i + 1];

      // Pure chronological evaluation: slice strictly up to candle i
      let action: 'call' | 'put' | null = null;
      const effectiveSliceStrategies = this.strategyEngine
        ? this.strategyEngine.evaluateStrategiesOnCandles(historicalSlice, this.config.asset, this.config.timeframe)
        : [];

      if (strategyId === 'sbaa' || strategyId.toLowerCase().includes('sbaa') || strategyId.includes('سبع')) {
        if (this.sbaaEngine) {
          const sbaaRecord = this.sbaaEngine.evaluateMarket(
            this.config.asset,
            this.config.timeframe,
            historicalSlice,
            { readOnly: true, autoExecute: false, ignoreConnectionGate: true }
          );
          if (
            (sbaaRecord.systemDecision === 'BUY' || sbaaRecord.systemDecision === 'SELL') &&
            sbaaRecord.confluenceScore >= Math.min(75, minThreshold)
          ) {
            action = sbaaRecord.systemDecision === 'BUY' ? 'call' : 'put';
          }
        } else {
          const detection = SbaaPatternDetector.detectPatterns(historicalSlice);
          const pattern = detection.primaryPattern;
          const evalResult = SbaaScoringEngine.evaluate({
            candles: historicalSlice,
            pattern,
            timeframe: this.config.timeframe,
            isClosedCandle: true,
            isConnected: true,
            isStaleData: false,
          });
          if (evalResult.decision === 'BUY' && evalResult.isQualifiedForDemo) {
            action = 'call';
          } else if (evalResult.decision === 'SELL' && evalResult.isQualifiedForDemo) {
            action = 'put';
          }
        }
      } else if (strategyId === 'auto' || strategyId === 'all') {
        const qualified = effectiveSliceStrategies.filter(
          (s) => s.dataValid && s.qualified && (s.signal === 'UP' || s.signal === 'DOWN')
        );
        const upC = qualified.filter((s) => s.signal === 'UP').length;
        const downC = qualified.filter((s) => s.signal === 'DOWN').length;
        if (!(upC >= 2 && downC >= 2)) {
          const top = qualified
            .filter((s) => (s.normalizedScore ?? 0) >= minThreshold)
            .sort((a, b) => (b.normalizedScore ?? 0) - (a.normalizedScore ?? 0))[0];
          if (top) action = top.signal === 'UP' ? 'call' : 'put';
        }
      } else if (strategyId === 'confluence') {
        const qualified = effectiveSliceStrategies.filter(
          (s) => s.dataValid && s.qualified && (s.signal === 'UP' || s.signal === 'DOWN')
        );
        const upStrats = qualified.filter((s) => s.signal === 'UP');
        const downStrats = qualified.filter((s) => s.signal === 'DOWN');
        const minVotes = 3;
        if (upStrats.length >= minVotes && upStrats.length > downStrats.length) {
          const avgConf = upStrats.reduce((acc, s) => acc + (s.normalizedScore ?? 0), 0) / upStrats.length;
          if (avgConf >= Math.min(minThreshold, 65)) action = 'call';
        } else if (downStrats.length >= minVotes && downStrats.length > upStrats.length) {
          const avgConf = downStrats.reduce((acc, s) => acc + (s.normalizedScore ?? 0), 0) / downStrats.length;
          if (avgConf >= Math.min(minThreshold, 65)) action = 'put';
        }
      } else if (strategyId === 'rsi_macd') {
        const macdStrat = StrategyEngine.matchStrategyById(effectiveSliceStrategies, 'macd');
        const rsiStrat = StrategyEngine.matchStrategyById(effectiveSliceStrategies, 'rsi_momentum');
        const mUp = macdStrat && macdStrat.qualified && macdStrat.signal === 'UP';
        const mDown = macdStrat && macdStrat.qualified && macdStrat.signal === 'DOWN';
        const rUp = rsiStrat && rsiStrat.qualified && rsiStrat.signal === 'UP';
        const rDown = rsiStrat && rsiStrat.qualified && rsiStrat.signal === 'DOWN';
        if ((mUp || rUp) && !(mDown || rDown)) action = 'call';
        else if ((mDown || rDown) && !(mUp || rUp)) action = 'put';
      } else {
        const matched = StrategyEngine.matchStrategyById(effectiveSliceStrategies, strategyId);
        if (matched && matched.dataValid && matched.qualified && (matched.signal === 'UP' || matched.signal === 'DOWN')) {
          action = matched.signal === 'UP' ? 'call' : 'put';
        }
      }

      if (action) {
        const entryPrice = currCandle.close;
        const exitPrice = nextCandle.close;
        const isWin = action === 'call' ? exitPrice > entryPrice : exitPrice < entryPrice;
        const isDraw = exitPrice === entryPrice;
        const pnl = isWin ? stake * payoutRatio : isDraw ? 0 : -stake;

        balance += pnl;
        if (isWin) grossProfit += pnl;
        else if (!isDraw) grossLoss += Math.abs(pnl);

        if (balance > peakBalance) peakBalance = balance;
        const ddUsd = peakBalance - balance;
        const ddPct = (ddUsd / peakBalance) * 100;
        if (ddUsd > maxDrawdownUsd) maxDrawdownUsd = ddUsd;
        if (ddPct > maxDrawdownPct) maxDrawdownPct = ddPct;

        tradesList.push({
          entryTime: currCandle.time,
          exitTime: nextCandle.time,
          action,
          entryPrice,
          exitPrice,
          stake,
          pnl: Number(pnl.toFixed(2)),
          isWin,
          isDraw,
        });

        // Skip to prevent overlapping bar contamination
        i += 1;
      }
    }

    const totalTrades = tradesList.length;
    const winningTrades = tradesList.filter((t) => t.isWin).length;
    const drawTrades = tradesList.filter((t) => t.isDraw).length;
    const losingTrades = totalTrades - winningTrades - drawTrades;
    const decisiveTrades = winningTrades + losingTrades;
    const winRate = decisiveTrades > 0 ? Number(((winningTrades / decisiveTrades) * 100).toFixed(1)) : 0;
    const profitFactor = grossLoss > 0 ? Number((grossProfit / grossLoss).toFixed(2)) : grossProfit > 0 ? 99 : 0;
    const avgWin = winningTrades > 0 ? Number((grossProfit / winningTrades).toFixed(2)) : 0;
    const avgLoss = losingTrades > 0 ? Number((grossLoss / losingTrades).toFixed(2)) : 0;

    return {
      strategyId,
      strategyName: strategyId,
      asset: this.config.asset,
      timeframe: this.config.timeframe,
      totalCandles: candles.length,
      totalTrades,
      winningTrades,
      losingTrades,
      drawTrades,
      winRate,
      netProfit: Number((balance - 1000).toFixed(2)),
      profitFactor,
      maxDrawdownPercent: Number(maxDrawdownPct.toFixed(1)),
      maxDrawdownUsd: Number(maxDrawdownUsd.toFixed(2)),
      avgWin,
      avgLoss,
      disclaimer: 'تنبيه: نتائج الاختبار التاريخي مبنية على التقييم الخوارزمي الفعلي للشموع ولا تشكل ضماناً للأرباح المستقبلية.',
      trades: tradesList,
    };
  }

  private getTargetCandles(asset: string, tf: number): Candle[] {
    if (this.marketDataStore && typeof this.marketDataStore.getClosedCandlesFor === 'function') {
      const closed = this.marketDataStore.getClosedCandlesFor(asset, tf) || [];
      if (closed.length >= 15) return closed;
    }
    if (this.candleBuilder && typeof this.candleBuilder.getClosedCandles === 'function') {
      const cbClosed = this.candleBuilder.getClosedCandles(asset, tf) || [];
      if (cbClosed.length >= 15) return cbClosed;
    }
    if (this.marketDataStore && typeof this.marketDataStore.getCandles === 'function') {
      const mdsAll = this.marketDataStore.getCandles(asset, tf) || [];
      if (mdsAll.length >= 15) return mdsAll;
    }
    if (this.candleBuilder && typeof this.candleBuilder.getCandles === 'function') {
      const cbAll = this.candleBuilder.getCandles(asset, tf) || [];
      if (cbAll.length >= 15) return cbAll;
    }
    return [];
  }

  /**
   * Main Strategy Signal Listener - Runs automatically on every live candle/tick (Rule 4, 8, 20)
   */
  public async onSignalUpdate(signal: Signal | null) {
    if (!this.isRunning || this.isEmergencyStopped || !signal || this.isExecutingTrade || this.executionLock) {
      return;
    }

    this.reconcileActiveTrades();
    const now = Date.now();

    // Check rest break status (Rule 3)
    if (this.isInRestBreak) {
      if (now >= this.restBreakUntil) {
        this.isInRestBreak = false;
        this.consecutiveTradesCount = 0;
        this.addLog('REST', 'success', '🎯 انتهت استراحة المتداول البشري. العودة لاستقبال الإشارات وتنفيذ الصفقات.');
        this.persistState();
        this.notifyStatusChange();
      } else {
        return; // Still in rest break
      }
    }

    // Check circuit breaker (Rule 5, 20)
    if (this.circuitBreakerTripped) return;

    // Brief backoff after failed/rejected order to prevent tick flooding
    if (this.lastFailedOrderTime > 0 && now - this.lastFailedOrderTime < 5000) return;

    // Timeframe-aware cooldown between consecutive trades (never blocks next candle on short frames)
    const configuredCooldownSec = Math.max(0, Number(this.config.cooldownBetweenTradesSec ?? 30));
    const effectiveCooldownMs = configuredCooldownSec === 0
      ? 0
      : Math.min(configuredCooldownSec * 1000, Math.max(2000, Math.floor((this.config.timeframe || 60) * 400)));
    if (effectiveCooldownMs > 0 && now - this.lastTradeSignalTime < effectiveCooldownMs) return;

    // Problem 3 & Problem 4: Enforce max concurrent trades (strictly 1 active trade at a time)
    if (this.config.maxConcurrentTrades <= 1 && this.hasActiveOpenTrade()) {
      this.lastExecutionBlockedReason = 'يوجد صفقة نشطة بالفعل قيد التنفيذ أو الانتظار؛ حظر فتح صفقات متزامنة.';
      return;
    }

    // Evaluate target action based on chosen strategy
    const tradeDecision = this.evaluateSignal(signal);
    if (!tradeDecision) return;

    // Risk Guard Evaluation (Rule 20)
    if (this.dailyPnL <= -Math.abs(this.config.stopLoss)) {
      this.circuitBreakerTripped = true;
      this.circuitBreakerReason = `تم الوصول لحد الخسارة اليومي (-$${Math.abs(this.dailyPnL).toFixed(2)})`;
      this.isRunning = false;
      this.addLog('RISK', 'error', `🚨 قاطع الدائرة مفعل: ${this.circuitBreakerReason}. تم إيقاف البوت تلقائياً لحماية رأس المال.`);
      this.persistState();
      this.notifyStatusChange();
      return;
    }

    if (this.dailyPnL >= Math.abs(this.config.takeProfit)) {
      this.circuitBreakerTripped = true;
      this.circuitBreakerReason = `تم تحقيق هدف الربح اليومي (+$${this.dailyPnL.toFixed(2)})`;
      this.isRunning = false;
      this.addLog('RISK', 'success', `🏆 قاطع الدائرة مفعل: ${this.circuitBreakerReason}. تم تأمين الأرباح بنجاح.`);
      this.persistState();
      this.notifyStatusChange();
      return;
    }

    // Problem 3: Robust Idempotency Key anchored to Candle Timestamp + RunCycleId (prevents repeated tick orders)
    const tf = this.config.timeframe || 60;
    const targetAsset = this.config.asset || signal.asset || 'EURUSD_otc';
    const candleTimestamp =
      tradeDecision.candleTimestamp ||
      (signal as any).candleTimestamp ||
      (signal as any).candleTime ||
      (signal.timestamp ? Math.floor(signal.timestamp / (tf * 1000)) * (tf * 1000) : Math.floor(now / (tf * 1000)) * (tf * 1000));

    const idempotencyKey = `ord_${this.runCycleId}_${targetAsset}_${tf}_${candleTimestamp}_${tradeDecision.action}`;
    if (this.processedOrderTokens.has(idempotencyKey)) {
      this.duplicateOrdersPreventedCount++;
      this.lastExecutionBlockedReason = `طلب مكرر محظور بنفس دورة التشغيل وعلى شمعة الفريم ذاتها: ${idempotencyKey}`;
      return; // Already processed this exact signal on this candle!
    }
    this.processedOrderTokens.add(idempotencyKey);

    // Execute order pipeline with dynamic strategy and duration
    await this.executeStealthTradePipeline(
      tradeDecision.action,
      tradeDecision.reason,
      idempotencyKey,
      candleTimestamp,
      (signal as any)?.id || `sig_${candleTimestamp}`,
      tradeDecision.duration,
      tradeDecision.strategyName
    );
  }

  private evaluateSignal(signal: Signal): {
    action: 'call' | 'put';
    reason: string;
    duration?: number;
    strategyName?: string;
    candleTimestamp?: number;
  } | null {
    if ((signal as any).dataStatus === 'OFFLINE' || (signal as any).dataStatus === 'ERROR') {
      this.lastExecutionBlockedReason = 'بيانات التغذية غير متصلة حالياً؛ حظر دخول الصفقة.';
      return null;
    }

    const rawStrategyId = this.config.strategyId || 'sbaa';
    const strategyId = rawStrategyId === 'sbaa_ai' || rawStrategyId === 'sbaa-ai' || rawStrategyId === 'ai' ? 'sbaa' : rawStrategyId;
    const currentTf = this.config.timeframe || 60;
    const targetAsset = this.config.asset || signal.asset || 'EURUSD_otc';
    const minThreshold = this.config.minSignalStrength ?? 70;

    // Fetch fresh closed candles for the bot's configured asset/timeframe so a stale upstream activeConfirmedSignal never blocks subsequent setups
    const freshCandles = this.getTargetCandles(targetAsset, currentTf);
    const rawLatestCandleTs = freshCandles.length > 0 ? freshCandles[freshCandles.length - 1].time : undefined;
    const rawSignalCandleTs = (signal as any).candleTimestamp || (signal as any).candleTime || 0;
    const normalizeTsSec = (ts: number) => (ts > 1e11 ? Math.floor(ts / 1000) : ts);
    const latestCandleTsSec = rawLatestCandleTs ? normalizeTsSec(rawLatestCandleTs) : 0;
    const signalCandleTsSec = rawSignalCandleTs ? normalizeTsSec(rawSignalCandleTs) : 0;

    const hasAssetOrTfMismatch = Boolean(
      (signal.asset && signal.asset !== targetAsset) ||
      (signal.timeframe && signal.timeframe !== currentTf)
    );
    const hasNewerCandle = Boolean(latestCandleTsSec > 0 && signalCandleTsSec > 0 && latestCandleTsSec > signalCandleTsSec);
    const isSignalStaleOrMismatched = hasAssetOrTfMismatch || hasNewerCandle;

    let activeStrategiesList: StrategyResult[] = signal.strategies && Array.isArray(signal.strategies) ? signal.strategies : [];
    if (
      (isSignalStaleOrMismatched || activeStrategiesList.length === 0) &&
      freshCandles.length >= 15 &&
      this.strategyEngine &&
      typeof this.strategyEngine.evaluateStrategiesOnCandles === 'function'
    ) {
      activeStrategiesList = this.strategyEngine.evaluateStrategiesOnCandles(freshCandles, targetAsset, currentTf);
    }
    const anchorCandleTimestamp = isSignalStaleOrMismatched && rawLatestCandleTs && freshCandles.length >= 15 ? rawLatestCandleTs : undefined;

    // Option 1: SBAA Pro Engine (Integrated 6 Pillars + 26 Quantitative Strategies Master Matrix)
    if (strategyId === 'sbaa' || strategyId.toLowerCase().includes('sbaa') || strategyId.includes('سبع')) {
      if (this.sbaaEngine) {
        const sbaaRecord = this.sbaaEngine.evaluateMarket(
          targetAsset,
          currentTf,
          freshCandles.length >= 15 ? freshCandles : undefined,
          { readOnly: true }
        );
        if ((sbaaRecord.systemDecision === 'BUY' || sbaaRecord.systemDecision === 'SELL') && sbaaRecord.confluenceScore >= Math.min(75, minThreshold)) {
          const action = sbaaRecord.systemDecision === 'BUY' ? 'call' : 'put';
          const isBreakout = sbaaRecord.patternNameAr.includes('كسر') || sbaaRecord.patternNameAr.includes('Breakout');
          const duration = currentTf * (isBreakout && currentTf <= 900 ? 2 : 1);
          this.addLog(
            'ORDER',
            'info',
            `[SBAA سبع - المحرك المدمج] إشارة ${action === 'call' ? 'شراء' : 'بيع'} مؤكدة بنتيجة توافق ${sbaaRecord.confluenceScore}/100 على ${sbaaRecord.patternNameAr} (المدة: ${duration}s)`
          );
          return {
            action,
            reason: `[SBAA سبع - توافق ${sbaaRecord.confluenceScore}/100]: ${sbaaRecord.patternNameAr} عند ${sbaaRecord.srZone} (${sbaaRecord.reasonAr})`,
            duration,
            strategyName: 'SBAA Pro Engine (استراتيجية سبع المطورة - المحرك الشامل)',
            candleTimestamp: anchorCandleTimestamp,
          };
        }
      }

      // Concurrently inspect all 26 quantitative strategies integrated within SBAA
      if (activeStrategiesList.length > 0) {
        const qualifiedStrats = activeStrategiesList.filter(
          (s) => s.dataValid !== false && s.qualified && (s.signal === 'UP' || s.signal === 'DOWN')
        );

        const upCount = qualifiedStrats.filter((s) => s.signal === 'UP').length;
        const downCount = qualifiedStrats.filter((s) => s.signal === 'DOWN').length;

        // Anti-conflict verification
        if (!(upCount >= 2 && downCount >= 2)) {
          const candidates = qualifiedStrats
            .filter((s) => (s.normalizedScore ?? s.rawScore ?? 0) >= minThreshold)
            .sort((a, b) => (b.normalizedScore ?? b.rawScore ?? 0) - (a.normalizedScore ?? a.rawScore ?? 0));

          if (candidates.length > 0) {
            const best = candidates[0];
            const action: 'call' | 'put' = best.signal === 'UP' ? 'call' : 'put';
            const candleMultiplier = (signal.expiryDurationSec && signal.timeframe && signal.expiryDurationSec > signal.timeframe) ? 2 : 1;
            const duration = currentTf * candleMultiplier;
            this.addLog(
              'ORDER',
              'info',
              `[SBAA سبع - دمج شامل] إشارة ${action === 'call' ? 'شراء' : 'بيع'} مؤكدة عبر استراتيجية ${best.strategyName} (${best.normalizedScore ?? best.rawScore}%) داخل محرك سبع (المدة: ${duration}s)`
            );
            return {
              action,
              reason: `[SBAA سبع - المحرك الشامل]: استراتيجية ${best.strategyName} مؤهلة بنقاط ${best.normalizedScore ?? best.rawScore}% مع توافق هيكلي`,
              duration,
              strategyName: `SBAA Pro (${best.strategyName})`,
              candleTimestamp: anchorCandleTimestamp,
            };
          }
        }
      }

      return null;
    }

    // Option 2: Confluence of all quantitative strategies (strictly rejects OFFLINE/ERROR & low confidence)
    if (strategyId === 'confluence') {
      if ((signal as any).dataStatus === 'OFFLINE' || (signal as any).dataStatus === 'ERROR') {
        this.lastExecutionBlockedReason = 'بيانات التغذية غير متصلة حالياً؛ حظر دخول توافق الاستراتيجيات.';
        return null;
      }

      // When upstream signal matches current candle/asset/tf cleanly, honor its gate decision
      if (!isSignalStaleOrMismatched) {
        if (typeof signal.confidence === 'number' && signal.confidence < Math.min(minThreshold, 65)) {
          this.lastExecutionBlockedReason = `ثقة إشارة التوافق (${signal.confidence}%) أقل من الحد الأدنى المطلوب (${minThreshold}%).`;
          return null;
        }
        const candleMultiplier = (signal.expiryDurationSec && signal.timeframe && signal.expiryDurationSec > signal.timeframe) ? 2 : 1;
        const duration = currentTf * candleMultiplier;
        if (signal.type === 'UP') {
          return {
            action: 'call',
            reason: `توافق استراتيجيات قوي للصعود (ثقة: ${signal.confidence}%)`,
            duration,
            strategyName: 'توافق الاستراتيجيات (Confluence Matrix)',
            candleTimestamp: anchorCandleTimestamp,
          };
        }
        if (signal.type === 'DOWN') {
          return {
            action: 'put',
            reason: `توافق استراتيجيات قوي للهبوط (ثقة: ${signal.confidence}%)`,
            duration,
            strategyName: 'توافق الاستراتيجيات (Confluence Matrix)',
            candleTimestamp: anchorCandleTimestamp,
          };
        }
        return null;
      }

      // If upstream signal was stale (e.g. unexpired activeConfirmedSignal from an earlier candle), evaluate fresh candles directly
      if (activeStrategiesList.length > 0) {
        const qualified = activeStrategiesList.filter(
          (s) => s.dataValid !== false && s.qualified && (s.signal === 'UP' || s.signal === 'DOWN')
        );
        const upStrats = qualified.filter((s) => s.signal === 'UP');
        const downStrats = qualified.filter((s) => s.signal === 'DOWN');
        if (!(upStrats.length >= 2 && downStrats.length >= 2)) {
          if (upStrats.length >= 3 && upStrats.length > downStrats.length) {
            const avgConf = Math.round(upStrats.reduce((acc, s) => acc + (s.normalizedScore ?? s.rawScore ?? 0), 0) / upStrats.length);
            if (avgConf >= Math.min(minThreshold, 65)) {
              return {
                action: 'call',
                reason: `توافق استراتيجيات قوي للصعود (ثقة: ${avgConf}%)`,
                duration: currentTf,
                strategyName: 'توافق الاستراتيجيات (Confluence Matrix)',
                candleTimestamp: anchorCandleTimestamp,
              };
            }
          } else if (downStrats.length >= 3 && downStrats.length > upStrats.length) {
            const avgConf = Math.round(downStrats.reduce((acc, s) => acc + (s.normalizedScore ?? s.rawScore ?? 0), 0) / downStrats.length);
            if (avgConf >= Math.min(minThreshold, 65)) {
              return {
                action: 'put',
                reason: `توافق استراتيجيات قوي للهبوط (ثقة: ${avgConf}%)`,
                duration: currentTf,
                strategyName: 'توافق الاستراتيجيات (Confluence Matrix)',
                candleTimestamp: anchorCandleTimestamp,
              };
            }
          }
        }
      }
      return null;
    }

    // Option 3: Autonomous Algorithmic Selection (Auto-Select Highest Edge Without Conflict)
    if (strategyId === 'auto' || strategyId === 'all') {
      if (this.sbaaEngine) {
        const sbaaRecord = this.sbaaEngine.evaluateMarket(
          targetAsset,
          currentTf,
          freshCandles.length >= 15 ? freshCandles : undefined,
          { readOnly: true }
        );
        if ((sbaaRecord.systemDecision === 'BUY' || sbaaRecord.systemDecision === 'SELL') && sbaaRecord.confluenceScore >= Math.min(80, minThreshold)) {
          const action = sbaaRecord.systemDecision === 'BUY' ? 'call' : 'put';
          const isBreakout = sbaaRecord.patternNameAr.includes('كسر') || sbaaRecord.patternNameAr.includes('Breakout');
          const duration = currentTf * (isBreakout && currentTf <= 900 ? 2 : 1);
          return {
            action,
            reason: `[الانتقاء التلقائي - SBAA سبع]: ${sbaaRecord.patternNameAr} (توافق ${sbaaRecord.confluenceScore}/100)`,
            duration,
            strategyName: 'SBAA Pro Engine (استراتيجية سبع المطورة)',
            candleTimestamp: anchorCandleTimestamp,
          };
        }
      }

      if (activeStrategiesList.length > 0) {
        const qualifiedStrats = activeStrategiesList.filter(
          (s) => s.dataValid !== false && s.qualified && (s.signal === 'UP' || s.signal === 'DOWN')
        );

        const upCount = qualifiedStrats.filter((s) => s.signal === 'UP').length;
        const downCount = qualifiedStrats.filter((s) => s.signal === 'DOWN').length;
        if (upCount >= 2 && downCount >= 2) {
          this.lastExecutionBlockedReason = 'تعارض اتجاهي بين الاستراتيجيات المؤهلة؛ حظر الدخول.';
          return null;
        }

        const candidates = qualifiedStrats
          .filter((s) => (s.normalizedScore ?? s.rawScore ?? 0) >= minThreshold)
          .sort((a, b) => (b.normalizedScore ?? b.rawScore ?? 0) - (a.normalizedScore ?? a.rawScore ?? 0));

        if (candidates.length > 0) {
          const best = candidates[0];
          const action: 'call' | 'put' = best.signal === 'UP' ? 'call' : 'put';
          const candleMultiplier = (signal.expiryDurationSec && signal.timeframe && signal.expiryDurationSec > signal.timeframe) ? 2 : 1;
          const duration = currentTf * candleMultiplier;
          return {
            action,
            reason: `[الانتقاء التلقائي]: استراتيجية ${best.strategyName} مؤهلة بنقاط ${best.normalizedScore ?? best.rawScore}%`,
            duration,
            strategyName: best.strategyName,
            candleTimestamp: anchorCandleTimestamp,
          };
        }
      }
      return null;
    }

    // Option 4: Specific Selected Quantitative Strategy (all 26 modular strategies + rsi_macd)
    if (activeStrategiesList.length > 0) {
      if (strategyId === 'rsi_macd') {
        const macd = StrategyEngine.matchStrategyById(activeStrategiesList, 'macd');
        const rsi = StrategyEngine.matchStrategyById(activeStrategiesList, 'rsi_momentum');
        const macdUp = Boolean(macd && macd.dataValid !== false && macd.qualified !== false && macd.signal === 'UP');
        const macdDown = Boolean(macd && macd.dataValid !== false && macd.qualified !== false && macd.signal === 'DOWN');
        const rsiUp = Boolean(rsi && rsi.dataValid !== false && rsi.qualified !== false && rsi.signal === 'UP');
        const rsiDown = Boolean(rsi && rsi.dataValid !== false && rsi.qualified !== false && rsi.signal === 'DOWN');
        const candleMultiplier = (signal.expiryDurationSec && signal.timeframe && signal.expiryDurationSec > signal.timeframe) ? 2 : 1;
        const duration = currentTf * candleMultiplier;

        if ((macdUp || rsiUp) && !(macdDown || rsiDown)) {
          return { action: 'call', reason: 'إشارة صعود مؤكدة من استراتيجية RSI + MACD', duration, strategyName: 'RSI + MACD', candleTimestamp: anchorCandleTimestamp };
        }
        if ((macdDown || rsiDown) && !(macdUp || rsiUp)) {
          return { action: 'put', reason: 'إشارة هبوط مؤكدة من استراتيجية RSI + MACD', duration, strategyName: 'RSI + MACD', candleTimestamp: anchorCandleTimestamp };
        }
        return null;
      }

      const strat = StrategyEngine.matchStrategyById(activeStrategiesList, strategyId);

      // Strictly require valid candle data, qualified setup, and directional signal (NEVER enter on WAIT/NEUTRAL)
      if (strat && strat.dataValid !== false && strat.qualified !== false && (strat.signal === 'UP' || strat.signal === 'DOWN')) {
        const scoreVal = strat.normalizedScore ?? strat.rawScore ?? strat.confidence ?? null;
        if (scoreVal !== null && this.config.minSignalStrength && scoreVal < Math.min(this.config.minSignalStrength, 60)) {
          this.lastExecutionBlockedReason = `نقاط استراتيجية ${strat.strategyName} (${scoreVal}%) دون الحد الأدنى المطلوب.`;
          return null;
        }

        const candleMultiplier = (signal.expiryDurationSec && signal.timeframe && signal.expiryDurationSec > signal.timeframe) ? 2 : 1;
        const duration = currentTf * candleMultiplier;
        const action: 'call' | 'put' = strat.signal === 'UP' ? 'call' : 'put';
        return {
          action,
          reason: `إشارة ${action === 'call' ? 'صعود' : 'هبوط'} حقيقية من استراتيجية ${strat.strategyName} (التقييم: ${scoreVal ?? strat.score}%)`,
          duration,
          strategyName: strat.strategyName,
          candleTimestamp: anchorCandleTimestamp,
        };
      }
    }

    return null;
  }

  private getExactTimeframeCandleCount(asset: string, tf: number): number {
    let count = this.poService.getCandleCount(asset, tf);
    if (count < 15 && this.candleBuilder && typeof this.candleBuilder.getCandles === 'function') {
      const cbCount = (this.candleBuilder.getCandles(asset, tf) || []).length;
      if (cbCount > count) count = cbCount;
    }
    if (count < 15 && this.marketDataStore && typeof this.marketDataStore.getCandles === 'function') {
      const mdsCount = (this.marketDataStore.getCandles(asset, tf) || []).length;
      if (mdsCount > count) count = mdsCount;
    }
    return count;
  }

  private async executeStealthTradePipeline(
    action: 'call' | 'put',
    reason: string,
    idempotencyKey: string,
    candleTimestamp: number,
    signalId: string,
    customDuration?: number,
    strategyName?: string
  ) {
    this.isExecutingTrade = true;
    this.executionLock = true;

    const targetAsset = this.config.asset || this.poService.getActiveAsset() || 'EURUSD_otc';
    const tf = this.config.timeframe || 60;
    const tradeId = `at_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    try {
      // 1. Strict Pre-Flight Verification BEFORE creating any CREATED trade record or sleeping
      const candleCountPre = this.getExactTimeframeCandleCount(targetAsset, tf);
      if (candleCountPre < 15) {
        this.processedOrderTokens.delete(idempotencyKey);
        this.lastExecutionBlockedReason = `عدد شموع الفريم المحدد (${tf}s) غير كافٍ للتحليل (${candleCountPre}/15 شمعة مطلوبة).`;
        this.addLog(
          'ORDER',
          'warn',
          `⚠️ تم إلغاء تنفيذ الصفقة: عدد شموع الفريم المحدد (${tf}s) غير كافٍ للتحليل (${candleCountPre}/15 شمعة مطلوبة).`
        );
        return;
      }

      const diag = this.poService.getDiagnostics();
      const wsReady = typeof this.poService.isConnected === 'function'
        ? this.poService.isConnected()
        : diag?.subsystems?.websocket === 'connected';
      const authReady = (this.poService as any).authVerified === true || diag?.subsystems?.auth === 'success';
      if (!wsReady || !authReady) {
        this.processedOrderTokens.delete(idempotencyKey);
        this.lastExecutionBlockedReason = 'تعذر إرسال الصفقة: الحساب الحقيقي غير متصل أو غير موثق مع خادم Pocket Option.';
        this.addLog('SECURITY', 'warn', `⚠️ تم إلغاء الصفقة قبل الإنشاء: منصة التداول الحقيقي غير متصلة أو بانتظار توثيق الجلسة.`);
        return;
      }

      // 2. Calculate Exact Trade Amount & Validate Balance
      let calculatedAmount = this.config.baseAmount;
      if (this.config.enableMartingale && this.currentMartingaleStep > 0) {
        const step = Math.min(this.currentMartingaleStep, this.config.maxMartingaleDepth);
        calculatedAmount = this.config.baseAmount * Math.pow(this.config.martingaleMultiplier, step);
      }

      let finalAmount = Math.round(calculatedAmount * 100) / 100;
      finalAmount = Math.max(1.0, Math.min(finalAmount, 1000.0));

      const currentBalance = diag?.account?.balance;
      if (typeof currentBalance === 'number' && finalAmount > currentBalance) {
        this.processedOrderTokens.delete(idempotencyKey);
        this.lastExecutionBlockedReason = `الرصيد المتاح ($${currentBalance.toFixed(2)}) غير كافٍ لمبلغ الصفقة المحدد ($${finalAmount.toFixed(2)})`;
        this.addLog('RISK', 'warn', `⚠️ تم إلغاء الصفقة: ${this.lastExecutionBlockedReason}`);
        return;
      }

      // 3. Dynamic Expiry Duration Determination - Strictly anchored to selected timeframe
      const SUPPORTED_EXPIRIES = [5, 15, 30, 60, 120, 180, 300, 600, 900, 1800, 3600];
      let targetTime = customDuration || tf;
      if (!SUPPORTED_EXPIRIES.includes(targetTime)) {
        targetTime = tf;
      }
      if (targetTime < tf) {
        targetTime = tf;
      }

      // Step A: Instantiate Trade Record in 'CREATED' state only after all pre-flight gates pass
      this.addLog('ORDER', 'info', `[CREATED] إنشاء سجل الصفقة الحقيقية (${tradeId}) بناء على إشارة: ${reason}`);
      const tradeRecord: AutoTraderTradeRecord = {
        id: tradeId,
        runCycleId: this.runCycleId,
        signalId,
        timestamp: Date.now(),
        candleTimestamp,
        idempotencyKey,
        asset: targetAsset,
        action,
        amount: finalAmount,
        lifecycle: 'CREATED',
        status: 'PENDING',
        strategy: strategyName || this.config.strategyId,
        durationSeconds: targetTime,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      this.trades.push(tradeRecord);
      this.persistState();
      this.notifyStatusChange();

      // Step B: Transition to 'PENDING' during human hesitation and pre-click checks
      this.transitionTradeState(tradeId, 'PENDING');

      // Human Hesitation Delay (1.5 to 3.5 seconds)
      const hesitationSec = Number((1.5 + Math.random() * 2.0).toFixed(2));
      this.addLog('HESITATION', 'info', `⏱️ انتظار التأكيد الفعلي (${hesitationSec}s) قبل إرسال الأمر للمنصة...`);

      await new Promise((resolve) => setTimeout(resolve, hesitationSec * 1000));

      if (this.isEmergencyStopped || !this.isRunning) {
        this.processedOrderTokens.delete(idempotencyKey);
        this.addLog('ORDER', 'warn', '[CANCELLED] تم إلغاء الصفقة قبل الإرسال لتفعيل أمر التوقف');
        this.transitionTradeState(tradeId, 'REJECTED', { rejectionReason: 'توقف البوت أثناء فترة الانتظار' });
        return;
      }

      // Pre-click Delay (150-300ms)
      const preClickMs = Math.floor(150 + Math.random() * 150);
      await new Promise((resolve) => setTimeout(resolve, preClickMs));

      // Post-delay live re-verification
      const candleCount = this.getExactTimeframeCandleCount(targetAsset, tf);
      if (candleCount < 15) {
        this.processedOrderTokens.delete(idempotencyKey);
        this.addLog(
          'ORDER',
          'warn',
          `⚠️ تم إلغاء تنفيذ الصفقة: عدد شموع الفريم المحدد (${tf}s) غير كافٍ للتحليل (${candleCount}/15 شمعة مطلوبة).`
        );
        this.transitionTradeState(tradeId, 'REJECTED', { rejectionReason: 'بيانات الشموع للفريم غير كافية' });
        return;
      }

      // Step C: Transition to 'SUBMITTED' right before dispatching real order over WebSocket
      this.lastTradeSignalTime = Date.now();
      this.transitionTradeState(tradeId, 'SUBMITTED');
      this.addLog('ORDER', 'info', `[SUBMITTED] إرسال أمر الصفقة الفعلي إلى خادم Pocket Option: ${action.toUpperCase()} على ${targetAsset} بمبلغ $${finalAmount} لمدة ${targetTime}s`);

      const result = await this.poService.openDeal({
        asset: targetAsset,
        amount: finalAmount,
        action,
        time: targetTime,
        strategyName: strategyName || this.config.strategyId,
      });

      if (result.success && result.deal) {
        const ticketId = String(result.deal.id || result.requestId || '');
        this.totalTrades++;
        this.consecutiveTradesCount++;

        // Step D: Transition to 'ACCEPTED'
        this.transitionTradeState(tradeId, 'ACCEPTED', {
          ticketId,
          openPrice: result.deal.openPrice,
        });

        // Step E: Immediately transition to 'OPEN' as active position
        this.transitionTradeState(tradeId, 'OPEN', {
          openPrice: result.deal.openPrice,
        });

        this.addLog('ORDER', 'success', `[OPEN] الصفقة مفتوحة ونشطة بنجاح! تذكرة #${ticketId} | سعر الفتح: ${result.deal.openPrice || 'جارٍ'}`);

        // Check if it's time for a Human Rest Break (after specified consecutive trades)
        if (this.consecutiveTradesCount >= this.config.tradesBeforeRest) {
          const restMins = Number((this.config.restMinMinutes + Math.random() * (this.config.restMaxMinutes - this.config.restMinMinutes)).toFixed(1));
          this.isInRestBreak = true;
          this.restBreakUntil = Date.now() + restMins * 60 * 1000;
          this.addLog('REST', 'warn', `☕ وضع خمول المتداول: تم إنجاز ${this.consecutiveTradesCount} صفقات متتالية. استراحة شاي لمدة ${restMins} دقيقة.`);
        }
      } else {
        this.processedOrderTokens.delete(idempotencyKey);
        this.lastFailedOrderTime = Date.now();
        this.transitionTradeState(tradeId, 'REJECTED', {
          rejectionReason: result.error || 'رفض خادم المنصة إتمام الصفقة',
        });
        this.addLog('ORDER', 'error', `[REJECTED] رفض تنفيذ الصفقة من المنصة: ${result.error || 'خطأ غير معروف'}`);
      }
    } catch (err: any) {
      this.processedOrderTokens.delete(idempotencyKey);
      this.lastFailedOrderTime = Date.now();
      this.transitionTradeState(tradeId, 'FAILED', {
        rejectionReason: err?.message || 'خطأ داخلي في مسار التنفيذ',
      });
      this.addLog('ORDER', 'error', `[FAILED] خطأ في مسار تنفيذ الصفقة: ${err?.message || err}`);
    } finally {
      this.isExecutingTrade = false;
      this.executionLock = false;
      this.persistState();
      this.notifyStatusChange();
    }
  }

  private handleDealClosed(deal: any) {
    if (!deal) return;
    const dealId = String(deal.id || deal.ticketId || '');
    if (dealId && this.processedDealIds.has(dealId)) {
      return; // Deduplication: prevent double counting PnL or repeated status broadcasts
    }
    if (dealId) {
      this.processedDealIds.add(dealId);
    }

    const profit = Number(deal.profit) || 0;
    const isWin = profit > 0;
    const isDraw = profit === 0;

    // Update in-place: transition from OPEN/SETTLING to COMPLETED (or update a trade that was auto-settled on expiry timeout)
    const matchingTrade = this.trades.find(
      (t) => (dealId && (t.ticketId === dealId || t.id === dealId)) ||
        (!t.ticketId && t.asset === deal.asset && TradeLifecycleManager.isActive(t.lifecycle))
    );

    const wasAutoSettledOnTimeout = Boolean(
      matchingTrade &&
      matchingTrade.lifecycle === 'COMPLETED' &&
      matchingTrade.rejectionReason &&
      matchingTrade.rejectionReason.includes('التسوية التلقائية')
    );

    if (wasAutoSettledOnTimeout) {
      this.drawTrades = Math.max(0, this.drawTrades - 1);
    }

    this.dailyPnL += profit;

    if (isWin) {
      this.winningTrades++;
      this.currentMartingaleStep = 0;
      this.addLog('RISK', 'success', `🎉 صفقة رابحة: +$${profit.toFixed(2)} | صافي اليوم: $${this.dailyPnL.toFixed(2)}`);
    } else if (isDraw) {
      this.drawTrades++;
      this.addLog('RISK', 'info', `⚖️ صفقة متعادلة (استرداد): $0.00 | صافي اليوم: $${this.dailyPnL.toFixed(2)}`);
    } else {
      this.losingTrades++;
      if (this.config.enableMartingale && this.currentMartingaleStep < this.config.maxMartingaleDepth) {
        this.currentMartingaleStep++;
        this.addLog('RISK', 'warn', `📉 صفقة خاسرة: -$${Math.abs(profit).toFixed(2)} | تصعيد المارتينجال للخطوة ${this.currentMartingaleStep}`);
      } else {
        this.currentMartingaleStep = 0;
        this.addLog('RISK', 'warn', `📉 صفقة خاسرة: -$${Math.abs(profit).toFixed(2)} | صافي اليوم: $${this.dailyPnL.toFixed(2)}`);
      }
    }

    if (matchingTrade) {
      if (wasAutoSettledOnTimeout) {
        matchingTrade.closePrice = deal.closePrice;
        matchingTrade.profit = profit;
        matchingTrade.status = isWin ? 'WON' : isDraw ? 'DRAW' : 'LOST';
        matchingTrade.rejectionReason = undefined;
        matchingTrade.updatedAt = Date.now();
      } else {
        if (matchingTrade.lifecycle !== 'SETTLING') {
          this.transitionTradeState(matchingTrade.id, 'SETTLING');
        }
        this.transitionTradeState(matchingTrade.id, 'COMPLETED', {
          closePrice: deal.closePrice,
          profit,
          status: isWin ? 'WON' : isDraw ? 'DRAW' : 'LOST',
        });
      }
    }

    // Check risk limits after deal closed
    if (this.dailyPnL <= -Math.abs(this.config.stopLoss)) {
      this.circuitBreakerTripped = true;
      this.circuitBreakerReason = `تم بلوغ حد الخسارة اليومي (-$${Math.abs(this.dailyPnL).toFixed(2)})`;
      this.isRunning = false;
      this.addLog('RISK', 'error', `🛑 قاطع الدائرة مفعل: ${this.circuitBreakerReason}. توقف البوت.`);
    } else if (this.dailyPnL >= Math.abs(this.config.takeProfit)) {
      this.circuitBreakerTripped = true;
      this.circuitBreakerReason = `تم بلوغ هدف الربح اليومي (+$${this.dailyPnL.toFixed(2)})`;
      this.isRunning = false;
      this.addLog('RISK', 'success', `🏆 قاطع الدائرة مفعل: ${this.circuitBreakerReason}. تم تأمين الأرباح.`);
    }

    this.persistState();
    this.notifyStatusChange();
  }

  private addLog(
    category: AutoTraderLog['category'],
    level: AutoTraderLog['level'],
    message: string
  ) {
    const entry: AutoTraderLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      timestamp: Date.now(),
      level,
      message,
      category,
    };
    this.logs.push(entry);
    if (this.logs.length > 100) this.logs.shift();

    if (this.onBroadcast) {
      this.onBroadcast('autotrader_log', entry);
    }
  }

  private notifyStatusChange() {
    if (this.onBroadcast) {
      this.onBroadcast('autotrader_status', this.getStatus());
    }
  }

  private persistState() {
    if (!this.persistToDisk) return;
    try {
      const dir = path.dirname(STATE_FILE_PATH);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      const stateData = {
        config: this.config,
        isRunning: this.isRunning,
        isEmergencyStopped: this.isEmergencyStopped,
        dailyPnL: this.dailyPnL,
        totalTrades: this.totalTrades,
        winningTrades: this.winningTrades,
        losingTrades: this.losingTrades,
        circuitBreakerTripped: this.circuitBreakerTripped,
        circuitBreakerReason: this.circuitBreakerReason,
        savedAt: new Date().toISOString(),
      };
      fs.writeFileSync(STATE_FILE_PATH, JSON.stringify(stateData, null, 2), 'utf-8');
    } catch (err) {
      console.error('[AutoTraderEngine] Error persisting state:', err);
    }
  }

  private loadPersistedState() {
    if (!this.persistToDisk) return;
    try {
      if (fs.existsSync(STATE_FILE_PATH)) {
        const raw = fs.readFileSync(STATE_FILE_PATH, 'utf-8');
        const data = JSON.parse(raw);
        if (data.config) {
          const loaded = { ...data.config };
          delete loaded.aiCode;
          delete loaded.isAiActivated;
          delete loaded.selectedAiModel;
          if (loaded.strategyId === 'sbaa_ai' || loaded.strategyId === 'sbaa-ai' || loaded.strategyId === 'ai') {
            loaded.strategyId = 'sbaa';
          }
          loaded.isDemo = false;

          this.config = {
            ...this.config,
            ...loaded,
            maxAmount: Math.max(1000.0, Number(loaded.maxAmount) || 1000.0, Number(loaded.baseAmount) || 1.0),
          };
        }
        this.dailyPnL = data.dailyPnL ?? 0;
        this.totalTrades = data.totalTrades ?? 0;
        this.winningTrades = data.winningTrades ?? 0;
        this.losingTrades = data.losingTrades ?? 0;
        this.circuitBreakerTripped = Boolean(data.circuitBreakerTripped);
        this.circuitBreakerReason = data.circuitBreakerReason ?? '';
        this.isEmergencyStopped = Boolean(data.isEmergencyStopped);
        // By safety default, bot is stopped on server restart until explicitly resumed
        this.isRunning = false;
        console.log('[AutoTraderEngine] Restored persisted bot state and config from disk.');
      }
    } catch (err) {
      console.warn('[AutoTraderEngine] Could not load persisted state, starting fresh.');
    }
  }
}
