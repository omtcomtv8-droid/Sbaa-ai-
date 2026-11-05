#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
support_resistance.py - استراتيجية الدعوم والمقاومات الحركية
Strategy 4: Support & Resistance Zones with Bounce / Breakout Confirmation
"""

import math
from typing import Any, Dict, List, Tuple
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from base_strategy import BaseStrategy, Candle, DecisionType, StrategyDecision


def find_swing_points(candles: List[Candle], window: int = 5) -> Tuple[List[float], List[float]]:
    highs = [c.high for c in candles]
    lows = [c.low for c in candles]
    swing_highs = []
    swing_lows = []

    for i in range(window, len(candles) - window):
        curr_h = highs[i]
        curr_l = lows[i]
        if all(curr_h >= highs[j] for j in range(i - window, i + window + 1) if j != i):
            swing_highs.append(curr_h)
        if all(curr_l <= lows[j] for j in range(i - window, i + window + 1) if j != i):
            swing_lows.append(curr_l)

    return swing_highs, swing_lows


class SupportResistanceStrategy(BaseStrategy):
    """
    استراتيجية الدعوم والمقاومات:
    - تحدد مستويات Swing Highs و Swing Lows المؤكدة.
    - تقيس عدد الملامسات وقوة المستوى (Level Strength).
    - تمنع الدخول في المستويات العشوائية أو الضعيفة.
    """

    def __init__(self, config: Dict[str, Any] = None):
        super().__init__(name="Support & Resistance", version="2.0.0", config=config)
        self.swing_window = self.config.get("swing_window", 4)
        self.zone_tolerance = self.config.get("zone_tolerance", 0.00035)

    def min_candles_required(self) -> int:
        return 40

    def get_metadata(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "version": self.version,
            "description": "استراتيجية الدعوم والمقاومات: ترصد القمم والقيعان المحورية مع قياس عدد الملامسات وترفض المستويات غير المؤكدة.",
            "parameters": {
                "swing_window": self.swing_window,
                "zone_tolerance": self.zone_tolerance
            }
        }

    def evaluate(self, candles: List[Candle]) -> StrategyDecision:
        if len(candles) < self.min_candles_required():
            return StrategyDecision(
                decision=DecisionType.WAIT,
                confidence=0.0,
                reason="بيانات غير كافية لحساب مناطق الدعم والمقاومة",
                rejection_reasons=[f"مطلوب {self.min_candles_required()} شمعة"],
                strategy_name=self.name,
                strategy_version=self.version
            )

        swing_highs, swing_lows = find_swing_points(candles, self.swing_window)
        curr_c = candles[-1]
        prev_c = candles[-2]
        curr_price = curr_c.close

        rejections = []

        if not swing_highs or not swing_lows:
            rejections.append("لم يتم العثور على قمم وقيعان محورية كافية لتشكيل مستويات موثوقة")
            return StrategyDecision(
                decision=DecisionType.WAIT,
                confidence=0.0,
                reason="غياب مستويات دعم أو مقاومة واضحة في النطاق الحالي",
                rejection_reasons=rejections,
                strategy_name=self.name,
                strategy_version=self.version
            )

        # أقرب دعم وأقرب مقاومة
        valid_supports = [s for s in swing_lows if s < curr_price]
        valid_resistances = [r for r in swing_highs if r > curr_price]

        nearest_support = max(valid_supports) if valid_supports else min(swing_lows)
        nearest_res = min(valid_resistances) if valid_resistances else max(swing_highs)

        # فحص عدد ملامسات المنطقة (Cluster strength)
        sup_touches = sum(1 for s in swing_lows if abs(s - nearest_support) <= nearest_support * self.zone_tolerance)
        res_touches = sum(1 for r in swing_highs if abs(r - nearest_res) <= nearest_res * self.zone_tolerance)

        indicators = {
            "current_price": curr_price,
            "nearest_support": round(nearest_support, 5),
            "nearest_resistance": round(nearest_res, 5),
            "support_touches": sup_touches,
            "resistance_touches": res_touches
        }

        # شرط ارتداد الدعم (Support Bounce)
        dist_to_sup = abs(curr_c.low - nearest_support) / curr_price
        is_at_support = dist_to_sup <= self.zone_tolerance
        is_bull_candle = curr_c.close > curr_c.open and curr_c.close > prev_c.close

        # شرط ارتداد المقاومة (Resistance Rejection)
        dist_to_res = abs(curr_c.high - nearest_res) / curr_price
        is_at_res = dist_to_res <= self.zone_tolerance
        is_bear_candle = curr_c.close < curr_c.open and curr_c.close < prev_c.close

        # 1. إشارة شراء عند دعم قوي (على الأقل ملامستان)
        if is_at_support and is_bull_candle:
            if sup_touches < 2:
                rejections.append(f"مستوى الدعم ضعيف: ملامسة واحدة فقط ({sup_touches})، يشترط ملامستان على الأقل")
            else:
                conf = min(92.0, 75.0 + sup_touches * 4.0)
                return StrategyDecision(
                    decision=DecisionType.BUY,
                    confidence=round(conf, 1),
                    reason=f"ارتداد صاعد مؤكد من منطقة دعم قوية ({nearest_support:.5f}) بعد {sup_touches} ملامسات",
                    indicators=indicators,
                    strategy_name=self.name,
                    strategy_version=self.version
                )

        # 2. إشارة بيع عند مقاومة قوية (على الأقل ملامستان)
        if is_at_res and is_bear_candle:
            if res_touches < 2:
                rejections.append(f"مستوى المقاومة ضعيف: ملامسة واحدة فقط ({res_touches})، يشترط ملامستان على الأقل")
            else:
                conf = min(92.0, 75.0 + res_touches * 4.0)
                return StrategyDecision(
                    decision=DecisionType.SELL,
                    confidence=round(conf, 1),
                    reason=f"رفض هابط مؤكد من منطقة مقاومة قوية ({nearest_res:.5f}) بعد {res_touches} ملامسات",
                    indicators=indicators,
                    strategy_name=self.name,
                    strategy_version=self.version
                )

        if not is_at_support and not is_at_res:
            rejections.append("السعر في منتصف النطاق (Mid-Range) بعيداً عن مناطق الانعكاس المؤكدة")

        return StrategyDecision(
            decision=DecisionType.WAIT,
            confidence=0.0,
            reason="السعر ليس في منطقة دعم أو مقاومة مؤكدة أو لم تتشكل شمعة انعكاسية",
            indicators=indicators,
            rejection_reasons=rejections,
            strategy_name=self.name,
            strategy_version=self.version
        )
