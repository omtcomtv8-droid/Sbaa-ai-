#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
security_manager.py - طبقة الحماية المتكاملة وإدارة بصمات المتصفح وتجاوز مكافحة البوتات
Security & Stealth Layer for Pocket Option Trading Bot
======================================================
يقوم هذا الكلاس بدمج وإدارة ملفات الحماية وبصمات TLS:
1. التحقق الصارم من حزمة المصادقة (SSID Formatting & Validation).
2. محاكاة بصمة متصفح كروم الحقيقية (TLS/JA3/JA4 Impersonation عبر curl_cffi).
3. تدوير User-Agents ومعرفات الأجهزة بين جلسات الاتصال لمنع ربط البصمة بجهاز واحد.
4. دمج البروكسيات السكنية (Residential / SOCKS5 / HTTP Proxies).
5. إعادة المحاولة الصامتة عند حدوث أخطاء شبكية أو قيود Cloudflare دون انهيار البوت.
"""

import asyncio
import json
import logging
import random
import re
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger("SecurityManager")

# محاولة استيراد curl_cffi لتزوير بصمة TLS الخاصة بمتصفح Chrome
try:
    from curl_cffi import requests as cffi_requests
    HAS_CURL_CFFI = True
except ImportError:
    cffi_requests = None
    HAS_CURL_CFFI = False

try:
    import requests as standard_requests
except ImportError:
    standard_requests = None


class BrowserFingerprintPool:
    """مستودع بصمات وترويسات متصفحات حديثة حقيقية"""

    USER_AGENTS = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ]

    CHROME_VERSIONS = ["126", "125", "124"]

    @classmethod
    def get_random_profile(cls) -> Dict[str, str]:
        ua = random.choice(cls.USER_AGENTS)
        ver = random.choice(cls.CHROME_VERSIONS)
        return {
            "User-Agent": ua,
            "Origin": "https://pocketoption.com",
            "Referer": "https://pocketoption.com/en/cabinet/demo-quick-high-low/",
            "Accept-Language": "en-US,en;q=0.9,ar;q=0.8",
            "Accept-Encoding": "gzip, deflate, br",
            "Sec-Ch-Ua": f'"Not/A)Brand";v="8", "Chromium";v="{ver}", "Google Chrome";v="{ver}"',
            "Sec-Ch-Ua-Mobile": "?0",
            "Sec-Ch-Ua-Platform": '"Windows"' if "Windows" in ua else ('"macOS"' if "Macintosh" in ua else '"Linux"'),
            "Sec-Fetch-Dest": "websocket",
            "Sec-Fetch-Mode": "websocket",
            "Sec-Fetch-Site": "cross-site",
            "Pragma": "no-cache",
            "Cache-Control": "no-cache"
        }


class SecurityManager:
    """
    المدير الأمني العام:
    يُستدعى في بداية تشغيل البوت ومع كل طلب أو اتصال جديد.
    """

    def __init__(
        self,
        proxy_url: Optional[str] = None,
        impersonate_target: str = "chrome"
    ):
        self.proxy_url = proxy_url
        self.impersonate_target = impersonate_target
        self.current_profile = BrowserFingerprintPool.get_random_profile()
        self.session_generation = 0
        self.failed_request_retries = 3

    def rotate_fingerprint(self):
        """تدوير الـ User-Agent وبصمة المتصفح لجلسة جديدة"""
        self.session_generation += 1
        self.current_profile = BrowserFingerprintPool.get_random_profile()
        logger.info(
            f"🔄 [تدوير البصمة الرقمية]: توليد هوية متصفح جديدة (جيل #{self.session_generation})\n"
            f"   User-Agent: {self.current_profile['User-Agent'][:60]}..."
        )

    def validate_and_sanitize_ssid(
        self,
        raw_ssid: str,
        is_demo: int = 1,
        uid: int = 0,
        platform: int = 2
    ) -> Dict[str, Any]:
        """
        التحقق الصارم من صيغة SSID بناءً على ملفات حماية Pocket Option الرسمية.
        يمنع أخطاء Authentication Timeout الناتجة عن نسخ الـ session_id فقط.
        """
        clean = (raw_ssid or "").strip()
        session_token = ""
        resolved_demo = is_demo
        resolved_uid = uid
        resolved_platform = platform

        if clean.startswith('42["auth"') or clean.startswith("42['auth'"):
            try:
                json_part = clean[2:]
                parsed = json.loads(json_part)
                if len(parsed) >= 2 and isinstance(parsed[1], dict):
                    data = parsed[1]
                    session_token = data.get("session", "")
                    resolved_demo = int(data.get("isDemo", is_demo))
                    resolved_uid = int(data.get("uid", uid))
                    resolved_platform = int(data.get("platform", platform))
            except Exception as e:
                logger.warning(f"تحذير تفكيك حزمة Socket.IO: {e}")

        if not session_token:
            token_match = re.search(r'([a-zA-Z0-9_\-]{20,64})', clean)
            if token_match:
                session_token = token_match.group(1)
            else:
                session_token = clean

        session_token = session_token.strip('"\'')

        if len(session_token) < 15:
            logger.warning(
                f"⚠️ [تحذير الحماية]: توكن الجلسة قصير بشكل مريب ({len(session_token)} خانات). "
                "تأكد من نسخه من تبويب Network -> WS -> 42[\"auth\"...]"
            )

        auth_payload = {
            "session": session_token,
            "isDemo": resolved_demo,
            "uid": resolved_uid,
            "platform": resolved_platform
        }

        packet = f'42["auth",{json.dumps(auth_payload, separators=(",", ":"))}]'

        return {
            "packet": packet,
            "payload": auth_payload,
            "session_token": session_token,
            "is_demo": resolved_demo
        }

    def verify_network_identity(self) -> Tuple[bool, Optional[str]]:
        """
        فحص الـ IP العام والبصمة باستخدام curl_cffi المقلد لـ Chrome
        """
        urls = ["https://api.ipify.org?format=json", "https://api64.ipify.org?format=json"]

        # محاولة عبر curl_cffi مع بصمة chrome الحقيقية
        if HAS_CURL_CFFI and cffi_requests:
            for url in urls:
                try:
                    kwargs: Dict[str, Any] = {
                        "impersonate": self.impersonate_target,
                        "timeout": 5
                    }
                    if self.proxy_url:
                        kwargs["proxies"] = {"http": self.proxy_url, "https": self.proxy_url}

                    resp = cffi_requests.get(url, **kwargs)
                    if resp.status_code == 200:
                        ip = resp.json().get("ip")
                        logger.info(f"🛡️ [بصمة TLS مشفرة]: اجتياز فحص Chrome Impersonation بنجاح | IP: {ip}")
                        return True, ip
                except Exception as e:
                    logger.debug(f"خطأ طفيف في curl_cffi: {e}")

        # محاولة احتياطية عبر requests
        if standard_requests:
            for url in urls:
                try:
                    kwargs = {"timeout": 5}
                    if self.proxy_url:
                        kwargs["proxies"] = {"http": self.proxy_url, "https": self.proxy_url}
                    resp = standard_requests.get(url, **kwargs)
                    if resp.status_code == 200:
                        ip = resp.json().get("ip")
                        logger.info(f"🌐 [فحص IP]: الاتصال متصل من عنوان {ip}")
                        return True, ip
                except Exception:
                    continue

        return False, None

    def get_handshake_headers(self) -> Dict[str, str]:
        """الحصول على الترويسات الحالية المتوافقة مع متصفح كروم"""
        return dict(self.current_profile)

    async def execute_safe_async_call(self, coro_func, *args, **kwargs) -> Any:
        """
        إحاطة شاملة بـ try-except لجميع طلبات الشبكة
        مع إعادة المحاولة الصامتة (Silent Retry) دون انهيار البوت
        """
        last_error = None
        for attempt in range(1, self.failed_request_retries + 1):
            try:
                return await coro_func(*args, **kwargs)
            except Exception as e:
                last_error = e
                wait_sec = attempt * 1.5 + random.uniform(0.5, 1.2)
                logger.warning(
                    f"⚠️ [محاولة صامتة]: فشل الطلب ({attempt}/{self.failed_request_retries}): {e}. "
                    f"إعادة المحاولة بعد {wait_sec:.1f}s..."
                )
                await asyncio.sleep(wait_sec)

        logger.error(f"❌ استنفدت جميع محاولات الحماية: {last_error}")
        return None
