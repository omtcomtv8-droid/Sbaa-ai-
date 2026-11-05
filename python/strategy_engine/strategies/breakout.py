#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
breakout.py - استراتيجية الاختراق السعري المؤكد
Strategy 5: Range Breakout with Momentum & Candle Body Confirmation
"""

import math
from typing import Any, Dict, List
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from base_strategy import BaseStrategy, Candle, DecisionType, StrategyDecision


def calc_atr(candles: List[Candle], period: int = 14) -> float:
    if len(candles) <= period:
        return 0.0005
    trs = []
    for i in range(1, len(candles)):
        h = candles[i].high
        l = candles[i].low
        prev_c = candles[i - 1].close
        tr = max(h - l, abs(h - prev_c), abs(l - prev_c))
        trs.append(tr)
    return sum(trs[-period:]) / period


class BreakoutStrategy(BaseStrategy):
    """
    استراتيجية الاختراق:
    - تحدد نطاق التجميع (Consolidation Range) لآخر N شمعة.
    - تفحص اختراق الشمعة الحالية أعلى أو أسفل النطاق بإغلاق كامل.
    - تتحقق من حجم جسم الشمعة وتوسع المدى (ATR) لمنع مصائد الاختراق الكاذب (Fakeouts).
    """

    def __init__(self, config: Dict[str, Any] = None):
        super().__init__(name="Breakout", version="2.0.0", config=config)
        self.lookback = self.config.get("lookback", 20)
        self.min_body_ratio = self.config.get("min_body_ratio", 0.60)

    def min_candles_required(self) -> int:
        return self.lookback + 10

    def get_metadata(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "version": self.version,
            "description": "استراتيجية اختراق النطاق: تفحص إغلاق الشمعة خارج قناة Donchian مع تأكيد قوة جسم الشمعة ورفض الاختراقات الكاذبة.",
            "parameters": {
                "lookback": self.lookback,
                "min_body_ratio": self.min_body_ratio
            }
        }

    def evaluate(self, candles: List[Candle]) -> StrategyDecision:
        if len(candles) < self.min_candles_required():
            return StrategyDecision(
                decision=DecisionType.WAIT,
                confidence=0.0,
                reason="بيانات غير كافية لحساب نطاق الاختراق",
                rejection_reasons=[f"مطلوب {self.min_candles_required()} شمعة"],
                strategy_name=self.name,
                strategy_version=self.version
            )

        curr = candles[-1]
        prior = candles[-self.lookback - 1:-1]

        range_high = max(c.high for c in prior)
        range_low = min(c.low for c in prior)
        range_size = range_high - range_low

        candle_range = curr.high - curr.low
        candle_body = abs(curr.close - curr.open)
        body_ratio = candle_body / candle_range if candle_range > 0 else 0

        atr = calc_atr(candles, 14)

        indicators = {
            "range_high": round(range_high, 5),
            "range_low": round(range_low, 5),
            "range_size": round(range_size, 5),
            "candle_body_ratio": round(body_ratio * 100, 1),
            "atr": round(atr, 5),
            "current_close": curr.close
        }

        rejections = []

        # شرط اختراق صاعد (Bullish Breakout)
        is_break_up = curr.close > range_high and curr.close > curr.open
        # شرط اختراق هابط (Bearish Breakout)
        is_break_down = curr.close < range_low and curr.close < curr.open

        if not is_break_up and not is_break_down:
            rejections.append("السعر لا يزال يتذبذب داخل النطاق دون اختراق صريح للقمة أو القاع")
            return StrategyDecision(
                decision=DecisionType.WAIT,
                confidence=0.0,
                reason="لا يوجد اختراق مؤكد للنطاق السعري",
                indicators=indicators,
                rejection_reasons=rejections,
                strategy_name=self.name,
                strategy_version=self.version
            )

        # فحص جودة الاختراق:
        # 1. جسم الشمعة قوي (ليس ذيلاً طويلاً يوحي برفض الاختراق)
        if body_ratio < self.min_body_ratio:
            rejections.append(f"اختراق ضعيف وغير مؤكد: نسبة جسم الشمعة ({body_ratio*100:.1f}%) أقل من المطلوب ({self.min_body_ratio*100}%)")

        # 2. مدى الشمعة ملحوظ بالنسبة لـ ATR
        if candle_range < atr * 0.8:
            rejections.append("شمعة الاختراق تفتقر للزخم الكافي مقارنة بمتوسط مدى الحركة اليومي (ATR)")

        if is_break_up and not rejections:
            conf = min(92.0, 75.0 + (body_ratio * 20.0))
            return StrategyDecision(
                decision=DecisionType.BUY,
                confidence=round(conf, 1),
                reason=f"اختراق صاعد مؤكد: إغلاق أعلى قمة النطاق ({range_high:.5f}) بجسم شمعة قوي ({body_ratio*100:.0f}%)",
                indicators=indicators,
                strategy_name=self.name,
                strategy_version=self.version
            )

        if is_break_down and not rejections:
            conf = min(92.0, 75.0 + (body_ratio * 20.0))
            return StrategyDecision(
                decision=DecisionType.SELL,
                confidence=round(conf, 1),
                reason=f"اختراق هابط مؤكد: إغلاق أسفل قاع النطاق ({range_low:.5f}) بجسم شمعة قوي ({body_ratio*100:.0f}%)",
                indicators=indicators,
                strategy_name=self.name,
                strategy_version=self.version
            )

        return StrategyDecision(
            decision=DecisionType.WAIT,
            confidence=0.0,
            reason="اختراق غير مؤكد تم رفضه لمنع فخ الاختراق الكاذب (Fakeout)",
            indicators=indicators,
            rejection_reasons=rejections,
            strategy_name=self.name,
            strategy_version=self.version
        )
