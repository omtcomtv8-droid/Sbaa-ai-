#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
data_validator.py - طبقة التحقق الصارم من سلامة وجودة بيانات الأسعار
Data Validation Layer (Rule 19)
==================================================================
يتحقق بدقة من:
1. اكتمال بيانات الشموع (Open, High, Low, Close, Timestamp).
2. الترتيب الزمني التصاعدي الدقيق للشموع.
3. عدم تكرار الشموع ذات نفس التوقيت الزمني.
4. عدم وجود قيم غير صالحة (NaN, Null, Negative, Zero, High < Low).
5. حداثة الأسعار (Freshness) وعدم تقادمها.
6. توفر عدد كافٍ من الشموع لحساب المؤشرات.
"""

import math
import time
from typing import Dict, List, Optional, Tuple
from base_strategy import Candle


class DataValidationResult:
    def __init__(self, is_valid: bool, errors: List[str], warnings: List[str], clean_candles: List[Candle]):
        self.is_valid = is_valid
        self.errors = errors
        self.warnings = warnings
        self.clean_candles = clean_candles


class DataValidator:
    """
    المدقق الصارم لبيانات الشموع
    """

    @staticmethod
    def validate_candles(
        candles: List[Candle],
        min_required: int = 30,
        max_freshness_seconds: Optional[int] = 300,
        expected_timeframe_sec: Optional[int] = None
    ) -> DataValidationResult:
        errors: List[str] = []
        warnings: List[str] = []

        if not candles:
            return DataValidationResult(False, ["قائمة الشموع فارغة تماماً."], [], [])

        if len(candles) < min_required:
            errors.append(
                f"بيانات الشموع غير كافية لحساب المؤشرات بدقة: متوفر {len(candles)}، والمطلوب على الأقل {min_required} شمعة."
            )

        clean_candles: List[Candle] = []
        seen_timestamps = set()
        prev_ts = -1

        for idx, c in enumerate(candles):
            # 1. فحص القيم الصفرية أو غير المعرفة أو غير الرقمية
            for f_name, f_val in [("Open", c.open), ("High", c.high), ("Low", c.low), ("Close", c.close)]:
                if f_val is None or math.isnan(f_val) or math.isinf(f_val) or f_val <= 0:
                    errors.append(f"شمعة غير صالحة عند الفهرس {idx}: القيمة {f_name} غير صحيحة ({f_val}).")

            # 2. فحص منطق الشمعة (High يجب أن يكون أعلى من Low)
            if c.high < c.low:
                errors.append(f"خطأ في الشمعة {idx}: سعر القمة (High={c.high}) أقل من القاع (Low={c.low}).")

            if c.high < c.open or c.high < c.close:
                errors.append(f"خطأ في الشمعة {idx}: سعر القمة (High={c.high}) أقل من سعر الفتح/الإغلاق.")

            if c.low > c.open or c.low > c.close:
                errors.append(f"خطأ في الشمعة {idx}: سعر القاع (Low={c.low}) أعلى من سعر الفتح/الإغلاق.")

            # 3. فحص التكرار الزمني
            if c.timestamp in seen_timestamps:
                warnings.append(f"تم اكتشاف وتجاهل شمعة مكررة بنفس التوقيت: {c.timestamp}.")
                continue
            seen_timestamps.add(c.timestamp)

            # 4. فحص الترتيب الزمني
            if prev_ts != -1 and c.timestamp < prev_ts:
                errors.append(
                    f"البيانات غير مرتبة زمنياً: الشمعة عند {c.timestamp} تسبق الشمعة السابقة {prev_ts}."
                )
            prev_ts = c.timestamp

            clean_candles.append(c)

        # 5. فحص حداثة الأسعار (Freshness)
        if clean_candles and max_freshness_seconds is not None:
            latest_ts = clean_candles[-1].timestamp
            # Handle timestamps in milliseconds vs seconds
            now_sec = time.time()
            effective_ts = latest_ts / 1000.0 if latest_ts > 1e11 else float(latest_ts)
            age_sec = now_sec - effective_ts

            if age_sec > max_freshness_seconds:
                errors.append(
                    f"بيانات الأسعار قديمة أو منقطعة: آخر شمعة تعود إلى {int(age_sec)} ثانية مضت (الحد الأقصى المسموح: {max_freshness_seconds}s)."
                )

        # 6. فحص اتساق الفريم الزمني
        if clean_candles and expected_timeframe_sec and len(clean_candles) > 1:
            diffs = []
            for i in range(1, min(10, len(clean_candles))):
                t1 = clean_candles[i - 1].timestamp
                t2 = clean_candles[i].timestamp
                step = (t2 - t1) / 1000.0 if t2 > 1e11 else float(t2 - t1)
                diffs.append(step)
            avg_diff = sum(diffs) / len(diffs)
            if abs(avg_diff - expected_timeframe_sec) > expected_timeframe_sec * 0.2:
                warnings.append(
                    f"تنبيه: متوسط تباعد الشموع ({avg_diff:.1f}s) قد لا يطابق الفريم المطلوب ({expected_timeframe_sec}s)."
                )

        is_valid = len(errors) == 0 and len(clean_candles) >= min_required
        return DataValidationResult(
            is_valid=is_valid,
            errors=errors,
            warnings=warnings,
            clean_candles=clean_candles
        )
