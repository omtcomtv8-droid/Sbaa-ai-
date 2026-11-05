#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
rsi_macd.py - استراتيجية الزخم المدمجة: RSI + MACD
Strategy 2: RSI 14 + MACD (12, 26, 9) Multi-Indicator Confluence
"""

import math
from typing import Any, Dict, List, Optional
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from base_strategy import BaseStrategy, Candle, DecisionType, StrategyDecision


def calc_ema(values: List[float], period: int) -> List[float]:
    if len(values) < period:
        return []
    k = 2.0 / (period + 1)
    prev = sum(values[:period]) / period
    out = [prev]
    for v in values[period:]:
        curr = v * k + prev * (1.0 - k)
        out.append(curr)
        prev = curr
    return out


def calc_rsi(closes: List[float], period: int = 14) -> Optional[float]:
    if len(closes) <= period:
        return None
    gains = []
    losses = []
    for i in range(1, len(closes)):
        diff = closes[i] - closes[i - 1]
        gains.append(max(0.0, diff))
        losses.append(max(0.0, -diff))

    avg_gain = sum(gains[:period]) / period
    avg_loss = sum(losses[:period]) / period

    for i in range(period, len(gains)):
        avg_gain = (avg_gain * (period - 1) + gains[i]) / period
        avg_loss = (avg_loss * (period - 1) + losses[i]) / period

    if avg_loss == 0:
        return 100.0
    rs = avg_gain / avg_loss
    return round(100.0 - (100.0 / (1.0 + rs)), 2)


def calc_macd(closes: List[float], fast: int = 12, slow: int = 26, signal: int = 9):
    if len(closes) < slow + signal:
        return None, None, None

    ema_fast = calc_ema(closes, fast)
    ema_slow = calc_ema(closes, slow)

    # Offset fast to match slow length
    offset = len(ema_fast) - len(ema_slow)
    macd_line = [f - s for f, s in zip(ema_fast[offset:], ema_slow)]

    if len(macd_line) < signal:
        return None, None, None

    signal_line = calc_ema(macd_line, signal)
    if not signal_line:
        return None, None, None

    hist = macd_line[-1] - signal_line[-1]
    return round(macd_line[-1], 6), round(signal_line[-1], 6), round(hist, 6)


class RsiMacdStrategy(BaseStrategy):
    """
    استراتيجية دمج مؤشر القوة النسبية مع الماكد:
    - تشترط اتفاق كلا المؤشرين في نفس الاتجاه.
    - ترفض الدخول إذا كان هناك تعارض أو حياد في أي مؤشر.
    """

    def __init__(self, config: Dict[str, Any] = None):
        super().__init__(name="RSI + MACD", version="2.0.0", config=config)
        self.rsi_period = self.config.get("rsi_period", 14)
        self.rsi_buy_level = self.config.get("rsi_buy_level", 45)
        self.rsi_sell_level = self.config.get("rsi_sell_level", 55)

    def min_candles_required(self) -> int:
        return 45

    def get_metadata(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "version": self.version,
            "description": "استراتيجية دمج الزخم: تجمع إشارات RSI مع تقاطع خطوط وهستوجرام MACD وتمنع اتخاذ القرار بناءً على مؤشر منفرد.",
            "parameters": {
                "rsi_period": self.rsi_period,
                "rsi_buy_level": self.rsi_buy_level,
                "rsi_sell_level": self.rsi_sell_level
            }
        }

    def evaluate(self, candles: List[Candle]) -> StrategyDecision:
        closes = [c.close for c in candles]
        if len(closes) < self.min_candles_required():
            return StrategyDecision(
                decision=DecisionType.WAIT,
                confidence=0.0,
                reason="بيانات غير كافية لحساب RSI و MACD",
                rejection_reasons=[f"مطلوب {self.min_candles_required()} شمعة"],
                strategy_name=self.name,
                strategy_version=self.version
            )

        rsi = calc_rsi(closes, self.rsi_period)
        macd_val, signal_val, hist = calc_macd(closes)

        if rsi is None or macd_val is None or signal_val is None or hist is None:
            return StrategyDecision(
                decision=DecisionType.WAIT,
                confidence=0.0,
                reason="تعذر حساب قيم المؤشرات",
                strategy_name=self.name,
                strategy_version=self.version
            )

        indicators = {
            "rsi": rsi,
            "macd": macd_val,
            "signal": signal_val,
            "histogram": hist
        }

        rejections = []

        # شروط الزخم الصاعد:
        # RSI أعلى من 52 (خارج المنطقة الميتة 48-52) وليس في تشبع مفرط (>72)
        # MACD Line أعلى من Signal Line وهستوجرام إيجابي بقيمة حقيقية (ليست ضوضاء مجهرية)
        min_hist_magnitude = 0.00001
        rsi_bull = 52.0 <= rsi < 72.0
        macd_bull = macd_val > signal_val and hist > min_hist_magnitude

        # شروط الزخم الهابط:
        # RSI أسفل من 48 (خارج المنطقة الميتة 48-52) وليس في تشبع مفرط (<28)
        # MACD Line أسفل من Signal Line وهستوجرام سلبي بقيمة حقيقية
        rsi_bear = 28.0 < rsi <= 48.0
        macd_bear = macd_val < signal_val and hist < -min_hist_magnitude

        if rsi_bull and macd_bull:
            confidence = min(92.0, 70.0 + (abs(hist) * 20000) + (rsi - 45))
            return StrategyDecision(
                decision=DecisionType.BUY,
                confidence=round(confidence, 1),
                reason=f"توافق زخم صاعد: RSI={rsi} مع تقاطع إيجابي لـ MACD (Hist={hist:+0.5f})",
                indicators=indicators,
                strategy_name=self.name,
                strategy_version=self.version
            )

        if rsi_bear and macd_bear:
            confidence = min(92.0, 70.0 + (abs(hist) * 20000) + (55 - rsi))
            return StrategyDecision(
                decision=DecisionType.SELL,
                confidence=round(confidence, 1),
                reason=f"توافق زخم هابط: RSI={rsi} مع تقاطع سلبي لـ MACD (Hist={hist:+0.5f})",
                indicators=indicators,
                strategy_name=self.name,
                strategy_version=self.version
            )

        # في حال تعارض المؤشرين
        if (rsi_bull and not macd_bull) or (macd_bull and not rsi_bull):
            rejections.append("تعارض الإشارات: أحد المؤشرين يعطي صعود والآخر لا يدعمه (رفض الدخول المنفرد)")
        elif (rsi_bear and not macd_bear) or (macd_bear and not rsi_bear):
            rejections.append("تعارض الإشارات: أحد المؤشرين يعطي هبوط والآخر لا يدعمه (رفض الدخول المنفرد)")
        else:
            rejections.append("المؤشرات في المنطقة المحايدة (WAIT)")

        return StrategyDecision(
            decision=DecisionType.WAIT,
            confidence=0.0,
            reason="غياب التوافق بين RSI و MACD",
            indicators=indicators,
            rejection_reasons=rejections,
            strategy_name=self.name,
            strategy_version=self.version
        )
