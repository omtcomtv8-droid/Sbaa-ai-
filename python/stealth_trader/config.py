#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
config.py - إعدادات البوت المتخفي وإدارة المخاطر والشبكة
Stealth Trader Configuration Module
====================================================
"""

import os
from dataclasses import dataclass, field
from typing import List, Optional


@dataclass
class StealthConfig:
    """إعدادات البوت العامة وسلوك التخفي وإدارة المخاطر"""

    # --- 1. إعدادات المنصة والجلسة (Session & Platform) ---
    raw_ssid: str = os.getenv("POCKET_OPTION_SSID", "")
    is_demo: int = int(os.getenv("IS_DEMO", "1"))  # 1: تجريبي (Demo) | 0: حقيقي (Live)
    asset: str = os.getenv("TRADING_ASSET", "EURUSD_otc")
    timeframe: int = int(os.getenv("TIMEFRAME", "60"))  # مدة الصفقة بالثواني (60s, 30s, etc.)

    # قائمة خوادم Pocket Option المعتمدة
    endpoints: List[str] = field(default_factory=lambda: [
        "wss://api-eu.po.market/socket.io/?EIO=4&transport=websocket",
        "wss://api-us-north.po.market/socket.io/?EIO=4&transport=websocket",
        "wss://api-asia.po.market/socket.io/?EIO=4&transport=websocket",
        "wss://api-l.po.market/socket.io/?EIO=4&transport=websocket",
        "wss://api-msk.po.market/socket.io/?EIO=4&transport=websocket"
    ])

    # --- 2. إعدادات محاكاة السلوك البشري (Human Emulation Settings) ---
    # تردد الدخول البشري (Human Hesitation) بالثواني
    hesitation_min: float = 1.5
    hesitation_max: float = 4.2

    # نسبة تباين حجم الصفقة العشوائي (Amount Jitter Ratio: 5% تباين مثلاً)
    amount_jitter_percent: float = 0.05

    # فترات راحة المتداول (Fatigue & Rest Breaks)
    trades_before_rest: int = 10         # بعد كل 10 صفقات
    rest_duration_min_minutes: float = 15.0  # أدنى فترة راحة (دقيقة)
    rest_duration_max_minutes: float = 45.0  # أقصى فترة راحة (دقيقة)

    # تأخير النقر البشري بعد تحريك الماوس (بالمللي ثانية)
    click_delay_min_ms: int = 200
    click_delay_max_ms: int = 500

    # --- 3. إدارة المخاطر المالية (Risk Management) ---
    base_trade_amount: float = 10.0      # المبلغ الأساسي للصفقة ($)
    max_trade_amount: float = 50.0       # أقصى حد مالي للصفقة الواحدة
    daily_stop_loss: float = 30.0        # أقصى خسارة يومية ($) يتوقف البوت بعدها
    daily_take_profit: float = 50.0      # هدف الربح اليومي ($) يتوقف البوت بعدها
    use_martingale: bool = False         # تفعيل نظام المارتينجال
    martingale_multiplier: float = 2.0   # مضاعف المارتينجال
    max_martingale_depth: int = 2        # أقصى عمق مضاعفات (مثال: مضاعفتين فقط لتفادي تصفير الحساب)

    # --- 4. التخفي الشبكي والبروكسي (Network Evasion & Proxy) ---
    # مثال بروكسي سكني: "socks5://user:pass@residential.proxy.com:1080" أو "http://..."
    proxy_url: Optional[str] = os.getenv("RESIDENTIAL_PROXY", None)
    impersonate_target: str = "chrome"   # محاكاة متصفح كروم عبر TLS/JA3
    user_agent: str = (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/126.0.0.0 Safari/537.36"
    )

    # --- 5. نبضات الاتصال وإعادة المحاولة (Keep-Alive & Reconnect) ---
    ping_interval: int = 25              # إرسال Ping كل 25 ثانية
    max_reconnect_attempts: int = 3      # محاولات إعادة الاتصال قبل التبديل للتجريبي
    reconnect_delay: int = 5             # ثواني الانتظار بين المحاولات
