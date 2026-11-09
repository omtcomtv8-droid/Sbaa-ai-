import WebSocket from 'ws';
import {
  AccountInfo,
  AccountMode,
  AccountStatus,
  AssetInfo,
  Candle,
  ConnectionStatus,
  DiagnosticsInfo,
  MarketTick,
  PocketOptionAuthDiagnostic,
  SessionFormatType,
  SubsystemStatus,
} from './types';
import { CandleBuilder } from './CandleBuilder';
import {
  PocketOptionAuthManager,
  ParsedAuthData,
  AuthValidationResult,
  RawAuthInput,
} from './PocketOptionAuthManager';
import { PocketOptionAccountManager } from './PocketOptionAccountManager';

const UPDATE_ASSETS_KEYS = [
  'id',
  'asset',
  'label',
  'type',
  'digits',
  'payout',
  'default_expiration',
  'min_expiration',
  'expiration_step',
  'is_otc',
  'otc_id',
  'real_id',
  'signals',
  'exp_time',
  'active',
  'timeframes',
  'scheduled_until',
  'min_quick_timeframe',
  'scheduled_at',
];

interface PendingBinaryEvent {
  eventName: string;
  payload: any;
  totalAttachments: number;
  receivedAttachments: any[];
  connId?: string;
  generation?: number;
}

export interface ParsedSession {
  session: string;
  uid: number | null;
  isDemo: number; // 0 for real account, 1 for demo account
  platform: number;
  hasSession: boolean;
  format?: SessionFormatType;
  detectedModeFromPayload?: 'REAL' | 'DEMO' | null;
}

export const DEFAULT_PO_ASSETS: AssetInfo[] = [
  // Major OTC Currencies
  { id: 1, asset: 'EURUSD_otc', label: 'EUR/USD OTC', type: 'currency', digits: 5, payout: 92, is_otc: true, active: true },
  { id: 2, asset: 'GBPUSD_otc', label: 'GBP/USD OTC', type: 'currency', digits: 5, payout: 92, is_otc: true, active: true },
  { id: 3, asset: 'USDJPY_otc', label: 'USD/JPY OTC', type: 'currency', digits: 3, payout: 92, is_otc: true, active: true },
  { id: 4, asset: 'AUDUSD_otc', label: 'AUD/USD OTC', type: 'currency', digits: 5, payout: 92, is_otc: true, active: true },
  { id: 5, asset: 'USDCAD_otc', label: 'USD/CAD OTC', type: 'currency', digits: 5, payout: 92, is_otc: true, active: true },
  { id: 6, asset: 'USDCHF_otc', label: 'USD/CHF OTC', type: 'currency', digits: 5, payout: 90, is_otc: true, active: true },
  { id: 7, asset: 'NZDUSD_otc', label: 'NZD/USD OTC', type: 'currency', digits: 5, payout: 90, is_otc: true, active: true },
  { id: 8, asset: 'EURJPY_otc', label: 'EUR/JPY OTC', type: 'currency', digits: 3, payout: 90, is_otc: true, active: true },
  { id: 9, asset: 'GBPJPY_otc', label: 'GBP/JPY OTC', type: 'currency', digits: 3, payout: 90, is_otc: true, active: true },
  { id: 10, asset: 'EURGBP_otc', label: 'EUR/GBP OTC', type: 'currency', digits: 5, payout: 90, is_otc: true, active: true },
  { id: 11, asset: 'AUDCAD_otc', label: 'AUD/CAD OTC', type: 'currency', digits: 5, payout: 90, is_otc: true, active: true },
  { id: 12, asset: 'AUDJPY_otc', label: 'AUD/JPY OTC', type: 'currency', digits: 3, payout: 90, is_otc: true, active: true },
  { id: 13, asset: 'CADJPY_otc', label: 'CAD/JPY OTC', type: 'currency', digits: 3, payout: 90, is_otc: true, active: true },
  { id: 14, asset: 'CHFJPY_otc', label: 'CHF/JPY OTC', type: 'currency', digits: 3, payout: 90, is_otc: true, active: true },
  { id: 15, asset: 'EURAUD_otc', label: 'EUR/AUD OTC', type: 'currency', digits: 5, payout: 88, is_otc: true, active: true },
  { id: 16, asset: 'EURCAD_otc', label: 'EUR/CAD OTC', type: 'currency', digits: 5, payout: 88, is_otc: true, active: true },
  { id: 17, asset: 'EURCHF_otc', label: 'EUR/CHF OTC', type: 'currency', digits: 5, payout: 88, is_otc: true, active: true },
  { id: 18, asset: 'EURNZD_otc', label: 'EUR/NZD OTC', type: 'currency', digits: 5, payout: 88, is_otc: true, active: true },
  { id: 19, asset: 'GBPAUD_otc', label: 'GBP/AUD OTC', type: 'currency', digits: 5, payout: 88, is_otc: true, active: true },
  { id: 20, asset: 'GBPCAD_otc', label: 'GBP/CAD OTC', type: 'currency', digits: 5, payout: 88, is_otc: true, active: true },
  { id: 21, asset: 'GBPCHF_otc', label: 'GBP/CHF OTC', type: 'currency', digits: 5, payout: 88, is_otc: true, active: true },
  { id: 22, asset: 'GBPNZD_otc', label: 'GBP/NZD OTC', type: 'currency', digits: 5, payout: 88, is_otc: true, active: true },
  { id: 23, asset: 'NZDJPY_otc', label: 'NZD/JPY OTC', type: 'currency', digits: 3, payout: 88, is_otc: true, active: true },
  // Exotic OTC Currencies
  { id: 24, asset: 'USDINR_otc', label: 'USD/INR OTC', type: 'currency', digits: 3, payout: 89, is_otc: true, active: true },
  { id: 25, asset: 'USDBRL_otc', label: 'USD/BRL OTC', type: 'currency', digits: 4, payout: 89, is_otc: true, active: true },
  { id: 26, asset: 'USDIDR_otc', label: 'USD/IDR OTC', type: 'currency', digits: 2, payout: 92, is_otc: true, active: true },
  { id: 27, asset: 'USDMXN_otc', label: 'USD/MXN OTC', type: 'currency', digits: 4, payout: 92, is_otc: true, active: true },
  { id: 28, asset: 'USDPHP_otc', label: 'USD/PHP OTC', type: 'currency', digits: 3, payout: 86, is_otc: true, active: true },
  { id: 29, asset: 'USDPKR_otc', label: 'USD/PKR OTC', type: 'currency', digits: 2, payout: 85, is_otc: true, active: true },
  { id: 30, asset: 'USDSGD_otc', label: 'USD/SGD OTC', type: 'currency', digits: 4, payout: 82, is_otc: true, active: true },
  { id: 31, asset: 'USDTHB_otc', label: 'USD/THB OTC', type: 'currency', digits: 3, payout: 92, is_otc: true, active: true },
  { id: 32, asset: 'USDVND_otc', label: 'USD/VND OTC', type: 'currency', digits: 1, payout: 92, is_otc: true, active: true },
  { id: 33, asset: 'MADUSD_otc', label: 'MAD/USD OTC', type: 'currency', digits: 5, payout: 92, is_otc: true, active: true },
  // Commodities OTC
  { id: 34, asset: 'XAUUSD_otc', label: 'Gold OTC', type: 'commodity', digits: 2, payout: 80, is_otc: true, active: true },
  { id: 35, asset: 'XAGUSD_otc', label: 'Silver OTC', type: 'commodity', digits: 3, payout: 80, is_otc: true, active: true },
  { id: 36, asset: 'UKBrent_otc', label: 'Brent Oil OTC', type: 'commodity', digits: 2, payout: 80, is_otc: true, active: true },
  { id: 37, asset: 'USCrude_otc', label: 'Crude Oil OTC', type: 'commodity', digits: 2, payout: 80, is_otc: true, active: true },
  // Crypto OTC
  { id: 38, asset: 'BTCUSD_otc', label: 'Bitcoin OTC', type: 'crypto', digits: 2, payout: 85, is_otc: true, active: true },
  { id: 39, asset: 'ETHUSD_otc', label: 'Ethereum OTC', type: 'crypto', digits: 2, payout: 85, is_otc: true, active: true },
  { id: 40, asset: 'SOL-USD_otc', label: 'Solana OTC', type: 'crypto', digits: 2, payout: 80, is_otc: true, active: true },
  // Equities OTC
  { id: 41, asset: 'AAPL_otc', label: 'Apple OTC', type: 'stock', digits: 2, payout: 85, is_otc: true, active: true },
  { id: 42, asset: 'TSLA_otc', label: 'Tesla OTC', type: 'stock', digits: 2, payout: 85, is_otc: true, active: true },
  { id: 43, asset: 'MSFT_otc', label: 'Microsoft OTC', type: 'stock', digits: 2, payout: 85, is_otc: true, active: true },
  { id: 44, asset: 'AMZN_otc', label: 'Amazon OTC', type: 'stock', digits: 2, payout: 85, is_otc: true, active: true },
  { id: 45, asset: 'GOOG_otc', label: 'Google OTC', type: 'stock', digits: 2, payout: 85, is_otc: true, active: true },
  { id: 46, asset: 'NVDA_otc', label: 'NVIDIA OTC', type: 'stock', digits: 2, payout: 85, is_otc: true, active: true },
  { id: 47, asset: 'META_otc', label: 'Meta OTC', type: 'stock', digits: 2, payout: 85, is_otc: true, active: true },
  { id: 48, asset: 'SP500_otc', label: 'S&P 500 OTC', type: 'indices', digits: 2, payout: 80, is_otc: true, active: true },
  { id: 49, asset: 'NASUSD_otc', label: 'US 100 OTC', type: 'indices', digits: 2, payout: 80, is_otc: true, active: true },
  // Standard Real Pairs
  { id: 50, asset: 'EURUSD', label: 'EUR/USD', type: 'currency', digits: 5, payout: 80, is_otc: false, active: true },
  { id: 51, asset: 'GBPUSD', label: 'GBP/USD', type: 'currency', digits: 5, payout: 80, is_otc: false, active: true },
  { id: 52, asset: 'USDJPY', label: 'USD/JPY', type: 'currency', digits: 3, payout: 80, is_otc: false, active: true },
  { id: 53, asset: 'AUDUSD', label: 'AUD/USD', type: 'currency', digits: 5, payout: 80, is_otc: false, active: true },
  { id: 54, asset: 'USDCAD', label: 'USD/CAD', type: 'currency', digits: 5, payout: 80, is_otc: false, active: true },
  { id: 55, asset: 'USDCHF', label: 'USD/CHF', type: 'currency', digits: 5, payout: 80, is_otc: false, active: true },
];

export const CLUSTER_ENDPOINTS: string[] = [
  'wss://api-eu.po.market/socket.io/?EIO=4&transport=websocket',
  'wss://demo-api-eu.po.market/socket.io/?EIO=4&transport=websocket',
  'wss://api-us-north.po.market/socket.io/?EIO=4&transport=websocket',
  'wss://api-us-south.po.market/socket.io/?EIO=4&transport=websocket',
  'wss://api-sc.po.market/socket.io/?EIO=4&transport=websocket',
];

export const ASSET_BASE_PRICES: Record<string, { price: number; digits: number }> = {
  EURUSD_otc: { price: 1.08450, digits: 5 },
  GBPUSD_otc: { price: 1.29350, digits: 5 },
  USDJPY_otc: { price: 154.350, digits: 3 },
  AUDUSD_otc: { price: 0.65200, digits: 5 },
  USDCAD_otc: { price: 1.38500, digits: 5 },
  USDCHF_otc: { price: 0.88400, digits: 5 },
  NZDUSD_otc: { price: 0.58900, digits: 5 },
  EURJPY_otc: { price: 167.450, digits: 3 },
  GBPJPY_otc: { price: 199.650, digits: 3 },
  EURGBP_otc: { price: 0.83850, digits: 5 },
  BTCUSD_otc: { price: 88500.00, digits: 2 },
  ETHUSD_otc: { price: 2750.00, digits: 2 },
  'SOL-USD_otc': { price: 185.00, digits: 2 },
  XAUUSD_otc: { price: 2745.50, digits: 2 },
  XAGUSD_otc: { price: 32.800, digits: 3 },
  UKBrent_otc: { price: 74.50, digits: 2 },
  USCrude_otc: { price: 70.80, digits: 2 },
  AAPL_otc: { price: 228.50, digits: 2 },
  TSLA_otc: { price: 245.80, digits: 2 },
  EURUSD: { price: 1.08450, digits: 5 },
};

export class PocketOptionService {
  private ws: WebSocket | null = null;
  private endpoint: string;
  private activeAsset: string;
  private timeframe: number;

  private accountManager: PocketOptionAccountManager;

  private status: ConnectionStatus = 'disconnected';
  private activeConnectionId: string | null = null;
  private sessionStatus: 'none' | 'active' | 'expired' | 'invalid' = 'none';

  private isSimulatorActive: boolean = false;
  private simulatorInterval: NodeJS.Timeout | null = null;
  private currentClusterIndex: number = 0;
  private currentSyntheticPrices: Map<string, number> = new Map();

  private subsystems: SubsystemStatus = {
    websocket: 'disconnected',
    auth: 'none',
    account: 'UNKNOWN',
    assets: 'waiting',
    marketData: 'waiting',
    candles: 'waiting',
    strategy: 'wait',
    overall: 'DISCONNECTED',
  };

  private accountInfo: AccountInfo = {
    status: 'UNKNOWN',
    balance: null,
    balanceStatus: 'UNAVAILABLE',
    currency: 'USD',
    isDemo: true,
    uidMasked: null,
    lastUpdated: null,
    connectionId: null,
    source: 'NONE',
    lastKnownBalance: null,
    lastKnownBalanceTimestamp: null,
    staleSeconds: 0,
  };

  private authVerified: boolean = false;
  private authError: string | null = null;
  private authUid: string | null = null;
  private strategyWaitReason: string | null = 'Awaiting Pocket Option account connection.';

  private pingStartTime: number = 0;
  private latencyMs: number = 0;
  private lastPing: number = 0;
  private packetCount: number = 0;
  private ticksCount: number = 0;
  private lastError: string | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private monitorInterval: NodeJS.Timeout | null = null;
  private balanceTimeout: NodeJS.Timeout | null = null;
  private authTimeout: NodeJS.Timeout | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private isExplicitlyClosed = false;
  private lastAuthResponse: string | null = null;
  private authValidationResult: AuthValidationResult | null = null;
  private authEventSent: boolean = false;
  private socketConnected: boolean = false;
  private engineIoConnected: boolean = false;
  private socketIoConnected: boolean = false;
  private authDemoFallbackAttempted: number | null = null;

  private candleBuilder: CandleBuilder;
  private assetsMap: Map<string, AssetInfo> = new Map();
  private logs: { time: string; text: string; level: 'info' | 'warn' | 'error' }[] = [];
  private pendingBinary: PendingBinaryEvent | null = null;
  private sentimentMap: Map<string, number> = new Map();

  // Listeners for UI updates
  private onTickListeners: ((tick: MarketTick) => void)[] = [];
  private onStatusListeners: ((status: ConnectionStatus) => void)[] = [];
  private onHistoricalCandlesListeners: ((asset: string, period: number, candles: Candle[]) => void)[] = [];
  private onAssetsUpdatedListeners: ((assets: AssetInfo[]) => void)[] = [];
  private onBalanceUpdatedListeners: ((balanceInfo: any) => void)[] = [];

  // Deals & Orders management for real trade execution
  private activeDeals: Map<string, any> = new Map();
  private dealsHistory: any[] = [];
  private pendingDealOrders: Map<number, {
    resolve: (res: any) => void;
    timer: NodeJS.Timeout;
    params: any;
  }> = new Map();
  private onDealOpenedListeners: ((deal: any) => void)[] = [];
  private onDealClosedListeners: ((deal: any) => void)[] = [];

  // Buffer for early authenticated account packets arriving before store readiness
  private earlyAccountMessageBuffer: Array<{
    eventName: string;
    payload: any;
    connId: string;
    generation: number;
    receivedAt: number;
  }> = [];

  // Async connection handshake resolvers
  private pendingHandshakes: Array<{
    generation: number;
    attemptId?: string;
    resolve: (res: any) => void;
    timer: NodeJS.Timeout;
  }> = [];

  private resolveHandshakes(generation: number, result: any): void {
    const toResolve = this.pendingHandshakes.filter((h) => h.generation === generation);
    this.pendingHandshakes = this.pendingHandshakes.filter((h) => h.generation !== generation);
    for (const h of toResolve) {
      clearTimeout(h.timer);
      try {
        h.resolve(result);
      } catch (err) {
        console.warn('[PO-ENGINE] Error resolving handshake:', err);
      }
    }
  }

  private rejectHandshakes(generation: number, errResult: any): void {
    const toReject = this.pendingHandshakes.filter((h) => h.generation === generation);
    this.pendingHandshakes = this.pendingHandshakes.filter((h) => h.generation !== generation);
    for (const h of toReject) {
      clearTimeout(h.timer);
      try {
        h.resolve(errResult);
      } catch (err) {
        console.warn('[PO-ENGINE] Error rejecting handshake:', err);
      }
    }
  }

  private cancelAllPendingHandshakes(reason: string): void {
    for (const h of this.pendingHandshakes) {
      clearTimeout(h.timer);
      try {
        h.resolve({
          success: false,
          ok: false,
          state: 'DISCONNECTED',
          error: reason,
          errorCode: 'UNKNOWN_ERROR',
          diagnostics: this.getDiagnostics(),
        });
      } catch {
        // ignore
      }
    }
    this.pendingHandshakes = [];
  }

  public onAssetsUpdated(fn: (assets: AssetInfo[]) => void): void {
    this.onAssetsUpdatedListeners.push(fn);
  }

  public onHistoricalCandles(fn: (asset: string, period: number, candles: Candle[]) => void): void {
    this.onHistoricalCandlesListeners.push(fn);
  }

  public onBalanceUpdated(fn: (balanceInfo: any) => void): void {
    this.onBalanceUpdatedListeners.push(fn);
  }

  public onDealOpened(fn: (deal: any) => void): () => void {
    this.onDealOpenedListeners.push(fn);
    return () => {
      this.onDealOpenedListeners = this.onDealOpenedListeners.filter((l) => l !== fn);
    };
  }

  public onDealClosed(fn: (deal: any) => void): () => void {
    this.onDealClosedListeners.push(fn);
    return () => {
      this.onDealClosedListeners = this.onDealClosedListeners.filter((l) => l !== fn);
    };
  }

  public getActiveDeals(): any[] {
    return Array.from(this.activeDeals.values());
  }

  public getDealsHistory(): any[] {
    return [...this.dealsHistory];
  }

  public getStatus(): ConnectionStatus {
    return this.status;
  }

  public requestBalance(): void {
    const activeMode = this.accountManager.getActiveMode();
    this.log(`[PO-DEBUG] Dispatching broker balance request packets for mode: ${activeMode}`);
    if (this.subsystems.account !== 'LIVE') {
      this.subsystems.account = 'LOADING';
      this.notifyStatusChange();
    }
    this.sendPacket('42["update_balance"]');
    this.sendPacket('42["updateBalance"]');
    this.sendPacket(`42["change_balance",{"isDemo":${activeMode === 'DEMO' ? 1 : 0}}]`);
    this.sendPacket(`42["changeBalance",{"isDemo":${activeMode === 'DEMO' ? 1 : 0}}]`);
    this.sendPacket('42["ps"]');
    this.sendPacket('42["balance"]');
    this.sendPacket('42["getBalance"]');
    this.sendPacket('42["get_balance"]');
  }

  private seedDefaultAssets(): void {
    for (const a of DEFAULT_PO_ASSETS) {
      if (!this.assetsMap.has(a.asset)) {
        this.assetsMap.set(a.asset, { ...a });
      }
    }
  }

  public static cleanEndpoint(url: string): string {
    if (!url || typeof url !== 'string') {
      return CLUSTER_ENDPOINTS[0];
    }
    let cleaned = url.replace(/\[\d+\]/g, '').trim();
    cleaned = cleaned.replace(/EI0=4/i, 'EIO=4');
    cleaned = cleaned.replace(/\s+/g, '');
    if (!cleaned.startsWith('ws://') && !cleaned.startsWith('wss://')) {
      return CLUSTER_ENDPOINTS[0];
    }
    // Automatically sanitize and map blocked or unavailable cluster nodes
    if (cleaned.includes('api-fin.') || cleaned.includes('api-l.') || cleaned.includes('api-sp.')) {
      cleaned = cleaned.replace(/api-(fin|l|sp)\.po\.market/g, 'api-eu.po.market');
    }
    return cleaned;
  }

  public isStreamActive(): boolean {
    return this.ticksCount > 0;
  }

  public isDemoOrSimulationActive(): boolean {
    return this.accountManager.getActiveMode() === 'DEMO' && this.authVerified;
  }

  public getEffectiveSyntheticPrice(asset: string): number {
    return ASSET_BASE_PRICES[asset]?.price || 1.08450;
  }

  public seedHistoricalCandlesIfEmpty(_asset: string, _period: number): void {
    // Anti-dummy data enforcement: Never inject simulated candles as real data
  }

  public startStreamSynthesizer(): void {
    // Anti-dummy data enforcement: Zero mock/simulated streams
  }

  public stopStreamSynthesizer(): void {
    if (this.simulatorInterval) {
      clearInterval(this.simulatorInterval);
      this.simulatorInterval = null;
    }
    this.isSimulatorActive = false;
  }

  public getEffectiveEndpoint(mode?: AccountMode, sessionToken?: string): string {
    const targetMode = mode || this.accountManager.getActiveMode();
    let ep = this.endpoint;
    const effectiveToken = sessionToken ?? this.accountManager.getActiveContext().sessionToken;
    const isPublicGuestDemo =
      !effectiveToken ||
      effectiveToken.startsWith('po_demo_') ||
      effectiveToken === '296a5cb3321a6c66c7ab018b8a596b8b' ||
      effectiveToken.toLowerCase() === 'demo';

    if (targetMode === 'DEMO' && isPublicGuestDemo) {
      if (!ep || ep.includes('try-demo')) {
        ep = 'wss://demo-api-eu.po.market/socket.io/?EIO=4&transport=websocket';
      }
    } else {
      // For registered user accounts (both DEMO and REAL modes):
      // The user's account and session live on the main production cluster (api-eu.po.market, api-us-north, etc.)
      if (ep.includes('demo-api-')) {
        ep = ep.replace('demo-api-', 'api-');
      }
      if (!ep || ep.includes('try-demo')) {
        ep = 'wss://api-eu.po.market/socket.io/?EIO=4&transport=websocket';
      }
    }
    return PocketOptionService.cleanEndpoint(ep);
  }

  constructor(
    candleBuilder: CandleBuilder,
    endpoint = 'wss://api-eu.po.market/socket.io/?EIO=4&transport=websocket',
    sessionToken = '',
    isDemo = false,
    activeAsset = 'EURUSD_otc',
    timeframe = 60,
    configuredUid?: number | null
  ) {
    this.candleBuilder = candleBuilder;
    this.endpoint = PocketOptionService.cleanEndpoint(endpoint);
    this.activeAsset = activeAsset;
    this.timeframe = timeframe;

    // Seed default Pocket Option OTC & spot assets so asset catalog is never empty
    this.seedDefaultAssets();

    const initialMode: AccountMode = isDemo ? 'DEMO' : 'REAL';
    this.accountManager = new PocketOptionAccountManager(initialMode);
    this.endpoint = this.getEffectiveEndpoint(initialMode);

    if (sessionToken && sessionToken.trim()) {
      this.accountManager.setCredentials({
        mode: initialMode,
        sessionToken: sessionToken.trim(),
        uid: configuredUid,
      });
    }

    this.accountInfo = this.accountManager.buildAccountInfo();

    this.startHealthMonitor();
  }

  public getAccountManager(): PocketOptionAccountManager {
    return this.accountManager;
  }

  public getAccountMode(): AccountMode {
    return this.accountManager ? this.accountManager.getActiveMode() : 'DEMO';
  }

  public static parseCredentials(
    rawInput: string,
    fallbackIsDemo = false,
    explicitUid?: number | null
  ): ParsedSession {
    const parsed = PocketOptionAuthManager.parse({
      sessionToken: rawInput,
      isDemo: fallbackIsDemo,
      uid: explicitUid,
    });
    return {
      session: parsed.session,
      uid: parsed.uid,
      isDemo: parsed.isDemo,
      platform: parsed.platform,
      hasSession: Boolean(parsed.session && parsed.session.length >= 8),
      format: parsed.format,
      detectedModeFromPayload: parsed.detectedModeFromPayload,
    };
  }

  public log(text: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    let sanitized = text;
    const activeCtx = this.accountManager.getActiveContext();
    if (activeCtx.sessionToken && activeCtx.sessionToken.length > 6) {
      sanitized = sanitized.split(activeCtx.sessionToken).join('[REDACTED_SESSION]');
    }

    const time = new Date().toLocaleTimeString();
    this.logs.unshift({ time, text: sanitized, level });
    if (this.logs.length > 120) this.logs.pop();
    console.log(`[PO-ENGINE ${level.toUpperCase()}] ${sanitized}`);
  }

  private cleanCurrentSocket(): void {
    this.socketConnected = false;
    this.engineIoConnected = false;
    this.socketIoConnected = false;
    this.authEventSent = false;

    if (this.ws) {
      const socket = this.ws;
      this.ws = null;
      socket.removeAllListeners();
      socket.on('error', () => {});
      try {
        if (socket.readyState === WebSocket.CONNECTING) {
          socket.terminate();
        } else if (socket.readyState === WebSocket.OPEN) {
          socket.close(1000, 'Normal Closure');
        }
      } catch {
        // ignore
      }
    }
  }

  public resetLiveConnectionState(
    reason: 'auth_failed' | 'disconnected' | 'config_change' | 'expired' | 'manual' = 'manual'
  ): void {
    this.authVerified = false;
    this.authUid = null;

    const isAuthFailure = reason === 'auth_failed' || reason === 'expired';
    const isDisconnected = reason === 'disconnected';

    const accStatus: AccountStatus = isAuthFailure
      ? 'INVALID'
      : isDisconnected
      ? 'DISCONNECTED'
      : 'UNKNOWN';

    const currentAcc = this.accountManager.buildAccountInfo();
    this.accountInfo = {
      ...currentAcc,
      status: accStatus,
      balance: null,
      balanceStatus: 'UNAVAILABLE',
      connectionId: null,
      source: 'UNAVAILABLE',
    };

    if (isAuthFailure) {
      this.subsystems.auth = 'failed';
      this.subsystems.account = 'INVALID';
      this.subsystems.assets = 'unavailable';
      this.subsystems.marketData = 'unavailable';
      this.subsystems.candles = 'stopped';
      this.subsystems.strategy = 'locked';
      this.subsystems.overall = 'AUTH_FAILED';
      this.sessionStatus = 'expired';
    } else if (isDisconnected) {
      this.subsystems.auth = 'none';
      this.subsystems.account = 'DISCONNECTED';
      this.subsystems.assets = 'waiting';
      this.subsystems.marketData = 'disconnected';
      this.subsystems.candles = 'stopped';
      this.subsystems.strategy = 'wait';
      this.subsystems.overall = 'DISCONNECTED';
    } else {
      this.subsystems.auth = 'none';
      this.subsystems.account = 'UNKNOWN';
      this.subsystems.assets = 'waiting';
      this.subsystems.marketData = 'waiting';
      this.subsystems.candles = 'waiting';
      this.subsystems.strategy = 'wait';
      this.subsystems.overall = 'DISCONNECTED';
    }

    this.ticksCount = 0;
    this.candleBuilder.clear();
    if (this.assetsMap.size === 0) {
      this.seedDefaultAssets();
    }
    this.sentimentMap.clear();
    this.pendingBinary = null;
  }

  public connect(): void {
    const activeCtx = this.accountManager.getActiveContext();
    const generation = this.accountManager.getSessionGeneration();

    // Dynamically ensure endpoint aligns with active mode (demo-api-*.po.market vs api-*.po.market)
    this.endpoint = this.getEffectiveEndpoint(activeCtx.mode);

    if (!activeCtx.sessionToken || activeCtx.sessionToken.length < 8) {
      this.log(`No ${activeCtx.mode} Pocket Option session/SSD token configured. Pipeline idle in DISCONNECTED state.`, 'info');
      this.cleanCurrentSocket();
      this.resetLiveConnectionState('disconnected');
      this.activeConnectionId = null;
      this.sessionStatus = 'none';
      this.authError = `No valid Pocket Option session token provided for ${activeCtx.mode} account. Connect your account in Settings.`;
      this.strategyWaitReason = 'Awaiting Pocket Option account connection.';
      this.setStatus('disconnected');
      return;
    }

    // Pre-flight Account Context Validation
    const parsed = PocketOptionAuthManager.parse({
      sessionToken: activeCtx.sessionToken,
      expectedMode: activeCtx.mode,
      uid: activeCtx.uid,
      platform: activeCtx.platform,
      endpoint: this.endpoint,
    });

    const preValidation = PocketOptionAuthManager.validate(parsed, activeCtx.mode);
    this.authValidationResult = preValidation;

    if (!preValidation.isValid) {
      this.log(`[AUTH] Connection blocked by safety validation: ${preValidation.error}`, 'error');
      this.cleanCurrentSocket();
      this.resetLiveConnectionState('auth_failed');
      this.activeConnectionId = null;
      this.sessionStatus = 'invalid';
      this.authError = preValidation.error;
      this.strategyWaitReason = preValidation.error;
      this.subsystems.auth = 'failed';
      this.subsystems.overall = 'AUTH_FAILED';
      this.lastAuthResponse = 'VALIDATION_FAILED';
      this.setStatus('error');
      return;
    }

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return;
    }

    this.cleanCurrentSocket();

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    const connectionId = 'po_' + Date.now() + '_' + crypto.randomUUID().slice(0, 8);
    this.activeConnectionId = connectionId;
    this.accountManager.setConnectionId(activeCtx.mode, connectionId);

    this.resetLiveConnectionState('manual');

    this.isExplicitlyClosed = false;
    this.authVerified = false;
    this.authError = null;
    this.subsystems.websocket = 'connecting';
    this.subsystems.auth = 'pending';
    this.subsystems.account = 'LOADING';
    this.subsystems.overall = 'CONNECTING';
    this.strategyWaitReason = `Connecting to Pocket Option WebSocket server (${activeCtx.mode})...`;
    this.setStatus('connecting');

    const currentConnId = connectionId;
    const currentGen = generation;

    this.log(`Establishing WebSocket transport to ${this.endpoint} (Conn ID: ${currentConnId}, Gen: ${currentGen}, Mode: ${activeCtx.mode})...`);

    try {
      const wsHeaders: Record<string, string> = {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
        Origin: 'https://pocketoption.com',
      };
      if (activeCtx.sessionToken && activeCtx.sessionToken.length >= 8) {
        wsHeaders['Cookie'] = `SSID=${activeCtx.sessionToken}; session=${activeCtx.sessionToken};`;
      }

      this.ws = new WebSocket(this.endpoint, {
        headers: wsHeaders,
        handshakeTimeout: 10000,
      });

      this.ws.on('open', () => this.handleOpen(currentConnId, currentGen));
      this.ws.on('message', (data: WebSocket.RawData, isBinary: boolean) =>
        this.handleIncomingMessage(data, isBinary, currentConnId, currentGen)
      );
      this.ws.on('error', (err) => this.handleError(err, currentConnId, currentGen));
      this.ws.on('close', (code, reason) => this.handleClose(code, reason, currentConnId, currentGen));
    } catch (err: any) {
      this.handleError(err, currentConnId, currentGen);
    }
  }

  public disconnect(): void {
    this.isExplicitlyClosed = true;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.balanceTimeout) {
      clearTimeout(this.balanceTimeout);
      this.balanceTimeout = null;
    }
    if (this.authTimeout) {
      clearTimeout(this.authTimeout);
      this.authTimeout = null;
    }
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }

    this.cleanCurrentSocket();
    this.activeConnectionId = null;
    this.sessionStatus = 'none';
    this.resetLiveConnectionState('disconnected');
    this.strategyWaitReason = 'Connection closed by user.';
    this.setStatus('disconnected');
    this.log('Pocket Option WebSocket disconnected manually.');
  }

  public getSessionToken(): string {
    return this.accountManager.getActiveContext().sessionToken;
  }

  public getSessionGeneration(): number {
    return this.accountManager.getSessionGeneration();
  }

  /**
   * Switches active account mode (REAL vs DEMO).
   * Increments sessionGeneration to reject stale callbacks and destroys old connection.
   */
  public switchAccountMode(newMode: AccountMode): void {
    this.log(`[ACCOUNT] Switching account mode to ${newMode}...`);
    this.cleanCurrentSocket();
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.reconnectAttempts = 0;
    this.authVerified = false;
    this.authError = null;
    this.lastAuthResponse = null;

    this.resetLiveConnectionState('manual');
    this.accountManager.switchMode(newMode);
    this.endpoint = this.getEffectiveEndpoint(newMode);
    this.accountInfo = this.accountManager.buildAccountInfo();

    const activeCtx = this.accountManager.getActiveContext();
    if (activeCtx.sessionToken) {
      this.connect();
    } else {
      this.setStatus('disconnected');
      this.subsystems.overall = 'DISCONNECTED';
      this.strategyWaitReason = `Awaiting ${newMode} account credentials.`;
      this.notifyStatusChange();
    }
  }

  /**
   * Hard Reset on SSD/token update.
   * Stops old connection, increments generation, sets credentials in isolated container, and reconnects.
   */
  public updateSsd(
    newSessionToken: string,
    isDemo?: boolean,
    endpoint?: string,
    uid?: number | string | null,
    autoConnect: boolean = true
  ): void {
    // 1. Increment generation to invalidate any obsolete packets or race conditions
    const newGen = this.accountManager.incrementGeneration();
    this.log(`[AUTH] Hard reset initiated. Advanced connection generation to #${newGen}. Tearing down active connection...`);

    // 2. Cancel any pending handshakes from older generations
    this.cancelAllPendingHandshakes('Superseded by new connection request');

    this.isExplicitlyClosed = false;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.reconnectAttempts = 0;
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.balanceTimeout) {
      clearTimeout(this.balanceTimeout);
      this.balanceTimeout = null;
    }
    if (this.authTimeout) {
      clearTimeout(this.authTimeout);
      this.authTimeout = null;
    }

    this.cleanCurrentSocket();

    this.authVerified = false;
    this.authUid = null;
    this.authError = null;
    this.sessionStatus = 'none';
    this.lastAuthResponse = null;
    this.authValidationResult = null;

    // First parse credentials from token to auto-detect mode from payload if present
    const preParsed = PocketOptionAuthManager.parse({
      sessionToken: newSessionToken,
      isDemo,
      uid,
    });

    // Determine target mode: explicit isDemo takes highest precedence
    let targetMode: AccountMode;
    if (isDemo !== undefined && isDemo !== null) {
      targetMode = isDemo ? 'DEMO' : 'REAL';
    } else if (preParsed.detectedModeFromPayload) {
      targetMode = preParsed.detectedModeFromPayload;
    } else {
      targetMode = this.accountManager.getActiveMode();
    }

    if (endpoint) {
      this.endpoint = PocketOptionService.cleanEndpoint(endpoint);
    }
    this.endpoint = this.getEffectiveEndpoint(targetMode, newSessionToken);

    const parsed = PocketOptionAuthManager.parse({
      sessionToken: newSessionToken,
      expectedMode: targetMode,
      isDemo: targetMode === 'DEMO',
      uid,
      endpoint: this.endpoint,
    });

    const finalUid = parsed.uid || (uid ? parseInt(String(uid), 10) : null);

    if (this.accountManager.getActiveMode() !== targetMode) {
      this.accountManager.switchMode(targetMode);
    }

    this.accountManager.setCredentials({
      mode: targetMode,
      sessionToken: parsed.session || newSessionToken.trim(),
      uid: finalUid && finalUid > 0 ? finalUid : null,
      platform: parsed.platform,
    });

    // STRICT RULE: Never extract or fabricate unverified balance from raw input text.
    // Real balance must ONLY be recorded when the broker sends verified successauth / updateBalance packets.

    this.resetLiveConnectionState('manual');
    this.accountInfo = this.accountManager.buildAccountInfo();

    if (autoConnect) {
      this.connect();
    }
  }

  /**
   * Asynchronous connection with handshake awaiting real authentication & balance verification.
   * Hard timeout enforced (defaults to 15s).
   */
  public async connectWithHandshake(params: {
    sessionToken: string;
    isDemo?: boolean;
    endpoint?: string;
    uid?: number | string | null;
    attemptId?: string;
    timeoutMs?: number;
  }): Promise<{
    success: boolean;
    ok: boolean;
    state: string;
    account: any;
    balance: number | null;
    accountMode: string;
    errorCode?: string;
    error?: string;
    diagnostics: any;
    generation: number;
    connectionId: string | null;
  }> {
    const timeoutDuration = params.timeoutMs || 15000;

    // Trigger SSD update and generation increment WITHOUT connecting immediately
    this.updateSsd(params.sessionToken, params.isDemo, params.endpoint, params.uid, false);
    const targetGen = this.accountManager.getSessionGeneration();
    const currentAttemptId = params.attemptId;

    // Check if pre-validation failed
    if (this.subsystems.overall === 'AUTH_FAILED' || this.subsystems.auth === 'failed') {
      return {
        success: false,
        ok: false,
        state: 'AUTH_FAILED',
        account: this.accountInfo,
        balance: null,
        accountMode: this.accountManager.getActiveMode(),
        error: this.authError || 'Pre-connection validation failed',
        errorCode: 'AUTH_FAILED',
        diagnostics: this.getDiagnostics(),
        generation: targetGen,
        connectionId: this.activeConnectionId,
      };
    }

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        // Remove from pending
        this.pendingHandshakes = this.pendingHandshakes.filter((h) => h.generation !== targetGen);

        this.log(`[AUTH] Connection handshake timed out after ${timeoutDuration}ms (Gen: ${targetGen})`, 'warn');
        this.cleanCurrentSocket();
        this.resetLiveConnectionState('disconnected');
        this.subsystems.overall = 'TIMEOUT';
        this.subsystems.websocket = 'disconnected';
        this.setStatus('error');
        this.notifyStatusChange();

        resolve({
          success: false,
          ok: false,
          state: 'TIMEOUT',
          account: this.accountInfo,
          balance: null,
          accountMode: this.accountManager.getActiveMode(),
          error: `انتهت مهلة انتظار خادم Pocket Option (${Math.round(timeoutDuration / 1000)} ثانية). تأكد من صحة رمز الجلسة والاتصال.`,
          errorCode: 'TIMEOUT',
          diagnostics: this.getDiagnostics(),
          generation: targetGen,
          connectionId: this.activeConnectionId,
        });
      }, timeoutDuration);

      // Register handshake BEFORE invoking connect() so no early responses are missed
      this.pendingHandshakes.push({
        generation: targetGen,
        attemptId: currentAttemptId,
        resolve: (res) => {
          clearTimeout(timer);
          resolve(res);
        },
        timer,
      });

      // Now start the connection
      this.connect();
    });
  }

  public updateConfig(
    endpoint?: string,
    sessionToken?: string,
    isDemo?: boolean,
    uid?: number | string | null
  ): void {
    if (
      sessionToken !== undefined ||
      endpoint !== undefined ||
      isDemo !== undefined ||
      uid !== undefined
    ) {
      const token = sessionToken ?? this.accountManager.getActiveContext().sessionToken;
      this.updateSsd(token, isDemo, endpoint, uid);
    }
  }

  public reconnectExplicit(): void {
    this.isExplicitlyClosed = false;
    this.authDemoFallbackAttempted = null;
    this.authError = null;
    this.sessionStatus = 'active';
    this.subsystems.auth = 'none';
    this.subsystems.overall = 'CONNECTING';
    this.cleanCurrentSocket();
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.reconnectAttempts = 0;
    this.log('[AUTH] Manual reconnection initiated by user. Retrying connection...', 'info');
    this.connect();
  }

  public subscribeAsset(asset: string, timeframe?: number): void {
    const prevAsset = this.activeAsset;
    this.activeAsset = asset;
    if (timeframe) this.timeframe = timeframe;

    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.authVerified) {
      if (prevAsset && prevAsset !== asset) {
        this.sendPacket(`42["unSubscribeSymbol","${prevAsset}"]`);
        this.sendPacket(`42["unsubfor","${prevAsset}"]`);
      }
      this.sendSubscriptionPackets(asset, this.timeframe);
    }
  }

  public requestHistoricalCandles(asset: string, period: number): boolean {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const now = Math.floor(Date.now() / 1000);
      const offset = Math.max(period * 500, 86400);
      this.sendPacket(
        `42["loadHistoryPeriod",{"asset":"${asset}","index":${now},"time":${now},"offset":${offset},"period":${period}}]`
      );
      this.sendPacket(
        `42["loadHistoryPeriodFast",{"asset":"${asset}","index":${now},"time":${now},"offset":${offset},"period":${period}}]`
      );
      this.log(`Dispatched historical candles request for ${asset} (${period}s, offset: ${offset}s)`);
      return true;
    }
    return false;
  }

  private handleOpen(connId: string, generation: number): void {
    if (
      connId !== this.activeConnectionId ||
      generation !== this.accountManager.getSessionGeneration()
    ) {
      return;
    }
    this.socketConnected = true;
    this.subsystems.websocket = 'connecting';
    this.subsystems.overall = 'SOCKET_CONNECTED';
    this.setStatus('connecting');
    this.log(`WebSocket transport open (Conn ID: ${connId}, Gen: ${generation}). Awaiting Engine.IO handshake...`);
    this.reconnectAttempts = 0;
    this.lastError = null;
    this.notifyStatusChange();
  }

  private handleIncomingMessage(
    data: WebSocket.RawData,
    isBinary: boolean,
    connId: string,
    generation: number
  ): void {
    if (
      connId !== this.activeConnectionId ||
      generation !== this.accountManager.getSessionGeneration()
    ) {
      // Discard packets from obsolete connection sessions or previous generations!
      return;
    }

    this.packetCount++;

    if (isBinary || (this.pendingBinary && Buffer.isBuffer(data) && !data.toString('utf-8').startsWith('4'))) {
      this.handleBinaryAttachment(data, connId, generation);
      return;
    }

    const str = data.toString('utf-8');

    // 1. Engine.IO Ping: '2'
    if (str === '2') {
      this.sendPacket('3'); // Engine.IO Pong reply
      return;
    }

    // 2. Engine.IO Pong response: '3'
    if (str === '3') {
      if (this.pingStartTime > 0) {
        this.latencyMs = Date.now() - this.pingStartTime;
        this.lastPing = Date.now();
      }
      return;
    }

    // 3. Engine.IO Handshake: 0{"sid":"..."}
    if (str.startsWith('0{')) {
      this.engineIoConnected = true;
      this.subsystems.overall = 'ENGINE_IO_READY';
      this.notifyStatusChange();
      this.log('Engine.IO handshake verified. Requesting Socket.IO transport channel (40)...');
      this.sendPacket('40'); // Request Socket.IO default namespace
      return;
    }

    // 4. Socket.IO Connected: 40{"sid":"..."} or 40
    if (str.startsWith('40')) {
      this.socketIoConnected = true;
      this.subsystems.websocket = 'connected';
      this.subsystems.overall = 'SOCKET_IO_READY';
      this.setStatus('connected');
      this.notifyStatusChange();
      this.log('Socket.IO transport connected. Dispatching Pocket Option authentication credentials...');
      this.sendAuth(connId, generation);
      this.startHeartbeatLoop();
      return;
    }

    // 5. Socket.IO Disconnected by server: 41
    if (str.startsWith('41')) {
      if (this.subsystems.auth === 'pending') {
        this.handleAuthFailure('ServerDisconnect(41)', null, connId, generation);
      } else {
        this.log('Socket.IO connection terminated by server.', 'warn');
        this.subsystems.websocket = 'disconnected';
        this.setStatus('disconnected');
      }
      return;
    }

    // 6. Socket.IO Binary Event Header: 45<count>-[event, placeholder]
    if (str.startsWith('45')) {
      this.handleBinaryHeader(str, connId, generation);
      return;
    }

    // 7. Standard Socket.IO Text Event (42) or ACK (43) with optional packet ID / namespace
    if (str.startsWith('42') || str.startsWith('43')) {
      const jsonStart = str.indexOf('[');
      if (jsonStart !== -1) {
        try {
          const jsonStr = str.slice(jsonStart);
          const parsed = JSON.parse(jsonStr);
          if (Array.isArray(parsed) && parsed.length >= 2) {
            const eventName = typeof parsed[0] === 'string' ? parsed[0] : 'ack';
            const payload = parsed.length === 2 ? parsed[1] : parsed.slice(1);
            this.handleEventPayload(eventName, payload, connId, generation);
          } else if (Array.isArray(parsed) && parsed.length === 1) {
            if (typeof parsed[0] === 'string') {
              this.handleEventPayload(parsed[0], null, connId, generation);
            } else if (typeof parsed[0] === 'object' && parsed[0] !== null) {
              this.processUpdateBalance(parsed[0], connId, generation);
            }
          }
        } catch (e: any) {
          this.log(`Failed to parse Socket.IO event: ${e.message}`, 'warn');
        }
        return;
      }

      // Check if Socket.IO frame carries direct object without array: e.g. 42{"balance": ...}
      const braceStart = str.indexOf('{');
      if (braceStart !== -1) {
        try {
          const parsed = JSON.parse(str.slice(braceStart));
          if (parsed && typeof parsed === 'object') {
            this.processUpdateBalance(parsed, connId, generation);
            return;
          }
        } catch {
          // ignore
        }
      }
    }

    // 8. Raw JSON message support (broker push without Socket.IO wrapper)
    if (str.startsWith('{') || str.startsWith('[{')) {
      try {
        const parsed = JSON.parse(str);
        if (parsed && typeof parsed === 'object') {
          if (
            parsed.balance !== undefined ||
            parsed.data?.balance !== undefined ||
            parsed.user?.balance !== undefined ||
            parsed.real_balance !== undefined ||
            parsed.demo_balance !== undefined
          ) {
            this.processUpdateBalance(parsed, connId, generation);
            return;
          }
        }
      } catch {
        // ignore
      }
    }
  }

  private handleBinaryHeader(str: string, connId: string, generation: number): void {
    try {
      const jsonStart = str.indexOf('[');
      if (jsonStart === -1) return;

      const countMatch = str.slice(2, jsonStart).match(/(\d+)/);
      const totalAttachments = countMatch ? parseInt(countMatch[1], 10) : 1;

      const parsed = JSON.parse(str.slice(jsonStart));
      if (Array.isArray(parsed) && parsed.length > 0) {
        const eventName = parsed[0];
        const payload = parsed.length > 1 ? parsed[1] : null;

        this.pendingBinary = {
          eventName,
          payload,
          totalAttachments,
          receivedAttachments: [],
          connId,
          generation,
        };
      }
    } catch (e: any) {
      this.log(`Error parsing binary event header: ${e.message}`, 'warn');
    }
  }

  private handleBinaryAttachment(
    data: WebSocket.RawData,
    connId: string,
    generation: number
  ): void {
    if (
      !this.pendingBinary ||
      (this.pendingBinary.connId && this.pendingBinary.connId !== connId) ||
      (this.pendingBinary.generation && this.pendingBinary.generation !== generation)
    ) {
      try {
        const str = data.toString('utf-8');
        if (str.startsWith('42[')) {
          const parsed = JSON.parse(str.slice(2));
          if (Array.isArray(parsed) && parsed.length >= 2) {
            this.handleEventPayload(parsed[0], parsed[1], connId, generation);
          }
        }
      } catch {
        // ignore
      }
      return;
    }

    try {
      const bufStr = Buffer.isBuffer(data) ? data.toString('utf-8') : String(data);
      let decoded: any;

      try {
        decoded = JSON.parse(bufStr);
      } catch {
        decoded = bufStr;
      }

      this.pendingBinary.receivedAttachments.push(decoded);

      if (this.pendingBinary.receivedAttachments.length >= this.pendingBinary.totalAttachments) {
        const { eventName, payload, receivedAttachments } = this.pendingBinary;
        this.pendingBinary = null;

        const combinedPayload =
          receivedAttachments.length === 1 ? receivedAttachments[0] : (payload || receivedAttachments);
        this.handleEventPayload(eventName, combinedPayload, connId, generation);
      }
    } catch (e: any) {
      this.log(`Error handling binary attachment: ${e.message}`, 'warn');
      this.pendingBinary = null;
    }
  }

  private handleEventPayload(
    eventName: string,
    payload: any,
    connId: string,
    generation: number
  ): void {
    if (
      connId !== this.activeConnectionId ||
      generation !== this.accountManager.getSessionGeneration()
    ) {
      return;
    }

    const norm = (eventName || '').toLowerCase();

    // Safe Developer Diagnostics (Strictly no SSD/tokens/cookies/secrets logged)
    if (this.authVerified || this.subsystems.auth === 'pending') {
      const pType = Array.isArray(payload) ? 'array' : typeof payload;
      const keys = payload && typeof payload === 'object' ? Object.keys(payload).slice(0, 10) : [];
      console.log(`[PO-DEBUG] MESSAGE RECEIVED eventName=${eventName} packetType=event payloadType=${pType} payloadKeys=[${keys.join(', ')}]`);
    }

    // 1. Balance synchronization events (case-insensitive & multiple aliases)
    if (
      norm === 'successupdatebalance' ||
      norm === 'updatebalance' ||
      norm === 'update_balance' ||
      norm === 'balance' ||
      norm === 'successbalance' ||
      norm === 'balancechanged' ||
      norm === 'balance_changed' ||
      norm === 'changebalance' ||
      norm === 'change_balance' ||
      norm === 'userbalance' ||
      norm === 'user_balance' ||
      norm === 'accountbalance' ||
      norm === 'account_balance' ||
      (norm.includes('balance') && !norm.includes('history'))
    ) {
      // Buffer early balance packet if authentication is still marked pending
      if (this.subsystems.auth === 'pending') {
        this.earlyAccountMessageBuffer.push({
          eventName,
          payload,
          connId,
          generation,
          receivedAt: Date.now(),
        });
        this.handleAuthSuccess(payload, connId, generation);
      }
      this.processUpdateBalance(payload, connId, generation);
      return;
    }

    // 2. Authentication success events
    if (
      norm === 'successauth' ||
      norm === 'authsuccess' ||
      norm === 'auth_success' ||
      norm === 'authorized' ||
      (norm === 'auth' && payload && (payload.status === true || payload.uid || payload.id))
    ) {
      this.handleAuthSuccess(payload, connId, generation);
      return;
    }

    // 2b. User profile & account change events indicating authenticated session
    if (
      norm === 'user' ||
      norm === 'profile' ||
      norm === 'user_profile' ||
      norm === 'change-account' ||
      norm === 'changeaccount' ||
      norm === 'change_account'
    ) {
      if (this.subsystems.auth === 'pending') {
        this.handleAuthSuccess(payload, connId, generation);
      }
      if (payload && typeof payload === 'object') {
        this.processUpdateBalance(payload, connId, generation);
      }
      return;
    }

    // 3. Authentication failure events
    if (
      norm === 'notauthorized' ||
      norm === 'failauth' ||
      norm === 'auth_failed' ||
      norm === 'auth_error' ||
      norm === 'autherror' ||
      norm === 'authorization_failed'
    ) {
      // If platform auth is already verified, do not kill the socket due to minor command rejection
      if (this.authVerified) {
        this.log(`[PO-DEBUG] Ignoring secondary ${eventName} event since session is already verified and active.`, 'info');
        return;
      }
      this.handleAuthFailure(eventName, payload, connId, generation);
      return;
    }

    // 4. Real Deal & Trade Execution Events
    if (norm === 'successopenorder' || norm === 'successopen_order' || norm === 'deal_opened') {
      this.processDealSuccess(payload);
      return;
    }

    if (norm === 'failopenorder' || norm === 'failopen_order' || norm === 'deal_failed') {
      this.processDealFailure(payload);
      return;
    }

    if (norm === 'closeorder' || norm === 'deals_close' || norm === 'deal_closed') {
      this.processDealClosed(payload);
      return;
    }

    switch (eventName) {
      case 'updateStream':
        if (this.subsystems.auth === 'pending') {
          this.handleAuthSuccess(payload, connId, generation);
        }
        this.processStreamUpdate(payload, connId, generation);
        break;

      case 'updateAssets':
        if (this.subsystems.auth === 'pending') {
          this.handleAuthSuccess(payload, connId, generation);
        }
        this.processAssetsUpdate(payload, connId, generation);
        break;

      case 'loadHistoryPeriodFast':
      case 'updateHistoryNewFast':
      case 'loadHistoryPeriod':
      case 'updateHistoryFast':
      case 'updateHistory':
      case 'history':
      case 'history_candles':
      case 'loadHistory':
        if (this.subsystems.auth === 'pending') {
          this.handleAuthSuccess(payload, connId, generation);
        }
        this.processHistoricalCandles(payload, connId, generation);
        break;

      case 'updateSentiment':
        this.processSentiment(payload);
        break;

      default:
        break;
    }
  }

  private sendAuth(connId?: string, generation?: number): void {
    if (
      (connId && connId !== this.activeConnectionId) ||
      (generation && generation !== this.accountManager.getSessionGeneration())
    ) {
      return;
    }

    const activeMode = this.accountManager.getActiveMode();
    const snapshot = this.accountManager.createAuthSnapshot({
      mode: activeMode,
      connectionId: connId || this.activeConnectionId || '',
    });

    const parsed = PocketOptionAuthManager.parse({
      sessionToken: snapshot.sessionToken,
      expectedMode: snapshot.mode,
      uid: snapshot.uid,
      platform: snapshot.platform,
      endpoint: this.endpoint,
    });

    const validation = PocketOptionAuthManager.validate(parsed, snapshot.mode, { allowZeroUid: true });
    this.authValidationResult = validation;

    const debugLines = PocketOptionAuthManager.getSafeDebugLog(parsed, validation, this.endpoint);
    for (const line of debugLines) {
      this.log(line, 'info');
    }

    if (!validation.isValid) {
      this.log(`[AUTH] Pre-send validation FAILED: ${validation.error}`, 'error');
      this.subsystems.auth = 'failed';
      this.subsystems.overall = 'AUTH_FAILED';
      this.sessionStatus = 'invalid';
      this.authError = validation.error;
      this.strategyWaitReason = validation.error;
      this.lastAuthResponse = 'VALIDATION_FAILED';

      this.cleanCurrentSocket();
      this.notifyStatusChange();
      return;
    }

    this.subsystems.auth = 'pending';
    this.subsystems.overall = 'AUTHENTICATING';
    this.authError = null;
    this.strategyWaitReason = `Authenticating ${activeMode} session with Pocket Option server...`;

    this.log(`[AUTH] Dispatching canonical authentication frame (Conn ID: ${connId || this.activeConnectionId}, Gen: ${snapshot.generation})`);
    this.log(
      `[AUTH] Target: ${this.endpoint} | Mode: ${snapshot.mode} (isDemo: ${snapshot.isDemo}) | UID: ${
        PocketOptionAuthManager.maskUid(snapshot.uid) || (snapshot.isDemo === 1 ? '0 (DEMO)' : 'MISSING')
      } | Platform: ${snapshot.platform}`
    );

    this.authEventSent = true;
    this.sendPacket(validation.packet!);

    if (this.authTimeout) clearTimeout(this.authTimeout);
    this.authTimeout = setTimeout(() => {
      if (this.subsystems.auth === 'pending') {
        this.log('[AUTH] Pocket Option authorization timed out (no response to auth packet within 12s)', 'warn');
        this.handleAuthFailure(
          'AuthTimeout',
          { reason: 'No response from auth service within 12s' },
          connId,
          generation
        );
      }
    }, 12000);
  }

  /**
   * handleAuthSuccess - The ONLY function allowed to transition:
   * authenticated = true and authVerified = true.
   */
  private handleAuthSuccess(payload: any, connId?: string, generation?: number): void {
    if (
      (connId && connId !== this.activeConnectionId) ||
      (generation && generation !== this.accountManager.getSessionGeneration())
    ) {
      return;
    }

    if (this.authTimeout) {
      clearTimeout(this.authTimeout);
      this.authTimeout = null;
    }

    const activeMode = this.accountManager.getActiveMode();
    let detectedUid: number | null = null;
    const rawUid =
      payload?.id || payload?.uid || (typeof payload === 'string' && payload !== 'success' ? payload : null);
    if (rawUid) {
      const num = parseInt(String(rawUid), 10);
      if (!isNaN(num) && num > 0) detectedUid = num;
    }

    // Set auth success in isolated account manager
    this.accountManager.setAuthSuccess(this.accountManager.getSessionGeneration(), activeMode, detectedUid);

    this.lastAuthResponse = 'successauth';
    this.authVerified = true;
    this.sessionStatus = 'active';
    this.authError = null;
    this.subsystems.auth = 'success';
    this.subsystems.account = 'READY';
    this.subsystems.overall = 'AUTHENTICATED';

    const updatedAcc = this.accountManager.buildAccountInfo();
    this.accountInfo = updatedAcc;
    this.authUid = updatedAcc.uidMasked;

    // Extract initial balance if present in auth payload
    if (payload && typeof payload === 'object') {
      const rawBal =
        payload.balance !== undefined
          ? payload.balance
          : activeMode === 'REAL'
          ? payload.real_balance ?? payload.realBalance ?? payload.amount
          : payload.demo_balance ?? payload.demoBalance ?? payload.amount;
      if (rawBal !== undefined && rawBal !== null) {
        const b = typeof rawBal === 'number' ? rawBal : parseFloat(String(rawBal));
        if (!isNaN(b) && b >= 0) {
          this.accountManager.updateBalance(
            this.accountManager.getSessionGeneration(),
            activeMode,
            b,
            payload.currency || 'USD'
          );
          this.subsystems.account = 'LIVE';
          this.log(`Account balance extracted on authentication: $${b.toFixed(2)} (${activeMode} ACCOUNT)`);
        }
      }
    }

    // If server sent verified UID in successauth and we lacked it, persist it
    if (detectedUid && (!updatedAcc.uid || updatedAcc.uid === 0)) {
      this.accountManager.setCredentials({
        mode: activeMode,
        sessionToken: this.accountManager.getActiveContext().sessionToken,
        uid: detectedUid,
      });
      this.accountInfo = this.accountManager.buildAccountInfo();
      this.authUid = this.accountInfo.uidMasked;
    }

    // Explicit confirmation log requirement: Connected to DEMO Account / Connected to REAL Account
    const confirmationMsg = `Connected to ${activeMode} Account`;
    console.log(`[PO-DEBUG] ${confirmationMsg}`);
    this.log(`[AUTH] ${confirmationMsg}`);
    this.log(`[AUTH] Auth response received: successauth`);
    this.log(`[AUTH] Connection ID: ${connId || this.activeConnectionId}`);
    this.log(`[AUTH] Authentication state: VERIFIED (${activeMode}${this.authUid ? `, UID: ${this.authUid}` : ''})`);

    // Check if early account packet was buffered prior to auth confirmation
    const earlyBalance = this.earlyAccountMessageBuffer.find((b) => b.generation === generation);
    if (earlyBalance) {
      this.log(`[PO-DEBUG] Replaying early buffered balance message for generation: ${generation}`);
      this.processUpdateBalance(earlyBalance.payload, connId, generation);
    }

    this.authDemoFallbackAttempted = null;

    // Request account balance through multiple canonical protocol methods
    if (this.subsystems.account !== 'LIVE') {
      this.subsystems.account = 'LOADING';
    }
    // Request account balance using standard Pocket Option protocol only
    if (this.subsystems.account !== 'LIVE') {
      this.subsystems.account = 'LOADING';
    }
    this.sendPacket(`42["change-account",{"isDemo":${activeMode === 'DEMO' ? 1 : 0}}]`);
    this.sendPacket('42["updateBalance"]');
    this.scheduleBalanceTimeout();

    // Fast balance retry probe
    setTimeout(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN && this.authVerified && this.accountInfo.balance === null) {
        this.sendPacket(`42["change-account",{"isDemo":${activeMode === 'DEMO' ? 1 : 0}}]`);
        this.sendPacket('42["updateBalance"]');
      }
    }, 1200);

    // Subscribe to symbol price stream & candle history
    this.sendSubscriptionPackets(this.activeAsset, this.timeframe);
    this.notifyStatusChange();

    // Immediate Handshake Resolution:
    // Once platform authentication is verified, resolve handshake immediately so UI does not time out!
    this.resolveHandshakes(generation, {
      success: true,
      ok: true,
      state: this.accountInfo.balance !== null ? 'READY' : 'AUTHENTICATED',
      account: this.accountManager.buildAccountInfo(),
      balance: this.accountInfo.balance,
      accountMode: activeMode,
      diagnostics: this.getDiagnostics(),
      generation,
      connectionId: connId || this.activeConnectionId,
      uid: detectedUid || this.authUid,
    });
  }

  /**
   * handleAuthFailure - The single source of truth for resetting state upon authentication failure.
   */
  private handleAuthFailure(
    eventName: string,
    payload: any,
    connId?: string,
    generation?: number
  ): void {
    if (
      (connId && connId !== this.activeConnectionId) ||
      (generation && generation !== this.accountManager.getSessionGeneration())
    ) {
      return;
    }

    if (this.authTimeout) {
      clearTimeout(this.authTimeout);
      this.authTimeout = null;
    }

    const activeMode = this.accountManager.getActiveMode();
    const activeCtx = this.accountManager.getActiveContext();

    // Automatic Session Bridge Fallback for DEMO mode:
    // If the server rejected direct DEMO (isDemo: 1) auth (e.g. session was created while in REAL mode on Pocket Option),
    // automatically attempt session authentication with isDemo: 0 and then switch to DEMO mode upon success.
    const norm = eventName.toLowerCase();
    if (
      activeMode === 'DEMO' &&
      this.authDemoFallbackAttempted !== (generation || this.accountManager.getSessionGeneration()) &&
      (norm === 'notauthorized' || norm === 'failauth') &&
      this.ws &&
      this.ws.readyState === WebSocket.OPEN
    ) {
      this.authDemoFallbackAttempted = generation || this.accountManager.getSessionGeneration();
      this.log('[AUTH] Pocket Option rejected direct isDemo:1 frame. Attempting session bridge with isDemo:0, then auto-switching to DEMO...', 'info');

      const bridgePacket = PocketOptionAuthManager.buildCanonicalPayload(
        activeCtx.sessionToken,
        'REAL',
        activeCtx.uid,
        activeCtx.platform
      );
      this.sendPacket(bridgePacket.packet);

      if (this.authTimeout) clearTimeout(this.authTimeout);
      this.authTimeout = setTimeout(() => {
        if (this.subsystems.auth === 'pending') {
          this.handleAuthFailure('AuthTimeout', { reason: 'Bridge auth timed out' }, connId, generation);
        }
      }, 10000);
      return;
    }

    const maskedSession = PocketOptionAuthManager.maskSecret(activeCtx.sessionToken);
    const maskedUid = PocketOptionAuthManager.maskUid(activeCtx.uid);

    const reason = `Pocket Option Authentication Rejected (${eventName}): The session token is invalid, expired, or unauthorized for ${activeMode} account.`;
    this.accountManager.setAuthFailure(this.accountManager.getSessionGeneration(), activeMode, reason, eventName);

    this.lastAuthResponse = eventName;
    this.authVerified = false;
    this.sessionStatus = 'invalid';
    this.authError = reason;
    this.strategyWaitReason = `Authentication notice: Pocket Option returned '${eventName}'. Provide a valid session token in Settings.`;

    this.cleanCurrentSocket();
    this.subsystems.websocket = 'disconnected';
    this.subsystems.auth = 'failed';
    this.subsystems.overall = 'AUTH_FAILED';
    this.setStatus('error');

    // Real-time diagnostic log (redacted of secrets)
    console.warn(
      `[PO-AUTH-DIAGNOSTIC] Server Rejection Captured in Real-Time:\n` +
      `  Server Event: ${eventName}\n` +
      `  Account Mode: ${activeMode}\n` +
      `  UID: ${maskedUid}\n` +
      `  Session Token: ${maskedSession}\n` +
      `  Rejection Reason: ${reason}\n` +
      `  Generation: #${generation || this.accountManager.getSessionGeneration()}\n` +
      `  Action Required: Obtain fresh session token from Pocket Option platform.`
    );
    this.log(`[AUTH] Session rejected by server (${eventName}). Update SSD in Settings.`, 'warn');
    this.notifyStatusChange();

    this.rejectHandshakes(generation || this.accountManager.getSessionGeneration(), {
      success: false,
      ok: false,
      state: 'AUTH_FAILED',
      account: this.accountInfo,
      balance: null,
      accountMode: activeMode,
      error: reason,
      errorCode: 'AUTH_FAILED',
      diagnostics: this.getDiagnostics(),
      generation: generation || this.accountManager.getSessionGeneration(),
      connectionId: connId || this.activeConnectionId,
    });
  }

  private processUpdateBalance(payload: any, connId?: string, generation?: number): void {
    if (
      (connId && connId !== this.activeConnectionId) ||
      (generation && generation !== this.accountManager.getSessionGeneration())
    ) {
      return;
    }

    if (this.balanceTimeout) {
      clearTimeout(this.balanceTimeout);
      this.balanceTimeout = null;
    }

    let balanceNum = NaN;
    const activeMode = this.accountManager.getActiveMode();
    let targetMode = activeMode;
    let currency = 'USD';

    if (payload !== null && payload !== undefined) {
      if (typeof payload === 'number') {
        balanceNum = payload;
      } else if (typeof payload === 'string') {
        const parsed = parseFloat(payload);
        if (!isNaN(parsed)) balanceNum = parsed;
      } else if (Array.isArray(payload) && payload.length > 0) {
        // Pocket Option array formats:
        // 1. [balance, isDemo, currency?] e.g. [10000, 1] or [500.5, 0, "USD"]
        // 2. [isDemo, balance, currency?] e.g. [1, 10000]
        // 3. [uid, balance] e.g. [98148605, 10000]
        // 4. [{ balance: 1000, isDemo: 1 }]
        // 5. [balance] e.g. [10000]
        const first = payload[0];
        const second = payload.length > 1 ? payload[1] : undefined;
        const third = payload.length > 2 ? payload[2] : undefined;

        if (typeof first === 'object' && first !== null) {
          if (first.isDemo !== undefined) {
            targetMode = first.isDemo === 1 || first.isDemo === true || String(first.isDemo) === '1' ? 'DEMO' : 'REAL';
          }
          if (first.currency && typeof first.currency === 'string') {
            currency = first.currency;
          }
          const arrBal =
            first.balance ??
            (targetMode === 'REAL' ? (first.real_balance ?? first.realBalance) : (first.demo_balance ?? first.demoBalance)) ??
            first.amount ??
            first.value;
          if (arrBal !== undefined && arrBal !== null) balanceNum = Number(arrBal);
        } else if (typeof first === 'number' || (typeof first === 'string' && !isNaN(parseFloat(first)))) {
          const firstNum = typeof first === 'number' ? first : parseFloat(first);
          if (second === 0 || second === 1 || typeof second === 'boolean' || second === '0' || second === '1') {
            // [balance, isDemo]: first is balance, second is demo flag
            balanceNum = firstNum;
            targetMode = second === 1 || second === true || second === '1' ? 'DEMO' : 'REAL';
            if (typeof third === 'string') currency = third;
          } else if ((firstNum === 0 || firstNum === 1) && (typeof second === 'number' || (typeof second === 'string' && !isNaN(parseFloat(second))))) {
            // [isDemo, balance]: first is demo flag, second is balance
            targetMode = firstNum === 1 ? 'DEMO' : 'REAL';
            balanceNum = typeof second === 'number' ? second : parseFloat(second);
            if (typeof third === 'string') currency = third;
          } else if (firstNum > 1000000 && (typeof second === 'number' || (typeof second === 'string' && !isNaN(parseFloat(second))))) {
            // [uid, balance]: first is large UID, second is balance
            balanceNum = typeof second === 'number' ? second : parseFloat(second);
          } else {
            balanceNum = firstNum;
          }
        }
      } else if (typeof payload === 'object') {
        if (payload.isDemo !== undefined) {
          targetMode =
            payload.isDemo === 1 || payload.isDemo === true || String(payload.isDemo) === '1'
              ? 'DEMO'
              : 'REAL';
        }
        if (payload.currency && typeof payload.currency === 'string') {
          currency = payload.currency;
        }

        // Try direct properties
        const rawBal =
          payload.balance !== undefined
            ? payload.balance
            : targetMode === 'REAL'
            ? payload.real_balance ?? payload.realBalance ?? payload.real ?? payload.amount ?? payload.value
            : payload.demo_balance ?? payload.demoBalance ?? payload.demo ?? payload.amount ?? payload.value;

        if (rawBal !== undefined && rawBal !== null) {
          balanceNum = typeof rawBal === 'number' ? rawBal : parseFloat(String(rawBal));
        } else if (payload.balances && typeof payload.balances === 'object') {
          const balObj = targetMode === 'REAL' ? payload.balances.real ?? payload.balances.real_balance : payload.balances.demo ?? payload.balances.demo_balance;
          if (balObj !== undefined && balObj !== null) balanceNum = Number(balObj);
        } else if (payload.data && typeof payload.data === 'object') {
          const innerBal =
            payload.data.balance ??
            (targetMode === 'REAL'
              ? payload.data.real_balance ?? payload.data.realBalance ?? payload.data.amount
              : payload.data.demo_balance ?? payload.data.demoBalance ?? payload.data.amount);
          if (innerBal !== undefined && innerBal !== null) balanceNum = Number(innerBal);
        } else if (payload.user && typeof payload.user === 'object') {
          const uBal = payload.user.balance ?? (targetMode === 'REAL' ? payload.user.real_balance : payload.user.demo_balance);
          if (uBal !== undefined && uBal !== null) balanceNum = Number(uBal);
        }
      }
    }

    if (!isNaN(balanceNum)) {
      // Receiving a verified balance confirms active authorization
      if (!this.authVerified) {
        this.authVerified = true;
        this.subsystems.auth = 'success';
      }

      this.accountManager.updateBalance(
        this.accountManager.getSessionGeneration(),
        targetMode,
        balanceNum,
        currency
      );

      // Update activeMode context balance ONLY if targetMode matches activeMode
      if (targetMode === activeMode) {
        this.accountManager.updateBalance(
          this.accountManager.getSessionGeneration(),
          activeMode,
          balanceNum,
          currency
        );
      }

      this.accountInfo = this.accountManager.buildAccountInfo();
      this.subsystems.account = 'LIVE';
      if (this.subsystems.overall === 'AUTHENTICATED' || this.subsystems.overall === 'AUTHENTICATING' || this.subsystems.overall === 'CONNECTING') {
        this.subsystems.overall = 'AUTHENTICATED';
      }
      this.log(`Account balance verified: $${balanceNum.toFixed(2)} (${targetMode} ACCOUNT)`);
      console.log(`[PO-DEBUG] BALANCE PACKET METADATA: eventName=processUpdateBalance hasNumericBalance=true currency=${currency} mode=${targetMode}`);
      this.notifyStatusChange();

      // Broadcast balance packet to real-time subscribers
      for (const listener of this.onBalanceUpdatedListeners) {
        try {
          listener({
            balance: balanceNum,
            accountMode: targetMode,
            currency,
            generation: generation || this.accountManager.getSessionGeneration(),
            connectionId: connId || this.activeConnectionId,
            accountId: this.accountInfo.uidMasked,
          });
        } catch (err) {
          console.warn('[PO-ENGINE] Error in onBalanceUpdated listener:', err);
        }
      }

      this.resolveHandshakes(generation || this.accountManager.getSessionGeneration(), {
        success: true,
        ok: true,
        state: 'READY',
        account: this.accountInfo,
        balance: balanceNum,
        diagnostics: this.getDiagnostics(),
        generation: generation || this.accountManager.getSessionGeneration(),
        connectionId: connId || this.activeConnectionId,
      });
    }
  }

  private scheduleBalanceTimeout(): void {
    if (this.balanceTimeout) clearTimeout(this.balanceTimeout);
    this.balanceTimeout = setTimeout(() => {
      if (this.subsystems.account === 'LOADING') {
        const activeCtx = this.accountManager.getActiveContext();
        if (activeCtx.balance !== null && !isNaN(activeCtx.balance)) {
          this.subsystems.account = 'LIVE';
          this.accountInfo = this.accountManager.buildAccountInfo();
          this.log(`Using cached/extracted balance: $${activeCtx.balance.toFixed(2)} (${activeCtx.mode})`);
        } else if (this.subsystems.auth === 'success') {
          this.subsystems.account = 'UNAVAILABLE';
          this.accountInfo.balanceStatus = 'UNAVAILABLE';
          this.log('Account balance data unavailable from current session scope.', 'warn');
        }
      }
    }, 12000);
  }

  private sendSubscriptionPackets(asset: string, period: number): void {
    this.log(`Subscribing to Pocket Option market stream for ${asset} (${period}s)...`);
    this.sendPacket('42["indicator/load"]');
    this.sendPacket('42["favorite/load"]');
    this.sendPacket('42["price-alert/load"]');

    this.sendPacket(`42["subscribeSymbol","${asset}"]`);
    this.sendPacket(`42["changeSymbol",{"asset":"${asset}","period":${period}}]`);
    this.sendPacket(`42["subfor","${asset}"]`);

    const now = Math.floor(Date.now() / 1000);
    const offset = Math.max(period * 200, 14400);
    this.sendPacket(
      `42["loadHistoryPeriod",{"asset":"${asset}","index":${now},"time":${now},"offset":${offset},"period":${period}}]`
    );
    this.sendPacket(
      `42["loadHistoryPeriodFast",{"asset":"${asset}","index":${now},"time":${now},"offset":${offset},"period":${period}}]`
    );
  }

  /**
   * Executes a real deal on Pocket Option (CALL/PUT) via canonical openOrder protocol.
   */
  public async openDeal(params: {
    asset?: string;
    amount: number;
    action: 'call' | 'put' | 'buy' | 'sell';
    time?: number;
    strategyName?: string;
    reasons?: string[];
    confluenceScore?: number;
  }): Promise<{
    success: boolean;
    deal?: any;
    error?: string;
    requestId?: number;
  }> {
    if (!this.isConnected() || !this.authVerified) {
      return {
        success: false,
        error: 'لا يمكن إرسال الصفقة: منصة Pocket Option غير متصلة أو غير موثقة. يرجى ربط حسابك في الإعدادات أولاً.',
      };
    }

    const isDemo = this.accountManager.getActiveMode() === 'DEMO' ? 1 : 0;
    const rawAmount = Number(params.amount);
    if (isNaN(rawAmount) || rawAmount < 1.0 || rawAmount > 1000.00) {
      return {
        success: false,
        error: 'مبلغ الصفقة يجب أن يكون بين 1.00$ و 1000.00$.',
      };
    }

    // Exact cent rounding without tampering
    const amount = Math.round(rawAmount * 100) / 100;

    // Platform & account balance pre-trade check
    const currentBalance = this.accountInfo.balance;
    if (typeof currentBalance === 'number' && currentBalance > 0 && amount > currentBalance) {
      return {
        success: false,
        error: `الرصيد المتاح ($${currentBalance.toFixed(2)}) غير كافٍ لفتح صفقة بمبلغ $${amount.toFixed(2)}.`,
      };
    }

    const asset = params.asset || this.activeAsset;
    const action = params.action.toLowerCase() === 'buy' || params.action.toLowerCase() === 'call' ? 'call' : 'put';
    // Strictly synchronize with current timeframe (1m=60, 5m=300, 15m=900) if not explicitly provided
    const duration = params.time ? Math.max(5, Number(params.time)) : (this.timeframe || 60);
    const requestId = Math.floor(Date.now() / 1000) * 1000 + Math.floor(Math.random() * 999);

    const dealPayload = {
      asset,
      amount,
      action,
      isDemo,
      requestId,
      optionType: 100,
      time: duration,
      strategyName: params.strategyName || 'توافق الاستراتيجيات (Confluence Matrix)',
      reasons: params.reasons || [],
      confluenceScore: params.confluenceScore || 0,
    };

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pendingDealOrders.delete(requestId);
        this.log(`[PO-TRADE] Deal request #${requestId} timed out awaiting broker response`, 'warn');
        resolve({
          success: false,
          error: 'انتهت مهلة انتظار خادم Pocket Option لتأكيد فتح الصفقة (10 ثوانٍ).',
          requestId,
        });
      }, 10000);

      this.pendingDealOrders.set(requestId, {
        resolve,
        timer,
        params: dealPayload,
      });

      this.sendPacket(`42["openOrder",${JSON.stringify({
        asset,
        amount,
        action,
        isDemo,
        requestId,
        optionType: 100,
        time: duration,
      })}]`);

      this.log(
        `[PO-TRADE] Open Deal dispatched: ${action.toUpperCase()} $${amount.toFixed(2)} on ${asset} (${duration}s, ${isDemo === 1 ? 'DEMO' : 'REAL'}, Req #${requestId})`
      );
    });
  }

  private processDealSuccess(payload: any): void {
    const rawReqId = payload?.requestId ?? payload?.request_id;
    const reqId = rawReqId !== undefined ? Number(rawReqId) : null;

    let pending: { resolve: (res: any) => void; timer: NodeJS.Timeout; params: any } | undefined;
    if (reqId && this.pendingDealOrders.has(reqId)) {
      pending = this.pendingDealOrders.get(reqId);
      this.pendingDealOrders.delete(reqId);
    } else if (this.pendingDealOrders.size > 0) {
      const firstKey = this.pendingDealOrders.keys().next().value;
      if (firstKey !== undefined) {
        pending = this.pendingDealOrders.get(firstKey);
        this.pendingDealOrders.delete(firstKey);
      }
    }

    if (pending) {
      clearTimeout(pending.timer);
    }

    const dealId = String(payload?.id || payload?.ticket || `deal_${Date.now()}`);
    const normalizedDeal = {
      id: dealId,
      ticketId: dealId,
      asset: payload?.asset || pending?.params?.asset || this.activeAsset,
      amount: payload?.amount || pending?.params?.amount || 1,
      action: payload?.command || payload?.action || pending?.params?.action || 'call',
      isDemo: payload?.isDemo === 1 || payload?.is_demo === 1 || pending?.params?.isDemo === 1,
      accountMode: (payload?.isDemo === 1 || payload?.is_demo === 1 || pending?.params?.isDemo === 1) ? 'DEMO' : 'REAL',
      timeframe: pending?.params?.time || this.timeframe || 60,
      strategyName: pending?.params?.strategyName || 'توافق الاستراتيجيات (Confluence Matrix)',
      reasons: pending?.params?.reasons || [],
      confluenceScore: pending?.params?.confluenceScore || 0,
      openPrice: Number(payload?.openPrice ?? payload?.open_price ?? 0),
      entryPrice: Number(payload?.openPrice ?? payload?.open_price ?? 0),
      openTime: Number(payload?.openTimestamp ?? payload?.open_timestamp ?? Math.floor(Date.now() / 1000)),
      closeTime: Number(payload?.closeTimestamp ?? payload?.close_timestamp ?? (Math.floor(Date.now() / 1000) + (pending?.params?.time || 60))),
      status: 'OPEN',
      profit: 0,
      payout: payload?.percentProfit ?? payload?.percent_profit ?? 88,
      raw: payload,
    };

    this.activeDeals.set(dealId, normalizedDeal);
    this.log(`[PO-TRADE] Deal OPENED: #${dealId} | ${normalizedDeal.asset} | Price: ${normalizedDeal.openPrice} | Amount: $${normalizedDeal.amount}`);

    // Immediately trigger balance request to synchronize balance with broker
    this.requestBalance();

    for (const listener of this.onDealOpenedListeners) {
      try {
        listener(normalizedDeal);
      } catch (err) {
        console.warn('[PO-ENGINE] onDealOpened listener notice:', err);
      }
    }

    if (pending) {
      pending.resolve({
        success: true,
        deal: normalizedDeal,
        requestId: reqId || pending.params?.requestId,
      });
    }
  }

  private processDealFailure(payload: any): void {
    const rawReqId = payload?.requestId ?? payload?.request_id;
    const reqId = rawReqId !== undefined ? Number(rawReqId) : null;
    const errMsg = payload?.error || payload?.message || 'Pocket Option rejected the deal request.';

    let pending: { resolve: (res: any) => void; timer: NodeJS.Timeout; params: any } | undefined;
    if (reqId && this.pendingDealOrders.has(reqId)) {
      pending = this.pendingDealOrders.get(reqId);
      this.pendingDealOrders.delete(reqId);
    } else if (this.pendingDealOrders.size > 0) {
      const firstKey = this.pendingDealOrders.keys().next().value;
      if (firstKey !== undefined) {
        pending = this.pendingDealOrders.get(firstKey);
        this.pendingDealOrders.delete(firstKey);
      }
    }

    if (pending) {
      clearTimeout(pending.timer);
      pending.resolve({
        success: false,
        error: errMsg,
        requestId: reqId || pending.params?.requestId,
      });
    }

    this.log(`[PO-TRADE] Deal opening FAILED: ${errMsg}`, 'warn');
  }

  private processDealClosed(payload: any): void {
    const dealId = String(payload?.id || payload?.ticket || '');
    let existing = this.activeDeals.get(dealId);
    if (!existing && payload?.id) {
      existing = {
        id: dealId,
        ticketId: dealId,
        asset: payload?.asset || this.activeAsset,
        amount: payload?.amount || 0,
        action: payload?.command || payload?.action || 'call',
        isDemo: payload?.isDemo === 1,
        accountMode: payload?.isDemo === 1 ? 'DEMO' : 'REAL',
        timeframe: this.timeframe || 60,
        strategyName: 'توافق الاستراتيجيات (Confluence Matrix)',
        reasons: [],
        confluenceScore: 0,
        openPrice: Number(payload?.openPrice ?? payload?.open_price ?? 0),
        entryPrice: Number(payload?.openPrice ?? payload?.open_price ?? 0),
        openTime: Number(payload?.openTimestamp ?? payload?.open_timestamp ?? 0),
      };
    }

    if (existing) {
      this.activeDeals.delete(dealId);
      const closePrice = Number(payload?.closePrice ?? payload?.close_price ?? 0);
      const profit = Number(payload?.profit ?? 0);
      const isWin = profit > 0;
      const isRefund = profit === 0;
      const closeTimestamp = Number(payload?.closeTimestamp ?? payload?.close_timestamp ?? Math.floor(Date.now() / 1000));
      const openTimestamp = Number(existing.openTime || Math.floor(Date.now() / 1000) - (existing.timeframe || 60));
      const durationSec = Math.max(1, closeTimestamp - openTimestamp);

      const closedDeal = {
        ...existing,
        closePrice,
        exitPrice: closePrice,
        closeTime: closeTimestamp,
        durationSec,
        profit,
        status: isWin ? 'WIN' : isRefund ? 'REFUND' : 'LOSS',
        result: isWin ? 'WIN' : isRefund ? 'REFUND' : 'LOSS',
      };

      this.dealsHistory.unshift(closedDeal);
      if (this.dealsHistory.length > 200) this.dealsHistory.pop();

      this.log(`[PO-TRADE] Deal CLOSED: #${dealId} | Result: ${closedDeal.result} | Profit: $${profit.toFixed(2)} | Duration: ${durationSec}s`);

      // Refresh balance upon deal close
      this.requestBalance();

      for (const listener of this.onDealClosedListeners) {
        try {
          listener(closedDeal);
        } catch (err) {
          console.warn('[PO-ENGINE] onDealClosed listener notice:', err);
        }
      }
    }
  }

  private processAssetsUpdate(payload: any, connId?: string, generation?: number): void {
    if (
      (connId && connId !== this.activeConnectionId) ||
      (generation && generation !== this.accountManager.getSessionGeneration())
    ) {
      return;
    }

    let items: any[] = [];
    if (Array.isArray(payload)) {
      items = payload;
    } else if (payload && typeof payload === 'object') {
      if (Array.isArray(payload.data)) items = payload.data;
      else if (Array.isArray(payload.assets)) items = payload.assets;
      else if (Array.isArray(payload.items)) items = payload.items;
      else {
        items = Object.values(payload).filter((v) => v && typeof v === 'object');
      }
    }

    if (!Array.isArray(items) || items.length === 0) return;

    let parsedCount = 0;
    for (const item of items) {
      if (!item) continue;
      let assetObj: any = null;

      if (Array.isArray(item)) {
        assetObj = {};
        for (let i = 0; i < item.length && i < UPDATE_ASSETS_KEYS.length; i++) {
          assetObj[UPDATE_ASSETS_KEYS[i]] = item[i];
        }
      } else if (typeof item === 'object') {
        assetObj = item;
      }

      if (!assetObj) continue;

      const rawAsset = String(assetObj.asset || assetObj.symbol || assetObj.name || '').trim();
      if (!rawAsset) continue;

      const isOtc = Boolean(
        assetObj.is_otc ||
        assetObj.isOtc ||
        rawAsset.toLowerCase().includes('otc')
      );

      const label = assetObj.label || (isOtc ? `${rawAsset.replace(/_otc/i, '')} OTC` : rawAsset);
      const payout = typeof assetObj.payout === 'number' ? assetObj.payout : 80;
      const digits = typeof assetObj.digits === 'number' ? assetObj.digits : (rawAsset.includes('JPY') ? 3 : 5);
      const type = assetObj.type || (isOtc ? 'currency' : 'market');
      const active = assetObj.active !== undefined ? Boolean(assetObj.active) : true;

      let deterministicId = 0;
      for (let charIdx = 0; charIdx < rawAsset.length; charIdx++) {
        deterministicId = ((deterministicId << 5) - deterministicId + rawAsset.charCodeAt(charIdx)) | 0;
      }
      deterministicId = Math.abs(deterministicId) || 1001;

      const info: AssetInfo = {
        id: assetObj.id || deterministicId,
        asset: rawAsset,
        label,
        type,
        digits,
        payout,
        is_otc: isOtc,
        active,
      };

      this.assetsMap.set(info.asset, info);
      parsedCount++;
    }

    if (parsedCount > 0) {
      this.subsystems.assets = 'loaded';
      this.log(`Loaded ${parsedCount} real trading assets from Pocket Option catalog.`);

      const allAssets = Array.from(this.assetsMap.values());
      for (const listener of this.onAssetsUpdatedListeners) {
        try {
          listener(allAssets);
        } catch (err) {
          console.error('[PocketOptionService] onAssetsUpdated error:', err);
        }
      }

      if (this.authVerified) {
        this.sendSubscriptionPackets(this.activeAsset, this.timeframe);
      }
    }
  }

  private processStreamUpdate(payload: any, connId?: string, generation?: number): void {
    if (
      (connId && connId !== this.activeConnectionId) ||
      (generation && generation !== this.accountManager.getSessionGeneration())
    ) {
      return;
    }
    if (!Array.isArray(payload)) return;

    for (const item of payload) {
      if (Array.isArray(item) && item.length >= 3) {
        const asset = String(item[0]);
        let timestamp = Number(item[1]);
        const price = Number(item[2]);

        if (isNaN(price) || price <= 0) continue;

        if (timestamp > 1e11) {
          timestamp = Math.floor(timestamp / 1000);
        }

        this.ticksCount++;
        this.candleBuilder.addTick(asset, timestamp, price, [5, 15, 30, 60, 300, 900, 1800, 3600, 14400, 86400]);

        if (this.subsystems.overall === 'ACCOUNT_READY' || this.subsystems.overall === 'AUTHENTICATED') {
          this.subsystems.overall = 'MARKET_DATA_READY';
        }

        const tick: MarketTick = {
          asset,
          timestamp,
          price,
          receivedAt: Date.now(),
        };

        if (asset === this.activeAsset) {
          for (const listener of this.onTickListeners) {
            listener(tick);
          }
        }
      }
    }
  }

  private processHistoricalCandles(
    payload: any,
    connId?: string,
    generation?: number
  ): void {
    if (
      (connId && connId !== this.activeConnectionId) ||
      (generation && generation !== this.accountManager.getSessionGeneration())
    ) {
      return;
    }
    if (!payload) return;

    const asset = payload.asset || this.activeAsset;
    const period = Number(payload.period || this.timeframe);
    let historyData = payload.data || payload.history || payload.candles || (Array.isArray(payload) ? payload : null);

    if (!historyData && payload && typeof payload === 'object') {
      if (Array.isArray(payload[asset])) {
        historyData = payload[asset];
      } else if (Array.isArray(payload[asset.toLowerCase()])) {
        historyData = payload[asset.toLowerCase()];
      } else {
        for (const val of Object.values(payload)) {
          if (Array.isArray(val) && val.length > 0) {
            historyData = val;
            break;
          }
        }
      }
    }

    if (Array.isArray(historyData) && historyData.length > 0) {
      const timeMap = new Map<number, Candle>();

      for (const d of historyData) {
        if (!d) continue;

        let rawTime = 0;
        let isSingleTick = false;
        let tickPrice = 0;
        let open = 0;
        let high = 0;
        let low = 0;
        let close = 0;
        let volume = 1;

        if (Array.isArray(d)) {
          let offset = 0;
          if (typeof d[0] === 'string' || (typeof d[0] === 'number' && d[0] < 1e8 && d.length >= 6)) {
            offset = 1; // symbol_id is first element
          }

          rawTime = Number(d[offset]);
          const p1 = Number(d[offset + 1]);
          const p2 = Number(d[offset + 2]);
          const p3 = Number(d[offset + 3]);
          const p4 = Number(d[offset + 4]);

          if (isNaN(p1) || p1 <= 0) continue;

          // Check if single tick [time, price]
          if (isNaN(p2) || p2 <= 0 || (d.length - offset <= 2)) {
            isSingleTick = true;
            tickPrice = p1;
          } else if (!isNaN(p4) && p4 > 0) {
            open = p1;
            const maxP = Math.max(p1, p2, p3, p4);
            const minP = Math.min(p1, p2, p3, p4);
            if (p4 !== maxP && p4 !== minP) {
              close = p4;
            } else {
              close = p2;
            }
            high = maxP;
            low = minP;
            volume = d[offset + 5] ? Number(d[offset + 5]) : 1;
          } else {
            open = p1;
            close = !isNaN(p2) && p2 > 0 ? p2 : open;
            high = Math.max(open, close);
            low = Math.min(open, close);
            volume = d[offset + 5] ? Number(d[offset + 5]) : 1;
          }
        } else if (typeof d === 'object') {
          rawTime = Number(d.time || d.timestamp || d.t || d.index || 0);
          if (d.price !== undefined && d.open === undefined) {
            isSingleTick = true;
            tickPrice = Number(d.price);
          } else {
            open = Number(d.open ?? d.o ?? d.close ?? 0);
            close = Number(d.close ?? d.c ?? d.open ?? 0);
            const rawHigh = Number(d.high ?? d.h ?? Math.max(open, close));
            const rawLow = Number(d.low ?? d.l ?? Math.min(open, close));
            high = Math.max(open, close, rawHigh);
            low = Math.min(open, close, rawLow);
            volume = Number(d.volume ?? d.v ?? 1);
          }
        }

        let secTime = rawTime;
        if (secTime > 1e11) secTime = Math.floor(secTime / 1000);
        if (secTime <= 0) continue;

        // Exact timeframe bucket alignment (requirement 20)
        const bucketTime = Math.floor(Math.floor(secTime) / period) * period;
        const candleId = `${asset.toLowerCase()}:${period}:${bucketTime}`;

        if (isSingleTick) {
          if (isNaN(tickPrice) || tickPrice <= 0) continue;
          const existing = timeMap.get(bucketTime);
          if (!existing) {
            timeMap.set(bucketTime, {
              candleId,
              asset,
              timeframe: period,
              time: bucketTime,
              open: tickPrice,
              high: tickPrice,
              low: tickPrice,
              close: tickPrice,
              volume: 1,
              isClosed: true,
              source: 'Pocket Option Real History',
            });
          } else {
            existing.high = Math.max(existing.high, tickPrice);
            existing.low = Math.min(existing.low, tickPrice);
            existing.close = tickPrice;
            existing.volume += 1;
          }
        } else {
          // OHLC bar
          if (open <= 0 || close <= 0 || high <= 0 || low <= 0) continue;
          const existing = timeMap.get(bucketTime);
          if (!existing) {
            timeMap.set(bucketTime, {
              candleId,
              asset,
              timeframe: period,
              time: bucketTime,
              open,
              high,
              low,
              close,
              volume: isNaN(volume) || volume <= 0 ? 1 : volume,
              isClosed: true,
              source: 'Pocket Option Real History',
            });
          } else {
            // Merge into bucket
            existing.high = Math.max(existing.high, high);
            existing.low = Math.min(existing.low, low);
            existing.close = close;
            existing.volume = Math.max(existing.volume, volume);
          }
        }
      }

      const sortedCandles = Array.from(timeMap.values()).sort((a, b) => a.time - b.time);

      if (sortedCandles.length > 0) {
        this.candleBuilder.loadHistoricalCandles(asset, period, sortedCandles);
        this.log(`Ingested ${sortedCandles.length} verified broker historical candles for ${asset} (${period}s)`);

        for (const listener of this.onHistoricalCandlesListeners) {
          try {
            listener(asset, period, sortedCandles);
          } catch (err) {
            console.error('[PocketOptionService] onHistoricalCandles dispatch error:', err);
          }
        }
      }
    }
  }

  private processSentiment(payload: any): void {
    if (Array.isArray(payload)) {
      for (const item of payload) {
        if (Array.isArray(item) && item.length >= 2) {
          this.sentimentMap.set(String(item[0]), Number(item[1]));
        }
      }
    }
  }

  private startHeartbeatLoop(): void {
    if (this.pingInterval) clearInterval(this.pingInterval);
    let pingCount = 0;
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.pingStartTime = Date.now();
        this.sendPacket('2');
        this.sendPacket('42["ps"]');

        pingCount++;
        // Request fresh balance update every 40s (every 2 pings)
        if (pingCount % 2 === 0 && this.authVerified) {
          this.sendPacket('42["updateBalance"]');
        }
      }
    }, 20000);
  }

  private startHealthMonitor(): void {
    if (this.monitorInterval) clearInterval(this.monitorInterval);
    this.monitorInterval = setInterval(() => {
      this.evaluateSubsystems();
    }, 1000);
  }

  private evaluateSubsystems(): void {
    const activeCtx = this.accountManager.getActiveContext();
    const staleInfo = this.candleBuilder.isStale(this.activeAsset, 8);
    const candleCount = this.candleBuilder.getCandleCount(this.activeAsset, this.timeframe);


    if (!activeCtx.sessionToken || activeCtx.sessionToken.length < 8) {
      this.subsystems.overall = 'DISCONNECTED';
      this.subsystems.auth = 'none';
      this.subsystems.account = 'UNKNOWN';
      this.subsystems.assets = 'waiting';
      this.subsystems.marketData = 'waiting';
      this.subsystems.candles = 'waiting';
      this.subsystems.strategy = 'wait';
      this.strategyWaitReason = 'Awaiting Pocket Option account connection.';
      return;
    }

    if (this.subsystems.auth === 'failed' || this.sessionStatus === 'expired') {
      this.subsystems.overall = 'AUTH_FAILED';
      this.subsystems.auth = 'failed';
      this.subsystems.account = 'INVALID';
      this.accountInfo.status = 'INVALID';
      this.accountInfo.balance = null;
      this.accountInfo.balanceStatus = 'UNAVAILABLE';
      this.accountInfo.source = 'UNAVAILABLE';
      this.subsystems.assets = 'unavailable';
      this.subsystems.marketData = 'unavailable';
      this.subsystems.candles = 'stopped';
      this.subsystems.strategy = 'locked';
      this.strategyWaitReason =
        this.authError || 'Pocket Option session rejected (NotAuthorized). Strategy engine locked on WAIT.';
      return;
    }

    if (this.subsystems.websocket !== 'connected') {
      if (this.accountInfo.status === 'LIVE') {
        this.accountInfo.status = 'DISCONNECTED';
        this.accountInfo.balanceStatus = 'UNAVAILABLE';
        this.subsystems.account = 'DISCONNECTED';
      }
      this.subsystems.marketData = this.ticksCount > 0 ? 'stale' : 'disconnected';
      this.subsystems.candles = 'stopped';
      this.subsystems.strategy = 'wait';
      this.subsystems.overall = this.subsystems.websocket === 'connecting' ? 'CONNECTING' : 'DISCONNECTED';
      this.strategyWaitReason =
        this.subsystems.websocket === 'connecting'
          ? 'Connecting to Pocket Option WebSocket server...'
          : 'WebSocket disconnected from Pocket Option server.';
      return;
    }

    if (this.subsystems.auth === 'pending') {
      this.subsystems.overall = 'AUTHENTICATING';
      this.subsystems.strategy = 'wait';
      this.strategyWaitReason = 'Authenticating session with Pocket Option server...';
      return;
    }

    if (!this.authVerified || this.subsystems.auth !== 'success') {
      if (this.accountInfo.status === 'LIVE' || this.accountInfo.status === 'READY') {
        this.accountInfo.status = 'INVALID';
        this.accountInfo.balance = null;
        this.accountInfo.balanceStatus = 'UNAVAILABLE';
        this.subsystems.account = 'INVALID';
      }
      this.subsystems.strategy = 'locked';
      this.strategyWaitReason = 'Awaiting verified Pocket Option session authorization. Strategy Engine locked.';
      return;
    }

    if (this.ticksCount === 0) {
      this.subsystems.marketData = 'waiting';
    } else if (staleInfo.isStale) {
      this.subsystems.marketData = 'stale';
    } else {
      this.subsystems.marketData = 'live';
    }

    if (candleCount === 0) {
      this.subsystems.candles = 'waiting';
    } else if (candleCount < 15) {
      this.subsystems.candles = 'building';
    } else if (staleInfo.isStale) {
      this.subsystems.candles = 'stale';
    } else {
      this.subsystems.candles = 'live';
    }

    if (this.accountInfo.status === 'LIVE' && this.accountInfo.lastUpdated) {
      const elapsedSec = Math.floor((Date.now() - this.accountInfo.lastUpdated) / 1000);
      this.accountInfo.staleSeconds = elapsedSec;
      if (elapsedSec > 120) {
        this.accountInfo.status = 'STALE';
        this.accountInfo.balanceStatus = 'STALE';
        this.subsystems.account = 'STALE';
      }
    }

    if (this.ticksCount === 0) {
      this.subsystems.strategy = 'locked';
      this.strategyWaitReason = 'Strategy Engine LOCKED: Awaiting first real market tick from Pocket Option stream.';
    } else if (candleCount < 15) {
      this.subsystems.strategy = 'locked';
      this.strategyWaitReason = `Strategy Engine LOCKED: Building candle history: ${candleCount}/15 candles collected.`;
    } else if (staleInfo.isStale) {
      this.subsystems.strategy = 'locked';
      this.strategyWaitReason = `Strategy Engine LOCKED: Market stream stale: no ticks received for ${staleInfo.secondsSinceLastTick}s.`;
    } else {
      this.subsystems.strategy = 'ready';
      this.strategyWaitReason = null;
    }

    if (this.subsystems.marketData === 'stale') {
      this.subsystems.overall = 'STALE';
    } else if (this.subsystems.strategy === 'ready') {
      this.subsystems.overall = 'STRATEGY_READY';
    } else if (this.subsystems.marketData === 'live' || this.ticksCount > 0) {
      this.subsystems.overall = 'MARKET_DATA_READY';
    } else if (this.accountInfo.balance !== null) {
      this.subsystems.overall = 'ACCOUNT_READY';
    } else if (this.subsystems.auth === 'success') {
      this.subsystems.overall = 'AUTHENTICATED';
    } else {
      this.subsystems.overall = 'SYNCING';
    }
  }

  private sendPacket(data: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(data);
    }
  }

  private handleError(err: any, connId?: string, generation?: number): void {
    if (
      (connId && connId !== this.activeConnectionId) ||
      (generation && generation !== this.accountManager.getSessionGeneration())
    ) {
      return;
    }
    if (this.isExplicitlyClosed) {
      return;
    }

    const message = err?.message || String(err);

    // Auto-recover from 403 Forbidden by rotating to next healthy cluster node
    if (message.includes('403') || message.includes('Unexpected server response: 403')) {
      this.currentClusterIndex = (this.currentClusterIndex + 1) % CLUSTER_ENDPOINTS.length;
      const nextEndpoint = CLUSTER_ENDPOINTS[this.currentClusterIndex];
      this.log(`[CLUSTER] 403 Forbidden on endpoint. Automatically rotating cluster node to ${nextEndpoint}...`, 'info');
      this.endpoint = nextEndpoint;

      this.subsystems.websocket = 'reconnecting';
      this.setStatus('reconnecting');
      this.scheduleReconnect();
      return;
    }

    if (message.includes('closed before the connection was established')) {
      this.log(`Handshake interrupted (${message}). Retrying connection...`, 'warn');
      this.subsystems.websocket = 'reconnecting';
      this.setStatus('reconnecting');
      this.scheduleReconnect();
      return;
    }

    this.lastError = message;
    this.log(`WebSocket transport notice: ${this.lastError}`, 'warn');
    this.subsystems.websocket = 'error';
    this.setStatus('error');

    const effectiveGen = generation || this.accountManager.getSessionGeneration();
    if (this.pendingHandshakes.some((h) => h.generation === effectiveGen)) {
      this.rejectHandshakes(effectiveGen, {
        success: false,
        ok: false,
        state: 'CONNECTION_ERROR',
        error: `WebSocket transport error: ${message}`,
        errorCode: 'SOCKET_ERROR',
        diagnostics: this.getDiagnostics(),
        generation: effectiveGen,
        connectionId: connId || this.activeConnectionId,
      });
    }
  }

  private handleClose(code: number, reason: Buffer, connId?: string, generation?: number): void {
    if (
      (connId && connId !== this.activeConnectionId) ||
      (generation && generation !== this.accountManager.getSessionGeneration())
    ) {
      return;
    }
    if (this.isExplicitlyClosed) {
      this.setStatus('disconnected');
      return;
    }

    this.log(`WebSocket connection closed (${code}: ${reason.toString() || 'normal'})`, 'warn');
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    this.ws = null;
    this.subsystems.websocket = 'disconnected';

    const effectiveGen = generation || this.accountManager.getSessionGeneration();
    if (this.pendingHandshakes.some((h) => h.generation === effectiveGen)) {
      this.rejectHandshakes(effectiveGen, {
        success: false,
        ok: false,
        state: 'CONNECTION_ERROR',
        error: `Connection closed before authentication was completed (Code ${code})`,
        errorCode: 'SOCKET_ERROR',
        diagnostics: this.getDiagnostics(),
        generation: effectiveGen,
        connectionId: connId || this.activeConnectionId,
      });
    }

    // Do NOT auto-reconnect if authentication was rejected
    if (
      this.subsystems.auth === 'failed' ||
      this.subsystems.overall === 'AUTH_FAILED' ||
      this.sessionStatus === 'expired' ||
      this.sessionStatus === 'invalid'
    ) {
      this.log('Reconnection paused: Credentials rejected by server. Provide a valid session token.', 'warn');
      return;
    }

    const activeCtx = this.accountManager.getActiveContext();
    if (activeCtx.sessionToken) {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    this.setStatus('reconnecting');
    this.subsystems.websocket = 'reconnecting';
    this.reconnectAttempts++;
    const delay = Math.min(10000, 1500 * Math.pow(1.5, Math.min(this.reconnectAttempts, 5)));
    this.log(`Scheduling reconnect attempt #${this.reconnectAttempts} in ${Math.round(delay)}ms...`);

    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, delay);
  }

  private setStatus(status: ConnectionStatus): void {
    this.status = status;
    this.notifyStatusChange();
  }

  private notifyStatusChange(): void {
    for (const listener of this.onStatusListeners) {
      try {
        listener(this.status);
      } catch (err) {
        // ignore
      }
    }
  }

  public getDiagnostics(): DiagnosticsInfo {
    this.evaluateSubsystems();
    const activeCtx = this.accountManager.getActiveContext();
    const activeMode = this.accountManager.getActiveMode();
    const staleInfo = this.candleBuilder.isStale(this.activeAsset, 8);
    const lastTick = this.candleBuilder.getLastTick(this.activeAsset);

    const isAuthFailed =
      this.subsystems.auth === 'failed' ||
      this.sessionStatus === 'expired' ||
      this.sessionStatus === 'invalid' ||
      this.subsystems.overall === 'AUTH_FAILED';

    const reconnectState: 'ACTIVE' | 'STOPPED' | 'IDLE' = isAuthFailed
      ? 'STOPPED'
      : this.subsystems.websocket === 'reconnecting' || this.status === 'reconnecting'
      ? 'ACTIVE'
      : 'IDLE';

    const parsed = PocketOptionAuthManager.parse({
      sessionToken: activeCtx.sessionToken,
      expectedMode: activeMode,
      uid: activeCtx.uid,
      platform: activeCtx.platform,
      endpoint: this.endpoint,
    });
    const validation = this.authValidationResult || PocketOptionAuthManager.validate(parsed, activeMode);

    const authResponseFormatted: 'SUCCESS' | 'NOTAUTHORIZED' | 'TIMEOUT' | 'CLOSED' | 'PENDING' | 'NONE' =
      this.lastAuthResponse === 'successauth' || this.lastAuthResponse === 'SUCCESS'
        ? 'SUCCESS'
        : this.lastAuthResponse === 'NotAuthorized' || this.lastAuthResponse === 'notauthorized'
        ? 'NOTAUTHORIZED'
        : this.lastAuthResponse === 'AuthTimeout'
        ? 'TIMEOUT'
        : this.lastAuthResponse?.includes('Disconnect') || this.lastAuthResponse?.includes('Closed')
        ? 'CLOSED'
        : this.subsystems.auth === 'pending'
        ? 'PENDING'
        : 'NONE';

    const authStateFormatted: 'SUCCESS' | 'FAILED' | 'PENDING' | 'IDLE' =
      this.subsystems.auth === 'success'
        ? 'SUCCESS'
        : this.subsystems.auth === 'failed'
        ? 'FAILED'
        : this.subsystems.auth === 'pending'
        ? 'PENDING'
        : 'IDLE';

    const currentAcc = this.accountManager.buildAccountInfo();

    const authDiagnostic = PocketOptionAuthManager.buildDiagnosticReport({
      activeCtx,
      connectionState: this.status,
      endpoint: this.endpoint,
      socketConnected: this.socketConnected && this.ws?.readyState === WebSocket.OPEN,
      engineIoConnected: this.engineIoConnected,
      socketIoConnected: this.socketIoConnected,
      parsed,
      validation,
      authEventSent: this.authEventSent,
      authResponse: authResponseFormatted,
      authState: authStateFormatted,
      reconnectState,
      failureReason: this.authError || this.lastError,
      generation: this.accountManager.getSessionGeneration(),
    });

    authDiagnostic.balanceState = currentAcc.balanceStatus;
    authDiagnostic.assetState = this.subsystems.assets;
    authDiagnostic.tickState = this.subsystems.marketData;
    authDiagnostic.candleState = this.subsystems.candles;
    authDiagnostic.freshnessState = staleInfo.secondsSinceLastTick;
    authDiagnostic.strategyState = this.subsystems.strategy;

    const candles = this.candleBuilder.getCandles(this.activeAsset, this.timeframe);
    const forming = this.candleBuilder.getFormingCandle(this.activeAsset, this.timeframe);

    return {
      status: this.status,
      subsystems: { ...this.subsystems },
      account: currentAcc,
      endpoint: this.endpoint,
      latencyMs: this.latencyMs,
      lastPing: this.lastPing,
      lastTickTime: lastTick ? lastTick.timestamp : null,
      freshnessSeconds: staleInfo.secondsSinceLastTick,
      isStale: staleInfo.isStale,
      packetCount: this.packetCount,
      ticksCount: this.ticksCount,
      candlesCount: this.candleBuilder.getCandleCount(this.activeAsset, this.timeframe),
      assetsCount: this.assetsMap.size,
      activeAsset: this.activeAsset,
      timeframe: this.timeframe,
      marketType: this.activeAsset.toLowerCase().includes('_otc') ? 'OTC' : 'GLOBAL',
      lastCandleTime: candles.length > 0 ? candles[candles.length - 1].time : null,
      currentCandleTime: forming ? forming.time : null,
      signalEngineStatus: this.subsystems.strategy === 'ready' ? 'READY' : 'WAITING',
      error: this.lastError || this.authError,
      hasSession: Boolean(activeCtx.sessionToken && activeCtx.sessionToken.length >= 8),
      sessionMasked: PocketOptionAuthManager.maskSecret(activeCtx.sessionToken),
      authVerified: this.authVerified,
      generation: this.accountManager.getSessionGeneration(),
      authError: this.authError,
      authUid: currentAcc.uidMasked,
      strategyWaitReason: this.strategyWaitReason,
      connectionId: this.activeConnectionId,
      sessionStatus: this.sessionStatus,
      reconnectState,
      authResponse: this.lastAuthResponse,
      authDiagnostic,
      logs: [...this.logs.slice(0, 35)],
    };
  }

  public isAuthVerified(): boolean {
    return this.authVerified;
  }

  public isConnected(): boolean {
    return this.subsystems.websocket === 'connected';
  }

  public getStrategyWaitReason(): string | null {
    return this.strategyWaitReason;
  }

  public getTicksCount(): number {
    return this.ticksCount;
  }

  public getSessionStatus(): 'none' | 'active' | 'expired' | 'invalid' {
    return this.sessionStatus;
  }

  public getActiveConnectionId(): string | null {
    return this.activeConnectionId;
  }

  public getAssets(): AssetInfo[] {
    return Array.from(this.assetsMap.values());
  }

  public getSentiment(asset: string): number | null {
    return this.sentimentMap.get(asset) ?? null;
  }

  public onTick(listener: (tick: MarketTick) => void): () => void {
    this.onTickListeners.push(listener);
    return () => {
      this.onTickListeners = this.onTickListeners.filter((l) => l !== listener);
    };
  }

  public onStatus(listener: (status: ConnectionStatus) => void): () => void {
    this.onStatusListeners.push(listener);
    return () => {
      this.onStatusListeners = this.onStatusListeners.filter((l) => l !== listener);
    };
  }

  public getActiveAsset(): string {
    return this.activeAsset;
  }

  public getTimeframe(): number {
    return this.timeframe;
  }

  public setTimeframe(timeframe: number): void {
    if (timeframe && timeframe > 0) {
      this.timeframe = timeframe;
      this.subscribeAsset(this.activeAsset, timeframe);
    }
  }

  public getCandleCount(asset: string = this.activeAsset, timeframe: number = this.timeframe): number {
    return this.candleBuilder.getCandleCount(asset, timeframe);
  }
}
