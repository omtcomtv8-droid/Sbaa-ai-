"""
indicator_engine.py - Verified Python Mathematical Indicator Engine
Authoritative technical analysis calculations for Pocket Option OTC & Real Feeds.
Strict parity with TypeScript mathematical implementations.
"""

import json
import math
from typing import Dict, List, Optional, Tuple, Any

try:
    import numpy as np
    import pandas as pd
    HAS_NUMPY = True
except ImportError:
    HAS_NUMPY = False

def calculate_sma(closes: List[float], period: int) -> Optional[float]:
    if len(closes) < period:
        return None
    return round(sum(closes[-period:]) / period, 5)

def calculate_ema_series(values: List[float], period: int) -> List[float]:
    if len(values) < period:
        return []
    k = 2.0 / (period + 1)
    # Initial SMA
    prev_ema = sum(values[:period]) / period
    result = [prev_ema]
    for val in values[period:]:
        curr_ema = val * k + prev_ema * (1.0 - k)
        result.append(curr_ema)
        prev_ema = curr_ema
    return result

def calculate_ema(values: List[float], period: int) -> Optional[float]:
    series = calculate_ema_series(values, period)
    if not series:
        return None
    return round(series[-1], 5)

def calculate_wma(values: List[float], period: int) -> Optional[float]:
    if len(values) < period:
        return None
    sub = values[-period:]
    weighted_sum = sum(val * (i + 1) for i, val in enumerate(sub))
    weight_sum = sum(range(1, period + 1))
    return round(weighted_sum / weight_sum, 5)

def calculate_hma(values: List[float], period: int) -> Optional[float]:
    sqrt_period = round(math.sqrt(period))
    half_period = period // 2
    if len(values) < period + sqrt_period:
        return None
    
    raw_diff = []
    for i in range(len(values) - sqrt_period, len(values)):
        sub_vals = values[:i + 1]
        wma_half = calculate_wma(sub_vals, half_period)
        wma_full = calculate_wma(sub_vals, period)
        if wma_half is None or wma_full is None:
            return None
        raw_diff.append(2 * wma_half - wma_full)
    
    return calculate_wma(raw_diff, sqrt_period)

def calculate_rsi(closes: List[float], period: int = 14) -> Optional[float]:
    if len(closes) <= period:
        return None
    
    gains = 0.0
    losses = 0.0
    for i in range(1, period + 1):
        diff = closes[i] - closes[i - 1]
        if diff >= 0:
            gains += diff
        else:
            losses += abs(diff)
            
    avg_gain = gains / period
    avg_loss = losses / period
    
    for i in range(period + 1, len(closes)):
        diff = closes[i] - closes[i - 1]
        if diff >= 0:
            avg_gain = (avg_gain * (period - 1) + diff) / period
            avg_loss = (avg_loss * (period - 1)) / period
        else:
            avg_gain = (avg_gain * (period - 1)) / period
            avg_loss = (avg_loss * (period - 1) + abs(diff)) / period
            
    if avg_loss == 0:
        return 100.0
    if avg_gain == 0:
        return 0.0
    rs = avg_gain / avg_loss
    return round(100.0 - (100.0 / (1.0 + rs)), 2)

def calculate_bollinger_bands(closes: List[float], period: int = 20, multiplier: float = 2.0) -> Optional[Dict[str, float]]:
    if len(closes) < period:
        return None
    sub = closes[-period:]
    mean = sum(sub) / period
    variance = sum((x - mean) ** 2 for x in sub) / period
    std_dev = math.sqrt(variance)
    
    upper = mean + multiplier * std_dev
    lower = mean - multiplier * std_dev
    last_close = closes[-1]
    band_range = upper - lower
    bandwidth = band_range / mean if mean > 0 else 0.0
    percent_b = (last_close - lower) / band_range if band_range > 0 else 0.5
    
    return {
        'upper': round(upper, 5),
        'middle': round(mean, 5),
        'lower': round(lower, 5),
        'bandwidth': round(bandwidth, 5),
        'percentB': round(percent_b, 4)
    }

def calculate_macd(closes: List[float], fast: int = 12, slow: int = 26, signal_p: int = 9) -> Optional[Dict[str, float]]:
    if len(closes) < slow + signal_p:
        return None
    fast_series = calculate_ema_series(closes, fast)
    slow_series = calculate_ema_series(closes, slow)
    offset = slow - fast
    macd_line = []
    for i in range(len(slow_series)):
        macd_line.append(fast_series[i + offset] - slow_series[i])
        
    signal_series = calculate_ema_series(macd_line, signal_p)
    if not signal_series:
        return None
    
    latest_macd = macd_line[-1]
    latest_signal = signal_series[-1]
    histogram = latest_macd - latest_signal
    
    return {
        'macd': round(latest_macd, 5),
        'signal': round(latest_signal, 5),
        'histogram': round(histogram, 5)
    }

def calculate_atr(candles: List[Dict[str, Any]], period: int = 14) -> Optional[Dict[str, Any]]:
    if len(candles) <= period:
        return None
    trs = []
    for i in range(1, len(candles)):
        curr = candles[i]
        prev = candles[i - 1]
        tr = max(
            curr['high'] - curr['low'],
            abs(curr['high'] - prev['close']),
            abs(curr['low'] - prev['close'])
        )
        trs.append(tr)
        
    if len(trs) < period:
        return None
        
    atr = sum(trs[:period]) / period
    atr_hist = [atr]
    for i in range(period, len(trs)):
        atr = (atr * (period - 1) + trs[i]) / period
        atr_hist.append(atr)
        
    benchmark = min(20, len(atr_hist))
    avg_atr = sum(atr_hist[-benchmark:]) / benchmark
    
    curr_atr = round(atr, 5)
    average_atr = round(avg_atr, 5)
    
    vol_state = 'NORMAL'
    if curr_atr > average_atr * 1.35:
        vol_state = 'HIGH'
    elif curr_atr < average_atr * 0.7:
        vol_state = 'LOW'
        
    return {
        'currentATR': curr_atr,
        'averageATR': average_atr,
        'volatilityState': vol_state
    }

def calculate_adx(candles: List[Dict[str, Any]], period: int = 14) -> Optional[Dict[str, Any]]:
    if len(candles) <= period * 2:
        return None
        
    trs = []
    plus_dms = []
    minus_dms = []
    
    for i in range(1, len(candles)):
        curr = candles[i]
        prev = candles[i - 1]
        up_move = curr['high'] - prev['high']
        down_move = prev['low'] - curr['low']
        
        plus_dms.append(up_move if (up_move > down_move and up_move > 0) else 0.0)
        minus_dms.append(down_move if (down_move > up_move and down_move > 0) else 0.0)
        
        tr = max(
            curr['high'] - curr['low'],
            abs(curr['high'] - prev['close']),
            abs(curr['low'] - prev['close'])
        )
        trs.append(tr)
        
    smooth_tr = sum(trs[:period])
    smooth_plus = sum(plus_dms[:period])
    smooth_minus = sum(minus_dms[:period])
    
    dx_list = []
    for i in range(period, len(trs)):
        smooth_tr = smooth_tr - (smooth_tr / period) + trs[i]
        smooth_plus = smooth_plus - (smooth_plus / period) + plus_dms[i]
        smooth_minus = smooth_minus - (smooth_minus / period) + minus_dms[i]
        
        plus_di = (smooth_plus / smooth_tr * 100) if smooth_tr > 0 else 0.0
        minus_di = (smooth_minus / smooth_tr * 100) if smooth_tr > 0 else 0.0
        di_sum = plus_di + minus_di
        dx = (abs(plus_di - minus_di) / di_sum * 100) if di_sum > 0 else 0.0
        dx_list.append(dx)
        
    if len(dx_list) < period:
        return None
        
    adx_series = calculate_ema_series(dx_list, period)
    if not adx_series:
        return None
        
    adx_val = round(adx_series[-1], 2)
    plus_di_val = round((smooth_plus / smooth_tr * 100) if smooth_tr > 0 else 0.0, 2)
    minus_di_val = round((smooth_minus / smooth_tr * 100) if smooth_tr > 0 else 0.0, 2)
    
    trend_str = 'RANGING'
    if adx_val >= 25:
        trend_str = 'TRENDING'
    elif adx_val >= 20:
        trend_str = 'WEAK_TREND'
        
    return {
        'adx': adx_val,
        'plusDI': plus_di_val,
        'minusDI': minus_di_val,
        'trendStrength': trend_str
    }

def calculate_stochastic(candles: List[Dict[str, Any]], k_period: int = 14, d_period: int = 3) -> Optional[Dict[str, float]]:
    if len(candles) < k_period + d_period:
        return None
    k_vals = []
    for i in range(k_period - 1, len(candles)):
        window = candles[i - k_period + 1: i + 1]
        highest = max(c['high'] for c in window)
        lowest = min(c['low'] for c in window)
        close = candles[i]['close']
        k = ((close - lowest) / (highest - lowest) * 100) if highest > lowest else 50.0
        k_vals.append(k)
        
    if len(k_vals) < d_period:
        return None
    d_val = sum(k_vals[-d_period:]) / d_period
    return {
        'k': round(k_vals[-1], 2),
        'd': round(d_val, 2)
    }

def calculate_cci(candles: List[Dict[str, Any]], period: int = 20) -> Optional[float]:
    if len(candles) < period:
        return None
    sub = candles[-period:]
    tps = [(c['high'] + c['low'] + c['close']) / 3.0 for c in sub]
    sma_tp = sum(tps) / period
    mean_dev = sum(abs(tp - sma_tp) for tp in tps) / period
    if mean_dev == 0:
        return 0.0
    return round((tps[-1] - sma_tp) / (0.015 * mean_dev), 2)

def calculate_williams_r(candles: List[Dict[str, Any]], period: int = 14) -> Optional[float]:
    if len(candles) < period:
        return None
    sub = candles[-period:]
    highest = max(c['high'] for c in sub)
    lowest = min(c['low'] for c in sub)
    close = sub[-1]['close']
    rng = highest - lowest
    if rng == 0:
        return -50.0
    return round(((highest - close) / rng) * -100.0, 2)

def calculate_roc(closes: List[float], period: int = 12) -> Optional[float]:
    if len(closes) <= period:
        return None
    curr = closes[-1]
    prev = closes[-1 - period]
    if prev == 0:
        return None
    return round(((curr - prev) / prev) * 100.0, 3)

def compute_all_indicators(candles: List[Dict[str, Any]]) -> Dict[str, Any]:
    closes = [c['close'] for c in candles]
    return {
        'sma20': calculate_sma(closes, 20),
        'sma50': calculate_sma(closes, 50),
        'ema9': calculate_ema(closes, 9),
        'ema21': calculate_ema(closes, 21),
        'wma20': calculate_wma(closes, 20),
        'hma20': calculate_hma(closes, 20),
        'rsi14': calculate_rsi(closes, 14),
        'bollinger': calculate_bollinger_bands(closes, 20, 2.0),
        'macd': calculate_macd(closes, 12, 26, 9),
        'atr14': calculate_atr(candles, 14),
        'adx14': calculate_adx(candles, 14),
        'stochastic': calculate_stochastic(candles, 14, 3),
        'cci20': calculate_cci(candles, 20),
        'williamsR14': calculate_williams_r(candles, 14),
        'roc12': calculate_roc(closes, 12)
    }

def get_engine_metadata() -> Dict[str, Any]:
    return {
        'engine': 'Python Mathematical Parity Engine',
        'has_numpy': HAS_NUMPY,
        'version': '1.0.0',
        'supported_indicators': [
            'SMA', 'EMA', 'WMA', 'HMA', 'RSI', 'BollingerBands',
            'MACD', 'ATR', 'ADX', 'Stochastic', 'CCI', 'Williams%R', 'ROC'
        ]
    }

