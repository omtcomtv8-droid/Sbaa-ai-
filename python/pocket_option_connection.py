#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Pocket Option Resilient Connection Manager
==========================================
نظام اتصال مستقر وإدارة الجلسات لبوت تداول Pocket Option (معتمد على AsyncIO و WebSockets)
- مصمم خصيصاً لحل مشكلة NotAuthorized وانقطاع الجلسة المفاجئ.
- يدعم Keep-Alive دوري لمنع انتهاء الجلسة من جانب السيرفر.
- يدعم إعادة الاتصال التلقائي (Auto-Reconnect) مع التبديل السلس للوضع التجريبي (Demo Mode).
- فحص ترابط عنوان الـ IP (IP Binding Check) لتنبيه المستخدم في حال وجود اختلاف في الشبكة.
- متوافق تماماً مع بيئات Linux و Termux و Python 3.8+.
"""

import asyncio
import json
import logging
import re
import sys
import time
from typing import Optional, Callable, Dict, Any

# المحاولة الآمنة لاستيراد المكتبات الخارجية
try:
    import websockets
except ImportError:
    print("[ERROR] مكتبة 'websockets' غير مثبتة. يرجى تثبيتها عبر: pip install websockets")
    websockets = None

try:
    import requests
except ImportError:
    requests = None


# تهيئة السجل الاحترافي
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger("POConnectionManager")


class PocketOptionSSIDFormatter:
    """
    مساعد تنسيق وفحص الـ SSID
    يقوم بالتحقق الصارم من بنية حزمة المصادقة وبناء الهيكل الرسمي لـ Pocket Option.
    """

    @staticmethod
    def extract_and_format(raw_input: str, is_demo: int = 1, uid: int = 0, platform: int = 2) -> Dict[str, Any]:
        """
        تحويل أي مدخل (سواء كان توكن جلسة خام أو حزمة Socket.IO كاملة) إلى حزمة رسمية معتمدة.
        
        الصيغة الرسمية لـ Socket.IO v4:
        42["auth", {"session": "<session_token>", "isDemo": 1, "uid": 0, "platform": 2}]
        """
        clean_input = raw_input.strip()

        session_token = ""
        resolved_demo = is_demo
        resolved_uid = uid
        resolved_platform = platform

        # الحالة 1: إدخال حزمة Socket.IO كاملة تبدأ بـ 42["auth"
        if clean_input.startswith('42["auth"') or clean_input.startswith("42['auth'"):
            try:
                # استخراج جزء الـ JSON بعد 42
                json_part = clean_input[2:]
                parsed_arr = json.loads(json_part)
                if len(parsed_arr) >= 2 and isinstance(parsed_arr[1], dict):
                    auth_dict = parsed_arr[1]
                    session_token = auth_dict.get("session", "")
                    resolved_demo = int(auth_dict.get("isDemo", is_demo))
                    resolved_uid = int(auth_dict.get("uid", uid))
                    resolved_platform = int(auth_dict.get("platform", platform))
            except Exception as e:
                logger.warning(f"تعذر تفكيك حزمة Socket.IO عبر JSON: {e}. جاري البحث التلقائي عن التوكن...")

        # الحالة 2: إذا لم يتم استخراج التوكن، نبحث عبر Regex عن توكن الجلسة (أبجدي رقمي بطول 20-64 خانة)
        if not session_token:
            token_match = re.search(r'([a-zA-Z0-9_\-]{20,64})', clean_input)
            if token_match:
                session_token = token_match.group(1)
            else:
                session_token = clean_input

        # تنظيف التوكن من أي علامات اقتباس إضافية
        session_token = session_token.strip('"\'')

        auth_payload = {
            "session": session_token,
            "isDemo": resolved_demo,
            "uid": resolved_uid,
            "platform": resolved_platform
        }

        # بناء الرسالة الرسمية 42["auth", {...}]
        formatted_packet = f'42["auth",{json.dumps(auth_payload, separators=(",", ":"))}]'

        return {
            "packet": formatted_packet,
            "payload": auth_payload,
            "session_token": session_token,
            "is_demo": resolved_demo
        }


class IPBindingChecker:
    """
    فاحص عنوان الـ IP والتحذير من عدم التطابق
    جلسات Pocket Option ترتبط مباشرة بعنوان IP الذي تم استخراج التوكن منه.
    إذا تم تغيير الـ IP أو تشغيل VPN، يرفض الخادم الجلسة بخطأ NotAuthorized فوراً.
    """

    @staticmethod
    def get_public_ip() -> Optional[str]:
        if not requests:
            return None
        services = [
            "https://api.ipify.org?format=json",
            "https://ipinfo.io/json",
            "https://api64.ipify.org?format=json"
        ]
        for url in services:
            try:
                res = requests.get(url, timeout=4)
                if res.status_code == 200:
                    data = res.json()
                    return data.get("ip")
            except Exception:
                continue
        return None

    @classmethod
    def verify_and_warn(cls, expected_ip: Optional[str] = None):
        current_ip = cls.get_public_ip()
        logger.info("==================================================")
        logger.info(f"🌐 فحص IP الجلسة: عنوان الـ IP العام الحالي هو: {current_ip or 'غير معروف'}")
        if expected_ip and current_ip:
            if current_ip != expected_ip:
                logger.warning(
                    f"⚠️ [تحذير هام]: عنوان IP الحالي ({current_ip}) يختلف عن IP الجلسة الأصلي ({expected_ip})!\n"
                    "Pocket Option تغلق الجلسة وترجع NotAuthorized إذا تغير الـ IP أو تم تبديل الـ VPN/البروكسي."
                )
            else:
                logger.info("✅ تطابق تام لعنوان IP الجلسة.")
        else:
            logger.info("ℹ️ ملاحظة: تأكد من أن البوت يعمل على نفس اتصال الإنترنت (أو نفس الـ VPN) الذي نسخت منه الـ SSID.")
        logger.info("==================================================")


class PocketOptionConnectionManager:
    """
    مدير اتصال متقدم وخفيف لـ Pocket Option
    يتحكم في دورة حياة الاتصال:
    1. التحقق من SSID وتنسيقه
    2. الاتصال مع خوادم Pocket Option الرسمية (Engine.IO / Socket.IO v4)
    3. تشغيل مهمة Keep-Alive دورية بالخلفية
    4. إعادة الاتصال التلقائي الذكية (Auto-Reconnect)
    5. التعامل مع NotAuthorized بالتحول للوضع التجريبي تلقائياً لمنع توقف البوت
    """

    DEFAULT_ENDPOINTS = [
        "wss://api-eu.po.market/socket.io/?EIO=4&transport=websocket",
        "wss://api-us-north.po.market/socket.io/?EIO=4&transport=websocket",
        "wss://api-asia.po.market/socket.io/?EIO=4&transport=websocket",
        "wss://api-l.po.market/socket.io/?EIO=4&transport=websocket",
        "wss://api-msk.po.market/socket.io/?EIO=4&transport=websocket"
    ]

    def __init__(
        self,
        raw_ssid: str,
        is_demo: int = 1,
        ping_interval: int = 25,
        max_reconnect_attempts: int = 3,
        reconnect_delay: int = 5,
        on_message_callback: Optional[Callable[[str], Any]] = None,
        on_auth_success: Optional[Callable[[Dict[str, Any]], Any]] = None
    ):
        self.raw_ssid = raw_ssid
        self.is_demo = is_demo
        self.ping_interval = ping_interval
        self.max_reconnect_attempts = max_reconnect_attempts
        self.reconnect_delay = reconnect_delay
        self.on_message_callback = on_message_callback
        self.on_auth_success = on_auth_success

        self.ws = None
        self.is_connected = False
        self.is_authenticated = False
        self.keep_alive_task: Optional[asyncio.Task] = None
        self.listener_task: Optional[asyncio.Task] = None
        self._stop_requested = False
        self.endpoint_index = 0
        self.balance: Optional[float] = None
        self.user_data: Dict[str, Any] = {}

    def get_current_endpoint(self) -> str:
        return self.DEFAULT_ENDPOINTS[self.endpoint_index % len(self.DEFAULT_ENDPOINTS)]

    def rotate_endpoint(self):
        self.endpoint_index += 1
        logger.info(f"🔄 التبديل إلى الخادم البديل: {self.get_current_endpoint()}")

    async def _send_keep_alive(self):
        """
        مهمة خلفية ترسل نبضات Keep-Alive كل 20-30 ثانية
        لمنع خوادم Pocket Option من إغلاق الاتصال بسبب الخمول.
        ترسل Socket.IO Ping 42["ping"] ونبضة Engine.IO '2'
        """
        logger.info(f"⏱️ بدء خدمة إبقاء الاتصال حياً (Keep-Alive) كل {self.ping_interval} ثانية...")
        try:
            while not self._stop_requested and self.is_connected and self.ws:
                await asyncio.sleep(self.ping_interval)
                if not self.is_connected or not self.ws:
                    break

                try:
                    # 1. إرسال Socket.IO ping
                    await self.ws.send('42["ping"]')
                    # 2. إرسال Engine.IO ping packet '2'
                    await self.ws.send('2')
                    logger.debug("💓 تم إرسال نبضة Keep-Alive بنجاح")
                except Exception as e:
                    logger.warning(f"⚠️ فشل إرسال نبضة Keep-Alive: {e}")
                    break
        except asyncio.CancelledError:
            logger.info("🛑 تم إيقاف مهمة Keep-Alive.")
        except Exception as e:
            logger.error(f"خطأ غير متوقع في Keep-Alive: {e}")

    async def _authenticate(self):
        """
        إرسال حزمة المصادقة الرسمية والتحقق من الاستجابة
        """
        formatted = PocketOptionSSIDFormatter.extract_and_format(
            self.raw_ssid,
            is_demo=self.is_demo
        )
        packet = formatted["packet"]
        logger.info(f"🔑 إرسال حزمة المصادقة (isDemo: {self.is_demo})...")
        await self.ws.send(packet)

    async def _handle_incoming_message(self, message: str):
        """
        معالجة وتفكيك رسائل Pocket Option الواردة عبر الـ WebSocket
        """
        # الرد التلقائي على طلبات Engine.IO Ping (الخادم يرسل '2' ونرد بـ '3')
        if message == "2":
            await self.ws.send("3")
            return

        # رسائل Socket.IO تبدأ عادة بـ 42
        if message.startswith("42"):
            try:
                payload_str = message[2:]
                event_data = json.loads(payload_str)
                event_name = event_data[0] if len(event_data) > 0 else ""
                event_body = event_data[1] if len(event_data) > 1 else {}

                # معالجة نجاح تسجيل الدخول والمصادقة
                if event_name in ["successauth", "auth", "profile", "success_auth"]:
                    self.is_authenticated = True
                    self.user_data = event_body if isinstance(event_body, dict) else {}
                    self.balance = self.user_data.get("balance", self.balance)
                    logger.info(f"✅ تم تأكيد المصادقة بنجاح! الرصيد الحالي: {self.balance or 'مجهول'}")
                    if self.on_auth_success:
                        self.on_auth_success(self.user_data)

                # معالجة رفض المصادقة أو انتهاء الجلسة
                elif "notauthorized" in event_name.lower() or "notauthorized" in str(event_body).lower():
                    logger.error(f"❌ تم رفض الجلسة من الخادم: NotAuthorized! (تفاصيل: {event_body})")
                    self.is_authenticated = False
                    # تنفيذ الشرط 4: إذا فشلت المصادقة على الحساب الحقيقي، نحول تلقائياً إلى التجريبي
                    if self.is_demo == 0:
                        logger.warning("🔄 التحول التلقائي إلى الوضع التجريبي (isDemo=1) لضمان استمرار عمل الرسوم والإشارات...")
                        self.is_demo = 1
                        await self._authenticate()

                elif event_name == "updateStream":
                    logger.debug(f"📊 تدفق أسعار حي: {event_body}")

            except json.JSONDecodeError:
                pass
            except Exception as e:
                logger.error(f"خطأ أثناء معالجة رسالة Socket.IO: {e}")

        # استدعاء دالة المعالجة الخارجية إذا كانت متوفرة
        if self.on_message_callback:
            try:
                self.on_message_callback(message)
            except Exception as e:
                logger.error(f"خطأ في on_message_callback: {e}")

    async def _message_listener(self):
        """
        حلقة الاستماع المستمرة للرسائل الواردة
        """
        try:
            async for message in self.ws:
                await self._handle_incoming_message(message)
        except websockets.exceptions.ConnectionClosed as e:
            logger.warning(f"⚠️ تم قطع الاتصال من قبل الخادم (Code: {e.code}, Reason: {e.reason})")
        except Exception as e:
            logger.error(f"⚠️ انقطاع غير متوقع في قناة الاستماع: {e}")
        finally:
            self.is_connected = False
            self.is_authenticated = False

    async def single_connect(self) -> bool:
        """
        محاولة اتصال واحدة بالخادم الحالي
        """
        endpoint = self.get_current_endpoint()
        logger.info(f"🌐 جاري محاولة الاتصال بـ Pocket Option: {endpoint}")

        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
            "Origin": "https://pocketoption.com"
        }

        try:
            self.ws = await websockets.connect(
                endpoint,
                extra_headers=headers,
                ping_interval=None,  # ندير الـ Ping بأنفسنا عبر _send_keep_alive
                close_timeout=10,
                open_timeout=10
            )
            self.is_connected = True
            logger.info("🔗 تم فتح قناة WebSocket بنجاح مع Pocket Option!")

            # إرسال حزمة المصادقة فوراً بعد فتح القناة
            await self._authenticate()

            # بدء مهام الاستماع ونبضات Keep-Alive
            self.listener_task = asyncio.create_task(self._message_listener())
            self.keep_alive_task = asyncio.create_task(self._send_keep_alive())

            # انتظار قصير للتأكد من نجاح المصادقة الأولية
            for _ in range(10):
                if self.is_authenticated:
                    return True
                if not self.is_connected:
                    return False
                await asyncio.sleep(0.5)

            return self.is_connected

        except Exception as e:
            logger.error(f"❌ فشل الاتصال بالخادم {endpoint}: {e}")
            self.is_connected = False
            self.is_authenticated = False
            return False

    async def connect(self):
        """
        الدالة الرئيسية للاتصال مع نظام إعادة المحاولة التلقائي (Auto-Reconnect Loop)
        تحاول الاتصال حتى 3 محاولات، وإذا استمر خطأ NotAuthorized، تتحول للحساب التجريبي.
        """
        self._stop_requested = False
        reconnect_count = 0

        # فحص وتنبيه عنوان الـ IP أولاً
        IPBindingChecker.verify_and_warn()

        while not self._stop_requested:
            try:
                success = await self.single_connect()
                if success:
                    reconnect_count = 0
                    logger.info("🚀 الاتصال مستقر ومستمر بنجاح.")
                    # ننتظر مهمة الاستماع حتى تنتهي (عند انقطاع الاتصال)
                    if self.listener_task:
                        await self.listener_task
                else:
                    reconnect_count += 1
                    logger.warning(f"⚠️ محاولة الاتصال غير ناجحة. المحاولة ({reconnect_count}/{self.max_reconnect_attempts})")

            except Exception as e:
                reconnect_count += 1
                logger.error(f"حدث خطأ أثناء الاتصال: {e}")

            # تنظيف المهام السابقة
            if self.keep_alive_task and not self.keep_alive_task.done():
                self.keep_alive_task.cancel()

            if self._stop_requested:
                break

            # التحقق من عدد المحاولات وإجراءات الاستشفاء الذاتي
            if reconnect_count >= self.max_reconnect_attempts:
                logger.warning(
                    f"⚠️ فشلت {self.max_reconnect_attempts} محاولات متتالية. "
                    "جاري تدوير الخادم والتحول للوضع التجريبي (Demo Mode) لضمان عدم توقف البوت..."
                )
                self.rotate_endpoint()
                self.is_demo = 1
                reconnect_count = 0  # تصفير العداد للمحاولة الجديدة

            logger.info(f"⏳ الانتظار {self.reconnect_delay} ثوانٍ قبل إعادة الاتصال التلقائي...")
            await asyncio.sleep(self.reconnect_delay)

    async def disconnect(self):
        """
        قطع الاتصال الآمن وإلغاء المهام بالخلفية
        """
        logger.info("🛑 إيقاف مدير الاتصال وقطع الجلسة...")
        self._stop_requested = True
        if self.keep_alive_task and not self.keep_alive_task.done():
            self.keep_alive_task.cancel()
        if self.ws:
            try:
                await self.ws.close()
            except Exception:
                pass
        self.is_connected = False
        self.is_authenticated = False
        logger.info("تم قطع الاتصال بنجاح.")


# دالة تجريبية لتشغيل الملف مباشرة من التيرمينال أو بيئة Termux
async def main():
    print("""
    ==================================================
        🚀 Pocket Option Resilient Connection Manager
        مدير الاتصال المتين لبوت Pocket Option
    ==================================================
    """)

    sample_ssid = '42["auth",{"session":"demo_session_sample_1234567890abcdef","isDemo":1,"uid":0,"platform":2}]'
    if len(sys.argv) > 1:
        sample_ssid = sys.argv[1]

    # إنشاء نسخة من مدير الاتصال
    manager = PocketOptionConnectionManager(
        raw_ssid=sample_ssid,
        is_demo=1,             # 1 = تجريبي (Demo), 0 = حقيقي (Live)
        ping_interval=25,      # إرسال Ping كل 25 ثانية
        max_reconnect_attempts=3,
        reconnect_delay=5
    )

    try:
        await manager.connect()
    except KeyboardInterrupt:
        logger.info("\nتم تلقي أمر الإيقاف عبر لوحة المفاتيح (Ctrl+C).")
        await manager.disconnect()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
