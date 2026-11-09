import fs from 'fs';
import path from 'path';
import { StrategyEngine } from './StrategyEngine';
import { PocketOptionService } from './PocketOptionService';
import { Signal, StrategyResult, Candle } from './types';
import { SbaaStrategyEngine } from './sbaa/SbaaStrategyEngine';
import { SbaaPatternDetector } from './sbaa/SbaaPatternDetector';
import { SbaaScoringEngine } from './sbaa/SbaaScoringEngine';

export interface AutoTraderConfig {
  strategyId: string;       // 'sbaa' (SBAA Pro Engine), 'confluence', 'ema_trend', 'rsi_macd', 'bollinger_bands', 'support_resistance', 'breakout', 'smc'
  baseAmount: number;       // e.g. 5.0
  maxAmount: number;        // e.g. 50.0
  stopLoss: number;         // e.g. 20.0 (Daily Stop Loss in $)
  takeProfit: number;       // e.g. 40.0 (Daily Take Profit in $)
  asset: string;            // e.g. 'EURUSD_otc'
  timeframe: number;        // e.g. 60
  isDemo: boolean;          // true for Demo, false for Real
  enableMartingale: boolean;
  martingaleMultiplier: number;
  maxMartingaleDepth: number;
  tradesBeforeRest: number; // e.g. 10
  restMinMinutes: number;   // e.g. 15
  restMaxMinutes: number;   // e.g. 45
  maxConcurrentTrades: number; // e.g. 1
  cooldownBetweenTradesSec: number; // e.g. 30
  minSignalStrength?: number; // Minimum confidence threshold for auto-select
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
    isDemo: true,
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

  private logs: AutoTraderLog[] = [];
  private trades: AutoTraderTradeRecord[] = [];
  private onBroadcast?: (event: string, data: any) => void;

  constructor(
    private strategyEngine: StrategyEngine,
    private poService: PocketOptionService,
    onBroadcast?: (event: string, data: any) => void,
    private sbaaEngine?: SbaaStrategyEngine
  ) {
    this.onBroadcast = onBroadcast;

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

  public setBroadcastHandler(handler: (event: string, data: any) => void) {
    this.onBroadcast = handler;
  }

  public getStatus() {
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
        isDemo: brokerDiag?.account?.isDemo ?? true,
      },
      recentTrades: this.trades.slice(-25).reverse(),
      recentLogs: this.logs.slice(-40).reverse(),
    };
  }

  public hasActiveOpenTrade(): boolean {
    return this.trades.some((t) => TradeLifecycleManager.isActive(t.lifecycle));
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
      this.config = {
        ...this.config,
        ...userConfig,
        maxAmount: Math.max(userConfig.maxAmount || 1000.0, userConfig.baseAmount || this.config.baseAmount || 1.0, 1000.0),
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
    this.addLog('SECURITY', 'info', `🛡️ تم تفعيل طبقات الحماية والتأخير البشري وعشوائية المبالغ`);

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
    this.config = {
      ...this.config,
      ...newConfig,
      maxAmount: Math.max(newConfig.maxAmount || 1000.0, newConfig.baseAmount || this.config.baseAmount || 1.0, 1000.0),
    };
    if (newConfig.timeframe) {
      this.config.timeframe = newConfig.timeframe;
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
      isDemo: diag?.account?.isDemo ?? true,
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

    for (let i = minLookback; i < candles.length - 1; i++) {
      const historicalSlice = candles.slice(0, i + 1);
      const currCandle = candles[i];
      const nextCandle = candles[i + 1];

      // Pure chronological evaluation: slice strictly up to candle i
      let action: 'call' | 'put' | null = null;

      // Strategy evaluation based on strategyId
      if (strategyId === 'sbaa' || strategyId.toLowerCase().includes('sbaa') || strategyId.includes('سبع')) {
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
      } else if (strategyId === 'ema_trend' || strategyId === 'confluence') {
        // Fast EMA (9) vs Slow EMA (21)
        const closes = historicalSlice.map((c) => c.close);
        const fast = this.calculateEmaSimple(closes, 9);
        const slow = this.calculateEmaSimple(closes, 21);
        if (fast > slow && currCandle.close > fast) action = 'call';
        else if (fast < slow && currCandle.close < fast) action = 'put';
      } else if (strategyId === 'rsi_macd') {
        const closes = historicalSlice.map((c) => c.close);
        const rsi = this.calculateRsiSimple(closes, 14);
        if (rsi && rsi < 35) action = 'call';
        else if (rsi && rsi > 65) action = 'put';
      } else if (strategyId === 'bollinger_bands') {
        const closes = historicalSlice.map((c) => c.close);
        const bb = this.calculateBollingerSimple(closes, 20, 2);
        if (bb && currCandle.low <= bb.lower && currCandle.close > currCandle.open) action = 'call';
        else if (bb && currCandle.high >= bb.upper && currCandle.close < currCandle.open) action = 'put';
      } else if (strategyId === 'breakout') {
        const prior20 = historicalSlice.slice(-20, -1);
        const high20 = Math.max(...prior20.map((c) => c.high));
        const low20 = Math.min(...prior20.map((c) => c.low));
        if (currCandle.close > high20) action = 'call';
        else if (currCandle.close < low20) action = 'put';
      } else {
        // Default to price action momentum
        if (currCandle.close > currCandle.open && currCandle.close > historicalSlice[historicalSlice.length - 2].close) action = 'call';
        else if (currCandle.close < currCandle.open && currCandle.close < historicalSlice[historicalSlice.length - 2].close) action = 'put';
      }

      if (action) {
        const entryPrice = currCandle.close;
        const exitPrice = nextCandle.close;
        const isWin = action === 'call' ? exitPrice > entryPrice : exitPrice < entryPrice;
        const pnl = isWin ? stake * payoutRatio : -stake;

        balance += pnl;
        if (isWin) grossProfit += pnl;
        else grossLoss += Math.abs(pnl);

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
        });

        // Skip to prevent overlapping bar contamination
        i += 1;
      }
    }

    const totalTrades = tradesList.length;
    const winningTrades = tradesList.filter((t) => t.isWin).length;
    const losingTrades = totalTrades - winningTrades;
    const winRate = totalTrades > 0 ? Number(((winningTrades / totalTrades) * 100).toFixed(1)) : 0;
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
      winRate,
      netProfit: Number((balance - 1000).toFixed(2)),
      profitFactor,
      maxDrawdownPercent: Number(maxDrawdownPct.toFixed(1)),
      maxDrawdownUsd: Number(maxDrawdownUsd.toFixed(2)),
      avgWin,
      avgLoss,
      disclaimer: 'تنبيه: نتائج الاختبار التاريخي تقديرية ولا تشكل ضماناً للأرباح المستقبلية.',
      trades: tradesList,
    };
  }

  /**
   * Main Strategy Signal Listener - Runs automatically on every live candle/tick (Rule 4, 8, 20)
   */
  public async onSignalUpdate(signal: Signal | null) {
    if (!this.isRunning || this.isEmergencyStopped || !signal || this.isExecutingTrade || this.executionLock) {
      return;
    }

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

    // Minimum cooldown between trades to avoid over-trading (Rule 5)
    if (now - this.lastTradeSignalTime < this.config.cooldownBetweenTradesSec * 1000) return;

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
      this.circuitBreakerReason = `تم تحقيق هدف الربح اليومي (+$$${this.dailyPnL.toFixed(2)})`;
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
  } | null {
    const { strategyId } = this.config;
    const currentTf = this.config.timeframe || 60;

    // Option 1: SBAA Pro Engine (Integrated 6 Pillars + 26 Quantitative Strategies Master Matrix)
    if (strategyId === 'sbaa' || strategyId.toLowerCase().includes('sbaa') || strategyId.includes('سبع')) {
      if (this.sbaaEngine) {
        const sbaaRecord = this.sbaaEngine.evaluateMarket(this.config.asset, currentTf);
        const minThreshold = this.config.minSignalStrength || 70;
        if ((sbaaRecord.systemDecision === 'BUY' || sbaaRecord.systemDecision === 'SELL') && sbaaRecord.confluenceScore >= Math.min(75, minThreshold)) {
          const action = sbaaRecord.systemDecision === 'BUY' ? 'call' : 'put';
          const isBreakout = sbaaRecord.patternNameAr.includes('كسر') || sbaaRecord.patternNameAr.includes('Breakout');
          // Dynamic duration: 2 candles on breakout, 1 candle on normal setup
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
            strategyName: 'SBAA Pro Engine (استراتيجية سبع الذكية المطورة - المحرك الشامل المدمج)',
          };
        }
      }

      // Concurrently inspect all 26 quantitative strategies integrated within SBAA
      if (signal.strategies && Array.isArray(signal.strategies)) {
        const qualifiedStrats = signal.strategies.filter(
          (s) => s.qualified && (s.signal === 'UP' || s.signal === 'DOWN')
        );

        const upCount = qualifiedStrats.filter((s) => s.signal === 'UP').length;
        const downCount = qualifiedStrats.filter((s) => s.signal === 'DOWN').length;

        // Anti-conflict verification
        if (!(upCount >= 2 && downCount >= 2)) {
          const threshold = this.config.minSignalStrength || 70;
          const candidates = qualifiedStrats
            .filter((s) => (s.normalizedScore ?? s.rawScore ?? 0) >= threshold)
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
              reason: `[SBAA سبع - المحرك الشامل المدمج]: استراتيجية ${best.strategyName} مؤهلة بنقاط ${best.normalizedScore ?? best.rawScore}% مع توافق هيكلي`,
              duration,
              strategyName: `SBAA Pro (${best.strategyName})`,
            };
          }
        }
      }

      // Strict no-trade when score is below threshold or WAIT - strictly zero random/fake entries!
      return null;
    }

    // Option 2: Confluence of all quantitative strategies
    if (strategyId === 'confluence') {
      const candleMultiplier = (signal.expiryDurationSec && signal.timeframe && signal.expiryDurationSec > signal.timeframe) ? 2 : 1;
      const duration = currentTf * candleMultiplier;
      if (signal.type === 'UP' || signal.direction === 'UP') {
        return {
          action: 'call',
          reason: `توافق استراتيجيات قوي للصعود (ثقة: ${signal.confidence}%)`,
          duration,
          strategyName: 'توافق الاستراتيجيات (Confluence Matrix)',
        };
      }
      if (signal.type === 'DOWN' || signal.direction === 'DOWN') {
        return {
          action: 'put',
          reason: `توافق استراتيجيات قوي للهبوط (ثقة: ${signal.confidence}%)`,
          duration,
          strategyName: 'توافق الاستراتيجيات (Confluence Matrix)',
        };
      }
      return null;
    }

    // Option 3: Intelligent Autonomous Selection (Auto-Select Highest Edge Without Conflict)
    if (strategyId === 'auto' || strategyId === 'all') {
      if (this.sbaaEngine) {
        const sbaaRecord = this.sbaaEngine.evaluateMarket(this.config.asset, currentTf);
        const minThreshold = this.config.minSignalStrength || 70;
        if ((sbaaRecord.systemDecision === 'BUY' || sbaaRecord.systemDecision === 'SELL') && sbaaRecord.confluenceScore >= Math.min(80, minThreshold)) {
          const action = sbaaRecord.systemDecision === 'BUY' ? 'call' : 'put';
          const isBreakout = sbaaRecord.patternNameAr.includes('كسر') || sbaaRecord.patternNameAr.includes('Breakout');
          const duration = currentTf * (isBreakout && currentTf <= 900 ? 2 : 1);
          return {
            action,
            reason: `[الانتقاء الذكي - SBAA سبع]: ${sbaaRecord.patternNameAr} (توافق ${sbaaRecord.confluenceScore}/100)`,
            duration,
            strategyName: 'SBAA Pro Engine (استراتيجية سبع المطورة)',
          };
        }
      }

      // Second priority: Autonomous candidate search across all 26 registered quantitative strategies
      if (signal.strategies && Array.isArray(signal.strategies)) {
        const qualifiedStrats = signal.strategies.filter(
          (s) => s.qualified && (s.signal === 'UP' || s.signal === 'DOWN')
        );

        // Anti-conflict verification: if strong UP and strong DOWN simultaneously exist, abort
        const upCount = qualifiedStrats.filter((s) => s.signal === 'UP').length;
        const downCount = qualifiedStrats.filter((s) => s.signal === 'DOWN').length;
        if (upCount >= 2 && downCount >= 2) {
          return null; // Severe directional contradiction
        }

        // Filter by user minimum confidence threshold
        const threshold = this.config.minSignalStrength || 70;
        const candidates = qualifiedStrats
          .filter((s) => (s.normalizedScore ?? s.rawScore ?? 0) >= threshold)
          .sort((a, b) => (b.normalizedScore ?? b.rawScore ?? 0) - (a.normalizedScore ?? a.rawScore ?? 0));

        if (candidates.length > 0) {
          const best = candidates[0];
          const action: 'call' | 'put' = best.signal === 'UP' ? 'call' : 'put';
          const candleMultiplier = (signal.expiryDurationSec && signal.timeframe && signal.expiryDurationSec > signal.timeframe) ? 2 : 1;
          const duration = currentTf * candleMultiplier;
          return {
            action,
            reason: `[الانتقاء الذكي]: استراتيجية ${best.strategyName} مؤهلة بنقاط ${best.normalizedScore ?? best.rawScore}%`,
            duration,
            strategyName: best.strategyName,
          };
        }
      }
      return null;
    }

    // Option 4: Specific Selected Quantitative Strategy (from the 26 modular strategies)
    if (signal.strategies && Array.isArray(signal.strategies)) {
      const target = strategyId.toLowerCase().replace(/[^a-z0-9]/g, '');

      // Special handling for legacy compound shortcuts
      if (strategyId === 'rsi_macd') {
        const macd = signal.strategies.find((s) => s.strategyId === 'macd');
        const rsi = signal.strategies.find((s) => s.strategyId === 'rsi' || s.strategyId === 'rsi_momentum');
        const isBull = (macd && (macd.signal === 'UP' || (macd.score ?? 0) > 0)) || (rsi && (rsi.signal === 'UP' || (rsi.score ?? 0) > 0));
        const isBear = (macd && (macd.signal === 'DOWN' || (macd.score ?? 0) < 0)) || (rsi && (rsi.signal === 'DOWN' || (rsi.score ?? 0) < 0));
        const candleMultiplier = (signal.expiryDurationSec && signal.timeframe && signal.expiryDurationSec > signal.timeframe) ? 2 : 1;
        const duration = currentTf * candleMultiplier;
        if (isBull && !isBear) {
          return { action: 'call', reason: 'إشارة صعود مؤكدة من استراتيجية RSI + MACD', duration, strategyName: 'RSI + MACD' };
        }
        if (isBear && !isBull) {
          return { action: 'put', reason: 'إشارة هبوط مؤكدة من استراتيجية RSI + MACD', duration, strategyName: 'RSI + MACD' };
        }
      }

      const strat = signal.strategies.find((s: StrategyResult) => {
        const id = (s.strategyId || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const name = (s.strategyName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        if (target === 'smc' && (id.includes('marketstructure') || name.includes('marketstructure') || id.includes('smc'))) return true;
        if (target === 'bollingerbands' && (id.includes('bollinger') || name.includes('bollinger'))) return true;
        if (target === 'ematrend' && (id.includes('ema') || name.includes('ema'))) return true;
        if (target === 'supportresistance' && (id.includes('support') || name.includes('support'))) return true;
        if (target === 'breakout' && (id.includes('breakout') || name.includes('breakout'))) return true;
        return id === target || name === target || id.includes(target) || target.includes(id) || name.includes(target);
      });

      if (strat && strat.qualified !== false) {
        const isBull =
          strat.signal === 'UP' ||
          (typeof strat.score === 'number' && strat.score > 0);
        const isBear =
          strat.signal === 'DOWN' ||
          (typeof strat.score === 'number' && strat.score < 0);

        const candleMultiplier = (signal.expiryDurationSec && signal.timeframe && signal.expiryDurationSec > signal.timeframe) ? 2 : 1;
        const duration = currentTf * candleMultiplier;

        if (isBull && !isBear) {
          return {
            action: 'call',
            reason: `إشارة صعود من استراتيجية ${strat.strategyName} (نقاط: ${strat.score})`,
            duration,
            strategyName: strat.strategyName,
          };
        }
        if (isBear && !isBull) {
          return {
            action: 'put',
            reason: `إشارة هبوط من استراتيجية ${strat.strategyName} (نقاط: ${strat.score})`,
            duration,
            strategyName: strat.strategyName,
          };
        }
      }
    }

    return null;
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
    this.lastTradeSignalTime = Date.now();

    const targetAsset = this.config.asset || this.poService.getActiveAsset() || 'EURUSD_otc';
    const tf = this.config.timeframe || 60;
    const tradeId = `at_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    try {
      this.addLog('ORDER', 'info', `[CREATED] إنشاء سجل الصفقة المبدئي (${tradeId}) بناء على إشارة: ${reason}`);

      // 1. Calculate Exact Trade Amount
      let calculatedAmount = this.config.baseAmount;
      if (this.config.enableMartingale && this.currentMartingaleStep > 0) {
        const step = Math.min(this.currentMartingaleStep, this.config.maxMartingaleDepth);
        calculatedAmount = this.config.baseAmount * Math.pow(this.config.martingaleMultiplier, step);
      }

      let finalAmount = Math.round(calculatedAmount * 100) / 100;
      finalAmount = Math.max(1.0, Math.min(finalAmount, 1000.0));

      // Balance & Platform Limit Validation Check
      const diag = this.poService.getDiagnostics();
      const currentBalance = diag?.account?.balance;
      if (typeof currentBalance === 'number' && currentBalance > 0 && finalAmount > currentBalance) {
        this.addLog(
          'RISK',
          'warn',
          `⚠️ تم إلغاء الصفقة: الرصيد المتاح ($${currentBalance.toFixed(2)}) غير كافٍ لمبلغ الصفقة المحدد ($${finalAmount.toFixed(2)})`
        );
        return;
      }

      // 2. Dynamic Expiry Duration Determination - Strictly anchored to selected timeframe
      const SUPPORTED_EXPIRIES = [5, 15, 30, 60, 120, 180, 300, 600, 900, 1800, 3600];
      let targetTime = customDuration || tf;
      if (!SUPPORTED_EXPIRIES.includes(targetTime)) {
        targetTime = tf;
      }
      if (targetTime < tf) {
        targetTime = tf;
      }

      // Step A: Instantiate Trade Record in 'CREATED' state
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
      this.addLog('HESITATION', 'info', `🧠 تطبيق التردد البشري: انتظار ${hesitationSec}s لمحاكاة سلوك المتداول البشري...`);

      await new Promise((resolve) => setTimeout(resolve, hesitationSec * 1000));

      if (this.isEmergencyStopped || !this.isRunning) {
        this.addLog('ORDER', 'warn', '[CANCELLED] تم إلغاء الصفقة قبل الإرسال لتفعيل أمر التوقف');
        this.transitionTradeState(tradeId, 'REJECTED', { rejectionReason: 'توقف البوت أثناء فترة الانتظار' });
        return;
      }

      // Pre-click Delay (150-300ms)
      const preClickMs = Math.floor(150 + Math.random() * 150);
      await new Promise((resolve) => setTimeout(resolve, preClickMs));

      // Minimum Candle Count Verification (Strictly No 1M Fallback)
      const candleCount = this.poService.getCandleCount(targetAsset, tf);
      if (candleCount < 15) {
        this.addLog(
          'ORDER',
          'warn',
          `⚠️ تم إلغاء تنفيذ الصفقة: عدد شموع الفريم المحدد (${tf}s) غير كافٍ للتحليل (${candleCount}/15 شمعة مطلوبة).`
        );
        this.transitionTradeState(tradeId, 'REJECTED', { rejectionReason: 'بيانات الشموع للفريم غير كافية' });
        return;
      }

      // Step C: Transition to 'SUBMITTED' right before dispatching over WebSocket
      this.transitionTradeState(tradeId, 'SUBMITTED');
      this.addLog('ORDER', 'info', `[SUBMITTED] إرسال أمر الصفقة إلى خادم المنصة: ${action.toUpperCase()} على ${targetAsset} بمبلغ $${finalAmount} لمدة ${targetTime}s`);

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
        this.transitionTradeState(tradeId, 'REJECTED', {
          rejectionReason: result.error || 'رفض خادم المنصة إتمام الصفقة',
        });
        this.addLog('ORDER', 'error', `[REJECTED] رفض تنفيذ الصفقة من المنصة: ${result.error || 'خطأ غير معروف'}`);
      }
    } catch (err: any) {
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

    // Update in-place: transition from OPEN/SETTLING to COMPLETED
    const matchingTrade = this.trades.find((t) => t.ticketId === dealId || t.id === dealId);
    if (matchingTrade) {
      this.transitionTradeState(matchingTrade.id, 'SETTLING');
      this.transitionTradeState(matchingTrade.id, 'COMPLETED', {
        closePrice: deal.closePrice,
        profit,
        status: isWin ? 'WON' : isDraw ? 'DRAW' : 'LOST',
      });
    }

    // Check risk limits after deal closed
    if (this.dailyPnL <= -Math.abs(this.config.stopLoss)) {
      this.circuitBreakerTripped = true;
      this.circuitBreakerReason = `تم بلوغ حد الخسارة اليومي (-$${Math.abs(this.dailyPnL).toFixed(2)})`;
      this.isRunning = false;
      this.addLog('RISK', 'error', `🛑 قاطع الدائرة مفعل: ${this.circuitBreakerReason}. توقف البوت.`);
    } else if (this.dailyPnL >= Math.abs(this.config.takeProfit)) {
      this.circuitBreakerTripped = true;
      this.circuitBreakerReason = `تم بلوغ هدف الربح اليومي (+$$${this.dailyPnL.toFixed(2)})`;
      this.isRunning = false;
      this.addLog('RISK', 'success', `🏆 قاطع الدائرة مفعل: ${this.circuitBreakerReason}. تم تأمين الأرباح.`);
    }

    this.persistState();
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
    try {
      if (fs.existsSync(STATE_FILE_PATH)) {
        const raw = fs.readFileSync(STATE_FILE_PATH, 'utf-8');
        const data = JSON.parse(raw);
        if (data.config) {
          this.config = {
            ...this.config,
            ...data.config,
            maxAmount: Math.max(1000.0, Number(data.config.maxAmount) || 1000.0, Number(data.config.baseAmount) || 1.0),
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

  // Helper technical math calculations for backtest
  private calculateEmaSimple(values: number[], period: number): number {
    if (values.length < period) return values[values.length - 1] || 0;
    const k = 2 / (period + 1);
    let ema = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
    for (let i = period; i < values.length; i++) {
      ema = values[i] * k + ema * (1 - k);
    }
    return ema;
  }

  private calculateRsiSimple(values: number[], period: number = 14): number | null {
    if (values.length <= period) return null;
    let gains = 0;
    let losses = 0;
    for (let i = 1; i <= period; i++) {
      const diff = values[i] - values[i - 1];
      if (diff >= 0) gains += diff;
      else losses -= diff;
    }
    let avgGain = gains / period;
    let avgLoss = losses / period;
    for (let i = period + 1; i < values.length; i++) {
      const diff = values[i] - values[i - 1];
      avgGain = (avgGain * (period - 1) + (diff > 0 ? diff : 0)) / period;
      avgLoss = (avgLoss * (period - 1) + (diff < 0 ? -diff : 0)) / period;
    }
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - 100 / (1 + rs);
  }

  private calculateBollingerSimple(values: number[], period: number = 20, multiplier: number = 2) {
    if (values.length < period) return null;
    const sub = values.slice(-period);
    const mean = sub.reduce((a, b) => a + b, 0) / period;
    const variance = sub.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / period;
    const stdDev = Math.sqrt(variance);
    return {
      middle: mean,
      upper: mean + multiplier * stdDev,
      lower: mean - multiplier * stdDev,
    };
  }
}
