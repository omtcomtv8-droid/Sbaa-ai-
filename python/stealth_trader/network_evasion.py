#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
network_evasion.py - طبقة التخفي الشبكي ومحاكاة بصمة المتصفح والبروكسي
Network Evasion, TLS Fingerprinting & Proxy Layer
==================================================
"""

import json
import logging
from typing import Any, Dict, Optional

logger = logging.getLogger("NetworkEvasion")

# محاولة استيراد curl_cffi لتزوير بصمة TLS / JA3 لمتصفح Chrome الحقيقي
try:
    from curl_cffi import requests as cffi_requests
    HAS_CURL_CFFI = True
except ImportError:
    cffi_requests = None
    HAS_CURL_CFFI = False

# استيراد بديل آمن لمكتبة requests القياسية
try:
    import requests as standard_requests
except ImportError:
    standard_requests = None


class NetworkEvasionManager:
    """
    مدير التخفي الشبكي:
    - محاكاة بصمة TLS الحقيقية لمتصفح Chrome عبر curl_cffi
    - التوجيه عبر بروكسي سكني (Residential Proxy) أو SOCKS5/HTTP
    - التحقق من الـ IP الخارجي لتفادي حظر أو فصل الجلسة
    """

    def __init__(
        self,
        proxy_url: Optional[str] = None,
        impersonate_target: str = "chrome"
    ):
        self.proxy_url = proxy_url
        self.impersonate_target = impersonate_target

    def get_proxy_dict(self) -> Optional[Dict[str, str]]:
        """بناء قاموس البروكسي القياسي لمكتبات الاتصال"""
        if not self.proxy_url:
            return None
        return {
            "http": self.proxy_url,
            "https": self.proxy_url
        }

    def fetch_public_ip(self) -> Optional[str]:
        """
        جلب عنوان الـ IP العام الحالي للتأكد من هوية الشبكة والبروكسي
        مع استخدام بصمة متصفح كروم الحقيقية لمنع الحجب
        """
        urls = [
            "https://api.ipify.org?format=json",
            "https://ipinfo.io/json",
            "https://api64.ipify.org?format=json"
        ]

        # الأسلوب 1: استخدام curl_cffi مع بصمة chrome
        if HAS_CURL_CFFI and cffi_requests:
            for url in urls:
                try:
                    kwargs: Dict[str, Any] = {
                        "impersonate": self.impersonate_target,
                        "timeout": 6
                    }
                    if self.proxy_url:
                        kwargs["proxies"] = self.get_proxy_dict()

                    resp = cffi_requests.get(url, **kwargs)
                    if resp.status_code == 200:
                        ip_val = resp.json().get("ip")
                        if ip_val:
                            logger.info(
                                f"🛡️ [بصمة TLS]: تم التحقق عبر curl_cffi (impersonate='{self.impersonate_target}') "
                                f"العنوان: {ip_val}"
                            )
                            return str(ip_val)
                except Exception as e:
                    logger.debug(f"فشلت محاولة جلب IP عبر curl_cffi: {e}")

        # الأسلوب 2: البديل الاحتياطي عبر requests
        if standard_requests:
            for url in urls:
                try:
                    kwargs = {"timeout": 5}
                    if self.proxy_url:
                        kwargs["proxies"] = self.get_proxy_dict()
                    resp = standard_requests.get(url, **kwargs)
                    if resp.status_code == 200:
                        return str(resp.json().get("ip"))
                except Exception:
                    continue

        return None

    def get_websocket_headers(self, origin: str = "https://pocketoption.com") -> Dict[str, str]:
        """
        توليد ترويسات HTTP/WebSocket واقعية تحاكي متصفح Google Chrome الحديث
        """
        return {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/126.0.0.0 Safari/537.36"
            ),
            "Origin": origin,
            "Accept-Language": "en-US,en;q=0.9,ar;q=0.8",
            "Accept-Encoding": "gzip, deflate, br",
            "Cache-Control": "no-cache",
            "Pragma": "no-cache",
            "Sec-WebSocket-Extensions": "permessage-deflate; client_max_window_bits"
        }
