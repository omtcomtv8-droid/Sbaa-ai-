#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
bollinger_bands.py - استراتيجية ارتداد وتقلبات بولينجر باند
Strategy 3: Bollinger Bands 20, 2 with Expansion/Squeeze Detection
"""

import math
from typing import Any, Dict, List
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from base_strategy import BaseStrategy, Candle, DecisionType, StrategyDecision


def calc_sma(values: List[float], period: int) -> float:
    return sum(values[-period:]) / period


def calc_std_dev(values: List[float], period: int, mean: float) -> float:
    sub = values[-period:]
    variance = sum((x - mean) ** 2 for x in sub) / period
    return math.sqrt(variance)


class BollingerBandsStrategy(BaseStrategy):
    """
    استراتيجية بولينجر باند:
    - فترة 20 مع انحراف معياري 2.
    - تقييم اتساع النطاق (Expansion) وحالة الانكماش (Squeeze).
    - التحقق من الاتجاه السعري قبل إعطاء إشارة ارتداد.
    """

    def __init__(self, config: Dict[str, Any] = None):
        super().__init__(name="Bollinger Bands", version="2.0.0", config=config)
        self.period = self.config.get("period", 20)
        self.multiplier = self.config.get("multiplier", 2.0)
        self.squeeze_threshold = self.config.get("squeeze_threshold", 0.0012)

    def min_candles_required(self) -> int:
        return self.period + 10

    def get_metadata(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "version": self.version,
            "description": "استراتيجية بولينجر باند 20,2: تفحص ارتداد الحدود العلوية والسفلية مع كشف الانكماش والتوسع والتحقق من اتجاه السوق.",
            "parameters": {
                "period": self.period,
                "multiplier": self.multiplier,
                "squeeze_threshold": self.squeeze_threshold
            }
        }

    def evaluate(self, candles: List[Candle]) -> StrategyDecision:
        closes = [c.close for c in candles]
        if len(closes) < self.min_candles_required():
            return StrategyDecision(
                decision=DecisionType.WAIT,
                confidence=0.0,
                reason="بيانات غير كافية لحساب Bollinger Bands",
                rejection_reasons=[f"مطلوب {self.min_candles_required()} شمعة"],
                strategy_name=self.name,
                strategy_version=self.version
            )

        curr_candle = candles[-1]
        prev_candle = candles[-2]
        curr_close = curr_candle.close

        middle = calc_sma(closes, self.period)
        std_dev = calc_std_dev(closes, self.period, middle)

        upper = middle + (self.multiplier * std_dev)
        lower = middle - (self.multiplier * std_dev)
        bandwidth = (upper - lower) / middle if middle > 0 else 0

        # مؤشر %B: موقع السعر النسبي داخل الباند
        percent_b = (curr_close - lower) / (upper - lower) if (upper - lower) > 0 else 0.5

        # التحقق من الاتجاه العام عبر ميل الخط الأوسط
        prev_middle = calc_sma(closes[:-1], self.period)
        trend_slope = middle - prev_middle

        indicators = {
            "middle": round(middle, 5),
            "upper": round(upper, 5),
            "lower": round(lower, 5),
            "bandwidth": round(bandwidth, 5),
            "percent_b": round(percent_b * 100, 1),
            "trend_slope": round(trend_slope, 6)
        }

        rejections = []

        # 1. كشف حالة الانكماش السعري الشديد (Squeeze) -> السوق ينتظر انفجار، نرفض الارتداد العادي
        if bandwidth < self.squeeze_threshold:
            rejections.append(f"حالة انكماش ضيقة (Bollinger Squeeze={bandwidth:.5f}): مخاطرة عالية، انتظار كسر مؤكد")

        # 2. فحص ارتداد صاعد من الحد السفلي (Lower Band Bounce)
        # السعر لامس أو تجاوز الحد السفلي وبدأت شمعة صاعدة خضراء، والاتجاه ليس هبوطاً حاداً
        is_lower_bounce = (
            (curr_candle.low <= lower or prev_candle.low <= lower) and
            curr_candle.close > curr_candle.open and
            trend_slope >= -0.0001
        )

        # 3. فحص ارتداد هابط من الحد العلوي (Upper Band Rejection)
        # السعر لامس أو تجاوز الحد العلوي وبدأت شمعة هابطة حمراء، والاتجاه ليس صعوداً حاداً
        is_upper_rejection = (
            (curr_candle.high >= upper or prev_candle.high >= upper) and
            curr_candle.close < curr_candle.open and
            trend_slope <= 0.0001
        )

        if is_lower_bounce and not rejections:
            conf = min(90.0, 72.0 + (1.0 - percent_b) * 20.0)
            return StrategyDecision(
                decision=DecisionType.BUY,
                confidence=round(conf, 1),
                reason=f"ارتداد صاعد مؤكد من الحد السفلي لبولينجر ({lower:.5f}) مع شمعة انعكاسية",
                indicators=indicators,
                strategy_name=self.name,
                strategy_version=self.version
            )

        if is_upper_rejection and not rejections:
            conf = min(90.0, 72.0 + (percent_b - 0.5) * 20.0)
            return StrategyDecision(
                decision=DecisionType.SELL,
                confidence=round(conf, 1),
                reason=f"رفض هابط مؤكد من الحد العلوي لبولينجر ({upper:.5f}) مع شمعة انعكاسية",
                indicators=indicators,
                strategy_name=self.name,
                strategy_version=self.version
            )

        if not is_lower_bounce and not is_upper_rejection:
            rejections.append(f"السعر يتحرك داخل النطاق الطبيعي (%B={percent_b*100:.1f}%) دون ملامسة الأطراف")

        return StrategyDecision(
            decision=DecisionType.WAIT,
            confidence=0.0,
            reason="لم تكتمل شروط ارتداد أطراف البولينجر",
            indicators=indicators,
            rejection_reasons=rejections,
            strategy_name=self.name,
            strategy_version=self.version
        )
