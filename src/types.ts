export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';

export type AccountStatus =
  | 'UNKNOWN'
  | 'LOADING'
  | 'AUTHENTICATED'
  | 'READY'
  | 'LIVE'
  | 'STALE'
  | 'INVALID'
  | 'EXPIRED'
  | 'UNAVAILABLE'
  | 'DISCONNECTED';

export type BalanceStatus = 'LIVE' | 'STALE' | 'UNAVAILABLE' | 'INVALID';

export type AccountSource =
  | 'POCKET_OPTION_AUTHENTICATED'
  | 'POCKET_OPTION_PUBLIC_DEMO'
  | 'CACHED'
  | 'UNAVAILABLE'
  | 'NONE';

export type OverallConnectionState =
  | 'DISCONNECTED'
  | 'CONNECTING'
  | 'SOCKET_CONNECTED'
  | 'ENGINE_IO_READY'
  | 'SOCKET_IO_READY'
  | 'AUTHENTICATING'
  | 'AUTHENTICATED'
  | 'ACCOUNT_READY'
  | 'MARKET_DATA_READY'
  | 'STRATEGY_READY'
  | 'READY'
  | 'SYNCING'
  | 'LIVE'
  | 'STALE'
  | 'CONNECTION_LOST'
  | 'RECONNECTING'
  | 'AUTH_FAILED'
  | 'ERROR';

export interface SubsystemStatus {
  websocket: 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';
  auth: 'none' | 'pending' | 'success' | 'failed';
  account: AccountStatus;
  assets: 'waiting' | 'loaded' | 'unavailable';
  marketData: 'waiting' | 'live' | 'stale' | 'unavailable' | 'disconnected';
  candles: 'waiting' | 'building' | 'live' | 'stale' | 'stopped';
  strategy: 'wait' | 'ready' | 'locked';
  overall: OverallConnectionState;
}

export interface AccountInfo {
  status: AccountStatus;
  balance: number | null;
  balanceStatus: BalanceStatus;
  currency: string;
  isDemo: boolean;
  uid?: string | number | null;
  uidMasked: string | null;
  lastUpdated: number | null;
  connectionId: string | null;
  source: AccountSource;
  lastKnownBalance?: number | null;
  lastKnownBalanceTimestamp?: number | null;
  staleSeconds?: number;
}

export interface AssetInfo {
  id: number;
  asset: string;
  label: string;
  type: string;
  digits: number;
  payout: number;
  is_otc: boolean;
  active: boolean;
}

export interface MarketTick {
  asset: string;
  timestamp: number;
  price: number;
  receivedAt: number;
}

export interface Candle {
  candleId?: string; // Deterministic unique identity: asset:timeframe:openTime
  asset: string;
  timeframe: number;
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  isClosed: boolean;
  source?: string;
}

export function buildCandleId(asset: string, timeframe: number, openTime: number): string {
  let sec = Number(openTime);
  if (sec > 1e11) sec = Math.floor(sec / 1000);
  sec = Math.floor(sec);
  return `${(asset || '').toLowerCase()}:${timeframe}:${sec}`;
}

export function getCandleOpenTime(timestamp: number, timeframe: number): number {
  let sec = Number(timestamp);
  if (sec > 1e11) sec = Math.floor(sec / 1000);
  sec = Math.floor(sec);
  const tf = Number(timeframe) || 60;
  return Math.floor(sec / tf) * tf;
}

export type MarketRegime =
  | 'TRENDING_UP'
  | 'TRENDING_DOWN'
  | 'RANGING'
  | 'HIGH_VOLATILITY'
  | 'LOW_VOLATILITY'
  | 'UNCERTAIN';

export interface DetectedPattern {
  name: string;
  bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  strength: number; // 1 to 3
  description: string;
  candleTimestamp: number;
}

export interface SupportResistanceLevel {
  price: number;
  type: 'SUPPORT' | 'RESISTANCE';
  touches: number;
  strength: number;
  distance: number;
  distancePercent: number;
}

export interface MarketStructure {
  state: 'BULLISH_STRUCTURE' | 'BEARISH_STRUCTURE' | 'RANGING_STRUCTURE' | 'UNCERTAIN';
  lastSwingHigh: number | null;
  lastSwingLow: number | null;
  details: string;
}

export interface VolatilityMetrics {
  currentVolatility: number;
  volatilityShift: number;
  baselineVolatility: number;
  highPrice: number;
  lowPrice: number;
  spreadPercent: number;
  tickVelocity: number;
  ticksAnalyzed: number;
  threshold: number;
  isExceeded: boolean;
  status: 'LOW' | 'NORMAL' | 'ELEVATED' | 'HIGH' | 'CRITICAL';
  updatedAt: number;
}

export interface VolatilityAlertState {
  isExceeded: boolean;
  currentVolatility: number;
  threshold: number;
  asset: string;
  timestamp: number;
  spreadPercent: number;
  shiftPercent: number;
}

export interface IndicatorMetrics {
  rsi: number | null;
  emaFast: number | null;
  emaSlow: number | null;
  sma: number | null;
  ema9?: number | null;
  ema21?: number | null;
  sma20?: number | null;
  sma50?: number | null;
  bollinger: {
    upper: number;
    middle: number;
    lower: number;
    bandwidth: number;
    percentB: number;
  } | null;
  macd: {
    macd: number;
    signal: number;
    histogram: number;
  } | null;
  atr: number | null;
  atrAverage: number | null;
  volatilityState: 'HIGH' | 'NORMAL' | 'LOW';
  adx: {
    adx: number;
    plusDI: number;
    minusDI: number;
    trendStrength: 'TRENDING' | 'WEAK_TREND' | 'RANGING';
  } | null;
  stochastic: {
    k: number;
    d: number;
  } | null;
  momentumROC: number | null;
  highestHigh: number | null;
  lowestLow: number | null;
  pattern: DetectedPattern | null;
  sentiment: number | null;
  // State Machine & Diagnostics
  engineState?: 'CONNECTING' | 'LOADING_HISTORY' | 'COLLECTING_DATA' | 'CALCULATING' | 'READY' | 'ERROR' | 'DATA_NOT_READY';
  engineMessage?: string;
  closedCandlesCount?: number;
  historicalCandlesCount?: number;
  requiredCandlesCount?: number;
  dataSource?: string;
  webSocketStatus?: string;
  currentCandleStatus?: 'ACTIVE' | 'FINALIZING' | 'NONE';
  lastCandleTimestamp?: number | null;
  lastCalculationTime?: number | null;
  validationErrors?: string[];
  indicatorStatuses?: Record<string, any>;
  crossovers?: Record<string, any>;
}

export type SignalType = 'UP' | 'DOWN' | 'WAIT';

export type StrategyName =
  | 'confluence'
  | 'ema_trend'
  | 'sma_crossover'
  | 'ma_alignment'
  | 'rsi_momentum'
  | 'rsi_reversal'
  | 'rsi_reversion'
  | 'macd'
  | 'bollinger_bounce'
  | 'stochastic'
  | 'cci'
  | 'adx_trend'
  | 'atr_volatility'
  | 'parabolic_sar'
  | 'ichimoku'
  | 'pivot_point'
  | 'fibonacci'
  | 'price_action'
  | 'candlestick'
  | 'support_resistance'
  | 'breakout'
  | 'market_structure'
  | 'gann_price_time'
  | 'elliott_wave'
  | 'darvas_box'
  | string;

export type StrategyCalculationStatus =
  | 'READY'
  | 'INSUFFICIENT_DATA'
  | 'CALCULATING'
  | 'WAITING_FOR_DATA'
  | 'STALE'
  | 'ERROR'
  | 'DISABLED';

export interface StrategyEvidence {
  condition: string;
  actual: string;
  result: boolean;
  direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  weight: number;
}

export interface StrategyContext {
  symbol: string;
  timeframe: number;
  candles: Candle[];
  currentCandle: Candle | null;
  previousCandle: Candle | null;
  connectionId?: string | null;
  generation?: number;
  lastTickTimestamp: number;
  lastCandleTimestamp: number;
  dataFreshness: number;
  currentPrice: number;
}

export interface StrategyCondition {
  name: string;
  satisfied: boolean;
  weight: number;
  isMandatory?: boolean;
}

export type SignalEngineState =
  | 'IDLE'
  | 'WAITING'
  | 'ANALYZING'
  | 'VALIDATING'
  | 'CONFIRMED_UP'
  | 'CONFIRMED_DOWN'
  | 'ACTIVE'
  | 'EXPIRED';

export type SignalStateMachineState =
  | 'IDLE'
  | 'WAITING'
  | 'ANALYZING'
  | 'WAITING_FOR_SETUP'
  | 'CONDITIONS_CHECKING'
  | 'VALIDATING'
  | 'SETUP_CONFIRMED'
  | 'CONFIRMED_UP'
  | 'CONFIRMED_DOWN'
  | 'SIGNAL_GENERATED'
  | 'ACTIVE'
  | 'EXPIRED';

export type AnalysisMode = 'CLOSED_CANDLE' | 'INTRABAR';

export interface CandleAnalysisSnapshot {
  id: string;
  symbol: string;
  timeframe: number;
  candleTimestamp: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  isClosed: boolean;
  indicatorSnapshot: Record<string, number | string | null>;
  strategyResults: StrategyResult[];
  bullishScore: number;
  bearishScore: number;
  confluence: number;
  activeStrategiesCount: number;
  confirmingStrategiesCount: number;
  stateMachineState: SignalStateMachineState;
  finalState: 'UP' | 'DOWN' | 'WAIT';
  reasons: string[];
  conflictReason?: string | null;
  evaluatedAt: number;
}

export interface StrategyCondition {
  id?: string;
  name: string;
  satisfied: boolean;
  weight: number;
  isMandatory?: boolean;
  actual?: string;
  required?: string;
}

export interface StrategyResult {
  strategyId: string;
  strategyName: string;
  symbol?: string;
  timeframe?: number;
  signal: SignalType;
  direction?: 'UP' | 'DOWN' | 'WAIT' | 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  rawScore?: number;
  score: number; // positive for UP, negative for DOWN, 0 for WAIT
  normalizedScore?: number | null; // 50% -> 100% for qualified, or null / below threshold
  bullishScore?: number | null;
  bearishScore?: number | null;
  qualified?: boolean;
  mandatoryConditionsPassed?: number;
  mandatoryConditionsTotal?: number;
  supportingConditionsPassed?: number;
  supportingConditionsTotal?: number;
  weight: number;
  reasons: string[];
  blockerReasons?: string[];
  candleTimestamp: number;
  calculationTimestamp?: number;
  dataValid: boolean;
  status?: StrategyCalculationStatus;
  confidence?: number | null;
  percentage?: number | null;
  conditions?: StrategyCondition[];
  evidence?: StrategyEvidence[];
  indicatorValues?: Record<string, number | string | null>;
  triggerCandle?: Candle | null;
  timestamp?: number;
  dataFreshness?: number;
  connectionId?: string | null;
  generation?: number;
  enabled?: boolean;
  gannData?: GannAnalysisData;
  elliottData?: ElliottWaveData;
  darvasData?: DarvasBoxData;
}

export interface SignalDecision {
  signal: 'UP' | 'DOWN' | 'WAIT';
  eligible: boolean;
  confidence: number;
  blockingReasons: string[];
  supportingStrategies: SupportingFactor[] | string[];
  opposingStrategies: OpposingFactor[] | string[];
}

export interface SignalEvidenceItem {
  indicator: string;
  value: string;
  interpretation: string;
  status: 'SUPPORTIVE' | 'CONTRADICTORY' | 'NEUTRAL';
}

export interface SupportingFactor {
  strategyId: string;
  name: string;
  percentage: number;
  weight: number;
  primaryFactor: string;
}

export interface OpposingFactor {
  strategyId: string;
  name: string;
  signal: 'UP' | 'DOWN' | 'WAIT';
  factor: string;
}

export interface SignalExplanation {
  verdictTitle: string;
  summaryRationale: string;
  direction: 'UP' | 'DOWN' | 'WAIT';
  confidencePercent: number;
  confluenceRatio: string;
  marketRegime: string;
  technicalEvidence: SignalEvidenceItem[];
  supportingStrategies: SupportingFactor[];
  opposingStrategies: OpposingFactor[];
  candleContext: {
    lastClose: number;
    candlePattern: string;
    volatilityState: string;
    antiRepaintingNote: string;
  };
  waitReasons?: string[];
  unlockRequirements?: string[];
}

export interface SignalValidation {
  thresholdPassed: boolean;
  candleConfirmed: boolean;
  directionConfirmed: boolean;
  conflictDetected: boolean;
  dataFresh: boolean;
  validationState: 'PENDING' | 'VALIDATING' | 'PASSED' | 'FAILED';
}

export interface SignalCandleAnalysis {
  isAvailable?: boolean;
  direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'UNAVAILABLE' | 'UNKNOWN';
  pattern: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  timestamp: number | string | null;
  bodySize: number | null;
  upperWick: number | null;
  lowerWick: number | null;
  totalRange: number | null;
  bodyRatio: number | null;
  isForming?: boolean;
  statusText?: string;
}

export interface SignalAuditTrail {
  timestamp: number;
  symbol: string;
  timeframe: number;
  strategy: string;
  selectedThreshold?: number;
  actualConfidence: number;
  direction: 'UP' | 'DOWN' | 'WAIT';
  candleDirection: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  candlePattern: string;
  indicatorValues: Record<string, number | string | null>;
  passedConditions: string[];
  failedConditions: string[];
  conflicts: string[];
  dataStatus: string;
  finalDecision: string;
}

export interface Signal {
  id: string;
  asset: string;
  symbol?: string;
  timeframe: number;
  type: SignalType;
  direction?: 'UP' | 'DOWN' | 'WAIT';
  strategy?: string;
  strength: number;
  confidence: number;
  actualConfidence?: number;
  signalGrade?: 'GRADE_A_PLUS' | 'GRADE_A' | 'GRADE_B' | 'WAIT';
  winProbability?: number;
  selectedThreshold?: number; // Legacy optional
  score: number;
  confirmations: number;
  totalStrategies: number;
  marketRegime: MarketRegime;
  regime?: MarketRegime;
  dataStatus: 'LIVE' | 'STALE' | 'INITIALIZING' | 'ERROR' | 'OFFLINE';
  reason: string;
  details: string[];
  reasons?: string[];
  price: number;
  entryPrice?: number;
  timestamp: number;
  candleTimestamp: number;
  strategies: StrategyResult[];
  explanation?: SignalExplanation;
  indicators?: IndicatorMetrics;
  srLevels?: SupportResistanceLevel[];
  conflictProtectionActive?: boolean;
  netScore?: number;
  upScore?: number;
  downScore?: number;
  expiryRecommendation: string;
  expiryDurationSec?: number;
  expiresAt?: number;
  remainingSeconds?: number;
  status: 'ACTIVE' | 'EXPIRED' | 'WON' | 'LOST' | 'PENDING' | 'CONFIRMED' | 'VALIDATING';
  validation?: SignalValidation;
  candle?: SignalCandleAnalysis;
  auditTrail?: SignalAuditTrail;
  resultPrice?: number;
  evaluatedAt?: number;
  confluence?: number;
  triggerCandle?: Candle | null;
  indicatorSnapshot?: Record<string, number | string | null>;
  analysisMode?: AnalysisMode;
  stateMachineState?: SignalStateMachineState;
  engineState?: SignalEngineState;
  reasonCode?: string;
  candidateDirection?: 'UP' | 'DOWN' | 'WAIT';
  candidateConfidence?: number;
  analysisVersion?: number;
  signalTimestamp?: number;
  blockedReasons?: string[];
  blockingReasons?: string[];
  passedConditions?: string[];
  primaryReason?: string;
  decision?: FinalSignalDecision;
  auditSnapshot?: SignalAuditSnapshot;
  snapshot?: AnalysisSnapshot;
  scoreLabel?: string;
  signalScore?: number;
  gannData?: GannAnalysisData;
  elliottData?: ElliottWaveData;
  darvasData?: DarvasBoxData;
}

export interface AnalysisSnapshot {
  id?: string;
  symbol: string;
  timeframe: number;
  candleTimestamp: number | null;
  candleState: 'FORMING' | 'CLOSED' | 'CONFIRMED';
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  indicatorValues: Record<string, number | string | null>;
  strategyResults: StrategyResult[];
  conditions: StrategyCondition[];
  confluence: number;
  dataFreshness: number;
  analysisTimestamp: number;
  connectionId?: string | null;
  generation?: number;
}

export interface FinalSignalDecision {
  signal: 'UP' | 'DOWN' | 'WAIT';
  direction: 'UP' | 'DOWN' | 'WAIT';
  score: number;
  scoreLabel: string;
  qualified: boolean;
  eligible: boolean;
  strategyResults: StrategyResult[];
  supportingConditions: string[];
  blockingConditions: string[];
  triggerCandle: Candle | null;
  timestamp: number;
  reason: string;
}

export interface SignalAuditSnapshot {
  id: string;
  symbol: string;
  timeframe: number;
  triggerCandle: Candle | null;
  triggerCandleTimestamp: number | null;
  entryPrice: number;
  direction: 'UP' | 'DOWN' | 'WAIT';
  score: number;
  scoreLabel: string;
  confluence: number;
  conditions: string[];
  indicatorValues: Record<string, number | string | null>;
  timestamp: number;
  reasons: string[];
  activeStrategyName: string;
  blockerReasons: string[];
}

export interface PerformanceMetrics {
  totalSignals: number;
  evaluatedSignals: number;
  upSignals: number;
  downSignals: number;
  waitSignals: number;
  wonSignals: number;
  lostSignals: number;
  accuracyRate: number | null;
  sampleSize: number;
  lastUpdated: number;
}

export type AccountMode = 'REAL' | 'DEMO';

export type SessionFormatType = 'RAW_SESSION' | 'COMPLETE_AUTH_PACKET' | 'UNKNOWN';

export interface PocketOptionSessionContext {
  mode: AccountMode;
  isDemo: 0 | 1;
  uid: number | null;
  sessionToken: string;
  platform?: number;
  lang?: string;
  sourceFormat: SessionFormatType;
  authenticated: boolean;
  connectionId: string | null;
  generation: number;
}

export interface AccountContextState {
  mode: AccountMode;
  isDemo: 0 | 1;
  uid: number | null;
  sessionToken: string;
  platform: number;
  connectionId: string | null;
  generation: number;
  authenticated: boolean;
  authState: 'SUCCESS' | 'FAILED' | 'PENDING' | 'IDLE';
  status: AccountStatus;
  authError: string | null;
  lastAuthResponse: string | null;
  balance: number | null;
  balanceStatus: BalanceStatus;
  currency: string;
  lastKnownBalance: number | null;
  lastKnownBalanceTimestamp: number | null;
  assets: any[];
  shouldAutoReconnect: boolean;
}

export interface PocketOptionAuthDiagnostic {
  endpoint: string;
  endpointRegion: string;
  socketConnected: boolean;
  engineIoConnected: boolean;
  socketIoConnected: boolean;
  sessionPresent: boolean;
  sessionFormat: SessionFormatType;
  sessionLength: number;
  sessionMasked: string;
  uidPresent: boolean;
  uidValid: boolean;
  uidSupplied: boolean;
  uid: number | null;
  uidMasked: string | null;
  isDemo: boolean;
  isDemoSent: 0 | 1;
  accountMode: AccountMode;
  platform: number;
  platformPresent: boolean;
  platformSent: number;
  authPayloadValidated: boolean;
  validationError: string | null;
  authEventSent: boolean;
  authResponse: 'SUCCESS' | 'NOTAUTHORIZED' | 'TIMEOUT' | 'CLOSED' | 'PENDING' | 'NONE';
  authState: 'SUCCESS' | 'FAILED' | 'PENDING' | 'IDLE';
  reconnectState: 'ACTIVE' | 'STOPPED' | 'IDLE';
  failureReason: string | null;
  generation: number;
  canonicalPayloadPreview?: string | null;
  packetSentMasked?: string | null;
  preSendValid?: boolean;
  balanceState?: BalanceStatus;
  assetState?: 'waiting' | 'loaded' | 'unavailable';
  tickState?: 'waiting' | 'live' | 'stale' | 'unavailable' | 'disconnected';
  candleState?: 'waiting' | 'building' | 'live' | 'stale' | 'stopped';
  freshnessState?: number;
  strategyState?: 'wait' | 'ready' | 'locked';
}

export interface DiagnosticsInfo {
  status: ConnectionStatus;
  subsystems: SubsystemStatus;
  account: AccountInfo;
  endpoint: string;
  latencyMs: number;
  lastPing: number;
  lastTickTime: number | null;
  freshnessSeconds: number;
  isStale: boolean;
  packetCount: number;
  ticksCount: number;
  candlesCount: number;
  assetsCount: number;
  error: string | null;
  hasSession: boolean;
  sessionMasked: string;
  connectionId: string | null;
  activeConnectionId?: string | null;
  sessionStatus: 'none' | 'active' | 'expired' | 'invalid';
  authVerified: boolean;
  generation?: number;
  authError: string | null;
  authUid: string | null;
  strategyWaitReason: string | null;
  reconnectState: 'ACTIVE' | 'STOPPED' | 'IDLE';
  authResponse: string | null;
  authDiagnostic: PocketOptionAuthDiagnostic;
  activeAsset?: string;
  timeframe?: number;
  marketType?: 'GLOBAL' | 'OTC';
  lastCandleTime?: number | null;
  currentCandleTime?: number | null;
  signalEngineStatus?: 'READY' | 'WAITING';
  logs: { time: string; text: string; level: 'info' | 'warn' | 'error' }[];
}

export interface EmaTrendConfig {
  enabled: boolean;
  fastPeriod: number;
  slowPeriod: number;
  filterPeriod: number;
  weight: number;
}

export interface RsiMomentumConfig {
  enabled: boolean;
  period: number;
  overbought: number;
  oversold: number;
  weight: number;
}

export interface MacdConfig {
  enabled: boolean;
  fastPeriod: number;
  slowPeriod: number;
  signalPeriod: number;
  weight: number;
}

export interface BollingerBounceConfig {
  enabled: boolean;
  period: number;
  stdDev: number;
  weight: number;
}

export interface CandlestickConfig {
  enabled: boolean;
  minPatternStrength: number;
  requireTrendAlignment: boolean;
  weight: number;
}

export interface SupportResistanceConfig {
  enabled: boolean;
  lookback: number;
  clusterTolerancePercent: number;
  weight: number;
}

export interface BreakoutConfig {
  enabled: boolean;
  lookback: number;
  atrFilterMultiplier: number;
  weight: number;
}

export interface MarketStructureConfig {
  enabled: boolean;
  swingLookback: number;
  weight: number;
}

export interface MultiConfluenceConfig {
  enabled: boolean;
  weight: number;
}

export interface GannLevel {
  fraction: string;
  price: number;
  type: 'MAJOR_LOW' | 'INTERMEDIATE' | 'EQUILIBRIUM' | 'MAJOR_HIGH';
}

export interface GannAngle {
  name: string;
  slope: number;
  currentValue: number;
  anchorPrice: number;
  anchorTime: number;
  direction: 'ASCENDING' | 'DESCENDING';
}

export interface GannAnalysisData {
  anchorHigh: { price: number; time: number; candleIndex: number };
  anchorLow: { price: number; time: number; candleIndex: number };
  range: number;
  elapsedBars: number;
  dominantTrend: 'BULLISH' | 'BEARISH' | 'CONSOLIDATION';
  gannLevels: GannLevel[];
  angles: GannAngle[];
  priceTimeSquareRatio: number;
  isPriceTimeSquared: boolean;
  nearestTimeCycle: number;
  barsToCycle: number;
  levelInteraction: string;
  currentStatus: string;
}

export interface GannPriceTimeConfig {
  enabled: boolean;
  lookback: number;
  weight: number;
  cycleIntervals?: number[];
}

export interface ElliottWavePoint {
  label: '0' | '1' | '2' | '3' | '4' | '5' | 'A' | 'B' | 'C';
  price: number;
  time: number;
  candleIndex: number;
  type: 'PEAK' | 'TROUGH';
  retracementOrExtension?: number;
}

export interface ElliottWaveData {
  primaryCount: string;
  alternativeCount: string;
  currentWave: string;
  dominantTrend: 'IMPULSE_BULLISH' | 'IMPULSE_BEARISH' | 'CORRECTIVE_ABC' | 'AMBIGUOUS';
  confidenceScore: number;
  rulesChecked: { rule: string; passed: boolean; note: string }[];
  waves: ElliottWavePoint[];
  alternativeWaves?: ElliottWavePoint[];
  structureStatus: 'VALID_IMPULSE' | 'VALID_CORRECTION' | 'AMBIGUOUS_STRUCTURE' | 'INVALIDATED';
  lastConfirmedStructure: string;
}

export interface ElliottWaveConfig {
  enabled: boolean;
  lookback: number;
  weight: number;
  strictWave4Territory?: boolean;
}

export interface DarvasBox {
  id: string;
  upper: number;
  lower: number;
  spread: number;
  spreadPercent: number;
  creationTime: number;
  confirmedTime: number;
  candlesInside: number;
  isConfirmed: boolean;
  breakoutStatus: 'INSIDE' | 'BREAKOUT_UP' | 'BREAKDOWN_DOWN' | 'FAILED_BREAKOUT';
  breakoutPrice?: number;
  breakoutCandleTime?: number;
}

export interface DarvasBoxData {
  activeBox: DarvasBox | null;
  historicalBoxes: DarvasBox[];
  currentPriceRelativeToBox: 'ABOVE' | 'INSIDE' | 'BELOW' | 'NO_BOX';
  breakoutStatus: 'INSIDE' | 'BREAKOUT_UP' | 'BREAKDOWN_DOWN' | 'FAILED_BREAKOUT' | 'FORMING';
  candlesInsideActiveBox: number;
  lastConfirmedStructure: string;
  evidenceNotes: string[];
}

export interface DarvasBoxConfig {
  enabled: boolean;
  lookback: number;
  weight: number;
  consolidationCandlesRequired?: number;
}

export interface GlobalSignalConfig {
  selectedThreshold?: number; // Minimum confidence threshold (50 - 100)
  minConfirmations: number;
  minScore: number;
  signalCooldownSeconds: number;
  requireClosedCandle: boolean;
  requireCandleConfirmation?: boolean;
  maxDataFreshnessSeconds: number;
  enableConflictProtection: boolean;
  enableRegimeFilter: boolean;
  minimumSignalConfidence?: number;
  analysisMode?: AnalysisMode;
  candleCloseConfirmation?: boolean;
}

export interface StrategySettings {
  selectedThreshold?: number; // User-selected minimum strategy confidence (50 - 100)
  strategy?: StrategyName;
  rsiPeriod?: number;
  rsiOverbought?: number;
  rsiOversold?: number;
  emaFastPeriod?: number;
  emaSlowPeriod?: number;
  bollingerPeriod?: number;
  bollingerStdDev?: number;
  confluenceThreshold?: number;
  minConfirmations?: number;
  minNetScore?: number;
  allowCounterTrend?: boolean;
  minPayout?: number;

  global?: GlobalSignalConfig;
  emaTrend?: EmaTrendConfig;
  rsiMomentum?: RsiMomentumConfig;
  macd?: MacdConfig;
  bollingerBounce?: BollingerBounceConfig;
  candlestick?: CandlestickConfig;
  supportResistance?: SupportResistanceConfig;
  breakout?: BreakoutConfig;
  marketStructure?: MarketStructureConfig;
  multiConfluence?: MultiConfluenceConfig;
  gannPriceTime?: GannPriceTimeConfig;
  elliottWave?: ElliottWaveConfig;
  darvasBox?: DarvasBoxConfig;
}

export type ViewTab =
  | 'landing'
  | 'dashboard'
  | 'terminal'
  | 'vision'
  | 'ai_analysis'
  | 'execution'
  | 'sbaa'
  | 'autotrader'
  | 'scanner'
  | 'risk'
  | 'portfolio'
  | 'market'
  | 'chart'
  | 'indicators'
  | 'strategies'
  | 'signals'
  | 'history'
  | 'performance'
  | 'admin'
  | 'connection'
  | 'account'
  | 'diagnostics'
  | 'settings';

export type OrderSide = 'BUY' | 'SELL';
export type OrderType = 'MARKET' | 'LIMIT' | 'STOP';
export type OrderStatus = 'OPEN' | 'FILLED' | 'CLOSED' | 'CANCELLED';

export interface TradeOrder {
  id: string;
  symbol: string;
  side: OrderSide;
  orderType: OrderType;
  volume: number; // in lots or units
  entryPrice: number;
  stopLoss?: number;
  takeProfit?: number;
  leverage: number;
  status: OrderStatus;
  openTime: number;
  closeTime?: number;
  closePrice?: number;
  pnl?: number;
  riskAmount: number;
  potentialReward: number;
  riskRewardRatio: number;
  notes?: string;
}

export interface Position {
  id: string;
  orderId: string;
  symbol: string;
  side: OrderSide;
  volume: number;
  entryPrice: number;
  currentPrice: number;
  stopLoss?: number;
  takeProfit?: number;
  leverage: number;
  margin: number;
  pnl: number;
  pnlPercent: number;
  openTime: number;
}

export interface VisionAnalysisResult {
  id: string;
  timestamp: number;
  asset?: string;
  trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  patterns: string[];
  supportResistance: { price: number; type: 'SUPPORT' | 'RESISTANCE' }[];
  orderBlocks: { type: 'BULLISH' | 'BEARISH'; zone: string }[];
  fairValueGaps?: string[];
  suggestedSetup?: {
    direction: OrderSide;
    entry: number;
    stopLoss: number;
    takeProfit: number;
    rrRatio: number;
    rationale: string;
  };
  fullReport: string;
  confidence: number;
}

export interface AIAnalysisResult {
  id: string;
  timestamp: number;
  symbol: string;
  timeframe: string;
  engine: string;
  marketBias: 'STRONG_BULLISH' | 'BULLISH' | 'NEUTRAL' | 'BEARISH' | 'STRONG_BEARISH';
  score: number;
  structure: string;
  liquidityZones: string[];
  orderBlocks: string[];
  fairValueGaps: string[];
  tradeRecommendation: {
    direction: 'BUY' | 'SELL' | 'WAIT';
    entryZone: string;
    stopLoss: string;
    target: string;
    riskReward: string;
  };
  commentary: string;
}

export interface ScannerItem {
  symbol: string;
  label: string;
  currentPrice: number;
  change24h: number;
  trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  rsi: number;
  macd: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  macdStatus?: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | string;
  score: number;
  confluenceScore?: number;
  signal: 'STRONG_BUY' | 'BUY' | 'WAIT' | 'SELL' | 'STRONG_SELL';
  lastUpdated: number;
}

export interface SystemAuditLog {
  id: string;
  timestamp: number;
  level: 'INFO' | 'WARN' | 'ERROR' | 'SECURITY';
  category: 'ORDER' | 'AUTH' | 'DATA' | 'AI' | 'SYSTEM';
  message: string;
  details?: string;
}

// ==================== AI API KEY & GEMINI INTEGRATION TYPES ====================

export type GeminiHealthStatus =
  | 'READY'
  | 'REQUESTING'
  | 'RETRYING'
  | 'TEMPORARILY_UNAVAILABLE'
  | 'AUTH_ERROR'
  | 'INVALID_REQUEST'
  | 'RATE_LIMITED'
  | 'FAILED';

export interface GeminiHealthState {
  provider: string;
  model: string;
  status: GeminiHealthStatus;
  lastSuccessAt: number | null;
  lastFailureAt: number | null;
  lastErrorCode: string | null;
  consecutiveFailures: number;
  retryCount: number;
  latencyMs: number | null;
  cooldownUntil: number | null;
}

export interface AIAnalysisResultWrapper<T = any> {
  ok: boolean;
  status: GeminiHealthStatus | 'SUCCESS' | 'FALLBACK_EXPLANATION';
  provider: string;
  model: string;
  data: T | null;
  errorCode: string | null;
  retryable: boolean;
  latencyMs?: number;
  userMessage: string;
  technicalDetails?: string;
  requestId: string;
  snapshotId: string;
}

export type AiConnectionStatus =
  | 'NOT_CONNECTED'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'INVALID_API_KEY'
  | 'CONNECTION_ERROR'
  | 'QUOTA_EXCEEDED'
  | 'MODEL_UNAVAILABLE'
  | 'TEMPORARILY_UNAVAILABLE'
  | 'NOT CONNECTED'
  | 'INVALID API KEY'
  | 'CONNECTION ERROR'
  | 'QUOTA EXCEEDED'
  | 'MODEL UNAVAILABLE';

export type AiAnalysisState =
  | 'AI_DISABLED'
  | 'AI_NOT_CONFIGURED'
  | 'AI_CONNECTING'
  | 'AI_CONNECTED'
  | 'AI_ANALYZING'
  | 'AI_ANALYSIS_COMPLETE'
  | 'AI_ERROR'
  | 'AI_QUOTA_EXCEEDED'
  | 'AI_MODEL_UNAVAILABLE'
  | 'AI_DATA_UNAVAILABLE';

export interface AiModelMetadata {
  id: string;
  name: string;
  available: boolean;
  inputTypes: string[];
  status: 'AVAILABLE' | 'ACTIVE' | 'MODEL_UNAVAILABLE';
  description: string;
  availability?: string;
  supportedInputTypes?: string[];
}

export type AiModelDescriptor = AiModelMetadata;

export interface AiDataPermissions {
  sendCandles: boolean;
  sendIndicators: boolean;
  sendStrategyConfig: boolean;
  sendPatterns: boolean;
  sendVision: boolean;
  autoAnalysis: boolean;
  autoIntervalSeconds: number;
  autoAnalysisIntervalCandles?: number;
}

export interface AiConfigSnapshot {
  provider: string;
  providerId: string;
  configured: boolean;
  isConfigured?: boolean;
  maskedKey: string;
  hasUserKey: boolean;
  isEnvKeyFallback: boolean;
  model: string;
  selectedModel?: string;
  modelName: string;
  modelStatus: string;
  connectionStatus: AiConnectionStatus;
  health?: GeminiHealthState;
  lastVerified: number | null;
  lastErrorCategory: string | null;
  supportedModels: AiModelMetadata[];
  permissions: AiDataPermissions;
}

export interface AiConnectionTestResult {
  success: boolean;
  status: 'REAL API RESPONSE RECEIVED' | 'CONNECTION FAILED' | 'INVALID API KEY' | 'QUOTA EXCEEDED' | 'MODEL UNAVAILABLE' | 'CONNECTION ERROR';
  provider: string;
  model: string;
  timestamp: number;
  latencyMs?: number;
  message?: string;
  errorCategory?: string;
  lastVerified?: number | null;
}

export interface AiChartAnalysisRequestPayload {
  provider: string;
  model: string;
  symbol: string;
  timeframe: string;
  dataStatus: 'LIVE' | 'STALE' | 'OFFLINE' | 'DATA_SOURCE_NOT_AVAILABLE';
  candleData?: Array<{
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume?: number | null;
  }>;
  strategy?: {
    name: string;
    selectedThreshold: number;
    actualConfidence: number;
    direction: string;
  };
  indicators?: {
    macd?: any;
    rsi?: any;
    momentum?: any;
    ema9?: any;
    ema21?: any;
    atr?: any;
    adx?: any;
    stochastic?: any;
  };
  candleAnalysis?: {
    direction: string;
    pattern: string;
    confirmation: string;
  };
  conflicts?: string[];
  requestPurpose: string;
}

export interface AiStructuredChartAnalysis {
  id: string;
  timestamp: number;
  provider: string;
  model: string;
  symbol: string;
  timeframe: string;
  dataStatus: 'LIVE' | 'STALE' | 'OFFLINE' | 'DATA_SOURCE_NOT_AVAILABLE';
  analysisStatus: 'COMPLETE' | 'FAILED' | 'ERROR';
  dataQuality: 'VALID' | 'STALE' | 'INSUFFICIENT' | 'DATA_SOURCE_NOT_AVAILABLE';
  trend: {
    direction: 'UP' | 'DOWN' | 'NEUTRAL' | 'UNKNOWN';
    evidence: string[];
  };
  candleStructure: {
    direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'UNKNOWN';
    pattern: string;
    evidence: string[];
  };
  momentum: {
    state: 'STRONG_BULLISH' | 'BULLISH' | 'NEUTRAL' | 'BEARISH' | 'STRONG_BEARISH' | 'UNKNOWN';
    evidence: string[];
  };
  macdInterpretation: {
    value: string;
    signal: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'UNKNOWN';
    evidence: string[];
  };
  indicatorInterpretation: string[];
  strategyConditions: {
    status: 'Passed' | 'Failed' | 'Incomplete';
    thresholdReached: boolean;
    conditionsSupported: string[];
    conditionsNotVerified: string[];
  };
  conflicts: string[];
  missingData: string[];
  summary: string;
  limitations: string[];
  engineComparison: {
    engineResult: 'UP' | 'DOWN' | 'WAIT';
    aiResult: 'UP' | 'DOWN' | 'WAIT';
    status: 'ENGINE SIGNAL CONFIRMED' | 'REQUIRES REVIEW / WAIT' | 'NEUTRAL';
    alignment: 'Supporting' | 'Conflicting' | 'Inconclusive';
  };
  // Optional convenience fields for direct UI rendering
  modelUsed?: string;
  dataSourceStatus?: string;
  aiBias?: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  aiConfidence?: number;
  engineVsAiAlignment?: 'MATCH' | 'CONFLICT' | 'NEUTRAL';
  trendAnalysis?: string;
  candleStructureAnalysis?: string;
  momentumAnalysis?: string;
  strategyConditionsState?: string;
  detectedConflicts?: string[];
  riskNote?: string;
}

export interface AiAuditRecord {
  id: string;
  timestamp: number;
  action: 'TEST_CONNECTION' | 'CHART_ANALYSIS' | 'SAVE_KEY' | 'REMOVE_KEY';
  provider: string;
  model: string;
  symbol?: string;
  timeframe?: number | string;
  status: 'SUCCESS' | 'FAILURE' | 'ERROR';
  durationMs?: number;
  summary: string;
  errorCategory?: string;
  tokensUsed?: { prompt: number; completion: number };
  engineSignal?: string;
  aiBias?: string;
}

export type AiAuditLogEntry = AiAuditRecord;
