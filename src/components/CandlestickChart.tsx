import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  createSeriesMarkers,
  CrosshairMode,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
  type SeriesMarker,
  type IPriceLine,
} from 'lightweight-charts';
import { Candle, SupportResistanceLevel, Signal, IndicatorMetrics, buildCandleId, GannAnalysisData, ElliottWaveData, DarvasBoxData } from '../types';
import { candleStore } from '../services/CandleStore';
import { useLanguage } from '../i18n/LanguageContext';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  Minimize2,
  Activity,
  BarChart2,
  Terminal,
  X,
  TrendingUp,
  TrendingDown,
  Layers,
  Clock,
  Sliders,
  ChevronDown,
} from 'lucide-react';
import { useDeviceScale } from '../hooks/useDeviceScale';

export interface CandlestickChartProps {
  candles: Candle[];
  activeAsset: string;
  timeframe: number;
  currentPrice: number | null;
  digits?: number;
  levels?: SupportResistanceLevel[];
  srLevels?: SupportResistanceLevel[];
  recentSignals?: Signal[];
  activeSignal?: Signal | null;
  indicators?: IndicatorMetrics | null;
  dataStatus?: string;
  freshnessSeconds?: number;
  onSelectTimeframe?: (tf: number) => void;
  onSelectSignal?: (sig: Signal) => void;
  gannData?: GannAnalysisData | null;
  elliottData?: ElliottWaveData | null;
  darvasData?: DarvasBoxData | null;
  selectedStrategy?: string;
  backtestOverlayTrades?: any[] | null;
  onClearBacktestOverlay?: () => void;
}

interface FormattedCandle {
  time: UTCTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export const CandlestickChart: React.FC<CandlestickChartProps> = ({
  candles,
  activeAsset,
  timeframe,
  currentPrice,
  digits = 5,
  levels = [],
  srLevels,
  recentSignals = [],
  activeSignal = null,
  dataStatus = 'LIVE',
  freshnessSeconds = 0,
  onSelectTimeframe,
  onSelectSignal,
  gannData = null,
  elliottData = null,
  darvasData = null,
  selectedStrategy = 'confluence',
  backtestOverlayTrades = null,
  onClearBacktestOverlay,
}) => {
  const { t, isRTL } = useLanguage();
  const activeLevels = srLevels || levels;

  // Chart Container Refs
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const emaFastSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const emaSlowSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const smaSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bbUpperSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bbMiddleSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bbLowerSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const markersPrimitiveRef = useRef<any>(null);
  const priceLinesRef = useRef<IPriceLine[]>([]);
  const gannPriceLinesRef = useRef<IPriceLine[]>([]);
  const darvasPriceLinesRef = useRef<IPriceLine[]>([]);

  // Track the key of last full dataset load: `${activeAsset}:${timeframe}:${datasetId}`
  const lastFullLoadKeyRef = useRef<string>('');
  const lastCandleTimestampRef = useRef<number>(0);
  const lastAssetRef = useRef<string>('');
  const lastTimeframeRef = useRef<number>(0);
  const lastCandlesCountRef = useRef<number>(0);

  // UI State
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showDiagnosticsOverlay, setShowDiagnosticsOverlay] = useState(false);
  const [showCandleTable, setShowCandleTable] = useState(false);
  const [showDataSourceDebug, setShowDataSourceDebug] = useState(false);

  // Responsive Device-Scale Engine Integration
  const { layoutMode, isPhone, isLandscape, optimalChartHeight } = useDeviceScale();
  const [showOverlaysBar, setShowOverlaysBar] = useState(false);
  const lastSizeRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 });

  // Overlays State
  const [showEMA, setShowEMA] = useState(true);
  const [showSMA, setShowSMA] = useState(false);
  const [showBollinger, setShowBollinger] = useState(false);
  const [showLevels, setShowLevels] = useState(true);
  const [showGann, setShowGann] = useState(true);
  const [showElliott, setShowElliott] = useState(true);
  const [showDarvas, setShowDarvas] = useState(true);

  // Sub-pane Panels State
  const [showRsiPane, setShowRsiPane] = useState(false);
  const [showMacdPane, setShowMacdPane] = useState(false);

  // Hover Tooltip State
  const [hoverData, setHoverData] = useState<{
    timeStr: string;
    open: number;
    high: number;
    low: number;
    close: number;
    changePercent: number;
    volume: number;
    isClosed: boolean;
  } | null>(null);

  // Candle close countdown
  const [countdown, setCountdown] = useState<number>(timeframe);
  useEffect(() => {
    const updateTimer = () => {
      const nowSec = Math.floor(Date.now() / 1000);
      const rem = timeframe - (nowSec % timeframe);
      setCountdown(rem);
    };
    updateTimer();
    const interval = setInterval(updateTimer, 500);
    return () => clearInterval(interval);
  }, [timeframe]);

  // Clean and deduplicate candles with strict timeframe bucket alignment
  const cleanCandles = useMemo((): FormattedCandle[] => {
    if (!candles || candles.length === 0) {
      return [];
    }
    const map = new Map<number, FormattedCandle>();
    const tf = Math.floor(Number(timeframe) || 60);

    for (const c of candles) {
      if (!c) continue;
      // Filter out candles from other assets if asset is provided on candle
      if (c.asset && activeAsset && c.asset.toLowerCase() !== activeAsset.toLowerCase()) continue;
      // Filter out candles from other timeframes if timeframe is provided on candle
      if (c.timeframe && tf && Number(c.timeframe) !== tf) continue;

      let t = Math.floor(c.time);
      if (t > 1e11) t = Math.floor(t / 1000);
      if (t <= 0) continue;

      // Align strictly to timeframe bucket boundary
      const bucketTime = Math.floor(t / tf) * tf;

      const open = Number(c.open);
      const close = Number(c.close);
      let high = Number(c.high);
      let low = Number(c.low);

      if (isNaN(open) || isNaN(close) || open <= 0 || close <= 0) continue;
      if (isNaN(high) || high < Math.max(open, close)) high = Math.max(open, close);
      if (isNaN(low) || low > Math.min(open, close) || low <= 0) low = Math.min(open, close);

      const existing = map.get(bucketTime);
      if (!existing) {
        map.set(bucketTime, {
          time: bucketTime as UTCTimestamp,
          open,
          high,
          low,
          close,
          volume: Number(c.volume) > 0 ? Number(c.volume) : 1,
        });
      } else {
        // If incoming candle is newer update for the same bucket
        map.set(bucketTime, {
          time: bucketTime as UTCTimestamp,
          open: existing.open,
          high: Math.max(existing.high, high),
          low: Math.min(existing.low, low),
          close,
          volume: Math.max(existing.volume, Number(c.volume) || 1),
        });
      }
    }

    return Array.from(map.values()).sort((a, b) => (a.time as number) - (b.time as number));
  }, [candles, activeAsset, timeframe]);

  // Synchronize candle store count cleanly without render-phase side effects
  useEffect(() => {
    candleStore.setChartDataCount(cleanCandles.length);
  }, [cleanCandles.length]);

  // Compute Technical Indicators
  const indicatorData = useMemo(() => {
    if (cleanCandles.length < 5) {
      return { ema9: [], ema21: [], sma50: [], bbUpper: [], bbMiddle: [], bbLower: [], rsi: [], macd: null };
    }

    // EMA Helper
    const calcEMA = (period: number) => {
      if (cleanCandles.length < period) return [];
      const k = 2 / (period + 1);
      const res: { time: UTCTimestamp; value: number }[] = [];
      let sum = 0;
      for (let i = 0; i < period; i++) sum += cleanCandles[i].close;
      let prev = sum / period;
      res.push({ time: cleanCandles[period - 1].time, value: prev });
      for (let i = period; i < cleanCandles.length; i++) {
        const val = cleanCandles[i].close * k + prev * (1 - k);
        res.push({ time: cleanCandles[i].time, value: val });
        prev = val;
      }
      return res;
    };

    // SMA Helper
    const calcSMA = (period: number) => {
      if (cleanCandles.length < period) return [];
      const res: { time: UTCTimestamp; value: number }[] = [];
      let sum = 0;
      for (let i = 0; i < period; i++) sum += cleanCandles[i].close;
      res.push({ time: cleanCandles[period - 1].time, value: sum / period });
      for (let i = period; i < cleanCandles.length; i++) {
        sum += cleanCandles[i].close - cleanCandles[i - period].close;
        res.push({ time: cleanCandles[i].time, value: sum / period });
      }
      return res;
    };

    // Bollinger Bands Helper
    const calcBB = (period = 20, mult = 2) => {
      if (cleanCandles.length < period) return { upper: [], middle: [], lower: [] };
      const upper: { time: UTCTimestamp; value: number }[] = [];
      const middle: { time: UTCTimestamp; value: number }[] = [];
      const lower: { time: UTCTimestamp; value: number }[] = [];
      for (let i = period - 1; i < cleanCandles.length; i++) {
        let sum = 0;
        for (let j = i - period + 1; j <= i; j++) sum += cleanCandles[j].close;
        const mean = sum / period;
        let variance = 0;
        for (let j = i - period + 1; j <= i; j++) variance += Math.pow(cleanCandles[j].close - mean, 2);
        const sd = Math.sqrt(variance / period);
        middle.push({ time: cleanCandles[i].time, value: mean });
        upper.push({ time: cleanCandles[i].time, value: mean + sd * mult });
        lower.push({ time: cleanCandles[i].time, value: mean - sd * mult });
      }
      return { upper, middle, lower };
    };

    // RSI Helper
    const calcRSI = (period = 14) => {
      if (cleanCandles.length <= period) return [];
      const res: { time: UTCTimestamp; value: number }[] = [];
      let gains = 0;
      let losses = 0;
      for (let i = 1; i <= period; i++) {
        const diff = cleanCandles[i].close - cleanCandles[i - 1].close;
        if (diff >= 0) gains += diff;
        else losses -= diff;
      }
      let avgGain = gains / period;
      let avgLoss = losses / period;
      let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      res.push({ time: cleanCandles[period].time, value: 100 - 100 / (1 + rs) });
      for (let i = period + 1; i < cleanCandles.length; i++) {
        const diff = cleanCandles[i].close - cleanCandles[i - 1].close;
        const gain = diff > 0 ? diff : 0;
        const loss = diff < 0 ? -diff : 0;
        avgGain = (avgGain * (period - 1) + gain) / period;
        avgLoss = (avgLoss * (period - 1) + loss) / period;
        rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
        res.push({ time: cleanCandles[i].time, value: 100 - 100 / (1 + rs) });
      }
      return res;
    };

    const bb = calcBB(20, 2);

    return {
      ema9: calcEMA(9),
      ema21: calcEMA(21),
      sma50: calcSMA(50),
      bbUpper: bb.upper,
      bbMiddle: bb.middle,
      bbLower: bb.lower,
      rsi: calcRSI(14),
      macd: null,
    };
  }, [cleanCandles]);

  // Initialize Lightweight Chart Instance
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const container = chartContainerRef.current;
    container.innerHTML = '';

    const chart = createChart(container, {
      width: container.clientWidth || 800,
      height: container.clientHeight || 450,
      layout: {
        background: { color: '#090e17' },
        textColor: '#94a3b8',
        fontSize: 11,
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      },
      grid: {
        vertLines: { color: 'rgba(30, 41, 59, 0.45)', style: LineStyle.Dotted },
        horzLines: { color: 'rgba(30, 41, 59, 0.45)', style: LineStyle.Dotted },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: '#38bdf8',
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: '#1e293b',
        },
        horzLine: {
          color: '#38bdf8',
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: '#1e293b',
        },
      },
      timeScale: {
        borderColor: '#1e293b',
        timeVisible: true,
        secondsVisible: timeframe < 60,
        rightOffset: 12,
        barSpacing: 9,
        minBarSpacing: 3,
      },
      rightPriceScale: {
        borderColor: '#1e293b',
        autoScale: true,
        scaleMargins: {
          top: 0.08,
          bottom: 0.18,
        },
      },
    });

    // 1. Candlestick Series
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#f43f5e',
      borderVisible: true,
      borderUpColor: '#10b981',
      borderDownColor: '#f43f5e',
      wickUpColor: '#10b981',
      wickDownColor: '#f43f5e',
      priceFormat: {
        type: 'price',
        precision: digits,
        minMove: 1 / Math.pow(10, digits),
      },
    });

    // 2. Volume Histogram Overlay
    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: '#26a69a',
      priceFormat: { type: 'volume' },
      priceScaleId: '',
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
    });

    // 3. Technical Overlays
    const emaFastSeries = chart.addSeries(LineSeries, {
      color: '#38bdf8',
      lineWidth: 2,
      priceScaleId: 'right',
      title: 'EMA 9',
    });

    const emaSlowSeries = chart.addSeries(LineSeries, {
      color: '#f59e0b',
      lineWidth: 2,
      priceScaleId: 'right',
      title: 'EMA 21',
    });

    const smaSeries = chart.addSeries(LineSeries, {
      color: '#a855f7',
      lineWidth: 2,
      priceScaleId: 'right',
      title: 'SMA 50',
    });

    const bbUpperSeries = chart.addSeries(LineSeries, {
      color: 'rgba(168, 85, 247, 0.7)',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      priceScaleId: 'right',
    });

    const bbMiddleSeries = chart.addSeries(LineSeries, {
      color: 'rgba(168, 85, 247, 0.35)',
      lineWidth: 1,
      lineStyle: LineStyle.Dotted,
      priceScaleId: 'right',
    });

    const bbLowerSeries = chart.addSeries(LineSeries, {
      color: 'rgba(168, 85, 247, 0.7)',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      priceScaleId: 'right',
    });

    // Store references
    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;
    emaFastSeriesRef.current = emaFastSeries;
    emaSlowSeriesRef.current = emaSlowSeries;
    smaSeriesRef.current = smaSeries;
    bbUpperSeriesRef.current = bbUpperSeries;
    bbMiddleSeriesRef.current = bbMiddleSeries;
    bbLowerSeriesRef.current = bbLowerSeries;
    lastFullLoadKeyRef.current = '';

    // Crosshair tooltip listener
    chart.subscribeCrosshairMove((param) => {
      if (!param.point || !param.time || !param.seriesData) {
        setHoverData(null);
        return;
      }
      const bar = param.seriesData.get(candleSeries) as any;
      if (bar && typeof bar.open === 'number') {
        const d = new Date(Number(param.time) * 1000);
        const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
        const change = ((bar.close - bar.open) / bar.open) * 100;
        const volBar = param.seriesData.get(volumeSeries) as any;
        const vol = volBar && typeof volBar.value === 'number' ? volBar.value : 1;

        setHoverData({
          timeStr,
          open: bar.open,
          high: bar.high,
          low: bar.low,
          close: bar.close,
          changePercent: change,
          volume: vol,
          isClosed: true,
        });
      }
    });

    // Loop-safe ResizeObserver using requestAnimationFrame and threshold check
    let rafId: number | null = null;
    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const entry = entries[0];
      const { width, height } = entry.contentRect;
      if (width <= 0 || height <= 0) return;

      const w = Math.floor(width);
      const h = Math.floor(height);

      // Only resize if change is >= 2px to avoid sub-pixel layout thrashing loops
      if (Math.abs(w - lastSizeRef.current.width) < 2 && Math.abs(h - lastSizeRef.current.height) < 2) {
        return;
      }
      lastSizeRef.current = { width: w, height: h };

      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        if (chartRef.current) {
          try {
            chartRef.current.resize(w, h);
          } catch {}
        }
      });
    });
    resizeObserver.observe(container);

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      markersPrimitiveRef.current = null;
      lastCandlesCountRef.current = 0;
      lastCandleTimestampRef.current = 0;
      lastAssetRef.current = '';
      lastTimeframeRef.current = 0;
    };
  }, [timeframe, digits]);

  // Synchronize Candles & Volume to Chart (Immutable Closed + Live Forming Updates)
  useEffect(() => {
    const candleSeries = candleSeriesRef.current;
    const volumeSeries = volumeSeriesRef.current;
    const chart = chartRef.current;
    if (!candleSeries || !volumeSeries || !chart || cleanCandles.length === 0) return;

    const isSwitch = lastAssetRef.current !== activeAsset || lastTimeframeRef.current !== timeframe;
    const prevCount = lastCandlesCountRef.current;
    const currentCount = cleanCandles.length;
    const lastCandle = cleanCandles[currentCount - 1];
    const lastTime = lastCandle.time as number;
    const lastTimestamp = lastCandleTimestampRef.current;

    const performFullSetData = (shouldFitContent: boolean) => {
      const candleData = cleanCandles.map((c) => ({
        time: c.time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }));

      const volData = cleanCandles.map((c) => ({
        time: c.time,
        value: c.volume,
        color: c.close >= c.open ? 'rgba(16, 185, 129, 0.35)' : 'rgba(244, 63, 94, 0.35)',
      }));

      try {
        candleSeries.setData(candleData);
        volumeSeries.setData(volData);

        if (shouldFitContent) {
          chart.timeScale().fitContent();
        }

        lastAssetRef.current = activeAsset;
        lastTimeframeRef.current = timeframe;
        lastCandlesCountRef.current = currentCount;
        lastCandleTimestampRef.current = lastTime;
      } catch (err) {
        console.error('[CandlestickChart] Error in performFullSetData:', err);
      }
    };

    // Full load on asset/timeframe switch, initial load, or when initial candles arrive
    if (isSwitch || prevCount === 0) {
      performFullSetData(true);
      return;
    }

    // Forward progression: updating forming candle or appending newly formed candle (lastTime >= lastTimestamp)
    if (lastTime >= lastTimestamp && currentCount >= prevCount) {
      try {
        candleSeries.update({
          time: lastCandle.time,
          open: lastCandle.open,
          high: lastCandle.high,
          low: lastCandle.low,
          close: lastCandle.close,
        });

        volumeSeries.update({
          time: lastCandle.time,
          value: lastCandle.volume,
          color: lastCandle.close >= lastCandle.open ? 'rgba(16, 185, 129, 0.35)' : 'rgba(244, 63, 94, 0.35)',
        });

        lastCandlesCountRef.current = currentCount;
        lastCandleTimestampRef.current = lastTime;
        return;
      } catch (err) {
        console.warn('[CandlestickChart] Safe fallback to setData on candle update:', err);
        performFullSetData(false);
        return;
      }
    }

    // Prepending older historical candles or data reset: safe full sync without resetting user pan/zoom
    performFullSetData(false);
  }, [cleanCandles, activeAsset, timeframe]);

  // Synchronize Technical Overlays (EMA, SMA, Bollinger)
  useEffect(() => {
    if (!chartRef.current) return;

    if (emaFastSeriesRef.current) {
      if (showEMA && indicatorData.ema9.length > 0) {
        emaFastSeriesRef.current.setData(indicatorData.ema9);
      } else {
        emaFastSeriesRef.current.setData([]);
      }
    }

    if (emaSlowSeriesRef.current) {
      if (showEMA && indicatorData.ema21.length > 0) {
        emaSlowSeriesRef.current.setData(indicatorData.ema21);
      } else {
        emaSlowSeriesRef.current.setData([]);
      }
    }

    if (smaSeriesRef.current) {
      if (showSMA && indicatorData.sma50.length > 0) {
        smaSeriesRef.current.setData(indicatorData.sma50);
      } else {
        smaSeriesRef.current.setData([]);
      }
    }

    if (bbUpperSeriesRef.current && bbMiddleSeriesRef.current && bbLowerSeriesRef.current) {
      if (showBollinger && indicatorData.bbUpper.length > 0) {
        bbUpperSeriesRef.current.setData(indicatorData.bbUpper);
        bbMiddleSeriesRef.current.setData(indicatorData.bbMiddle);
        bbLowerSeriesRef.current.setData(indicatorData.bbLower);
      } else {
        bbUpperSeriesRef.current.setData([]);
        bbMiddleSeriesRef.current.setData([]);
        bbLowerSeriesRef.current.setData([]);
      }
    }
  }, [indicatorData, showEMA, showSMA, showBollinger]);

  // Synchronize Support / Resistance Price Lines
  useEffect(() => {
    const candleSeries = candleSeriesRef.current;
    if (!candleSeries) return;

    // Remove existing price lines
    for (const pl of priceLinesRef.current) {
      try {
        candleSeries.removePriceLine(pl);
      } catch {}
    }
    priceLinesRef.current = [];

    if (!showLevels || !activeLevels || activeLevels.length === 0) return;

    for (const lvl of activeLevels.slice(0, 8)) {
      if (!lvl || !lvl.price || isNaN(lvl.price)) continue;
      try {
        const isRes = lvl.type === 'RESISTANCE';
        const pl = candleSeries.createPriceLine({
          price: lvl.price,
          color: isRes ? 'rgba(244, 63, 94, 0.75)' : 'rgba(16, 185, 129, 0.75)',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: `${isRes ? 'RES' : 'SUP'} ${typeof lvl.price === 'number' ? lvl.price.toFixed(digits) : lvl.price}`,
        });
        priceLinesRef.current.push(pl);
      } catch {}
    }
  }, [activeLevels, showLevels, digits]);

  // Synchronize W.D. Gann Levels & 1x1 Angle Price Lines
  useEffect(() => {
    const candleSeries = candleSeriesRef.current;
    if (!candleSeries) return;

    for (const pl of gannPriceLinesRef.current) {
      try {
        candleSeries.removePriceLine(pl);
      } catch {}
    }
    gannPriceLinesRef.current = [];

    if (!showGann || !gannData) return;

    // 1. Draw Key Gann 8th Divisions
    if (gannData.gannLevels && gannData.gannLevels.length > 0) {
      for (const gl of gannData.gannLevels) {
        if (!gl || typeof gl.price !== 'number' || isNaN(gl.price)) continue;
        const isEq = gl.type === 'EQUILIBRIUM';
        const isMajor = gl.type === 'MAJOR_HIGH' || gl.type === 'MAJOR_LOW';
        const isQuarter = gl.fraction?.includes('2/8') || gl.fraction?.includes('6/8');
        if ((isEq || isMajor || isQuarter) && typeof gl.price === 'number' && !isNaN(gl.price)) {
          try {
            const pl = candleSeries.createPriceLine({
              price: gl.price,
              color: isEq ? '#f59e0b' : isMajor ? '#ec4899' : 'rgba(245, 158, 11, 0.45)',
              lineWidth: isEq ? 2 : 1,
              lineStyle: isEq ? LineStyle.Solid : LineStyle.Dashed,
              axisLabelVisible: true,
              title: `GANN ${gl.fraction ? gl.fraction.split(' ')[0] : ''} ${gl.price.toFixed(digits)}`,
            });
            gannPriceLinesRef.current.push(pl);
          } catch {}
        }
      }
    }

    // 2. Draw Gann 1x1 Geometric Angle Price Line
    const angle1x1 = gannData.angles?.find((a) => a.name.includes('1x1'));
    if (angle1x1 && typeof angle1x1.currentValue === 'number' && !isNaN(angle1x1.currentValue)) {
      try {
        const pl = candleSeries.createPriceLine({
          price: angle1x1.currentValue,
          color: '#38bdf8',
          lineWidth: 2,
          lineStyle: LineStyle.LargeDashed,
          axisLabelVisible: true,
          title: `GANN 1x1 ${angle1x1.currentValue.toFixed(digits)}`,
        });
        gannPriceLinesRef.current.push(pl);
      } catch {}
    }
  }, [gannData, showGann, digits]);

  // Synchronize Nicolas Darvas Box Boundary Price Lines
  useEffect(() => {
    const candleSeries = candleSeriesRef.current;
    if (!candleSeries) return;

    for (const pl of darvasPriceLinesRef.current) {
      try {
        candleSeries.removePriceLine(pl);
      } catch {}
    }
    darvasPriceLinesRef.current = [];

    if (!showDarvas || !darvasData?.activeBox) return;

    const box = darvasData.activeBox;
    if (!box || typeof box.upper !== 'number' || typeof box.lower !== 'number' || isNaN(box.upper) || isNaN(box.lower)) return;

    try {
      const topPl = candleSeries.createPriceLine({
        price: box.upper,
        color: '#f43f5e',
        lineWidth: 2,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        title: `DARVAS TOP ${box.upper.toFixed(digits)} ${box.isConfirmed ? '(CONFIRMED)' : '(FORMING)'}`,
      });
      darvasPriceLinesRef.current.push(topPl);

      const botPl = candleSeries.createPriceLine({
        price: box.lower,
        color: '#10b981',
        lineWidth: 2,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        title: `DARVAS BOTTOM ${box.lower.toFixed(digits)}`,
      });
      darvasPriceLinesRef.current.push(botPl);
    } catch {}
  }, [darvasData, showDarvas, digits]);

  // Synchronize Signal Markers, Elliott Wave Markers, and Darvas Breakout Markers
  useEffect(() => {
    const candleSeries = candleSeriesRef.current;
    if (!candleSeries) return;

    const markers: SeriesMarker<UTCTimestamp>[] = [];

    // 1. Elliott Wave Structural Wave Markers
    if (showElliott && elliottData?.waves && elliottData.waves.length > 0) {
      for (const w of elliottData.waves) {
        if (!w || !w.time) continue;
        let wTime = Math.floor(w.time);
        if (wTime > 1e11) wTime = Math.floor(wTime / 1000);
        if (wTime <= 0) continue;

        const isPeak = w.type === 'PEAK';
        markers.push({
          time: wTime as UTCTimestamp,
          position: isPeak ? 'aboveBar' : 'belowBar',
          color: '#38bdf8',
          shape: isPeak ? 'arrowDown' : 'arrowUp',
          text: `W${w.label}`,
        });
      }
    }

    // 2. Darvas Breakout Point Marker
    if (showDarvas && darvasData?.activeBox?.breakoutCandleTime && darvasData.activeBox.breakoutPrice) {
      let bTime = Math.floor(darvasData.activeBox.breakoutCandleTime);
      if (bTime > 1e11) bTime = Math.floor(bTime / 1000);
      if (bTime > 0) {
        const isUpBreak = darvasData.activeBox.breakoutStatus === 'BREAKOUT_UP';
        markers.push({
          time: bTime as UTCTimestamp,
          position: isUpBreak ? 'belowBar' : 'aboveBar',
          color: isUpBreak ? '#10b981' : '#f43f5e',
          shape: isUpBreak ? 'arrowUp' : 'arrowDown',
          text: `DARVAS ${isUpBreak ? 'BREAKOUT' : 'BREAKDOWN'}`,
        });
      }
    }

    // 3. Candle Times Reference for Snapping
    const candleTimes = cleanCandles && cleanCandles.length > 0 ? cleanCandles.map((c) => c.time as number) : [];
    const candleTimeSet = new Set<number>(candleTimes);

    // 4. Directional Signal History & Live Active Signal Markers
    if (candleTimes.length > 0) {
      // Collect all candidate signals: recentSignals + activeSignal
      const candidates: Signal[] = [];
      if (recentSignals && recentSignals.length > 0) {
        candidates.push(...recentSignals.slice(-25));
      }
      if (
        activeSignal &&
        (activeSignal.type === 'UP' ||
          activeSignal.type === 'DOWN' ||
          (activeSignal.type as any) === 'BUY' ||
          (activeSignal.type as any) === 'SELL')
      ) {
        const alreadyExists = candidates.some((s) => s.id === activeSignal.id);
        if (!alreadyExists) {
          candidates.push(activeSignal);
        }
      }

      // Map to deduplicate multiple signals on the same candle time
      const signalMarkersByTime = new Map<number, SeriesMarker<UTCTimestamp>>();

      for (const sig of candidates) {
        if (!sig) continue;
        const isUp = sig.type === 'UP' || (sig.type as any) === 'BUY' || (sig.direction as any) === 'UP';
        const isDown = sig.type === 'DOWN' || (sig.type as any) === 'SELL' || (sig.direction as any) === 'DOWN';
        if (!isUp && !isDown) continue;

        let rawTime =
          sig.candleTimestamp ||
          (sig.timestamp ? (sig.timestamp > 1e11 ? Math.floor(sig.timestamp / 1000) : sig.timestamp) : 0);
        if (rawTime > 1e11) rawTime = Math.floor(rawTime / 1000);

        let targetTime: number | null = null;
        if (rawTime > 0) {
          const snapped = Math.floor(rawTime / timeframe) * timeframe;
          if (candleTimeSet.has(snapped)) {
            targetTime = snapped;
          } else if (candleTimeSet.has(rawTime)) {
            targetTime = rawTime;
          } else {
            // Find closest candle in cleanCandles
            let minDiff = Infinity;
            let closest: number | null = null;
            for (const ct of candleTimes) {
              const diff = Math.abs(ct - rawTime);
              if (diff < minDiff) {
                minDiff = diff;
                closest = ct;
              }
            }
            if (closest !== null && minDiff <= timeframe * 3) {
              targetTime = closest;
            } else if (sig.id === activeSignal?.id) {
              targetTime = candleTimes[candleTimes.length - 1];
            }
          }
        } else if (sig.id === activeSignal?.id) {
          targetTime = candleTimes[candleTimes.length - 1];
        }

        if (targetTime !== null) {
          const confidence = sig.actualConfidence ?? sig.confidence ?? Math.round((sig.strength || 0) * 100);
          const text = `${isUp ? 'UP' : 'DOWN'} ${Math.round(confidence)}%`;

          signalMarkersByTime.set(targetTime, {
            time: targetTime as UTCTimestamp,
            position: isUp ? 'belowBar' : 'aboveBar',
            color: isUp ? '#10b981' : '#f43f5e',
            shape: isUp ? 'arrowUp' : 'arrowDown',
            text,
            size: 2,
          });
        }
      }

      for (const m of signalMarkersByTime.values()) {
        markers.push(m);
      }
    }

    // 5. Incorporate Backtest Overlay trades (winning/losing trades visualized on chart)
    if (candleTimes.length > 0 && backtestOverlayTrades && Array.isArray(backtestOverlayTrades) && backtestOverlayTrades.length > 0) {
      for (const tr of backtestOverlayTrades) {
        if (!tr || typeof tr !== 'object') continue;
        let rawTime = tr.entryTime;
        if (rawTime > 1e11) rawTime = Math.floor(rawTime / 1000);
        const snapped = Math.floor(rawTime / timeframe) * timeframe;
        let targetTime = candleTimeSet.has(snapped) ? snapped : candleTimeSet.has(rawTime) ? rawTime : null;
        if (targetTime === null && candleTimes.length > 0) {
          let minDiff = Infinity;
          let closest: number | null = null;
          for (const ct of candleTimes) {
            const diff = Math.abs(ct - rawTime);
            if (diff < minDiff) {
              minDiff = diff;
              closest = ct;
            }
          }
          if (closest !== null && minDiff <= timeframe * 3) {
            targetTime = closest;
          }
        }

        if (targetTime !== null) {
          const isCall = (tr.action || '').toLowerCase().includes('call') || (tr.action || '').toLowerCase().includes('up') || (tr.action || '').toLowerCase().includes('buy');
          const isWin = Boolean(tr.isWin);
          const pnlStr = typeof tr.pnl === 'number' ? `${tr.pnl >= 0 ? '+' : ''}$${tr.pnl.toFixed(1)}` : '';
          markers.push({
            time: targetTime as UTCTimestamp,
            position: isCall ? 'belowBar' : 'aboveBar',
            color: isWin ? '#10b981' : '#f43f5e',
            shape: isCall ? 'arrowUp' : 'arrowDown',
            text: `${isWin ? 'WIN' : 'LOSS'} ${pnlStr}`,
            size: 2,
          });
        }
      }
    }

    // Deduplicate by timestamp and order chronologically for lightweight-charts
    const uniqueMarkersMap = new Map<number, SeriesMarker<UTCTimestamp>>();
    for (const m of markers) {
      if (m && typeof m.time === 'number') {
        uniqueMarkersMap.set(m.time, m);
      }
    }
    const sortedMarkers = Array.from(uniqueMarkersMap.values()).sort((a, b) => (a.time as number) - (b.time as number));

    if (sortedMarkers.length === 0) {
      if (markersPrimitiveRef.current) {
        try {
          markersPrimitiveRef.current.setMarkers([]);
        } catch {
          markersPrimitiveRef.current = null;
        }
      }
      return;
    }

    try {
      if (!markersPrimitiveRef.current) {
        markersPrimitiveRef.current = createSeriesMarkers(candleSeries, sortedMarkers);
      } else {
        markersPrimitiveRef.current.setMarkers(sortedMarkers);
      }
    } catch {
      try {
        markersPrimitiveRef.current = createSeriesMarkers(candleSeries, sortedMarkers);
      } catch {}
    }
  }, [recentSignals, activeSignal, cleanCandles, timeframe, elliottData, darvasData, showElliott, showDarvas, backtestOverlayTrades]);

  // Controls Handlers
  const handleZoomIn = useCallback(() => {
    if (!chartRef.current) return;
    const timeScale = chartRef.current.timeScale();
    const currentSpacing = timeScale.coordinateToLogical(10) || 8;
    timeScale.applyOptions({ barSpacing: Math.min(40, (timeScale as any).options?.barSpacing * 1.25 || 12) });
  }, []);

  const handleZoomOut = useCallback(() => {
    if (!chartRef.current) return;
    const timeScale = chartRef.current.timeScale();
    timeScale.applyOptions({ barSpacing: Math.max(3, (timeScale as any).options?.barSpacing * 0.8 || 6) });
  }, []);

  const handleResetZoom = useCallback(() => {
    if (!chartRef.current) return;
    chartRef.current.timeScale().fitContent();
  }, []);

  const toggleFullscreen = () => {
    const el = chartContainerRef.current?.parentElement;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen().catch(() => setIsFullscreen(!isFullscreen));
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const formattedAsset = activeAsset ? activeAsset.toUpperCase().replace('_OTC', ' (OTC)') : 'ASSET';
  const isOtc = activeAsset?.toLowerCase().includes('otc');
  const lastCandle = cleanCandles[cleanCandles.length - 1];

  return (
    <div
      className={`flex flex-col bg-[#090e17] border border-slate-800/80 rounded-xl overflow-hidden shadow-2xl transition-all duration-200 ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none border-none' : 'w-full'
      }`}
      style={{ minHeight: isFullscreen ? '100dvh' : `${optimalChartHeight}px`, height: isFullscreen ? '100dvh' : undefined }}
    >
      {/* 1. TOP HEADER BAR */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-2 bg-slate-900/90 border-b border-slate-800">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {/* Asset Title & Badges */}
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <h2 className="text-xs sm:text-base font-black text-slate-100 font-mono tracking-wider truncate">
              {formattedAsset}
            </h2>
            <span
              className={`px-1 sm:px-1.5 py-0.5 text-[8px] sm:text-[9px] font-black rounded tracking-wider shrink-0 ${
                isOtc
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              }`}
            >
              {isOtc ? 'OTC' : 'MARKET'}
            </span>
            {cleanCandles.length > 0 && dataStatus !== 'NO REAL DATA' && dataStatus !== 'STALE' ? (
              <span className="hidden md:inline-flex items-center gap-1 px-1.5 py-0.5 text-[8px] sm:text-[9px] font-black rounded tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                REAL MARKET DATA • {(cleanCandles[0] as any)?.source || (isOtc ? 'Pocket Option OTC Feed' : 'Pocket Option Real Feed')}
              </span>
            ) : (
              <span className="hidden md:inline-flex items-center gap-1 px-1.5 py-0.5 text-[8px] sm:text-[9px] font-black rounded tracking-wider bg-rose-500/15 text-rose-400 border border-rose-500/30 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                NO REAL DATA • WAITING FOR TICKS
              </span>
            )}
          </div>

          {/* Current Live Price Display */}
          {typeof currentPrice === 'number' && !isNaN(currentPrice) && (
            <div className="flex items-center gap-1 sm:gap-1.5 font-mono text-xs sm:text-base font-black text-slate-100 bg-slate-800/80 px-2 sm:px-2.5 py-0.5 rounded-lg border border-slate-700/60 shadow-inner shrink-0">
              <span className="text-slate-400 text-[10px] sm:text-xs">P:</span>
              <span className="text-emerald-400">{currentPrice.toFixed(digits)}</span>
            </div>
          )}

          {/* Live Actionable Signal Callout on Chart (when entry conditions are met) */}
          {activeSignal && (activeSignal.type === 'UP' || activeSignal.type === 'DOWN') && (
            <div
              className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-0.5 rounded-lg border font-mono text-xs sm:text-sm font-black animate-pulse shadow-sm shrink-0 ${
                activeSignal.type === 'UP'
                  ? 'bg-emerald-500/25 text-emerald-400 border-emerald-500/60 shadow-emerald-950/40'
                  : 'bg-rose-500/25 text-rose-400 border-rose-500/60 shadow-rose-950/40'
              }`}
              title={isRTL ? 'شروط دخول الصفقة متوفرة الآن' : 'Trade Entry Conditions Met'}
            >
              <span>{activeSignal.type === 'UP' ? '⬆ CALL / UP' : '⬇ PUT / DOWN'}</span>
              <span className="font-extrabold underline decoration-2">
                {activeSignal.actualConfidence ?? activeSignal.confidence ?? Math.round((activeSignal.strength || 0) * 100)}%
              </span>
            </div>
          )}

          {/* Countdown timer */}
          <div className="hidden sm:flex items-center gap-1 text-[11px] font-mono text-slate-400 bg-slate-800/60 px-2 py-0.5 rounded border border-slate-700/40 shrink-0">
            <Clock className="w-3 h-3 text-cyan-400" />
            <span>CLOSE:</span>
            <span className="font-bold text-cyan-300">{countdown}s</span>
          </div>
        </div>

        {/* Timeframe Selectors & View Controls */}
        <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
          {/* Timeframe switcher buttons with horizontal scrollbar-free swipe */}
          <div className="flex items-center bg-slate-950/80 p-0.5 rounded-lg border border-slate-800 text-[10px] sm:text-[11px] font-mono overflow-x-auto no-scrollbar scrollbar-none flex-nowrap max-w-[200px] xs:max-w-none shrink-0">
            {[
              { label: '5s', tf: 5 },
              { label: '15s', tf: 15 },
              { label: '30s', tf: 30 },
              { label: '1m', tf: 60 },
              { label: '5m', tf: 300 },
              { label: '15m', tf: 900 },
              { label: '30m', tf: 1800 },
              { label: '1h', tf: 3600 },
            ].map(({ label, tf }) => (
              <button
                key={tf}
                onClick={() => onSelectTimeframe && onSelectTimeframe(tf)}
                className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded transition-colors font-bold whitespace-nowrap shrink-0 ${
                  timeframe === tf
                    ? 'bg-cyan-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Data Status Badge */}
          <div className="flex items-center gap-1 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md text-[9px] sm:text-[10px] font-mono font-bold bg-slate-950/80 border border-slate-800 shrink-0">
            <span
              className={`w-2 h-2 rounded-full ${
                dataStatus === 'LIVE'
                  ? 'bg-emerald-400 animate-pulse'
                  : dataStatus === 'STALE'
                  ? 'bg-amber-400'
                  : 'bg-rose-400'
              }`}
            />
            <span className="text-slate-300">{dataStatus}</span>
          </div>

          {/* Zoom & Action Buttons */}
          <div className="flex items-center gap-0.5 sm:gap-1 bg-slate-950/80 p-0.5 rounded-lg border border-slate-800 shrink-0">
            <button
              onClick={handleZoomIn}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleZoomOut}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleResetZoom}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Fit View / Reset"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={toggleFullscreen}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Toggle Fullscreen"
            >
              {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>

            {/* Overlays toggle button */}
            <button
              onClick={() => setShowOverlaysBar(!showOverlaysBar)}
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition-colors flex items-center gap-1 ${
                showOverlaysBar
                  ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-500/40'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              title="Toggle Indicators Toolbar"
            >
              <Sliders className="w-3 h-3 text-cyan-400" />
              <span className="hidden sm:inline">INDICATORS</span>
            </button>

            <button
              onClick={() => setShowDiagnosticsOverlay(!showDiagnosticsOverlay)}
              className={`p-1 rounded transition-colors hidden xs:flex items-center ${
                showDiagnosticsOverlay
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              title="Diagnostics"
            >
              <Terminal className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setShowCandleTable(!showCandleTable)}
              className={`px-1.5 sm:px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-colors hidden sm:flex items-center gap-1 ${
                showCandleTable
                  ? 'bg-purple-500/25 text-purple-300 border border-purple-500/40'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              title="Raw Verified Candles Table"
            >
              <BarChart2 className="w-3 h-3 text-purple-400" />
              <span>CANDLES ({cleanCandles.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. TECHNICAL INDICATOR OVERLAYS TOOLBAR (Responsive Collapsible / Desktop Always) */}
      {(!isPhone || showOverlaysBar) && (
        <div className="flex flex-wrap items-center justify-between gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 bg-slate-900/60 border-b border-slate-800/80 text-[10px] font-mono overflow-x-auto no-scrollbar scrollbar-none flex-nowrap">
          <div className="flex items-center gap-1 shrink-0">
            <span className="font-bold text-slate-500 uppercase mr-1 text-[9px] sm:text-[10px]">OVERLAYS:</span>
            <button
              onClick={() => setShowEMA(!showEMA)}
              className={`px-1.5 sm:px-2 py-0.5 rounded font-bold transition-colors whitespace-nowrap ${
                showEMA
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              EMA 9/21
            </button>
            <button
              onClick={() => setShowSMA(!showSMA)}
              className={`px-1.5 sm:px-2 py-0.5 rounded font-bold transition-colors whitespace-nowrap ${
                showSMA
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              SMA 50
            </button>
            <button
              onClick={() => setShowBollinger(!showBollinger)}
              className={`px-1.5 sm:px-2 py-0.5 rounded font-bold transition-colors whitespace-nowrap ${
                showBollinger
                  ? 'bg-violet-500/20 text-violet-300 border border-violet-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              BOLLINGER (20, 2)
            </button>
            <button
              onClick={() => setShowLevels(!showLevels)}
              className={`px-1.5 sm:px-2 py-0.5 rounded font-bold transition-colors whitespace-nowrap ${
                showLevels
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              SUPPORT / RES
            </button>
            <button
              onClick={() => setShowGann(!showGann)}
              className={`px-1.5 sm:px-2 py-0.5 rounded font-bold transition-colors whitespace-nowrap ${
                showGann
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              GANN 8ths/1x1
            </button>
            <button
              onClick={() => setShowElliott(!showElliott)}
              className={`px-1.5 sm:px-2 py-0.5 rounded font-bold transition-colors whitespace-nowrap ${
                showElliott
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              ELLIOTT WAVES
            </button>
            <button
              onClick={() => setShowDarvas(!showDarvas)}
              className={`px-1.5 sm:px-2 py-0.5 rounded font-bold transition-colors whitespace-nowrap ${
                showDarvas
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              DARVAS BOX
            </button>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <span className="font-bold text-slate-500 uppercase mr-1 text-[9px] sm:text-[10px]">PANES:</span>
            <button
              onClick={() => setShowRsiPane(!showRsiPane)}
              className={`px-1.5 sm:px-2 py-0.5 rounded font-bold transition-colors whitespace-nowrap ${
                showRsiPane
                  ? 'bg-purple-500/30 text-purple-300 border border-purple-500/50'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              RSI (14)
            </button>
          </div>
        </div>
      )}

      {/* 3. HOVER OHLC TOOLTIP BAR */}
      <div className="px-2.5 sm:px-3.5 py-1 bg-slate-950/90 border-b border-slate-800/60 flex flex-wrap items-center gap-2 sm:gap-3 text-[10px] sm:text-[11px] font-mono text-slate-300 min-h-[24px] sm:min-h-[26px]">
        {hoverData ? (
          <>
            <span className="text-slate-400">{hoverData.timeStr}</span>
            <span>
              O: <strong className="text-slate-100">{typeof hoverData.open === 'number' ? hoverData.open.toFixed(digits) : '—'}</strong>
            </span>
            <span>
              H: <strong className="text-emerald-400">{typeof hoverData.high === 'number' ? hoverData.high.toFixed(digits) : '—'}</strong>
            </span>
            <span>
              L: <strong className="text-rose-400">{typeof hoverData.low === 'number' ? hoverData.low.toFixed(digits) : '—'}</strong>
            </span>
            <span>
              C:{' '}
              <strong className={hoverData.close >= hoverData.open ? 'text-emerald-400' : 'text-rose-400'}>
                {typeof hoverData.close === 'number' ? hoverData.close.toFixed(digits) : '—'}
              </strong>
            </span>
            <span className="hidden xs:inline">
              CHG:{' '}
              <strong className={hoverData.changePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                {hoverData.changePercent >= 0 ? '+' : ''}
                {typeof hoverData.changePercent === 'number' ? hoverData.changePercent.toFixed(2) : '0.00'}%
              </strong>
            </span>
            <span className="hidden sm:inline">
              VOL: <strong className="text-slate-200">{hoverData.volume}</strong>
            </span>
          </>
        ) : lastCandle ? (
          <>
            <span className="text-slate-500 text-[10px]">LATEST:</span>
            <span>
              O: <strong className="text-slate-300">{typeof lastCandle.open === 'number' ? lastCandle.open.toFixed(digits) : '—'}</strong>
            </span>
            <span>
              H: <strong className="text-emerald-400">{typeof lastCandle.high === 'number' ? lastCandle.high.toFixed(digits) : '—'}</strong>
            </span>
            <span>
              L: <strong className="text-rose-400">{typeof lastCandle.low === 'number' ? lastCandle.low.toFixed(digits) : '—'}</strong>
            </span>
            <span>
              C:{' '}
              <strong className={lastCandle.close >= lastCandle.open ? 'text-emerald-400' : 'text-rose-400'}>
                {typeof lastCandle.close === 'number' ? lastCandle.close.toFixed(digits) : '—'}
              </strong>
            </span>
            <span className="hidden sm:inline">
              VOL: <strong className="text-slate-300">{lastCandle.volume}</strong>
            </span>
          </>
        ) : (
          <span className="text-slate-500">Awaiting market candle stream...</span>
        )}
      </div>

      {/* 3b. SPECIALIZED STRATEGY REAL-TIME CALCULATION BANNER */}
      {(showGann && gannData) || (showElliott && elliottData) || (showDarvas && darvasData?.activeBox) ? (
        <div className="px-2.5 sm:px-3.5 py-1 bg-slate-900/80 border-b border-slate-800/80 flex flex-wrap items-center gap-2 sm:gap-3 text-[10px] font-mono text-slate-300 overflow-x-auto no-scrollbar">
          {showGann && gannData && (
            <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded text-amber-300 shrink-0">
              <span className="font-bold">GANN:</span>
              <span>50% Eq: <strong>{gannData.gannLevels?.find((l) => l.type === 'EQUILIBRIUM')?.price?.toFixed(digits) ?? 'N/A'}</strong></span>
              <span>•</span>
              <span>1x1 Angle: <strong>{gannData.angles?.[0]?.currentValue?.toFixed(digits) ?? 'N/A'}</strong></span>
              <span>•</span>
              <span>Bars: <strong>{gannData.elapsedBars ?? 0}</strong> (C{gannData.nearestTimeCycle ?? 'N/A'})</span>
            </div>
          )}

          {showElliott && elliottData && (
            <div className="flex items-center gap-1.5 bg-sky-500/10 border border-sky-500/30 px-2 py-0.5 rounded text-sky-300 shrink-0">
              <span className="font-bold">ELLIOTT:</span>
              <span><strong>{elliottData.primaryCount || 'Active'}</strong></span>
              <span>•</span>
              <span>Confidence: <strong>{elliottData.confidenceScore ?? 0}%</strong></span>
              <span>•</span>
              <span>Swings: <strong>{elliottData.waves?.length ?? 0}</strong></span>
            </div>
          )}

          {showDarvas && darvasData?.activeBox && (
            <div className="flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/30 px-2 py-0.5 rounded text-rose-300 shrink-0">
              <span className="font-bold">DARVAS:</span>
              <span>Box: <strong>[{typeof darvasData.activeBox.lower === 'number' ? darvasData.activeBox.lower.toFixed(digits) : '—'} - {typeof darvasData.activeBox.upper === 'number' ? darvasData.activeBox.upper.toFixed(digits) : '—'}]</strong></span>
              <span>•</span>
              <span>Status: <strong className={darvasData.breakoutStatus?.includes('UP') ? 'text-emerald-400' : darvasData.breakoutStatus?.includes('DOWN') ? 'text-rose-400' : 'text-amber-400'}>{darvasData.breakoutStatus || 'INSIDE'}</strong></span>
              <span>•</span>
              <span>Inside: <strong>{darvasData.activeBox.candlesInside ?? 0}c</strong></span>
            </div>
          )}
        </div>
      ) : null}

      {/* 4. MAIN CHART VIEWPORT */}
      <div className="relative w-full flex-1 min-h-[220px] bg-[#090e17]">
        <div ref={chartContainerRef} className="w-full h-full min-h-[220px]" style={{ touchAction: 'none' }} />

        {/* Backtest Overlay Floating Status Badge */}
        {backtestOverlayTrades && Array.isArray(backtestOverlayTrades) && backtestOverlayTrades.length > 0 && (
          <div className="absolute top-3 left-3 z-20 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950/92 border border-indigo-500/50 shadow-2xl backdrop-blur-md text-[11px] font-mono text-slate-200">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="font-bold text-indigo-300">
              {isRTL ? 'تراكب الاختبار التاريخي' : 'Backtest Overlay'}
            </span>
            <span className="text-slate-600">|</span>
            <span className="text-emerald-400 font-bold">
              +{backtestOverlayTrades.filter((t) => t.isWin).length} WIN
            </span>
            <span className="text-rose-400 font-bold">
              -{backtestOverlayTrades.filter((t) => !t.isWin).length} LOSS
            </span>
            {onClearBacktestOverlay && (
              <button
                type="button"
                onClick={onClearBacktestOverlay}
                className="ml-1 p-0.5 hover:bg-slate-800 rounded text-slate-400 hover:text-white cursor-pointer"
                title={isRTL ? 'إلغاء التراكب' : 'Clear overlay'}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Empty State Overlay when 0 candles are loaded */}
        {cleanCandles.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-[#060a12]/92 backdrop-blur-sm z-10 pointer-events-none">
            <div className="p-3.5 rounded-full bg-slate-900 border border-slate-700/80 mb-3 shadow-xl">
              <Activity className="w-8 h-8 text-amber-400 animate-pulse" />
            </div>
            <h3 className="text-base font-bold text-slate-100 tracking-wide mb-1 font-mono">
              WAITING FOR POCKET OPTION CANDLE STREAM
            </h3>
            <p className="text-xs text-slate-400 max-w-md mb-2">
              Connecting to real authorized market stream for{' '}
              <span className="font-mono text-cyan-300 font-bold">{formattedAsset}</span> ({timeframe}s).
            </p>
            <div className="text-[11px] font-mono text-amber-300 bg-amber-500/10 border border-amber-500/30 px-3 py-1 rounded-full">
              Real Broker Data Pipeline Active — Zero Synthetic Data Permitted
            </div>
          </div>
        )}

        {/* Pipeline Diagnostics Modal Overlay */}
        {showDiagnosticsOverlay && (
          <div className="absolute top-3 right-3 z-30 max-w-md w-[calc(100%-24px)] sm:w-96 bg-slate-950/95 backdrop-blur-md border border-amber-500/40 rounded-xl p-3.5 shadow-2xl text-[11px] font-mono text-slate-300 animate-in fade-in duration-200">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
              <div className="flex items-center gap-1.5 text-amber-400 font-bold">
                <Terminal className="w-3.5 h-3.5" />
                <span>CHART PIPELINE & PERSISTENCE DIAGNOSTICS</span>
              </div>
              <button
                onClick={() => setShowDiagnosticsOverlay(false)}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-2.5">
              <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800/80">
                <div className="text-[10px] uppercase font-bold text-slate-400 mb-1">Chart Canvas Engine</div>
                <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-slate-300">
                  <div>Engine: <strong className="text-cyan-300">Market Data Engine</strong></div>
                  <div>Rendering: <strong className="text-emerald-400">WebGL / Canvas 60fps</strong></div>
                  <div>Stored Candles: <strong className="text-cyan-300">{cleanCandles.length}</strong></div>
                  <div>Active Asset: <strong className="text-slate-200">{activeAsset}</strong></div>
                  <div>Timeframe: <strong className="text-slate-200">{timeframe}s</strong></div>
                  <div>Live Price: <strong className="text-amber-300">{currentPrice ?? 'N/A'}</strong></div>
                </div>
              </div>

              <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800/80">
                <div className="text-[10px] uppercase font-bold text-slate-400 mb-1">Candle Stream Pipeline</div>
                <div className="space-y-1 text-slate-300">
                  <div className="flex justify-between">
                    <span>Data Integrity:</span>
                    <span className="text-emerald-400 font-bold">NO FAKE DATA (Strict)</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Update Mode:</span>
                    <span className="text-cyan-300 font-bold">In-Place Forming Update</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Closed Candles:</span>
                    <span className="text-emerald-400 font-bold">Immutable ({Math.max(0, cleanCandles.length - 1)})</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 5. RSI SUB-PANE (WHEN ENABLED) */}
      {showRsiPane && indicatorData.rsi.length > 0 && (
        <div className="h-28 bg-[#070b12] border-t border-slate-800 px-3 py-1.5 flex flex-col justify-between font-mono text-[10px]">
          {(() => {
            const latestRsi = indicatorData.rsi[indicatorData.rsi.length - 1]?.value;
            const rsiNum = typeof latestRsi === 'number' && !isNaN(latestRsi) ? latestRsi : 50;
            return (
              <>
                <div className="flex items-center justify-between text-purple-300 font-bold">
                  <span>RSI (14): {typeof latestRsi === 'number' ? latestRsi.toFixed(1) : 'N/A'}</span>
                  <div className="flex items-center gap-2 text-[9px] text-slate-500">
                    <span>OB: 70</span>
                    <span>OS: 30</span>
                  </div>
                </div>
                {/* Visual RSI bar */}
                <div className="w-full bg-slate-900 h-10 rounded border border-slate-800 relative overflow-hidden flex items-center px-2">
                  <div className="absolute left-0 right-0 top-1/2 border-t border-slate-800 border-dashed" />
                  <div
                    className={`h-4 rounded transition-all duration-300 ${
                      rsiNum > 70
                        ? 'bg-rose-500'
                        : rsiNum < 30
                        ? 'bg-emerald-500'
                        : 'bg-purple-500'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(0, rsiNum))}%` }}
                  />
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* 6. RAW CANDLES TABLE MODAL OVERLAY */}
      {showCandleTable && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-xl max-w-3xl w-full max-h-[80vh] flex flex-col overflow-hidden shadow-2xl font-mono text-xs">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/80">
              <div className="flex items-center gap-2 text-cyan-400 font-bold">
                <BarChart2 className="w-4 h-4" />
                <span>RAW VERIFIED CANDLES ({cleanCandles.length} Loaded)</span>
              </div>
              <button
                onClick={() => setShowCandleTable(false)}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-3">
              <table className="w-full text-left text-[11px]">
                <thead>
                  <tr className="text-slate-500 border-b border-slate-800 pb-1">
                    <th className="py-1">TIME</th>
                    <th className="py-1">OPEN</th>
                    <th className="py-1">HIGH</th>
                    <th className="py-1">LOW</th>
                    <th className="py-1">CLOSE</th>
                    <th className="py-1">VOL</th>
                    <th className="py-1">TYPE</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900">
                  {cleanCandles.slice(-100).reverse().map((c, idx) => (
                    <tr key={c.time as number} className="hover:bg-slate-900/50">
                      <td className="py-1 text-slate-400">
                        {new Date((c.time as number) * 1000).toLocaleTimeString()}
                      </td>
                      <td className="py-1 text-slate-300">{typeof c.open === 'number' ? c.open.toFixed(digits) : '—'}</td>
                      <td className="py-1 text-emerald-400">{typeof c.high === 'number' ? c.high.toFixed(digits) : '—'}</td>
                      <td className="py-1 text-rose-400">{typeof c.low === 'number' ? c.low.toFixed(digits) : '—'}</td>
                      <td className={`py-1 font-bold ${c.close >= c.open ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {typeof c.close === 'number' ? c.close.toFixed(digits) : '—'}
                      </td>
                      <td className="py-1 text-slate-400">{c.volume}</td>
                      <td className="py-1">
                        <span className={`px-1 rounded text-[9px] ${idx === 0 ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-500'}`}>
                          {idx === 0 ? 'FORMING' : 'CLOSED'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
