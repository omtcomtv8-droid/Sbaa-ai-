#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
main.py - المشغل الرئيسي لبوت التداول الآلي المتخفي (Stealth Auto-Trader)
Pocket Option Fully-Integrated Anti-Bot Evasion Trading Engine
==============================================================
يدمج:
- طبقة الحماية الشاملة (SecurityManager / StealthLayer)
- محاكي السلوك والتردد البشري (HumanEmulator)
- إدارة المخاطر المالية (RiskManager)
- مدير الاتصال المستقر (PocketOptionConnection)
"""

import argparse
import asyncio
import logging
import os
import random
import sys
import time
from typing import Any, Dict, Optional

from config import StealthConfig
from connection import PocketOptionConnection
from human_emulator import HumanEmulator
from security_manager import SecurityManager
from risk_manager import RiskManager

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S"
)
logger = logging.getLogger("StealthAutoTrader")


class StealthAutoTrader:
    """
    المنسق الرئيسي لجميع طبقات البوت:
    1. طبقة الحماية الأمنية والبصمات (SecurityManager)
    2. طبقة محاكاة السلوك الإنساني والتردد (HumanEmulator)
    3. طبقة إدارة المخاطر وحماية الرصيد (RiskManager)
    4. طبقة الاتصال عبر السوكيت وتنفيذ الصفقات (PocketOptionConnection)
    """

    def __init__(self, config: Optional[StealthConfig] = None, strategy_name: str = "Confluence"):
        self.config = config or StealthConfig()
        self.strategy_name = strategy_name

        # 1. تهيئة طبقة الحماية وبصمات كروم (SecurityManager)
        self.security_mgr = SecurityManager(
            proxy_url=self.config.proxy_url,
            impersonate_target=self.config.impersonate_target
        )

        # 2. تهيئة محاكي السلوك الإنساني (HumanEmulator)
        self.human_emulator = HumanEmulator(
            hesitation_min=self.config.hesitation_min,
            hesitation_max=self.config.hesitation_max,
            amount_jitter_ratio=self.config.amount_jitter_percent,
            trades_before_rest=self.config.trades_before_rest,
            rest_min_minutes=self.config.rest_duration_min_minutes,
            rest_max_minutes=self.config.rest_duration_max_minutes,
            click_delay_min_ms=self.config.click_delay_min_ms,
            click_delay_max_ms=self.config.click_delay_max_ms
        )

        # 3. تهيئة نظام إدارة المخاطر (RiskManager)
        self.risk_mgr = RiskManager(
            base_amount=self.config.base_trade_amount,
            max_amount=self.config.max_trade_amount,
            daily_stop_loss=self.config.daily_stop_loss,
            daily_take_profit=self.config.daily_take_profit,
            use_martingale=self.config.use_martingale,
            martingale_multiplier=self.config.martingale_multiplier,
            max_martingale_depth=self.config.max_martingale_depth
        )

        # فحص وتطهير الـ SSID وتجهيز حزمة المصادقة الرسمية
        sanitized_auth = self.security_mgr.validate_and_sanitize_ssid(
            raw_ssid=self.config.raw_ssid,
            is_demo=self.config.is_demo
        )

        # 4. تهيئة طبقة الاتصال مع ترويسات واقعية مستخرجة من SecurityManager
        headers = self.security_mgr.get_handshake_headers()
        self.connection = PocketOptionConnection(
            raw_ssid=sanitized_auth["packet"],
            is_demo=sanitized_auth["is_demo"],
            endpoints=self.config.endpoints,
            ping_interval=self.config.ping_interval,
            max_reconnect_attempts=self.config.max_reconnect_attempts,
            reconnect_delay=self.config.reconnect_delay,
            headers=headers
        )

        self.connection.on_deal_result = self.on_trade_closed
        self.conn_task: Optional[asyncio.Task] = None
        self._is_running = False

    def on_trade_closed(self, deal_result: Dict[str, Any]):
        """معالجة نتيجة الصفقة وتحديث مؤشرات المخاطرة"""
        try:
            profit = float(deal_result.get("profit", 0.0))
            is_win = profit > 0
            self.risk_mgr.record_trade_result(is_win=is_win, profit_or_loss=profit)
            logger.info(f"📊 [تقرير الأداء المالي]: {self.risk_mgr.get_summary()}")
        except Exception as e:
            logger.error(f"خطأ أثناء تسجيل نتيجة الصفقة: {e}")

    async def execute_order(
        self,
        action: str,  # "call" أو "put"
        asset: Optional[str] = None,
        duration: Optional[int] = None
    ) -> bool:
        """
        تنفيذ صفقة تداول متخفية بالكامل
        """
        target_asset = asset or self.config.asset
        target_duration = duration or self.config.timeframe

        logger.info("--------------------------------------------------")
        logger.info(
            f"🎯 [صفقة جديدة مبنية على استراتيجية '{self.strategy_name}']\n"
            f"   الاتجاه: {action.upper()} | الأصل: {target_asset} | المدة: {target_duration}s"
        )

        # 1. فحص إدارة المخاطر (Stop-Loss / Take-Profit)
        risk_check = self.risk_mgr.evaluate_pre_trade()
        if not risk_check.allowed:
            logger.warning(f"🚫 [تم إلغاء الصفقة بأمر إدارة المخاطر]: {risk_check.reason}")
            return False

        # 2. فحص استراحة المتداول البشري (Session Fatigue) بعد 10 صفقات
        needs_rest, rest_mins = self.human_emulator.record_trade_and_check_rest()
        if needs_rest:
            logger.info(f"☕ [استراحة بشرية]: أخذ قسط من الراحة لمدة {rest_mins} دقيقة...")
            # تدوير البصمة الرقمية أيضاً خلال الاستراحة لمحاكاة العودة بجلسة متصفح نظيفة
            self.security_mgr.rotate_fingerprint()
            await self.human_emulator.take_rest_break(rest_mins)

        # 3. عشوائية حجم الصفقة (Randomized Amounts)
        base_suggested = risk_check.suggested_amount
        actual_amount = self.human_emulator.randomize_trade_amount(
            base_amount=base_suggested,
            max_cap=self.config.max_trade_amount
        )

        # 4. محاكاة حركة الماوس المنحنية (Cubic Bezier Curves)
        start_pt = (random.randint(150, 300), random.randint(200, 350))
        target_pt = (
            random.randint(920, 960),
            random.randint(460, 490) if action.lower() == "call" else random.randint(560, 590)
        )
        trajectory = self.human_emulator.generate_bezier_trajectory(start_pt, target_pt)
        logger.debug(f"🖱️ مسار حركة الماوس: {len(trajectory)} نقطة بيزييه نحو زر {action.upper()}")

        # 5. تأخير التردد البشري الإلزامي (Human Hesitation)
        # تنفيذ الكود المطلوب حرفياً في بيئة غير متزامنة:
        # -------------------------------------------------------------
        import time
        import random
        # تأخير عشوائي بين 1.5 إلى 4.2 ثانية قبل دخول الصفقة لمحاكاة التردد البشري
        # في بيئة asyncio نستخدم النظير غير المتزامن لعدم تجميد السوكيت
        await self.human_emulator.apply_human_hesitation()
        # -------------------------------------------------------------

        # 6. تأخير النقر الواقعي (Pre-Click Delay: 200-500ms)
        await self.human_emulator.simulate_pre_click_delay()

        # 7. إرسال أمر فتح الصفقة عبر قناة WebSocket مع حماية المحاولات الصامتة
        async def _do_send():
            return await self.connection.place_order(
                asset=target_asset,
                amount=actual_amount,
                action=action,
                duration_seconds=target_duration
            )

        success = await self.security_mgr.execute_safe_async_call(_do_send)

        if success:
            logger.info("✨ تم إرسال الصفقة بنجاح تحت حماية طبقة التخفي والسلوك الإنساني الكامل!")
        else:
            logger.error("❌ فشل إرسال الصفقة بعد استنفاد محاولات الحماية.")

        logger.info("--------------------------------------------------")
        return bool(success)

    # اسم بديل متوافق مع متطلبات المستخدم البرمجية
    place_trade = execute_order

    async def start(self):
        """بدء الاتصال وتشغيل فحص الهوية والشبكة"""
        self._is_running = True

        print("""
================================================================
   🕵️‍♂️ POCKET OPTION ADVANCED STEALTH AUTO-TRADER v2.5
   نظام التداول الآلي عالي التخفي المدمج بملفات الحماية وإدارة المخاطر
================================================================
        """)
        logger.info(f"🎯 الاستراتيجية النشطة: {self.strategy_name}")
        logger.info(f"🛑 حد الخسارة اليومي: -${self.config.daily_stop_loss:.2f}")
        logger.info(f"🏆 هدف الربح اليومي: +${self.config.daily_take_profit:.2f}")

        # فحص الشبكة والبصمة عبر SecurityManager
        ok, current_ip = self.security_mgr.verify_network_identity()
        if self.config.proxy_url:
            logger.info(f"🔒 البروكسي المشفر: {self.config.proxy_url}")
        else:
            logger.info(f"🌐 الاتصال مباشر بدون بروكسي | عنوان IP: {current_ip or 'غير معروف'}")

        # إطلاق حلقة الاتصال الخلفية
        self.conn_task = asyncio.create_task(self.connection.start())

        # انتظار تأكيد المصادقة
        for _ in range(12):
            if self.connection.is_authenticated:
                break
            await asyncio.sleep(0.5)

        if self.connection.is_authenticated:
            logger.info(
                f"🎉 تم تأسيس الاتصال والمصادقة بنجاح! الرصيد: ${self.connection.balance or 0} "
                f"({'حساب تجريبي' if self.connection.is_demo else 'حساب حقيقي'})"
            )
        else:
            logger.warning("⚠️ جاري تأسيس الاتصال في الخلفية مع تدوير الخوادم التلقائي...")

    async def stop(self):
        """إيقاف البوت وفصل الاتصال"""
        logger.info("🛑 إيقاف البوت المتخفي...")
        self._is_running = False
        await self.connection.stop()
        if self.conn_task and not self.conn_task.done():
            self.conn_task.cancel()
        logger.info("تم إنهاء الجلسة بأمان.")


async def main():
    parser = argparse.ArgumentParser(description="Pocket Option Stealth Auto-Trader")
    parser.add_argument("--ssid", type=str, default="", help="Pocket Option SSID Token / Auth packet")
    parser.add_argument("--strategy", type=str, default="Confluence", help="Trading strategy name")
    parser.add_argument("--asset", type=str, default="EURUSD_otc", help="Trading asset (e.g. EURUSD_otc)")
    parser.add_argument("--amount", type=float, default=10.0, help="Base trade amount in USD")
    parser.add_argument("--stop-loss", type=float, default=30.0, help="Daily Stop-Loss in USD")
    parser.add_argument("--take-profit", type=float, default=50.0, help="Daily Take-Profit in USD")
    parser.add_argument("--demo", action="store_true", default=True, help="Run in Demo mode")
    parser.add_argument("--proxy", type=str, default="", help="Residential Proxy URL")
    args = parser.parse_args()

    ssid_val = args.ssid or os.getenv("POCKET_OPTION_SSID", "")
    if not ssid_val:
        ssid_val = '42["auth",{"session":"demo_sample_token_1234567890abcdef","isDemo":1,"uid":0,"platform":2}]'

    cfg = StealthConfig(
        raw_ssid=ssid_val,
        is_demo=1 if args.demo else 0,
        asset=args.asset,
        base_trade_amount=args.amount,
        daily_stop_loss=args.stop_loss,
        daily_take_profit=args.take_profit,
        proxy_url=args.proxy or None
    )

    bot = StealthAutoTrader(config=cfg, strategy_name=args.strategy)

    try:
        await bot.start()
        await asyncio.sleep(2)

        logger.info("🚀 محاكاة تنفيذ صفقات متتابعة للتأكد من سلاسة التردد البشري والتخفي...")
        # إرسال صفقة أولى مع تطبيق التأخير البشري
        await bot.place_trade(action="call", asset=cfg.asset, duration=60)

        logger.info("💡 البوت مستمر في وضع المراقبة والاستماع... (اضغط Ctrl+C للإيقاف)")
        while True:
            await asyncio.sleep(10)
    except KeyboardInterrupt:
        logger.info("تم تلقي أمر الإيقاف عبر سطر الأوامر.")
    finally:
        await bot.stop()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
