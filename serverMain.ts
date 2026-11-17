import express, { Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { CandleBuilder } from './server/CandleBuilder';
import { MarketDataStore } from './server/MarketDataStore';
import { PocketOptionService } from './server/PocketOptionService';
import { StrategyEngine } from './server/StrategyEngine';
import { StrategySettings, AccountMode, Candle } from './server/types';
import { SabaaService } from './server/sabaaServices';
import { HistoricalCandleService } from './server/HistoricalCandleService';
import { AutoTraderEngine } from './server/AutoTraderEngine';
import { SbaaStrategyEngine } from './server/sbaa/SbaaStrategyEngine';
import { createAdminRouter } from './server/routes/adminRoutes';
import { createActivationRouter } from './server/routes/activationRoutes';
import { createTelegramRouter } from './server/routes/telegramRoutes';
import { telegramBotService } from './server/services/TelegramBotService';
import { requireActivatedUser } from './server/middleware/authMiddleware';

// Prevent process crash from unhandled socket drops or transient network rejections
process.on('uncaughtException', (err) => {
  console.error('[SERVER UNCAUGHT EXCEPTION]:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[SERVER UNHANDLED REJECTION]:', reason);
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Support large base64 image uploads for chart computer vision analysis
  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ extended: true, limit: '25mb' }));
  app.use(cookieParser());

  // Mount Admin, Authentication and Telegram Routes
  app.use('/api/admin', createAdminRouter());
  app.use('/api/auth', createActivationRouter());
  app.use('/api/telegram', createTelegramRouter());

  // Core Service Instances
  const candleBuilder = new CandleBuilder();
  const marketDataStore = new MarketDataStore('EURUSD_otc', 60);
  const otcCandleStore = marketDataStore.getOTCCandleStore();
  const strategyEngine = new StrategyEngine(candleBuilder, undefined, marketDataStore);
  const sabaaService = new SabaaService();

  // SSE Clients manager
  const sseClients: Response[] = [];

  const broadcastSSE = (event: string, data: any) => {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (let i = sseClients.length - 1; i >= 0; i--) {
      try {
        sseClients[i].write(payload);
      } catch {
        sseClients.splice(i, 1);
      }
    }
  };

  // Initialize historical candles (100-200 closed candles) before indicator calculation
  marketDataStore.onCandlesLoaded((asset, tf, loadedCandles) => {
    candleBuilder.loadHistoricalCandles(asset, tf, loadedCandles.filter((c) => c.isClosed));
    console.log(`[SERVER] Broadcast loaded ${loadedCandles.length} candles for ${asset} (${tf}s)`);
    broadcastSSE('candles_loaded', {
      asset,
      timeframe: tf,
      candles: loadedCandles,
    });
    broadcastSSE('tick', {
      asset,
      timeframe: tf,
      candles: loadedCandles,
      diagnostics: marketDataStore.getDiagnostics(),
    });
  });

  const rawSession = process.env.PO_SESSION || process.env.PO_TOKEN || process.env.PO_SSD || '';
  const rawDemoEnv = (process.env.PO_IS_DEMO || '').trim();
  const isDemoPacket = rawDemoEnv.startsWith('42') || rawDemoEnv.startsWith('{') || rawDemoEnv.includes('sessionToken');
  const isDemoFlag =
    rawDemoEnv === 'true' ||
    rawDemoEnv === '1' ||
    rawDemoEnv.toLowerCase() === 'yes' ||
    isDemoPacket ||
    rawDemoEnv.includes('demo') ||
    rawSession.includes('demo') ||
    rawSession.includes('demo-quick-high-low');

  const realCreds = PocketOptionService.parseCredentials(rawSession, false);
  const demoCreds = PocketOptionService.parseCredentials(isDemoPacket ? rawDemoEnv : rawSession, true);

  // Default strictly to REAL mode
  const defaultMode: AccountMode =
    process.env.PO_DEFAULT_MODE === 'DEMO' ? 'DEMO' : 'REAL';

  let defaultEndpoint = PocketOptionService.cleanEndpoint(
    process.env.PO_ENDPOINT || 'wss://api-eu.po.market/socket.io/?EIO=4&transport=websocket'
  );

  const poService = new PocketOptionService(
    candleBuilder,
    defaultEndpoint,
    defaultMode === 'REAL' ? realCreds.session : demoCreds.session,
    defaultMode === 'DEMO',
    'EURUSD_otc',
    60,
    defaultMode === 'REAL' ? realCreds.uid : demoCreds.uid
  );

  const sbaaEngine = new SbaaStrategyEngine(candleBuilder, poService, marketDataStore, broadcastSSE);
  const autoTraderEngine = new AutoTraderEngine(strategyEngine, poService, broadcastSSE, sbaaEngine, undefined, candleBuilder, true, marketDataStore, telegramBotService);

  marketDataStore.setBrokerHistoryRequester((asset, tf) => {
    return poService.requestHistoricalCandles(asset, tf);
  });

  poService.onHistoricalCandles((asset, tf, candles) => {
    console.log(`[SERVER] Received ${candles.length} real broker candles for ${asset} (${tf}s) from Pocket Option`);
    if (HistoricalCandleService.isOtcAsset(asset)) {
      otcCandleStore.loadBrokerCandles(asset, tf, candles);
    }
    marketDataStore.loadHistoricalCandles(asset, tf, candles);
    candleBuilder.loadHistoricalCandles(asset, tf, candles);
    broadcastSSE('candles_loaded', {
      asset,
      timeframe: tf,
      candles,
    });
  });

  // Synchronize initial seeded candles into otcCandleStore and marketDataStore
  const initialCandles = candleBuilder.getCandles('EURUSD_otc', 60);
  if (initialCandles.length > 0) {
    otcCandleStore.loadBrokerCandles('EURUSD_otc', 60, initialCandles);
    marketDataStore.loadHistoricalCandles('EURUSD_otc', 60, initialCandles);
  }

  // Pre-seed both isolated account contexts with available credentials
  const accManager = poService.getAccountManager();
  if (realCreds.hasSession) {
    accManager.setCredentials({
      mode: 'REAL',
      sessionToken: realCreds.session,
      uid: realCreds.uid,
      platform: realCreds.platform,
    });
  }
  if (demoCreds.hasSession) {
    accManager.setCredentials({
      mode: 'DEMO',
      sessionToken: demoCreds.session,
      uid: demoCreds.uid,
      platform: demoCreds.platform,
    });
  }
  poService.switchAccountMode(defaultMode);

  // Connect to Pocket Option
  poService.connect();

  // Wire Telegram Bot to Pocket Option service for live balance & account query
  telegramBotService.setPocketOptionService(() => poService);

  const getUpstreamGate = () => ({
    isAuthVerified: poService.isAuthVerified(),
    isConnected: poService.isConnected(),
    waitReason: poService.getStrategyWaitReason(),
  });

  // Wire incoming ticks to MarketDataStore
  poService.onTick((tick) => {
    try {
      marketDataStore.processTick(tick.asset, tick.timestamp, tick.price);

      const asset = poService.getActiveAsset();
      const timeframe = poService.getTimeframe();
      let candles = marketDataStore.getCandles(asset, timeframe);
      if (candles.length === 0) {
        candles = marketDataStore.getAllCandles();
      }
      if (candles.length === 0) {
        candles = candleBuilder.getCandles(asset, timeframe);
      }
      const staleInfo = candleBuilder.isStale(asset, strategyEngine.getSettings().global.maxDataFreshnessSeconds);

      // Update active open positions mark-to-market with live tick price
      sabaaService.updatePositionsMarkToMarket({ [asset]: tick.price });

      // Evaluate live tick on forming candle
      const signal = strategyEngine.evaluateLiveTick(asset, timeframe, getUpstreamGate());
      autoTraderEngine.onSignalUpdate(signal);
      const indicators = strategyEngine.calculateIndicators(asset, timeframe);
      const performance = strategyEngine.getPerformanceMetrics();
      const positions = sabaaService.getPositions();

      broadcastSSE('tick', {
        tick,
        candles,
        formingCandle: marketDataStore.getFormingCandle ? marketDataStore.getFormingCandle() : candleBuilder.getFormingCandle(asset, timeframe),
        signal,
        indicators,
        performance,
        positions,
        freshness: staleInfo.secondsSinceLastTick,
        isStale: staleInfo.isStale,
      });
    } catch (err) {
      console.error('[SERVER] Tick handler error:', err);
    }
  });

  // Recalculate indicators and signals whenever a candle closes (Mandatory Rules 6, 7, 8)
  marketDataStore.onCandleClosed((closedCandle, allClosed) => {
    try {
      const asset = marketDataStore.getActiveAsset();
      const timeframe = marketDataStore.getTimeframe();
      candleBuilder.loadHistoricalCandles(asset, timeframe, allClosed);

      // Evaluate confirmed closed candle boundary
      const signal = strategyEngine.evaluateClosedCandle(asset, timeframe, closedCandle, allClosed, getUpstreamGate());
      autoTraderEngine.onSignalUpdate(signal);
      sbaaEngine.evaluateMarket(asset, timeframe);
      const indicators = strategyEngine.calculateIndicators(asset, timeframe);
      const performance = strategyEngine.getPerformanceMetrics();

      broadcastSSE('candle_closed', {
        candle: closedCandle,
        signal,
        indicators,
        performance,
        diagnostics: marketDataStore.getDiagnostics(),
      });

      // Broadcast confirmed trade signal to Telegram channel/bot if active
      if (signal && (signal.type === 'UP' || signal.type === 'DOWN') && signal.status === 'CONFIRMED') {
        telegramBotService
          .broadcastTradingSignal({
            asset,
            timeframe,
            type: signal.type,
            confidence: signal.confidence,
            price: signal.entryPrice || closedCandle.close,
            expirySeconds: signal.expiryDurationSec || (signal as any).expiryDurationSeconds || 120,
            strategy: signal.strategy,
            confirmations: signal.confirmations,
            reasons: signal.details || [],
            timestamp: signal.timestamp || Date.now(),
          })
          .catch((err) => {
            console.warn('[SERVER] Telegram signal broadcast notice:', err?.message || err);
          });
      }
    } catch (err) {
      console.error('[SERVER] onCandleClosed handler error:', err);
    }
  });

  poService.onStatus((status) => {
    try {
      if (status === 'connected') {
        marketDataStore.setWebSocketStatus('CONNECTED');
      } else if (status === 'connecting' || status === 'reconnecting') {
        marketDataStore.setWebSocketStatus('CONNECTING');
      } else if (status === 'error') {
        marketDataStore.setWebSocketStatus('ERROR');
      } else {
        marketDataStore.setWebSocketStatus('DISCONNECTED');
      }

      broadcastSSE('status', {
        status,
        diagnostics: poService.getDiagnostics(),
        marketStore: marketDataStore.getDiagnostics(),
      });
    } catch (err) {
      console.error('[SERVER] Status handler error:', err);
    }
  });

  poService.onAssetsUpdated((assets) => {
    try {
      broadcastSSE('assets', assets);
    } catch (err) {
      console.error('[SERVER] Assets updated broadcast error:', err);
    }
  });

  poService.onBalanceUpdated((balanceInfo) => {
    try {
      broadcastSSE('balance', balanceInfo);
      broadcastSSE('status', {
        status: poService.getStatus ? poService.getStatus() : 'connected',
        diagnostics: poService.getDiagnostics(),
        marketStore: marketDataStore.getDiagnostics(),
      });
    } catch (err) {
      console.error('[SERVER] Balance updated broadcast error:', err);
    }
  });

  poService.onDealOpened((deal) => {
    try {
      broadcastSSE('deal_opened', deal);
    } catch (err) {
      console.error('[SERVER] Deal opened broadcast error:', err);
    }
  });

  poService.onDealClosed((deal) => {
    try {
      sbaaEngine.handleBrokerDealClosed(deal);
      broadcastSSE('deal_closed', deal);
    } catch (err) {
      console.error('[SERVER] Deal closed broadcast error:', err);
    }
  });

  // API Routes
  app.get('/api/status', (req: Request, res: Response) => {
    try {
      const asset = poService.getActiveAsset();
      const timeframe = poService.getTimeframe();
      const signal = strategyEngine.getActiveSignal(asset, timeframe, getUpstreamGate());
      const indicators = strategyEngine.calculateIndicators(asset, timeframe);
      const performance = strategyEngine.getPerformanceMetrics();
      const marketDiagnostics = marketDataStore.getDiagnostics();

      res.json({
        diagnostics: {
          ...poService.getDiagnostics(),
          marketStore: marketDiagnostics,
        },
        marketDiagnostics,
        activeAsset: asset,
        timeframe,
        isAnalyzing: strategyEngine.isAnalyzing(),
        strategySettings: strategyEngine.getSettings(),
        activeSignal: signal,
        indicators,
        performance,
      });
    } catch (err: any) {
      console.error('[API] /api/status error:', err);
      res.status(200).json({
        diagnostics: poService.getDiagnostics(),
        activeAsset: poService.getActiveAsset(),
        timeframe: poService.getTimeframe(),
        isAnalyzing: strategyEngine.isAnalyzing(),
        strategySettings: strategyEngine.getSettings(),
        activeSignal: null,
        indicators: null,
        performance: strategyEngine.getPerformanceMetrics(),
        error: err?.message || 'Status calculation error',
      });
    }
  });

  app.get('/api/assets', (req: Request, res: Response) => {
    try {
      const assets = poService.getAssets();
      res.json(assets || []);
    } catch (err: any) {
      console.error('[API] /api/assets error:', err);
      res.json([]);
    }
  });

  app.get('/api/candles', async (req: Request, res: Response) => {
    try {
      const asset = (req.query.asset as string) || poService.getActiveAsset();
      const tf = Number(req.query.timeframe) || poService.getTimeframe();
      let candles = marketDataStore.getCandles(asset, tf);
      if (candles.length === 0 && marketDataStore.getActiveAsset() === asset) {
        candles = marketDataStore.getAllCandles();
      }
      if (candles.length === 0) {
        candles = candleBuilder.getCandles(asset, tf);
      }
      if (candles.length === 0 && HistoricalCandleService.isOtcAsset(asset)) {
        candles = otcCandleStore.getAllCandles(asset, tf);
      }

      // If candles are empty or low, load immediately
      if (candles.length < 25) {
        if (HistoricalCandleService.isOtcAsset(asset)) {
          // Request historical candles from broker stream
          poService.requestHistoricalCandles(asset, tf);
          const otcCandles = otcCandleStore.getAllCandles(asset, tf);
          if (otcCandles.length > 0) {
            candles = otcCandles;
          }
        } else {
          console.log(`[API] /api/candles: Low candle count (${candles.length}) for ${asset} (${tf}s). Loading historical candles...`);
          await marketDataStore.initHistoricalData(asset, tf);
          candles = marketDataStore.getCandles(asset, tf);
          if (candles.length === 0) {
            candles = marketDataStore.getAllCandles();
          }
        }
      }

      res.json(candles || []);
    } catch (err: any) {
      console.error('[API] /api/candles error:', err);
      res.json([]);
    }
  });

  app.get('/api/indicators', (req: Request, res: Response) => {
    try {
      const asset = (req.query.asset as string) || poService.getActiveAsset();
      const tf = Number(req.query.timeframe) || poService.getTimeframe();
      const indicators = strategyEngine.calculateIndicators(asset, tf);
      const diagnostics = marketDataStore.getDiagnostics();
      res.json({
        indicators,
        diagnostics,
      });
    } catch (err: any) {
      console.error('[API] /api/indicators error:', err);
      res.status(500).json({ error: err?.message || 'Indicator error' });
    }
  });

  app.get('/api/signals', (req: Request, res: Response) => {
    try {
      const asset = poService.getActiveAsset();
      const timeframe = poService.getTimeframe();
      const activeSignal = strategyEngine.getActiveSignal(asset, timeframe, getUpstreamGate());

      res.json({
        activeSignal,
        history: strategyEngine.getSignalHistory(),
        performance: strategyEngine.getPerformanceMetrics(),
      });
    } catch (err: any) {
      console.error('[API] /api/signals error:', err);
      res.status(200).json({
        activeSignal: null,
        history: strategyEngine.getSignalHistory(),
        performance: strategyEngine.getPerformanceMetrics(),
        error: err?.message || 'Signal generation error',
      });
    }
  });

  app.get('/api/history', (req: Request, res: Response) => {
    try {
      res.json({
        history: strategyEngine.getSignalHistory(),
        performance: strategyEngine.getPerformanceMetrics(),
      });
    } catch (err: any) {
      console.error('[API] /api/history error:', err);
      res.json({ history: [], performance: strategyEngine.getPerformanceMetrics() });
    }
  });

  app.post('/api/history/clear', (req: Request, res: Response) => {
    try {
      const result = strategyEngine.clearSignalHistory();
      res.json({
        ...result,
        history: [],
        performance: strategyEngine.getPerformanceMetrics(),
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Failed to clear signal history' });
    }
  });

  app.get('/api/performance', (req: Request, res: Response) => {
    try {
      res.json(strategyEngine.getPerformanceMetrics());
    } catch (err: any) {
      console.error('[API] /api/performance error:', err);
      res.json({ totalSignals: 0, winRate: 0, profitFactor: 0 });
    }
  });

  app.get('/api/strategies', (req: Request, res: Response) => {
    try {
      const asset = poService.getActiveAsset();
      const timeframe = poService.getTimeframe();
      const signal = strategyEngine.generateSignal(asset, timeframe, getUpstreamGate());
      res.json({
        settings: strategyEngine.getSettings(),
        strategies: signal.strategies || [],
      });
    } catch (err: any) {
      console.error('[API] /api/strategies error:', err);
      res.json({
        settings: strategyEngine.getSettings(),
        strategies: [],
      });
    }
  });

  app.post('/api/strategy/settings', (req: Request, res: Response) => {
    const settings = req.body;
    if (settings) {
      strategyEngine.updateSettings(settings);
    }
    const asset = poService.getActiveAsset();
    const timeframe = poService.getTimeframe();
    const signal = strategyEngine.generateSignal(asset, timeframe, getUpstreamGate());
    res.json({
      success: true,
      settings: strategyEngine.getSettings(),
      signal,
    });
  });

  app.post('/api/strategy/threshold', (req: Request, res: Response) => {
    try {
      const threshold = Number(req.body.threshold ?? req.body.selectedThreshold);
      if (isNaN(threshold) || threshold < 50 || threshold > 100) {
        return res.status(400).json({ error: 'Threshold must be a number between 50 and 100' });
      }
      strategyEngine.updateSettings({
        selectedThreshold: threshold,
        global: {
          ...strategyEngine.getSettings().global,
          selectedThreshold: threshold,
          minimumSignalConfidence: threshold,
        },
      });
      const asset = poService.getActiveAsset();
      const timeframe = poService.getTimeframe();
      const signal = strategyEngine.generateSignal(asset, timeframe, getUpstreamGate());
      res.json({
        success: true,
        selectedThreshold: threshold,
        settings: strategyEngine.getSettings(),
        signal,
      });
    } catch (err: any) {
      console.error('[API] /api/strategy/threshold error:', err);
      res.status(500).json({ error: err?.message || 'Error updating threshold' });
    }
  });

  app.post('/api/strategy/select', (req: Request, res: Response) => {
    const { strategy } = req.body;
    strategyEngine.updateSettings({ strategy, selectedStrategy: strategy });
    const asset = poService.getActiveAsset();
    const timeframe = poService.getTimeframe();
    const signal = strategyEngine.generateSignal(asset, timeframe, getUpstreamGate());
    res.json({
      success: true,
      strategy,
      settings: strategyEngine.getSettings(),
      signal,
    });
  });

  // START REAL-TIME ANALYSIS ENGINE (Bug 108)
  app.post('/api/analysis/start', (req: Request, res: Response) => {
    const { asset, timeframe, strategy, enabledStrategies } = req.body;

    if (asset) {
      poService.subscribeAsset(asset, timeframe ? Number(timeframe) : undefined);
    }
    if (strategy) {
      strategyEngine.updateSettings({ strategy, selectedStrategy: strategy });
    }
    if (enabledStrategies) {
      strategyEngine.updateSettings({ enabledStrategies });
    }

    strategyEngine.startAnalysis();

    const activeAsset = poService.getActiveAsset();
    const currentTf = poService.getTimeframe();
    const signal = strategyEngine.generateSignal(activeAsset, currentTf, getUpstreamGate());
    const indicators = strategyEngine.calculateIndicators(activeAsset, currentTf);
    const performance = strategyEngine.getPerformanceMetrics();

    broadcastSSE('analysis', {
      isAnalyzing: true,
      activeAsset,
      timeframe: currentTf,
      signal,
      indicators,
    });

    res.json({
      success: true,
      isAnalyzing: true,
      activeAsset,
      timeframe: currentTf,
      signal,
      indicators,
      performance,
    });
  });

  // STOP REAL-TIME ANALYSIS ENGINE (Bug 108)
  app.post('/api/analysis/stop', (req: Request, res: Response) => {
    strategyEngine.stopAnalysis();

    const activeAsset = poService.getActiveAsset();
    const currentTf = poService.getTimeframe();
    const signal = strategyEngine.generateSignal(activeAsset, currentTf, getUpstreamGate());
    const indicators = strategyEngine.calculateIndicators(activeAsset, currentTf);

    broadcastSSE('analysis', {
      isAnalyzing: false,
      activeAsset,
      timeframe: currentTf,
      signal,
      indicators,
    });

    res.json({
      success: true,
      isAnalyzing: false,
      signal,
    });
  });

  // ANALYSIS STATUS
  app.get('/api/analysis/status', (req: Request, res: Response) => {
    res.json({
      isAnalyzing: strategyEngine.isAnalyzing(),
      stateMachineState: strategyEngine.getStateMachineState(),
      latestSnapshot: strategyEngine.getLatestCandleSnapshot(),
      activeAsset: poService.getActiveAsset(),
      timeframe: poService.getTimeframe(),
      strategySettings: strategyEngine.getSettings(),
    });
  });

  // AUDIT SNAPSHOTS (Rule 4, 37)
  app.get('/api/analysis/snapshots', (req: Request, res: Response) => {
    res.json({
      stateMachineState: strategyEngine.getStateMachineState(),
      latestSnapshot: strategyEngine.getLatestCandleSnapshot(),
      snapshots: strategyEngine.getRecentCandleSnapshots(),
    });
  });

  // BATCH DATASET EVALUATION & INTEGRITY TEST (Rule 39)
  app.post('/api/analysis/evaluate-dataset', (req: Request, res: Response) => {
    try {
      const { candles, asset, timeframe } = req.body;
      const targetAsset = asset || poService.getActiveAsset();
      const targetTf = Number(timeframe) || poService.getTimeframe();
      const dataset = candles && Array.isArray(candles) && candles.length > 0
        ? candles
        : marketDataStore.getClosedCandles().length > 0
        ? marketDataStore.getClosedCandles()
        : candleBuilder.getClosedCandles(targetAsset, targetTf);

      const result = strategyEngine.evaluateCandleDataset(dataset, targetAsset, targetTf);
      res.json({
        success: true,
        asset: targetAsset,
        timeframe: targetTf,
        ...result,
      });
    } catch (err: any) {
      console.error('[API] /api/analysis/evaluate-dataset error:', err);
      res.status(500).json({ error: err?.message || 'Dataset evaluation failed' });
    }
  });

  app.post('/api/subscribe', (req: Request, res: Response) => {
    const { asset, timeframe } = req.body;
    if (asset) {
      strategyEngine.resetActiveSignal();
      poService.subscribeAsset(asset, timeframe);
      sbaaEngine.setAsset(asset);
      if (!autoTraderEngine.getStatus().isRunning) {
        autoTraderEngine.setAsset(asset);
      }
      marketDataStore.switchAsset(asset, timeframe ? Number(timeframe) : 60).then(() => {
        const closed = marketDataStore.getClosedCandles();
        if (closed.length > 0) {
          candleBuilder.loadHistoricalCandles(asset, timeframe ? Number(timeframe) : 60, closed);
        }
      });
    }
    res.json({ success: true, activeAsset: asset, timeframe });
  });

  // Dedicated Timeframe Synchronization Endpoint (1M, 5M, 15M, 30M, 1H, and fast frames)
  app.post('/api/timeframe', async (req: Request, res: Response) => {
    try {
      const rawTf = Number(req.body.timeframe);
      const VALID_TIMEFRAMES = [5, 15, 30, 60, 120, 180, 300, 900, 1800, 3600];
      const targetTf = VALID_TIMEFRAMES.includes(rawTf) ? rawTf : (rawTf || 60);
      const activeAsset = poService.getActiveAsset();
      const tfLabel = targetTf >= 3600 ? `${Math.round(targetTf / 3600)}H` : targetTf >= 60 ? `${Math.round(targetTf / 60)}M` : `${targetTf}s`;

      strategyEngine.resetActiveSignal();
      poService.setTimeframe(targetTf);
      poService.subscribeAsset(activeAsset, targetTf);
      autoTraderEngine.setTimeframe(targetTf);
      sbaaEngine.setTimeframe(targetTf);

      await marketDataStore.switchAsset(activeAsset, targetTf);

      const closed = marketDataStore.getClosedCandles();
      if (closed.length > 0) {
        candleBuilder.loadHistoricalCandles(activeAsset, targetTf, closed);
      }

      broadcastSSE('timeframe_synced', {
        asset: activeAsset,
        timeframe: targetTf,
        timeframeLabel: tfLabel,
      });

      res.json({
        success: true,
        asset: activeAsset,
        timeframe: targetTf,
        timeframeLabel: tfLabel,
        candleCount: closed.length,
      });
    } catch (err: any) {
      console.error('[API] /api/timeframe error:', err);
      res.status(500).json({ success: false, error: err?.message || 'Failed to sync timeframe' });
    }
  });

  app.post('/api/settings', (req: Request, res: Response) => {
    let { endpoint, sessionToken, isDemo, uid, settings } = req.body;

    // Guard against object passed as endpoint or whole body from SettingsModal
    if (typeof endpoint === 'object' && endpoint !== null) {
      sessionToken = endpoint.sessionToken || sessionToken;
      isDemo = endpoint.isDemo !== undefined ? endpoint.isDemo : isDemo;
      uid = endpoint.accountUid || endpoint.uid || uid;
      endpoint = endpoint.endpoint;
    }

    if (settings && typeof settings === 'object') {
      strategyEngine.updateSettings(settings);
    }

    // Lock /api/settings to REAL mode only
    const lockedIsDemo = false;
    marketDataStore.setAccountMode('REAL', poService.getSessionGeneration());

    const safeEndpoint =
      typeof endpoint === 'string' && !endpoint.toLowerCase().includes('demo-api')
        ? endpoint
        : undefined;

    if (safeEndpoint || typeof sessionToken === 'string') {
      poService.updateConfig(
        safeEndpoint,
        typeof sessionToken === 'string' ? sessionToken : undefined,
        lockedIsDemo,
        uid
      );
    }

    res.json({
      success: true,
      strategySettings: strategyEngine.getSettings(),
      diagnostics: poService.getDiagnostics(),
    });
  });

  app.post('/api/strategies/toggle', (req: Request, res: Response) => {
    const { strategyId, enabled } = req.body;
    if (strategyId) {
      const updateObj: any = {};
      updateObj[strategyId] = { enabled: Boolean(enabled) };
      strategyEngine.updateSettings(updateObj);
    }
    res.json({ success: true, settings: strategyEngine.getSettings() });
  });

  app.post('/api/account/connect', async (req: Request, res: Response) => {
    try {
      const { endpoint, sessionToken, isDemo, uid, mode, attemptId, timeoutMs } = req.body;
      if (!sessionToken || typeof sessionToken !== 'string' || !sessionToken.trim()) {
        res.status(400).json({ success: false, ok: false, error: 'Session / SSD token is required' });
        return;
      }

      let effectiveSession = sessionToken.trim();
      let effectiveUid = uid;

      // Pre-parse credentials to detect whether the SSD specifically contains isDemo: 0 (REAL) or 1 (DEMO)
      const preParse = PocketOptionService.parseCredentials(effectiveSession, isDemo === true, effectiveUid ? Number(effectiveUid) : undefined);

      let determinedMode: AccountMode = 'REAL';
      if (mode === 'REAL') {
        determinedMode = 'REAL';
      } else if (mode === 'DEMO' || isDemo === true || preParse.detectedModeFromPayload === 'DEMO') {
        res.status(400).json({
          success: false,
          ok: false,
          error: 'تم إيقاف الحساب التجريبي (DEMO). يرجى استخدام جلسة الحساب الحقيقي فقط (isDemo=0).',
          errorCode: 'DEMO_DISABLED',
        });
        return;
      }

      const isDemoBool = false;

      const parsed = PocketOptionService.parseCredentials(effectiveSession, isDemoBool, effectiveUid ? Number(effectiveUid) : undefined);
      const targetUid = effectiveUid || parsed.uid;

      let targetEndpoint = endpoint && typeof endpoint === 'string' && endpoint.trim().length > 0
        ? PocketOptionService.cleanEndpoint(endpoint.trim())
        : undefined;

      if (!targetEndpoint || targetEndpoint.includes('demo-api-')) {
        targetEndpoint = 'wss://api-eu.po.market/socket.io/?EIO=4&transport=websocket';
      }

      console.log(`[PO-CONNECT] Connecting account: Mode=${determinedMode} (isDemo=${isDemoBool}), PayloadDetected=${preParse.detectedModeFromPayload || 'NONE'}, Endpoint=${targetEndpoint}, UID=${targetUid || 'auto'}`);

      // Execute connection with handshake and hard timeout
      const result = await poService.connectWithHandshake({
        sessionToken: effectiveSession,
        isDemo: isDemoBool,
        endpoint: targetEndpoint,
        uid: targetUid,
        attemptId,
        timeoutMs: timeoutMs ? Number(timeoutMs) : 15000,
      });

      marketDataStore.setAccountMode(determinedMode, poService.getSessionGeneration());

      if (result.success) {
        res.json({
          success: true,
          ok: true,
          state: result.state,
          account: result.account,
          balance: result.balance,
          accountMode: result.accountMode,
          isDemo: isDemoBool,
          detectedModeFromPayload: preParse.detectedModeFromPayload,
          diagnostics: result.diagnostics || poService.getDiagnostics(),
          generation: result.generation,
          connectionId: result.connectionId,
        });
      } else {
        // Return 200 OK with clean JSON payload so reverse proxies/Cloud Run never intercept with <!doctype html> error pages
        res.status(200).json({
          success: false,
          ok: false,
          state: result.state || 'CONNECTION_ERROR',
          error: result.error || 'Connection failed',
          errorCode: result.errorCode || 'UNKNOWN_ERROR',
          diagnostics: result.diagnostics || poService.getDiagnostics(),
          generation: result.generation,
        });
      }
    } catch (err: any) {
      console.error('[API] /api/account/connect error:', err);
      res.status(200).json({
        success: false,
        ok: false,
        error: err?.message || 'Internal connection error',
        errorCode: 'UNKNOWN_ERROR',
        diagnostics: poService.getDiagnostics(),
      });
    }
  });

  app.post('/api/account/switch-mode', (req: Request, res: Response) => {
    const { mode } = req.body;
    if (mode !== 'REAL') {
      res.status(400).json({
        success: false,
        error: 'تم إيقاف الحساب التجريبي (DEMO). المنصة تعمل بالحساب الحقيقي (REAL) فقط.',
        errorCode: 'DEMO_DISABLED',
      });
      return;
    }
    poService.switchAccountMode('REAL');
    marketDataStore.setAccountMode('REAL', poService.getSessionGeneration());
    res.json({
      success: true,
      mode: 'REAL',
      diagnostics: poService.getDiagnostics(),
    });
  });

  app.post('/api/account/balance/refresh', (req: Request, res: Response) => {
    poService.requestBalance();
    res.json({
      success: true,
      message: 'Balance update request dispatched to Pocket Option',
      diagnostics: poService.getDiagnostics(),
    });
  });

  app.post('/api/account/disconnect', (req: Request, res: Response) => {
    poService.disconnect();
    res.json({
      success: true,
      message: 'Account session disconnected and cleared',
      diagnostics: poService.getDiagnostics(),
    });
  });

  app.post('/api/reconnect', (req: Request, res: Response) => {
    poService.reconnectExplicit();
    res.json({
      success: true,
      message: 'Reconnection evaluation initiated',
      diagnostics: poService.getDiagnostics(),
    });
  });

  // ==================== SABAA QUANT INSTITUTIONAL API ROUTES ====================

  // Real Pocket Option Deal & Order Execution Routes
  app.get('/api/orders', (req: Request, res: Response) => {
    try {
      const activeDeals = poService.getActiveDeals();
      const history = poService.getDealsHistory();
      res.json({
        success: true,
        activeDeals,
        history,
        total: activeDeals.length + history.length,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Error fetching orders' });
    }
  });

  app.post('/api/orders', async (req: Request, res: Response) => {
    try {
      const { symbol, asset, amount, action, side, time, duration, strategyName, reasons, confluenceScore } = req.body;
      const targetAsset = asset || symbol || poService.getActiveAsset();
      
      const rawAmount = Number(amount);
      if (isNaN(rawAmount) || rawAmount < 1.0 || rawAmount > 1000.00) {
        return res.status(400).json({
          success: false,
          error: 'مبلغ الصفقة يجب أن يكون بين 1.00$ و 1,000.00$.',
        });
      }

      // Preserve exact cents with 2 decimal places
      const targetAmount = Math.round(rawAmount * 100) / 100;

      // Platform & account balance pre-trade check
      const currentBalance = poService.getDiagnostics()?.account?.balance;
      if (typeof currentBalance === 'number' && currentBalance > 0 && targetAmount > currentBalance) {
        return res.status(400).json({
          success: false,
          error: `الرصيد المتاح ($${currentBalance.toFixed(2)}) غير كافٍ لفتح صفقة بمبلغ $${targetAmount.toFixed(2)}.`,
        });
      }

      const rawAction = String(action || side || 'call').toLowerCase();
      const targetAction: 'call' | 'put' = rawAction === 'sell' || rawAction === 'put' || rawAction === 'down' ? 'put' : 'call';
      // Strictly synchronize with active timeframe (1m=60, 5m=300, 15m=900)
      const targetTime = Number(time || duration) || poService.getTimeframe() || 60;

      const result = await poService.openDeal({
        asset: targetAsset,
        amount: targetAmount,
        action: targetAction,
        time: targetTime,
        strategyName: strategyName || 'توافق الاستراتيجيات (Confluence Matrix)',
        reasons: Array.isArray(reasons) ? reasons : [],
        confluenceScore: typeof confluenceScore === 'number' ? confluenceScore : 0,
      });

      if (result.success) {
        broadcastSSE('deal_opened', result.deal);
        res.json({
          success: true,
          deal: result.deal,
          message: 'تم فتح الصفقة بنجاح على منصة Pocket Option',
          requestId: result.requestId,
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error || 'فشل فتح الصفقة على المنصة',
          requestId: result.requestId,
        });
      }
    } catch (err: any) {
      console.error('[API] /api/orders trade execution error:', err);
      res.status(500).json({
        success: false,
        error: err?.message || 'فشل تنفيذ الصفقة بسبب خطأ في الخادم',
      });
    }
  });

  // ==================== STEALTH AUTO-TRADER REST & CONTROL API ====================
  app.get('/api/autotrader/status', (req: Request, res: Response) => {
    try {
      res.json({ success: true, ...autoTraderEngine.getStatus() });
    } catch (err: any) {
      console.error('[API] /api/autotrader/status error:', err);
      res.status(500).json({ success: false, error: err?.message || 'Status error' });
    }
  });

  app.post('/api/autotrader/start', async (req: Request, res: Response) => {
    const config = { ...req.body, isDemo: false };
    const result = autoTraderEngine.start(config);
    const activeCfg = autoTraderEngine.getStatus().config;
    const syncAsset = activeCfg.asset || poService.getActiveAsset();
    const syncTf = Number(activeCfg.timeframe) || poService.getTimeframe();
    if (syncAsset && syncTf && (syncAsset !== poService.getActiveAsset() || syncTf !== poService.getTimeframe())) {
      poService.setTimeframe(syncTf);
      poService.subscribeAsset(syncAsset, syncTf);
      sbaaEngine.setAsset(syncAsset);
      sbaaEngine.setTimeframe(syncTf);
      marketDataStore.switchAsset(syncAsset, syncTf).catch(() => {});
    }
    res.json({ ...result, status: autoTraderEngine.getStatus() });
  });

  app.post('/api/autotrader/stop', (req: Request, res: Response) => {
    const result = autoTraderEngine.stop();
    res.json({ ...result, status: autoTraderEngine.getStatus() });
  });

  app.post('/api/autotrader/emergency-stop', (req: Request, res: Response) => {
    const result = autoTraderEngine.emergencyStop();
    res.json({ ...result, status: autoTraderEngine.getStatus() });
  });

  app.post('/api/autotrader/clear-emergency', (req: Request, res: Response) => {
    const result = autoTraderEngine.clearEmergencyStop();
    res.json({ ...result, status: autoTraderEngine.getStatus() });
  });

  app.post('/api/autotrader/test-connection', (req: Request, res: Response) => {
    const testResult = autoTraderEngine.testConnection();
    res.json({ success: testResult.ok, ...testResult });
  });

  app.post('/api/autotrader/save-settings', (req: Request, res: Response) => {
    const result = autoTraderEngine.saveSettings({ ...req.body, isDemo: false });
    const activeCfg = autoTraderEngine.getStatus().config;
    const syncAsset = activeCfg.asset || poService.getActiveAsset();
    const syncTf = Number(activeCfg.timeframe) || poService.getTimeframe();
    if (syncAsset && syncTf && (syncAsset !== poService.getActiveAsset() || syncTf !== poService.getTimeframe())) {
      poService.setTimeframe(syncTf);
      poService.subscribeAsset(syncAsset, syncTf);
      sbaaEngine.setAsset(syncAsset);
      sbaaEngine.setTimeframe(syncTf);
      marketDataStore.switchAsset(syncAsset, syncTf).catch(() => {});
    }
    res.json({ ...result, status: autoTraderEngine.getStatus() });
  });

  app.post('/api/autotrader/reset-pnl', (req: Request, res: Response) => {
    const result = autoTraderEngine.resetPnL();
    res.json({ ...result, status: autoTraderEngine.getStatus() });
  });

  app.post('/api/autotrader/clear-trades', (req: Request, res: Response) => {
    const result = autoTraderEngine.clearTradeList();
    res.json({ ...result, status: autoTraderEngine.getStatus() });
  });

  app.post('/api/autotrader/clear-logs', (req: Request, res: Response) => {
    const result = autoTraderEngine.clearLogs();
    res.json({ ...result, status: autoTraderEngine.getStatus() });
  });

  app.post('/api/autotrader/backtest', (req: Request, res: Response) => {
    try {
      const { strategyId, asset, timeframe, stake, payoutRatio } = req.body;
      const targetAsset = asset || poService.getActiveAsset();
      const targetTf = Number(timeframe) || poService.getTimeframe();
      
      let candles = marketDataStore.getCandles(targetAsset, targetTf);
      if (candles.length === 0 && marketDataStore.getActiveAsset() === targetAsset) {
        candles = marketDataStore.getAllCandles();
      }
      if (candles.length === 0) {
        candles = candleBuilder.getCandles(targetAsset, targetTf);
      }

      const report = autoTraderEngine.runBacktest(
        strategyId || 'confluence',
        candles,
        stake ? Number(stake) : 10,
        payoutRatio ? Number(payoutRatio) : 0.88
      );

      res.json({ success: true, report });
    } catch (err: any) {
      console.error('[API] /api/autotrader/backtest error:', err);
      res.status(500).json({ success: false, error: err?.message || 'Backtest error' });
    }
  });

  app.get('/api/positions', (req: Request, res: Response) => {
    res.json(poService.getActiveDeals());
  });

  // ==============================================================
  // SBAA STRATEGY ENGINE API (استراتيجية سبع الذكية المطورة)
  // ==============================================================
  app.get('/api/sbaa/status', (req: Request, res: Response) => {
    try {
      res.json(sbaaEngine.getStatus());
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Error fetching SBAA status' });
    }
  });

  app.get('/api/sbaa/logs', (req: Request, res: Response) => {
    try {
      const limit = Number(req.query.limit) || 100;
      res.json(sbaaEngine.getDetectionLogs(limit));
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Error fetching SBAA logs' });
    }
  });

  app.post('/api/sbaa/config', (req: Request, res: Response) => {
    try {
      sbaaEngine.updateConfig(req.body);
      res.json({ success: true, status: sbaaEngine.getStatus() });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message });
    }
  });

  app.post('/api/sbaa/toggle', (req: Request, res: Response) => {
    try {
      const { autoDemoExecution, enabled } = req.body;
      const update: any = {};
      if (autoDemoExecution !== undefined) update.autoDemoExecution = Boolean(autoDemoExecution);
      if (enabled !== undefined) update.enabled = Boolean(enabled);
      sbaaEngine.updateConfig(update);
      res.json({ success: true, status: sbaaEngine.getStatus() });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message });
    }
  });

  app.post('/api/sbaa/reset-stats', (req: Request, res: Response) => {
    try {
      sbaaEngine.resetStats();
      res.json({ success: true, status: sbaaEngine.getStatus() });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message });
    }
  });

  app.post('/api/sbaa/clear-logs', (req: Request, res: Response) => {
    try {
      sbaaEngine.clearLogs();
      res.json({ success: true, logs: [] });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message });
    }
  });

  app.post('/api/sbaa/analyze', (req: Request, res: Response) => {
    try {
      const { asset, timeframe, candles } = req.body;
      const targetAsset = asset || poService.getActiveAsset();
      const targetTf = Number(timeframe) || poService.getTimeframe();
      const result = sbaaEngine.evaluateMarket(targetAsset, targetTf, candles);
      res.json({ success: true, result, status: sbaaEngine.getStatus() });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'SBAA analysis failed' });
    }
  });


  const scannerHistoricalService = new HistoricalCandleService();

  // Market Scanner (100% Real Broker + Spot Feeds)
  app.get('/api/scanner', async (req: Request, res: Response) => {
    try {
      const scannerData = await sabaaService.getRealScannerData({
        poService,
        marketDataStore,
        candleBuilder,
        strategyEngine,
        historicalService: scannerHistoricalService,
      });
      res.json(scannerData);
    } catch (err: any) {
      console.error('[API] /api/scanner error:', err);
      res.json([]);
    }
  });

  // Public System Telemetry (unshadowed by /api/admin auth router)
  app.get('/api/telemetry/health', (req: Request, res: Response) => {
    res.json(sabaaService.getHealthTelemetry(sseClients.length, process.memoryUsage()));
  });

  app.get('/api/telemetry/logs', (req: Request, res: Response) => {
    res.json(sabaaService.getAuditLogs());
  });

  // Direct APK distribution and in-app update endpoints
  app.get(['/download', '/download/index.html'], (req: Request, res: Response) => {
    const downloadPage = path.join(process.cwd(), 'public', 'download', 'index.html');
    if (fs.existsSync(downloadPage)) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=300');
      return res.sendFile(downloadPage);
    }
    res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>SABAA QUANT - Download</title></head><body style="background:#020617;color:white;text-align:center;padding:50px;font-family:sans-serif;"><h1>SABAA QUANT</h1><p>Android App</p><p><a href="/download/SABAA-AI.apk" style="background:#10b981;color:white;padding:15px 30px;border-radius:10px;text-decoration:none;font-weight:bold;display:inline-block;">Download APK</a></p></body></html>`);
  });

  const serveApkFile = (req: Request, res: Response, targetFilename?: string) => {
    const requested = targetFilename || req.params.filename || 'SABAA-AI.apk';
    const downloadFilename = requested.endsWith('.apk') ? requested : `${requested}.apk`;
    
    // Explicitly remove any 403 or auth restrictions - public APK distribution
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Content-Type', 'application/vnd.android.package-archive');
    res.setHeader('Content-Disposition', `attachment; filename="${downloadFilename}"`);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=3600, no-transform');

    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }
    
    // Check if external storage URL is configured
    const externalUrl = process.env.APK_DOWNLOAD_URL || process.env.EXTERNAL_APK_URL;
    
    const candidates = [
      path.join(process.cwd(), 'public', 'download', requested),
      path.join(process.cwd(), 'public', 'download', 'SABAA-AI.apk'),
      path.join(process.cwd(), 'public', 'app', requested),
      path.join(process.cwd(), 'public', 'app', 'SABAA-AI.apk'),
      path.join(process.cwd(), 'public', 'app', 'Sabaa-AI-Solution-v1.0.0-release.apk'),
      path.join(process.cwd(), 'public', 'app', 'app-release.apk'),
      path.join(process.cwd(), 'android', 'app', 'src', 'main', 'assets', 'public', 'download', requested),
      path.join(process.cwd(), 'android', 'app', 'src', 'main', 'assets', 'public', 'download', 'SABAA-AI.apk'),
      path.join(process.cwd(), 'android', 'app', 'src', 'main', 'assets', 'public', 'app', requested),
      path.join(process.cwd(), 'android', 'app', 'src', 'main', 'assets', 'public', 'app', 'Sabaa-AI-Solution-v1.0.0-release.apk'),
      path.join(process.cwd(), 'android', 'app', 'src', 'main', 'assets', 'public', 'app', 'app-release.apk'),
      path.join(process.cwd(), 'android', 'app', 'build', 'outputs', 'apk', 'release', requested),
      path.join(process.cwd(), 'android', 'app', 'build', 'outputs', 'apk', 'release', 'Sabaa-AI-Solution-v1.0.0-release.apk'),
      path.join(process.cwd(), 'android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk'),
    ];

    for (const filePath of candidates) {
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        if (stats.size > 0) {
          res.setHeader('Content-Length', stats.size.toString());
          
          if (req.method === 'HEAD') {
            return res.status(200).end();
          }
          return res.status(200).sendFile(filePath);
        }
      }
    }

    if (externalUrl) {
      return res.redirect(302, externalUrl);
    }

    // Gracefully redirect to the mobile installation and PWA setup page instead of 404
    return res.redirect(302, '/download');
  };

  // Dedicated public APK download endpoint - zero 403 restrictions
  app.all('/download/SABAA-AI.apk', (req: Request, res: Response) => {
    serveApkFile(req, res, 'SABAA-AI.apk');
  });

  // Public APK download endpoints
  app.all(['/download/:filename'], (req: Request, res: Response) => {
    serveApkFile(req, res, req.params.filename || 'SABAA-AI.apk');
  });

  app.all(['/app/:filename'], (req: Request, res: Response) => {
    const filename = req.params.filename;
    if (filename === 'version.json') {
      const versionFile = path.join(process.cwd(), 'public', 'app', 'version.json');
      if (fs.existsSync(versionFile)) {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        return res.sendFile(versionFile);
      }
      return res.json({
        versionName: '1.0.0',
        versionCode: 1,
        apkUrl: '/download/SABAA-AI.apk',
        mandatory: false,
        releaseNotes: 'الإصدار الرسمي لتطبيق SABAA QUANT لمنصة أندرويد'
      });
    }
    serveApkFile(req, res, filename);
  });

  app.get('/app/version.json', (req: Request, res: Response) => {
    const versionFile = path.join(process.cwd(), 'public', 'app', 'version.json');
    if (fs.existsSync(versionFile)) {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      return res.sendFile(versionFile);
    }
    res.json({
      versionName: '1.0.0',
      versionCode: 1,
      apkUrl: '/download/SABAA-AI.apk',
      mandatory: false,
      releaseNotes: 'الإصدار الرسمي لتطبيق SABAA QUANT لمنصة أندرويد'
    });
  });

  // Server-Sent Events Live Stream
  app.get('/api/live', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    sseClients.push(res);

    // Initial state push
    const asset = poService.getActiveAsset();
    const timeframe = poService.getTimeframe();
    let candles = marketDataStore.getCandles(asset, timeframe);
    if (candles.length === 0 && marketDataStore.getActiveAsset() === asset) {
      candles = marketDataStore.getAllCandles();
    }
    if (candles.length === 0) {
      candles = candleBuilder.getCandles(asset, timeframe);
    }
    const signal = strategyEngine.generateSignal(asset, timeframe, getUpstreamGate());
    const indicators = strategyEngine.calculateIndicators(asset, timeframe);
    const performance = strategyEngine.getPerformanceMetrics();

    res.write(
      `event: init\ndata: ${JSON.stringify({
        diagnostics: { ...poService.getDiagnostics(), ...marketDataStore.getDiagnostics() },
        candles,
        signal,
        indicators,
        performance,
        positions: sabaaService.getPositions(),
        orders: sabaaService.getOrders(),
        strategySettings: strategyEngine.getSettings(),
        activeAsset: asset,
        timeframe,
      })}\n\n`
    );

    req.on('close', () => {
      const idx = sseClients.indexOf(res);
      if (idx !== -1) sseClients.splice(idx, 1);
    });
  });

  // Vite middleware for development vs static build in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Pocket Option Signal Engine server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
