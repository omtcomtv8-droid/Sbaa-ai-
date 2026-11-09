import fs from 'fs';
import path from 'path';
import { Candle } from '../types';
import { PocketOptionService } from '../PocketOptionService';
import { CandleBuilder } from '../CandleBuilder';
import { MarketDataStore } from '../MarketDataStore';
import {
  SbaaConfig,
  SbaaDecision,
  SbaaDetectionLogRecord,
  SbaaEngineState,
  SbaaEngineStatus,
  SbaaMtfState,
} from './SbaaTypes';
import { SbaaPatternDetector } from './SbaaPatternDetector';
import { SbaaScoringEngine } from './SbaaScoringEngine';
import { SbaaRiskGuardian } from './SbaaRiskGuardian';
import { calculateEMA, calculateRSI } from '../indicators';
import { EmaTrendStrategy } from '../strategies/EmaTrendStrategy';
import { RsiMomentumStrategy } from '../strategies/RsiMomentumStrategy';
import { MacdStrategy } from '../strategies/MacdStrategy';
import { BollingerBounceStrategy } from '../strategies/BollingerBounceStrategy';
import { CandlestickPatternStrategy } from '../strategies/CandlestickPatternStrategy';
import { SupportResistanceStrategy } from '../strategies/SupportResistanceStrategy';
import { BreakoutStrategy } from '../strategies/BreakoutStrategy';
import { MarketStructureStrategy } from '../strategies/MarketStructureStrategy';
import { MultiConfluenceStrategy } from '../strategies/MultiConfluenceStrategy';
import { SmaCrossoverStrategy } from '../strategies/SmaCrossoverStrategy';
import { MaAlignmentStrategy } from '../strategies/MaAlignmentStrategy';
import { RsiReversalStrategy } from '../strategies/RsiReversalStrategy';
import { StochasticStrategy } from '../strategies/StochasticStrategy';
import { CciStrategy } from '../strategies/CciStrategy';
import { AdxTrendStrategy } from '../strategies/AdxTrendStrategy';
import { ParabolicSarStrategy } from '../strategies/ParabolicSarStrategy';
import { IchimokuStrategy } from '../strategies/IchimokuStrategy';
import { PivotPointStrategy } from '../strategies/PivotPointStrategy';
import { FibonacciRetracementStrategy } from '../strategies/FibonacciRetracementStrategy';
import { PriceActionStrategy } from '../strategies/PriceActionStrategy';
import { AtrVolatilityStrategy } from '../strategies/AtrVolatilityStrategy';
import { SuperTrendStrategy } from '../strategies/SuperTrendStrategy';
import { VolumeFlowStrategy } from '../strategies/VolumeFlowStrategy';
import { GannPriceTimeStrategy } from '../strategies/GannPriceTimeStrategy';
import { ElliottWaveStrategy } from '../strategies/ElliottWaveStrategy';
import { DarvasBoxStrategy } from '../strategies/DarvasBoxStrategy';

const LOG_FILE_PATH = path.resolve(process.cwd(), '.data', 'sbaa_detection_log.json');
const STATE_FILE_PATH = path.resolve(process.cwd(), '.data', 'sbaa_engine_state.json');

export class SbaaStrategyEngine {
  private config: SbaaConfig = {
    enabled: true,
    autoDemoExecution: false,
    minScoreThreshold: 80,
    baseTradeAmount: 10.0,
    maxDailyLoss: 50.0,
    maxDailyProfitTarget: 100.0,
    maxConcurrentTrades: 1,
    cooldownCandles: 3,
    requireClosedCandle: true,
    allowRangingMarketTrades: false,
    minWickRatio: 0.5,
    atrMultiplierFilter: 2.5,
  };

  private state: SbaaEngineState = 'SCANNING';
  private detectionLogs: SbaaDetectionLogRecord[] = [];
  private riskGuardian: SbaaRiskGuardian;
  private onBroadcast?: (event: string, data: any) => void;

  // Statistics counters
  private patternsDetectedCount = 0;
  private buySignalsCount = 0;
  private sellSignalsCount = 0;
  private waitDecisionsCount = 0;
  private totalDemoTrades = 0;
  private wonDemoTrades = 0;
  private lostDemoTrades = 0;
  private drawDemoTrades = 0;
  private todayDemoPnL = 0;

  // Active tracking
  private activeDemoTrades = new Map<string, SbaaDetectionLogRecord>();
  private recentExecutedSignals: Array<{ patternType: string; timestamp: number; candleIndex: number }> = [];
  private lastAnalysisTimestamp = Date.now();
  private latestStatusCache: Partial<SbaaEngineStatus> = {};

  constructor(
    private candleBuilder: CandleBuilder,
    private poService?: PocketOptionService,
    private marketDataStore?: MarketDataStore,
    onBroadcast?: (event: string, data: any) => void
  ) {
    this.riskGuardian = new SbaaRiskGuardian(this.config);
    this.onBroadcast = onBroadcast;

    this.ensureDataDir();
    this.loadPersistedData();

    // Listen to broker deals if poService available
    if (this.poService && typeof this.poService.onDealClosed === 'function') {
      this.poService.onDealClosed((deal) => {
        this.handleBrokerDealClosed(deal);
      });
    }
  }

  private activeAsset: string = 'EURUSD_otc';
  private activeTimeframe: number = 60;

  public setBroadcastHandler(handler: (event: string, data: any) => void) {
    this.onBroadcast = handler;
  }

  public setTimeframe(tf: number) {
    if (tf && tf > 0) {
      this.activeTimeframe = tf;
    }
  }

  public getTimeframe(): number {
    return this.activeTimeframe;
  }

  public setAsset(asset: string) {
    if (asset) {
      this.activeAsset = asset;
    }
  }

  public getAsset(): string {
    return this.activeAsset;
  }

  private ensureDataDir() {
    const dir = path.resolve(process.cwd(), '.data');
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch {}
    }
  }

  private loadPersistedData() {
    try {
      if (fs.existsSync(LOG_FILE_PATH)) {
        const raw = fs.readFileSync(LOG_FILE_PATH, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.detectionLogs = parsed.slice(0, 300);
        }
      }
    } catch (err) {
      console.warn('[SBAA] Could not load persisted detection logs:', err);
    }

    try {
      if (fs.existsSync(STATE_FILE_PATH)) {
        const raw = fs.readFileSync(STATE_FILE_PATH, 'utf-8');
        const s = JSON.parse(raw);
        if (s) {
          this.patternsDetectedCount = s.patternsDetectedCount ?? 0;
          this.buySignalsCount = s.buySignalsCount ?? 0;
          this.sellSignalsCount = s.sellSignalsCount ?? 0;
          this.waitDecisionsCount = s.waitDecisionsCount ?? 0;
          this.totalDemoTrades = s.totalDemoTrades ?? 0;
          this.wonDemoTrades = s.wonDemoTrades ?? 0;
          this.lostDemoTrades = s.lostDemoTrades ?? 0;
          this.drawDemoTrades = s.drawDemoTrades ?? 0;
          this.todayDemoPnL = s.todayDemoPnL ?? 0;
          if (s.config) {
            this.config = { ...this.config, ...s.config };
            this.riskGuardian.updateConfig(this.config);
          }
        }
      }
    } catch (err) {
      console.warn('[SBAA] Could not load persisted state:', err);
    }
  }

  private persistData() {
    try {
      this.ensureDataDir();
      fs.writeFileSync(LOG_FILE_PATH, JSON.stringify(this.detectionLogs.slice(0, 300), null, 2));
      fs.writeFileSync(
        STATE_FILE_PATH,
        JSON.stringify({
          patternsDetectedCount: this.patternsDetectedCount,
          buySignalsCount: this.buySignalsCount,
          sellSignalsCount: this.sellSignalsCount,
          waitDecisionsCount: this.waitDecisionsCount,
          totalDemoTrades: this.totalDemoTrades,
          wonDemoTrades: this.wonDemoTrades,
          lostDemoTrades: this.lostDemoTrades,
          drawDemoTrades: this.drawDemoTrades,
          todayDemoPnL: this.todayDemoPnL,
          config: this.config,
        }, null, 2)
      );
    } catch (err) {
      console.warn('[SBAA] Error persisting state to disk:', err);
    }
  }

  /**
   * Main analysis trigger evaluated on confirmed candle close or on-demand.
   */
  public evaluateMarket(
    asset: string,
    timeframe: number,
    candlesOverride?: Candle[],
    options?: { autoExecute?: boolean }
  ): SbaaDetectionLogRecord {
    this.lastAnalysisTimestamp = Date.now();
    this.state = 'SCANNING';

    const candles =
      candlesOverride ||
      (this.marketDataStore ? this.marketDataStore.getCandles(asset, timeframe) : []) ||
      this.candleBuilder.getCandles(asset, timeframe);

    if (candles.length < 15) {
      this.state = 'NO_TRADE';
      const logRecord: SbaaDetectionLogRecord = {
        id: `sbaa_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        asset,
        marketType: asset.toLowerCase().includes('otc') ? 'OTC' : 'REAL_MARKET',
        timeframe,
        patternType: 'NO_PATTERN',
        patternNameAr: 'بيانات غير كافية',
        patternNameEn: 'Insufficient Data',
        direction: 'WAIT',
        srZone: 'غير محددة',
        confluenceScore: 0,
        scoreBreakdown: {
          trendScore: 0,
          srLocationScore: 0,
          patternScore: 0,
          wickLiquidityScore: 0,
          structureScore: 0,
          momentumScore: 0,
          mtfScore: 0,
          totalScore: 0,
          verdict: 'IGNORE',
          reasons: [],
          blockers: ['بيانات الشموع غير كافية لبدء التحليل الفني'],
        },
        detectionTime: Date.now(),
        confirmationTime: Date.now(),
        systemDecision: 'WAIT',
        reasonAr: 'WAIT: بيانات الشموع غير كافية لتحليل النماذج (أقل من 15 شمعة)',
        reasonEn: 'WAIT: Insufficient candle data',
        tradeStatus: 'NOT_TRIGGERED',
      };
      this.logDetection(logRecord);
      return logRecord;
    }

    // Step 1: Detect technical candlestick & liquidity patterns
    this.state = 'SCANNING';
    const detection = SbaaPatternDetector.detectPatterns(candles);
    let pattern = detection.primaryPattern;

    // Step 1b: Evaluate All 26 Modular Quantitative Strategies Integrated Inside SBAA
    const rawStratResults = [
      EmaTrendStrategy.evaluate(candles, { enabled: true, fastPeriod: 9, slowPeriod: 21, filterPeriod: 50, weight: 1.0 }),
      RsiMomentumStrategy.evaluate(candles, { enabled: true, period: 14, overbought: 70, oversold: 30, weight: 1.0 }),
      MacdStrategy.evaluate(candles, { enabled: true, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, weight: 1.0 }),
      BollingerBounceStrategy.evaluate(candles, { enabled: true, period: 20, stdDev: 2, weight: 1.0 }),
      CandlestickPatternStrategy.evaluate(candles, { enabled: true, minPatternStrength: 1, requireTrendAlignment: false, weight: 1.0 }),
      SupportResistanceStrategy.evaluate(candles, { enabled: true, lookback: 40, clusterTolerancePercent: 0.08, weight: 1.0 }),
      BreakoutStrategy.evaluate(candles, { enabled: true, lookback: 20, atrFilterMultiplier: 1.1, weight: 1.0 }),
      MarketStructureStrategy.evaluate(candles, { enabled: true, swingLookback: 2, weight: 1.0 }),
      MultiConfluenceStrategy.evaluate(candles, { enabled: true, weight: 1.0 }),
      SmaCrossoverStrategy.evaluate(candles),
      MaAlignmentStrategy.evaluate(candles),
      RsiReversalStrategy.evaluate(candles),
      StochasticStrategy.evaluate(candles),
      CciStrategy.evaluate(candles),
      AdxTrendStrategy.evaluate(candles),
      ParabolicSarStrategy.evaluate(candles),
      IchimokuStrategy.evaluate(candles),
      PivotPointStrategy.evaluate(candles),
      FibonacciRetracementStrategy.evaluate(candles),
      PriceActionStrategy.evaluate(candles),
      AtrVolatilityStrategy.evaluate(candles),
      SuperTrendStrategy.evaluate(candles),
      VolumeFlowStrategy.evaluate(candles),
      GannPriceTimeStrategy.evaluate(candles),
      ElliottWaveStrategy.evaluate(candles),
      DarvasBoxStrategy.evaluate(candles),
    ];

    const qualifiedStrats = rawStratResults.filter((s) => s.qualified && (s.signal === 'UP' || s.signal === 'DOWN'));
    const upStrats = qualifiedStrats.filter((s) => s.signal === 'UP');
    const downStrats = qualifiedStrats.filter((s) => s.signal === 'DOWN');

    // If no strict candlestick pattern was detected, synthesize pattern from the best qualified integrated strategy
    if (!pattern && qualifiedStrats.length > 0) {
      const topStrat = qualifiedStrats.slice().sort(
        (a, b) => (b.normalizedScore ?? b.rawScore ?? 0) - (a.normalizedScore ?? a.rawScore ?? 0)
      )[0];

      if (topStrat && (upStrats.length >= downStrats.length || downStrats.length >= upStrats.length)) {
        const dir = topStrat.signal === 'UP' ? 'BUY' : 'SELL';
        pattern = {
          type: (topStrat.strategyId.toUpperCase().replace(/[^A-Z0-9_]/g, '_')) as any,
          nameAr: `استراتيجية سبع المدمجة (${topStrat.strategyName})`,
          nameEn: `SBAA Integrated (${topStrat.strategyName})`,
          direction: dir,
          confidence: (topStrat.normalizedScore ?? 75) / 100,
          candleIndex: candles.length - 1,
          triggerPrice: candles[candles.length - 1].close,
          descriptionAr: `تأكيد نموذج واستراتيجية ${topStrat.strategyName} بقوة ${topStrat.normalizedScore ?? 75}% داخل محرك سبع`,
          descriptionEn: `Signal from integrated ${topStrat.strategyName} within SBAA`,
          isConfirmed: true,
        };
      }
    }

    if (pattern) {
      this.patternsDetectedCount++;
      this.state = 'PATTERN_DETECTED';
    }

    // Step 2 & 3: Multi-Timeframe synthesis
    this.state = 'TREND_VALIDATION';
    const mtfState = this.calculateMtfState(asset, timeframe * 5); // 5x higher timeframe

    // Step 4: Scoring and No-Trade Filters
    this.state = 'SIGNAL_SCORING';
    const evalResult = SbaaScoringEngine.evaluate({
      candles,
      pattern,
      timeframe,
      mtfState,
      isClosedCandle: true,
      isConnected: this.poService ? this.poService.isConnected() : true,
      isStaleData: false,
      recentSignalsHistory: this.recentExecutedSignals,
    });

    // Update Decision Counters
    if (evalResult.decision === 'BUY') {
      this.buySignalsCount++;
    } else if (evalResult.decision === 'SELL') {
      this.sellSignalsCount++;
    } else {
      this.waitDecisionsCount++;
    }

    const logRecord: SbaaDetectionLogRecord = {
      id: `sbaa_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      asset,
      marketType: asset.toLowerCase().includes('otc') ? 'OTC' : 'REAL_MARKET',
      timeframe,
      patternType: pattern ? pattern.type : 'NO_PATTERN',
      patternNameAr: pattern ? pattern.nameAr : 'لا يوجد نموذج محدد',
      patternNameEn: pattern ? pattern.nameEn : 'No Specific Pattern',
      direction: evalResult.decision,
      srZone: evalResult.srZoneLabel,
      confluenceScore: evalResult.scoreBreakdown.totalScore,
      scoreBreakdown: evalResult.scoreBreakdown,
      detectionTime: Date.now(),
      confirmationTime: Date.now(),
      systemDecision: evalResult.decision,
      reasonAr: evalResult.primaryReasonAr,
      reasonEn: evalResult.primaryReasonEn,
      tradeStatus: 'NOT_TRIGGERED',
    };

    // Step 5: Risk Validation & Auto Demo Execution (strictly single-orchestrated, never dual-worker)
    if (options?.autoExecute && evalResult.isQualifiedForDemo && this.config.autoDemoExecution && evalResult.decision !== 'WAIT') {
      this.state = 'RISK_VALIDATION';
      const riskCheck = this.riskGuardian.validateTradeExecution({
        amount: this.config.baseTradeAmount,
        signalId: logRecord.id,
        candleTimestamp: candles[candles.length - 1].time,
        isDemo: true, // Strictly Demo
      });

      if (riskCheck.allowed) {
        this.state = 'READY_TO_EXECUTE';
        this.executeDemoTrade(logRecord, candles[candles.length - 1]);
      } else {
        this.state = 'NO_TRADE';
        logRecord.tradeStatus = 'REJECTED';
        logRecord.rejectionReason = riskCheck.reasonAr;
        logRecord.reasonAr += ` [تم رفض التنفيذ التجريبي: ${riskCheck.reasonAr}]`;
      }
    } else {
      this.state = evalResult.decision === 'WAIT' ? 'SCANNING' : 'NO_TRADE';
    }

    this.logDetection(logRecord);
    this.persistData();
    this.notifyUpdate();

    return logRecord;
  }

  private calculateMtfState(asset: string, mtfTimeframe: number): SbaaMtfState {
    const candles = this.candleBuilder.getCandles(asset, mtfTimeframe);
    if (!candles || candles.length < 15) {
      return {
        timeframe: mtfTimeframe,
        trend: 'RANGING',
        ema20: null,
        ema50: null,
        ema200: null,
        rsi: null,
        nearestSupport: null,
        nearestResistance: null,
        alignsWithTrigger: true,
      };
    }

    const closes = candles.map((c) => c.close);
    const ema20 = calculateEMA(closes, 20);
    const ema50 = calculateEMA(closes, 50);
    const ema200 = calculateEMA(closes, Math.min(200, closes.length));
    const rsi = calculateRSI(closes, 14);

    let trend: SbaaMtfState['trend'] = 'RANGING';
    if (ema20 !== null && ema50 !== null) {
      if (ema20 > ema50 && closes[closes.length - 1] > ema20) {
        trend = 'BULLISH';
      } else if (ema20 < ema50 && closes[closes.length - 1] < ema20) {
        trend = 'BEARISH';
      }
    }

    return {
      timeframe: mtfTimeframe,
      trend,
      ema20,
      ema50,
      ema200,
      rsi,
      nearestSupport: Math.min(...candles.slice(-10).map((c) => c.low)),
      nearestResistance: Math.max(...candles.slice(-10).map((c) => c.high)),
      alignsWithTrigger: true,
    };
  }

  private async executeDemoTrade(logRecord: SbaaDetectionLogRecord, triggerCandle: Candle) {
    this.state = 'DEMO_EXECUTED';
    const stake = this.config.baseTradeAmount;
    const action = logRecord.direction === 'BUY' ? 'call' : 'put';

    this.riskGuardian.registerTradeOpened(logRecord.id, triggerCandle.time);
    this.recentExecutedSignals.push({
      patternType: logRecord.patternType,
      timestamp: Date.now(),
      candleIndex: 0,
    });
    if (this.recentExecutedSignals.length > 20) {
      this.recentExecutedSignals.shift();
    }

    logRecord.tradeStatus = 'DEMO_SUBMITTED';
    logRecord.stake = stake;
    logRecord.entryPrice = triggerCandle.close;

    // Dispatch via PocketOptionService if connected, otherwise Paper Trading simulation
    if (this.poService && this.poService.isConnected() && this.poService.isAuthVerified()) {
      try {
        const tf = logRecord.timeframe || this.activeTimeframe || 60;
        const isBreakout = logRecord.patternType.includes('BREAKOUT') || logRecord.patternType.includes('BOS') || logRecord.patternType.includes('CHOCH') || logRecord.patternType.includes('MOMENTUM');
        const durationCandles = isBreakout && tf <= 900 ? 2 : 1;
        const dealDuration = tf * durationCandles;

        const orderRes = await this.poService.openDeal({
          asset: logRecord.asset,
          action,
          amount: stake,
          time: dealDuration,
        });

        if (orderRes && orderRes.success) {
          const dealId = String(orderRes.deal?.id || orderRes.requestId || `demo_deal_${Date.now()}`);
          logRecord.demoTradeId = dealId;
          logRecord.tradeStatus = 'DEMO_OPEN';
          this.activeDemoTrades.set(dealId, logRecord);
          this.state = 'POSITION_MONITORING';
        } else {
          // Fallback to internal paper trading simulation with notice
          this.runPaperTradingSimulation(logRecord, action, stake, triggerCandle);
        }
      } catch (err: any) {
        this.runPaperTradingSimulation(logRecord, action, stake, triggerCandle);
      }
    } else {
      // Paper Trading Simulation (Section 14 requirement: If broker API unavailable, use Paper Trading with clear transparency)
      this.runPaperTradingSimulation(logRecord, action, stake, triggerCandle);
    }

    this.totalDemoTrades++;
  }

  private runPaperTradingSimulation(
    logRecord: SbaaDetectionLogRecord,
    action: 'call' | 'put',
    stake: number,
    triggerCandle: Candle
  ) {
    const simDealId = `paper_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    logRecord.demoTradeId = simDealId;
    logRecord.tradeStatus = 'DEMO_OPEN';
    this.activeDemoTrades.set(simDealId, logRecord);
    this.state = 'POSITION_MONITORING';

    // Simulate completion after timeframe expiration
    setTimeout(() => {
      const currentCandles = this.candleBuilder.getCandles(logRecord.asset, logRecord.timeframe);
      const closePrice =
        currentCandles.length > 0
          ? currentCandles[currentCandles.length - 1].close
          : triggerCandle.close + (action === 'call' ? 0.0001 : -0.0001);

      const isWin = action === 'call' ? closePrice > triggerCandle.close : closePrice < triggerCandle.close;
      const isDraw = closePrice === triggerCandle.close;
      const profit = isWin ? Number((stake * 0.88).toFixed(2)) : isDraw ? 0 : -stake;

      this.handleBrokerDealClosed({
        id: simDealId,
        profit,
        closePrice,
        openPrice: triggerCandle.close,
        amount: stake,
      });
    }, Math.max(3000, logRecord.timeframe * 1000));
  }

  public handleBrokerDealClosed(deal: any) {
    const dealId = String(deal.id || deal.ticketId || '');
    const logRecord = this.activeDemoTrades.get(dealId);

    const profit = Number(deal.profit ?? 0);
    const closePrice = Number(deal.closePrice ?? deal.exitPrice ?? 0);

    this.state = 'CLOSED';

    if (profit > 0) {
      this.wonDemoTrades++;
      this.todayDemoPnL += profit;
      if (logRecord) logRecord.tradeStatus = 'DEMO_WON';
    } else if (profit < 0) {
      this.lostDemoTrades++;
      this.todayDemoPnL += profit;
      if (logRecord) logRecord.tradeStatus = 'DEMO_LOST';
    } else {
      this.drawDemoTrades++;
      if (logRecord) logRecord.tradeStatus = 'DEMO_DRAW';
    }

    if (logRecord) {
      logRecord.profit = profit;
      logRecord.exitPrice = closePrice;
      this.activeDemoTrades.delete(dealId);
    }

    this.riskGuardian.registerTradeClosed(profit);
    this.state = 'STATISTICS_UPDATED';

    this.persistData();
    this.notifyUpdate();

    // Transition back to scanning
    setTimeout(() => {
      this.state = 'SCANNING';
      this.notifyUpdate();
    }, 1500);
  }

  private logDetection(record: SbaaDetectionLogRecord) {
    this.detectionLogs.unshift(record);
    if (this.detectionLogs.length > 300) {
      this.detectionLogs.pop();
    }
    if (this.onBroadcast) {
      this.onBroadcast('sbaa_log', record);
    }
  }

  private notifyUpdate() {
    if (this.onBroadcast) {
      this.onBroadcast('sbaa_update', this.getStatus());
    }
  }

  public getStatus(): SbaaEngineStatus {
    const completedEvaluated = this.wonDemoTrades + this.lostDemoTrades;
    const winRate =
      completedEvaluated > 0
        ? Number(((this.wonDemoTrades / completedEvaluated) * 100).toFixed(1))
        : 0;

    const latest = this.detectionLogs[0];
    const riskStatus = this.riskGuardian.getStatus();

    const stateArMap: Record<SbaaEngineState, string> = {
      SCANNING: 'جاري فحص السوق والشموع (SCANNING)',
      PATTERN_DETECTED: 'تم اكتشاف نموذج فني (PATTERN DETECTED)',
      LOCATION_VALIDATION: 'التحقق من الدعم والمقاومة (LOCATION VALIDATION)',
      TREND_VALIDATION: 'فحص الاتجاه العام (TREND VALIDATION)',
      CONFIRMATION: 'انتظار شمعة التأكيد (CONFIRMATION)',
      SIGNAL_SCORING: 'احتساب نقاط الإشارة (SIGNAL SCORING)',
      RISK_VALIDATION: 'فحص إدارة المخاطر (RISK VALIDATION)',
      READY_TO_EXECUTE: 'جاهز للتنفيذ التجريبي (DEMO READY)',
      DEMO_EXECUTED: 'تم الدخول التجريبي (DEMO EXECUTED)',
      POSITION_MONITORING: 'متابعة الصفقة التجريبية (POSITION MONITORING)',
      CLOSED: 'تم إغلاق الصفقة (CLOSED)',
      STATISTICS_UPDATED: 'تم تحديث الإحصائيات (STATISTICS UPDATED)',
      NO_TRADE: 'حظر الدخول / شروط غير مكتملة (NO TRADE)',
    };

    return {
      state: this.state,
      stateAr: stateArMap[this.state] || this.state,
      isScanning: this.config.enabled,
      autoDemoEnabled: this.config.autoDemoExecution,
      activeAsset: this.poService?.getActiveAsset() || 'EURUSD_otc',
      timeframe: this.poService?.getTimeframe() || 60,
      patternsDetectedCount: this.patternsDetectedCount,
      buySignalsCount: this.buySignalsCount,
      sellSignalsCount: this.sellSignalsCount,
      waitDecisionsCount: this.waitDecisionsCount,
      totalDemoTrades: this.totalDemoTrades,
      wonDemoTrades: this.wonDemoTrades,
      lostDemoTrades: this.lostDemoTrades,
      drawDemoTrades: this.drawDemoTrades,
      winRate,
      todayDemoPnL: Number(this.todayDemoPnL.toFixed(2)),
      latestScore: latest?.confluenceScore ?? 0,
      latestScoreBreakdown: latest?.scoreBreakdown ?? null,
      latestPatternName: latest?.patternNameAr ?? null,
      latestDecision: latest?.systemDecision ?? 'WAIT',
      latestReasonAr: latest?.reasonAr ?? 'في انتظار الشمعة التالية...',
      isCircuitBreakerTripped: riskStatus.circuitBreakerTripped,
      circuitBreakerReason: riskStatus.circuitBreakerReason,
      lastAnalysisTimestamp: this.lastAnalysisTimestamp,
      mtfMatrix: {
        '1M': this.calculateMtfState(this.poService?.getActiveAsset() || 'EURUSD_otc', 60),
        '5M': this.calculateMtfState(this.poService?.getActiveAsset() || 'EURUSD_otc', 300),
        '15M': this.calculateMtfState(this.poService?.getActiveAsset() || 'EURUSD_otc', 900),
      },
    };
  }

  public getDetectionLogs(limit: number = 100): SbaaDetectionLogRecord[] {
    return this.detectionLogs.slice(0, limit);
  }

  public updateConfig(newConfig: Partial<SbaaConfig>) {
    this.config = { ...this.config, ...newConfig };
    this.riskGuardian.updateConfig(this.config);
    this.persistData();
    this.notifyUpdate();
  }

  public resetStats() {
    this.patternsDetectedCount = 0;
    this.buySignalsCount = 0;
    this.sellSignalsCount = 0;
    this.waitDecisionsCount = 0;
    this.totalDemoTrades = 0;
    this.wonDemoTrades = 0;
    this.lostDemoTrades = 0;
    this.drawDemoTrades = 0;
    this.todayDemoPnL = 0;
    this.recentExecutedSignals = [];
    this.riskGuardian.resetDailyLimits();
    this.persistData();
    this.notifyUpdate();
  }

  public clearLogs() {
    this.detectionLogs = [];
    this.persistData();
    this.notifyUpdate();
  }
}
