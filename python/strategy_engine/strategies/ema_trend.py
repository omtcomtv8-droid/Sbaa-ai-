#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ema_trend.py - استراتيجية متابعة الاتجاه بالمتوسطات المتحركة الأسية (EMA Trend)
Strategy 1: EMA 20, EMA 50, EMA 200 with Choppiness Filter
"""

import math
from typing import Any, Dict, List
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from base_strategy import BaseStrategy, Candle, DecisionType, StrategyDecision


def calc_ema_series(values: List[float], period: int) -> List[float]:
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


class EmaTrendStrategy(BaseStrategy):
    """
    استراتيجية تتبع الاتجاه بالمتوسطات:
    - EMA 200 كمرشح اتجاه عام رئيسي (Macro Trend Filter).
    - EMA 20 و EMA 50 لتأكيد اتساق الزخم اللحظي.
    - فحص ميلان المتوسطات لمنع الدخول في النطاقات العرضية والأسواق المسطحة (Choppy Markets).
    """

    def __init__(self, config: Dict[str, Any] = None):
        super().__init__(name="EMA Trend", version="2.0.0", config=config)
        self.fast_period = self.config.get("fast_period", 20)
        self.mid_period = self.config.get("mid_period", 50)
        self.slow_period = self.config.get("slow_period", 200)

    def min_candles_required(self) -> int:
        return self.slow_period + 10

    def get_metadata(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "version": self.version,
            "description": "استراتيجية متابعة الاتجاه: تستخدم EMA 200 كفلتر اتجاه رئيسي و EMA 20/50 للزخم مع استبعاد الأسواق العرضية.",
            "parameters": {
                "fast_period": self.fast_period,
                "mid_period": self.mid_period,
                "slow_period": self.slow_period
            },
            "allowed_timeframes": [30, 60, 120, 300, 900]
        }

    def evaluate(self, candles: List[Candle]) -> StrategyDecision:
        closes = [c.close for c in candles]
        if len(closes) < self.min_candles_required():
            return StrategyDecision(
                decision=DecisionType.WAIT,
                confidence=0.0,
                reason="عدد الشموع غير كافٍ لحساب EMA 200",
                rejection_reasons=[f"مطلوب {self.min_candles_required()} شمعة، متوفر {len(closes)}"],
                strategy_name=self.name,
                strategy_version=self.version
            )

        ema20_series = calc_ema_series(closes, self.fast_period)
        ema50_series = calc_ema_series(closes, self.mid_period)
        ema200_series = calc_ema_series(closes, self.slow_period)

        if not ema20_series or not ema50_series or not ema200_series:
            return StrategyDecision(
                decision=DecisionType.WAIT,
                confidence=0.0,
                reason="فشل حساب سلاسل EMA",
                strategy_name=self.name,
                strategy_version=self.version
            )

        curr_close = closes[-1]
        curr_ema20 = ema20_series[-1]
        curr_ema50 = ema50_series[-1]
        curr_ema200 = ema200_series[-1]

        prev_ema20 = ema20_series[-2] if len(ema20_series) >= 2 else curr_ema20
        slope20 = curr_ema20 - prev_ema20

        indicators = {
            "close": curr_close,
            "ema20": round(curr_ema20, 5),
            "ema50": round(curr_ema50, 5),
            "ema200": round(curr_ema200, 5),
            "slope20": round(slope20, 6)
        }

        rejections = []

        # فحص تقارب المتوسطات الشديد (السوق العرضي الميت)
        spread_fast_mid = abs(curr_ema20 - curr_ema50) / curr_close
        if spread_fast_mid < 0.00015:
            rejections.append("غياب الاتجاه الواضح: تداخل شديد بين المتوسطات السريعة (سوق عرضي)")

        # شرط الشراء (Bullish Trend Alignment)
        is_bull_align = curr_close > curr_ema20 > curr_ema50 > curr_ema200
        is_bull_slope = slope20 > 0

        # شرط البيع (Bearish Trend Alignment)
        is_bear_align = curr_close < curr_ema20 < curr_ema50 < curr_ema200
        is_bear_slope = slope20 < 0

        if is_bull_align and is_bull_slope and not rejections:
            confidence = min(95.0, 75.0 + (spread_fast_mid * 5000))
            return StrategyDecision(
                decision=DecisionType.BUY,
                confidence=round(confidence, 1),
                reason=f"اتجاه صاعد مؤكد: السعر أعلى من EMA 20 و 50 و 200 مع ميل إيجابي ({slope20:+.5f})",
                indicators=indicators,
                strategy_name=self.name,
                strategy_version=self.version
            )

        if is_bear_align and is_bear_slope and not rejections:
            confidence = min(95.0, 75.0 + (spread_fast_mid * 5000))
            return StrategyDecision(
                decision=DecisionType.SELL,
                confidence=round(confidence, 1),
                reason=f"اتجاه هابط مؤكد: السعر أسفل من EMA 20 و 50 و 200 مع ميل سلبي ({slope20:+.5f})",
                indicators=indicators,
                strategy_name=self.name,
                strategy_version=self.version
            )

        if not is_bull_align and not is_bear_align:
            rejections.append("المتوسطات غير متوافقة في مسار اتجاهي صريح (انتظار)")

        return StrategyDecision(
            decision=DecisionType.WAIT,
            confidence=0.0,
            reason="شروط الاتجاه غير مكتملة أو هناك تعارض بين المتوسطات",
            indicators=indicators,
            rejection_reasons=rejections,
            strategy_name=self.name,
            strategy_version=self.version
        )
