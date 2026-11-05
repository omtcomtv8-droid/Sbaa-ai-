import { Candle } from '../types';

export type SbaaDecision = 'BUY' | 'SELL' | 'WAIT';

export type SbaaEngineState =
  | 'SCANNING'
  | 'PATTERN_DETECTED'
  | 'LOCATION_VALIDATION'
  | 'TREND_VALIDATION'
  | 'CONFIRMATION'
  | 'SIGNAL_SCORING'
  | 'RISK_VALIDATION'
  | 'READY_TO_EXECUTE'
  | 'DEMO_EXECUTED'
  | 'POSITION_MONITORING'
  | 'CLOSED'
  | 'STATISTICS_UPDATED'
  | 'NO_TRADE';

export type SbaaPatternType =
  // Section 2: Candlestick Patterns
  | 'BULLISH_PIN_BAR'
  | 'BEARISH_PIN_BAR'
  | 'TWEEZER_BOTTOM'
  | 'TWEEZER_TOP'
  | 'MORNING_STAR'
  | 'EVENING_STAR'
  | 'PIERCING_LINE'
  | 'DARK_CLOUD_COVER'
  | 'BULLISH_HARAMI'
  | 'BEARISH_HARAMI'
  | 'INSIDE_BAR_BREAKOUT_BUY'
  | 'INSIDE_BAR_BREAKOUT_SELL'
  | 'BULLISH_OUTSIDE_BAR'
  | 'BEARISH_OUTSIDE_BAR'
  | 'THREE_WHITE_SOLDIERS'
  | 'THREE_BLACK_CROWS'
  | 'BULLISH_ENGULFING'
  | 'BEARISH_ENGULFING'
  // Section 3: Liquidity & Structure Patterns
  | 'LIQUIDITY_SWEEP_HIGH'
  | 'LIQUIDITY_SWEEP_LOW'
  | 'BOS_BULLISH'
  | 'BOS_BEARISH'
  | 'CHOCH_BULLISH'
  | 'CHOCH_BEARISH'
  | 'BREAK_AND_RETEST_BUY'
  | 'BREAK_AND_RETEST_SELL'
  | 'FAKE_BREAKOUT_BUY'
  | 'FAKE_BREAKOUT_SELL'
  | 'SR_FLIP_SUPPORT'
  | 'SR_FLIP_RESISTANCE'
  // Section 4: Momentum & Compression
  | 'MOMENTUM_BREAKOUT_BUY'
  | 'MOMENTUM_BREAKOUT_SELL'
  | 'BOLLINGER_SQUEEZE_BUY'
  | 'BOLLINGER_SQUEEZE_SELL'
  | 'RSI_DIVERGENCE_BULLISH'
  | 'RSI_DIVERGENCE_BEARISH'
  | 'PULLBACK_CONTINUATION_BUY'
  | 'PULLBACK_CONTINUATION_SELL';

export interface SbaaDetectedPattern {
  type: SbaaPatternType;
  nameAr: string;
  nameEn: string;
  direction: 'BUY' | 'SELL';
  confidence: number; // 0 to 1
  candleIndex: number;
  triggerPrice: number;
  descriptionAr: string;
  descriptionEn: string;
  isConfirmed: boolean;
}

export interface SbaaScoreBreakdown {
  trendScore: number;         // Max 15
  srLocationScore: number;    // Max 20
  patternScore: number;       // Max 15
  wickLiquidityScore: number; // Max 15
  structureScore: number;     // Max 15
  momentumScore: number;      // Max 10
  mtfScore: number;           // Max 10
  totalScore: number;         // Max 100
  verdict: 'IGNORE' | 'WATCH_ONLY' | 'WEAK_SIGNAL' | 'DEMO_QUALIFIED' | 'STRONG_CONFLUENCE';
  reasons: string[];
  blockers: string[];
}

export interface SbaaDetectionLogRecord {
  id: string;
  asset: string;
  marketType: 'OTC' | 'REAL_MARKET';
  timeframe: number;
  patternType: SbaaPatternType | 'NO_PATTERN';
  patternNameAr: string;
  patternNameEn: string;
  direction: SbaaDecision;
  srZone: string;
  confluenceScore: number;
  scoreBreakdown: SbaaScoreBreakdown;
  detectionTime: number;
  confirmationTime: number;
  systemDecision: SbaaDecision;
  reasonAr: string;
  reasonEn: string;
  tradeStatus: 'NOT_TRIGGERED' | 'DEMO_SUBMITTED' | 'DEMO_OPEN' | 'DEMO_WON' | 'DEMO_LOST' | 'DEMO_DRAW' | 'REJECTED';
  rejectionReason?: string;
  demoTradeId?: string;
  entryPrice?: number;
  exitPrice?: number;
  stake?: number;
  profit?: number;
}

export interface SbaaMtfState {
  timeframe: number;
  trend: 'BULLISH' | 'BEARISH' | 'RANGING';
  ema20: number | null;
  ema50: number | null;
  ema200: number | null;
  rsi: number | null;
  nearestSupport: number | null;
  nearestResistance: number | null;
  alignsWithTrigger: boolean;
}

export interface SbaaConfig {
  enabled: boolean;
  autoDemoExecution: boolean;
  minScoreThreshold: number; // Default 80
  baseTradeAmount: number;    // Default 5.0
  maxDailyLoss: number;       // Default 30.0 (Daily Stop Loss in $)
  maxDailyProfitTarget: number;// Default 60.0 (Daily Take Profit in $)
  maxConcurrentTrades: number;// Default 1
  cooldownCandles: number;    // Default 3 candles
  requireClosedCandle: boolean; // Default true
  allowRangingMarketTrades: boolean; // Default false (avoid middle of range)
  minWickRatio: number;       // Default 0.5
  atrMultiplierFilter: number;// Default 2.5
}

export interface SbaaEngineStatus {
  state: SbaaEngineState;
  stateAr: string;
  isScanning: boolean;
  autoDemoEnabled: boolean;
  activeAsset: string;
  timeframe: number;
  patternsDetectedCount: number;
  buySignalsCount: number;
  sellSignalsCount: number;
  waitDecisionsCount: number;
  totalDemoTrades: number;
  wonDemoTrades: number;
  lostDemoTrades: number;
  drawDemoTrades: number;
  winRate: number;
  todayDemoPnL: number;
  latestScore: number;
  latestScoreBreakdown: SbaaScoreBreakdown | null;
  latestPatternName: string | null;
  latestDecision: SbaaDecision;
  latestReasonAr: string;
  isCircuitBreakerTripped: boolean;
  circuitBreakerReason?: string;
  lastAnalysisTimestamp: number;
  mtfMatrix: Record<string, SbaaMtfState>;
}
