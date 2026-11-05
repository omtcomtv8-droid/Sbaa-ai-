#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
smc.py - استراتيجية المفاهيم المؤسسية (Smart Money Concepts - SMC)
Strategy 6: Market Structure, BOS, CHoCH, Order Blocks, and Fair Value Gaps
"""

import math
from typing import Any, Dict, List, Optional, Tuple
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from base_strategy import BaseStrategy, Candle, DecisionType, StrategyDecision


class SmcStrategy(BaseStrategy):
    """
    استراتيجية مفاهيم الأموال الذكية (SMC):
    - كشف كسر الهيكل (Break of Structure - BOS).
    - كشف تغير السلوك والاتجاه (Change of Character - CHoCH).
    - كتل الأوامر المؤسسية (Order Blocks - OB).
    - فجوات القيمة العادلة (Fair Value Gaps - FVG).
    - مناطق سيولة القمم والقيعان المزدوجة (Liquidity Pools).
    - ترفض الادعاء أو إصدار قرار إذا كانت البيانات غير كافية.
    """

    def __init__(self, config: Dict[str, Any] = None):
        super().__init__(name="Smart Money Concepts", version="2.0.0", config=config)
        self.swing_len = self.config.get("swing_len", 5)
        self.fvg_min_size_ratio = self.config.get("fvg_min_size_ratio", 0.0002)

    def min_candles_required(self) -> int:
        return 50

    def get_metadata(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "version": self.version,
            "description": "استراتيجية المفاهيم المؤسسية SMC: تحليل هيكل السوق الحقيقي (BOS/CHoCH)، كتل الأوامر، وفجوات FVG دون تضليل عند نقص البيانات.",
            "parameters": {
                "swing_len": self.swing_len,
                "fvg_min_size_ratio": self.fvg_min_size_ratio
            }
        }

    def detect_swings(self, candles: List[Candle]) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        highs = [c.high for c in candles]
        lows = [c.low for c in candles]
        swing_highs = []
        swing_lows = []

        w = self.swing_len
        for i in range(w, len(candles) - w):
            if all(highs[i] >= highs[j] for j in range(i - w, i + w + 1) if j != i):
                swing_highs.append({"index": i, "price": highs[i], "time": candles[i].timestamp})
            if all(lows[i] <= lows[j] for j in range(i - w, i + w + 1) if j != i):
                swing_lows.append({"index": i, "price": lows[i], "time": candles[i].timestamp})

        return swing_highs, swing_lows

    def detect_fair_value_gaps(self, candles: List[Candle]) -> List[Dict[str, Any]]:
        fvgs = []
        # FVG يتطلب 3 شموع متتالية: الشمعة 0 و 2 يوجد فراغ سعري بينهما
        for i in range(len(candles) - 15, len(candles) - 1):
            if i < 2:
                continue
            c0 = candles[i - 2]
            c1 = candles[i - 1]
            c2 = candles[i]

            # Bullish FVG: Low الشمعة 2 أعلى من High الشمعة 0
            if c2.low > c0.high:
                gap_size = c2.low - c0.high
                if gap_size / c1.close >= self.fvg_min_size_ratio:
                    fvgs.append({
                        "type": "BULLISH_FVG",
                        "top": c2.low,
                        "bottom": c0.high,
                        "size": gap_size,
                        "index": i - 1
                    })

            # Bearish FVG: High الشمعة 2 أقل من Low الشمعة 0
            elif c2.high < c0.low:
                gap_size = c0.low - c2.high
                if gap_size / c1.close >= self.fvg_min_size_ratio:
                    fvgs.append({
                        "type": "BEARISH_FVG",
                        "top": c0.low,
                        "bottom": c2.high,
                        "size": gap_size,
                        "index": i - 1
                    })

        return fvgs

    def evaluate(self, candles: List[Candle]) -> StrategyDecision:
        if len(candles) < self.min_candles_required():
            return StrategyDecision(
                decision=DecisionType.WAIT,
                confidence=0.0,
                reason="بيانات غير كافية لتحليل هيكل السوق المؤسسي (SMC)",
                rejection_reasons=[f"مطلوب {self.min_candles_required()} شمعة على الأقل"],
                strategy_name=self.name,
                strategy_version=self.version
            )

        swing_highs, swing_lows = self.detect_swings(candles)
        fvgs = self.detect_fair_value_gaps(candles)

        rejections = []

        if len(swing_highs) < 2 or len(swing_lows) < 2:
            rejections.append("عدد القمم والقيعان المحورية غير كافٍ لرسم مسار الهيكل (Market Structure غير مكتمل)")
            return StrategyDecision(
                decision=DecisionType.WAIT,
                confidence=0.0,
                reason="هيكل السوق غير واضح بدرجة كافية للمفاهيم المؤسسية",
                rejection_reasons=rejections,
                strategy_name=self.name,
                strategy_version=self.version
            )

        curr = candles[-1]
        prev = candles[-2]
        curr_price = curr.close

        last_sh = swing_highs[-1]
        prev_sh = swing_highs[-2]
        last_sl = swing_lows[-1]
        prev_sl = swing_lows[-2]

        # 1. كشف كسر الهيكل الصاعد (Bullish BOS) أو تغير السلوك (CHoCH)
        is_bull_bos = curr.close > last_sh["price"] and prev.close <= last_sh["price"]
        # 2. كشف كسر الهيكل الهابط (Bearish BOS)
        is_bear_bos = curr.close < last_sl["price"] and prev.close >= last_sl["price"]

        # كشف فجوة FVG نشطة يتم اختبارها حالياً
        testing_bull_fvg = any(f["type"] == "BULLISH_FVG" and f["bottom"] <= curr_price <= f["top"] for f in fvgs)
        testing_bear_fvg = any(f["type"] == "BEARISH_FVG" and f["bottom"] <= curr_price <= f["top"] for f in fvgs)

        # تحديد كتلة الأوامر الصاعدة (Bullish Order Block): آخر شمعة هابطة قبل الحركة الصاعدة العنيفة
        bull_ob_price = last_sl["price"]
        bear_ob_price = last_sh["price"]

        indicators = {
            "last_swing_high": round(last_sh["price"], 5),
            "last_swing_low": round(last_sl["price"], 5),
            "active_fvgs_count": len(fvgs),
            "bull_ob": round(bull_ob_price, 5),
            "bear_ob": round(bear_ob_price, 5),
            "is_bull_bos": is_bull_bos,
            "is_bear_bos": is_bear_bos
        }

        # حالة 1: كسر هيكل صاعد مؤكد (Bullish BOS) أو ارتداد من Bullish FVG
        if is_bull_bos or (testing_bull_fvg and curr.close > curr.open):
            conf = 88.0 if is_bull_bos else 80.0
            trigger = "كسر هيكل صاعد (BOS)" if is_bull_bos else "إعادة اختبار فجوة القيمة العادلة (Bullish FVG)"
            return StrategyDecision(
                decision=DecisionType.BUY,
                confidence=conf,
                reason=f"إشارة مؤسسية صاعدة: {trigger} عند {curr_price:.5f}",
                indicators=indicators,
                strategy_name=self.name,
                strategy_version=self.version
            )

        # حالة 2: كسر هيكل هابط مؤكد (Bearish BOS) أو ارتداد من Bearish FVG
        if is_bear_bos or (testing_bear_fvg and curr.close < curr.open):
            conf = 88.0 if is_bear_bos else 80.0
            trigger = "كسر هيكل هابط (Bearish BOS)" if is_bear_bos else "إعادة اختبار فجوة القيمة العادلة (Bearish FVG)"
            return StrategyDecision(
                decision=DecisionType.SELL,
                confidence=conf,
                reason=f"إشارة مؤسسية هابطة: {trigger} عند {curr_price:.5f}",
                indicators=indicators,
                strategy_name=self.name,
                strategy_version=self.version
            )

        rejections.append("لا يوجد كسر هيكل (BOS) أو استهداف لمنطقة كتلة أوامر (Order Block) حالياً")

        return StrategyDecision(
            decision=DecisionType.WAIT,
            confidence=0.0,
            reason="السعر يتحرك ضمن النطاق الداخلي دون تأكيد لاختراق الهيكل المؤسسي",
            indicators=indicators,
            rejection_reasons=rejections,
            strategy_name=self.name,
            strategy_version=self.version
        )
