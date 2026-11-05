#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
human_emulator.py - كلاس محاكاة السلوك البشري لتفادي كشف البوتات
Human Emulation & Anti-Bot Evasion Layer
==============================================================
هذا الكلاس مسؤول عن إخفاء الهوية البرمجية وجعل البوت يتصرف تماماً كمتداول بشري:
1. التردد الإنساني قبل النقر (Human Hesitation Delay).
2. إضفاء عشوائية ذكية على حجم الصفقة (Randomized Cent/Dollar Jitter).
3. فترات الراحة الإجبارية وإدارة إجهاد المتداول (Session Fatigue & Rest Breaks).
4. مسارات حركة الماوس المنحنية (Cubic Bezier Curves) والتأخير قبل الضغط.
"""

import asyncio
import logging
import math
import random
import time
from typing import Dict, List, Optional, Tuple

logger = logging.getLogger("HumanEmulator")


class HumanEmulator:
    """
    محاكي السلوك البشري الشامل
    """

    def __init__(
        self,
        hesitation_min: float = 1.5,
        hesitation_max: float = 4.2,
        amount_jitter_ratio: float = 0.05,
        trades_before_rest: int = 10,
        rest_min_minutes: float = 15.0,
        rest_max_minutes: float = 45.0,
        click_delay_min_ms: int = 200,
        click_delay_max_ms: int = 500
    ):
        self.hesitation_min = hesitation_min
        self.hesitation_max = hesitation_max
        self.amount_jitter_ratio = amount_jitter_ratio
        self.trades_before_rest = trades_before_rest
        self.rest_min_minutes = rest_min_minutes
        self.rest_max_minutes = rest_max_minutes
        self.click_delay_min_ms = click_delay_min_ms
        self.click_delay_max_ms = click_delay_max_ms

        self.consecutive_trades_count = 0
        self.total_sessions_completed = 0
        self.last_trade_time: Optional[float] = None

    # =========================================================================
    # أ. تأخير التردد البشري (Human Hesitation)
    # =========================================================================
    def execute_sync_hesitation(self) -> float:
        """
        الكود المطلوب حرفياً لمحاكاة التردد البشري (في البيئات المتزامنة).
        يقوم بإيقاف التنفيذ لبرهة عشوائية بين 1.5 و 4.2 ثانية.
        """
        import time
        import random

        # تأخير عشوائي بين 1.5 إلى 4.2 ثانية قبل دخول الصفقة لمحاكاة التردد البشري
        delay = random.uniform(self.hesitation_min, self.hesitation_max)
        time.sleep(delay)
        return delay

    async def apply_human_hesitation(self) -> float:
        """
        النسخة المتوافقة مع AsyncIO لضمان عدم تجميد مهام الـ WebSocket
        ونبضات الـ Keep-Alive أثناء محاكاة تردد التفكير الإنساني.
        """
        delay = round(random.uniform(self.hesitation_min, self.hesitation_max), 3)
        logger.info(
            f"🧠 [محاكاة التردد البشري]: انتظار {delay} ثانية لمحاكاة تردد عين ويد المتداول قبل الضغط..."
        )
        await asyncio.sleep(delay)
        return delay

    # =========================================================================
    # ب. عشوائية حجم الصفقة (Randomized Amounts)
    # =========================================================================
    def randomize_trade_amount(self, base_amount: float, max_cap: float = 50.0) -> float:
        """
        منع إرسال مبالغ ثابتة مكررة (مثل 10.0$ في كل صفقة) التي تكشف البوتات.
        يتم إضافة تموجات عشوائية طبيعية في السنتات (مثل: 9.85$ أو 10.15$ أو 10.30$).
        """
        if base_amount <= 1.0:
            return round(base_amount, 2)

        # حساب مدى التغيير العشوائي (مثلاً ±5% من المبلغ الأساسي)
        max_jitter = base_amount * self.amount_jitter_ratio
        jitter = random.uniform(-max_jitter, max_jitter)

        # التوليد مع تقريب سنتين واقعيين
        randomized = round(base_amount + jitter, 2)

        # ضمان عدم النزول تحت 1$ وعدم تجاوز الحد الأقصى للمخاطرة
        safe_amount = max(1.0, min(randomized, max_cap))
        logger.info(
            f"🎲 [تنويع حجم الصفقة البشري]: المبلغ الأساسي: ${base_amount:.2f} -> "
            f"المبلغ الديناميكي الفعلي: ${safe_amount:.2f} (تغير: {safe_amount - base_amount:+.2f}$)"
        )
        return safe_amount

    # =========================================================================
    # ج. فترات الراحة وإدارة الإجهاد (Session Management & Rest Breaks)
    # =========================================================================
    def record_trade_and_check_rest(self) -> Tuple[bool, float]:
        """
        التحقق مما إذا كان البوت بحاجة لأخذ قسط من الراحة بعد عدد صفقات معين.
        البشر يتعبون ويأخذون فترات راحة بين 15 إلى 45 دقيقة بعد كل 10 صفقات.
        ترجع: (هل حان وقت الراحة، مدة الراحة بالدقائق)
        """
        self.consecutive_trades_count += 1
        self.last_trade_time = time.time()

        if self.consecutive_trades_count >= self.trades_before_rest:
            rest_minutes = round(
                random.uniform(self.rest_min_minutes, self.rest_max_minutes), 1
            )
            return True, rest_minutes

        return False, 0.0

    async def take_rest_break(self, rest_minutes: float):
        """
        تنفيذ فترة الراحة البشرية مع تسجيل العداد والوقت المتبقي
        """
        logger.info("==================================================")
        logger.info(
            f"☕ [وضع خمول المتداول]: تم تنفيذ {self.consecutive_trades_count} صفقات متتالية. "
            f"البوت يدخل الآن في استراحة شاي/قهوة مدتها {rest_minutes} دقيقة لمحاكاة السلوك الإنساني..."
        )
        logger.info("==================================================")

        # تصفير عداد الصفقات المتتالية
        self.consecutive_trades_count = 0
        self.total_sessions_completed += 1

        total_seconds = int(rest_minutes * 60)
        check_interval = 60  # إشعار كل دقيقة في السجلات

        elapsed = 0
        while elapsed < total_seconds:
            sleep_chunk = min(check_interval, total_seconds - elapsed)
            await asyncio.sleep(sleep_chunk)
            elapsed += sleep_chunk
            remaining_mins = max(0.0, round((total_seconds - elapsed) / 60.0, 1))
            if remaining_mins > 0 and int(remaining_mins) % 5 == 0:
                logger.info(f"⏳ الاستراحة مستمرة... باقي {remaining_mins} دقيقة للعودة للتداول.")

        logger.info("🎯 [انتهاء الاستراحة]: المتداول عاد إلى الشاشة، استئناف مراقبة السوق وإرسال الصفقات!")

    # =========================================================================
    # د. محاكاة حركة الماوس المنحنية (Bezier Curves Mouse Emulation)
    # =========================================================================
    @staticmethod
    def generate_bezier_trajectory(
        start: Tuple[int, int],
        target: Tuple[int, int],
        steps: int = 25
    ) -> List[Tuple[int, int]]:
        """
        توليد مسار ماوس طبيعي باستخدام منحنيات بيزييه التكعيبية (Cubic Bezier Curves)
        لحركات الماوس في حال تشغيل أداة متصفح مثل Playwright أو Selenium.
        البشر لا يحركون الماوس في خطوط مستقيمة، بل في أقواس طبيعية ذات تسارع وتباطؤ.
        """
        x0, y0 = start
        x3, y3 = target

        # نقاط تحكم عشوائية لخلق تقوس بشري واقعي
        deviation_x = random.randint(-80, 80)
        deviation_y = random.randint(-80, 80)

        x1 = x0 + (x3 - x0) * 0.33 + deviation_x
        y1 = y0 + (y3 - y0) * 0.33 + deviation_y

        x2 = x0 + (x3 - x0) * 0.66 + (deviation_x * 0.5)
        y2 = y0 + (y3 - y0) * 0.66 + (deviation_y * 0.5)

        points: List[Tuple[int, int]] = []
        for i in range(steps + 1):
            t = i / float(steps)
            # دالة Bezier التكعيبية
            xt = (1 - t)**3 * x0 + 3 * (1 - t)**2 * t * x1 + 3 * (1 - t) * t**2 * x2 + t**3 * x3
            yt = (1 - t)**3 * y0 + 3 * (1 - t)**2 * t * y1 + 3 * (1 - t) * t**2 * y2 + t**3 * y3
            # إضافة اهتزاز طبيعي ضئيل جداً لليد (Micro-Jitter)
            jitter_x = random.uniform(-0.5, 0.5)
            jitter_y = random.uniform(-0.5, 0.5)
            points.append((int(round(xt + jitter_x)), int(round(yt + jitter_y))))

        return points

    async def simulate_pre_click_delay(self) -> float:
        """
        تأخير إضافي طبيعي بين وصول الماوس للزر وبين لحظة النقر الفعلية
        (بين 200 إلى 500 مللي ثانية).
        """
        delay_ms = random.randint(self.click_delay_min_ms, self.click_delay_max_ms)
        delay_sec = delay_ms / 1000.0
        logger.debug(f"🖱️ [تأخير النقر البشري]: {delay_ms}ms قبل تنفيذ ضغطة الزر.")
        await asyncio.sleep(delay_sec)
        return delay_sec
