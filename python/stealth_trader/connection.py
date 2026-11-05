#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
connection.py - مدير الاتصال وجلسات WebSocket لـ Pocket Option
Pocket Option WebSocket Transport & Protocol Manager
======================================================
"""

import asyncio
import json
import logging
import re
import sys
import time
from typing import Any, Callable, Dict, List, Optional

logger = logging.getLogger("POConnection")

try:
    import websockets
except ImportError:
    logger.error("مكتبة 'websockets' غير مثبتة! يرجى تثبيتها عبر: pip install websockets")
    websockets = None


class SSIDValidator:
    """
    التحقق الصارم من SSID وبناء الهيكل الرسمي لحزمة Pocket Option
    """

    @staticmethod
    def format_auth_packet(
        raw_ssid: str,
        is_demo: int = 1,
        uid: int = 0,
        platform: int = 2
    ) -> Dict[str, Any]:
        """
        تحويل أي مدخل إلى حزمة مصادقة Socket.IO كاملة وصحيحة:
        42["auth", {"session": "...", "isDemo": 1, "uid": 0, "platform": 2}]
        """
        clean = (raw_ssid or "").strip()
        session_token = ""
        resolved_demo = is_demo
        resolved_uid = uid
        resolved_platform = platform

        # الحالة 1: إدخال حزمة كاملة تبدأ بـ 42["auth"
        if clean.startswith('42["auth"') or clean.startswith("42['auth'"):
            try:
                json_part = clean[2:]
                parsed = json.loads(json_part)
                if len(parsed) >= 2 and isinstance(parsed[1], dict):
                    body = parsed[1]
                    session_token = body.get("session", "")
                    resolved_demo = int(body.get("isDemo", is_demo))
                    resolved_uid = int(body.get("uid", uid))
                    resolved_platform = int(body.get("platform", platform))
            except Exception as e:
                logger.warning(f"تعذر استخراج JSON من حزمة Socket.IO: {e}")

        # الحالة 2: إذا لم يستخرج التوكن، البحث عن توكن الجلسة الأبجدي الرقمي
        if not session_token:
            token_match = re.search(r'([a-zA-Z0-9_\-]{20,64})', clean)
            if token_match:
                session_token = token_match.group(1)
            else:
                session_token = clean

        session_token = session_token.strip('"\'')

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


class PocketOptionConnection:
    """
    مدير اتصال WebSocket خفيف ومتين:
    - اتصال بالخوادم الرسمية
    - نبضات إبقاء الاتصال حياً (Keep-Alive) كل 20-30 ثانية
    - إعادة محاولة تلقائية (Auto-Reconnect) مع التحول للحساب التجريبي عند استمرار NotAuthorized
    - إرسال وتنفيذ الصفقات ومتابعة النتائج
    """

    def __init__(
        self,
        raw_ssid: str,
        is_demo: int = 1,
        endpoints: Optional[List[str]] = None,
        ping_interval: int = 25,
        max_reconnect_attempts: int = 3,
        reconnect_delay: int = 5,
        headers: Optional[Dict[str, str]] = None
    ):
        self.raw_ssid = raw_ssid
        self.is_demo = is_demo
        self.endpoints = endpoints or [
            "wss://api-eu.po.market/socket.io/?EIO=4&transport=websocket",
            "wss://api-us-north.po.market/socket.io/?EIO=4&transport=websocket",
            "wss://api-asia.po.market/socket.io/?EIO=4&transport=websocket"
        ]
        self.ping_interval = ping_interval
        self.max_reconnect_attempts = max_reconnect_attempts
        self.reconnect_delay = reconnect_delay
        self.headers = headers or {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0",
            "Origin": "https://pocketoption.com"
        }

        self.ws = None
        self.is_connected = False
        self.is_authenticated = False
        self.current_endpoint_idx = 0
        self.balance: Optional[float] = None
        self.user_profile: Dict[str, Any] = {}
        self.active_deals: Dict[str, Any] = {}
        self.request_counter = 1000

        self.keep_alive_task: Optional[asyncio.Task] = None
        self.listener_task: Optional[asyncio.Task] = None
        self._stop_event = asyncio.Event()

        # استدعاءات خارجية (Callbacks)
        self.on_deal_result: Optional[Callable[[Dict[str, Any]], Any]] = None

    def get_active_endpoint(self) -> str:
        return self.endpoints[self.current_endpoint_idx % len(self.endpoints)]

    def rotate_endpoint(self):
        self.current_endpoint_idx += 1
        logger.info(f"🔄 التحول للخادم التالي: {self.get_active_endpoint()}")

    async def _send_keep_alive_loop(self):
        """إرسال Ping كل 20-30 ثانية لمنع الخادم من إغلاق الاتصال"""
        logger.info(f"💓 تفعيل خدمة إبقاء الاتصال حياً (Keep-Alive) كل {self.ping_interval} ثانية...")
        try:
            while not self._stop_event.is_set() and self.is_connected and self.ws:
                await asyncio.sleep(self.ping_interval)
                if not self.is_connected or not self.ws:
                    break
                try:
                    # 1. إرسال Socket.IO ping
                    await self.ws.send('42["ping"]')
                    # 2. إرسال Engine.IO ping packet '2'
                    await self.ws.send('2')
                    logger.debug("💓 تم إرسال نبضة Ping بنجاح.")
                except Exception as e:
                    logger.warning(f"⚠️ فشل إرسال نبضة Ping: {e}")
                    break
        except asyncio.CancelledError:
            pass

    async def _send_auth(self):
        """إرسال حزمة المصادقة بالصيغة الرسمية"""
        formatted = SSIDValidator.format_auth_packet(self.raw_ssid, is_demo=self.is_demo)
        logger.info(f"🔑 إرسال حزمة المصادقة الرسمية (isDemo: {self.is_demo})...")
        await self.ws.send(formatted["packet"])

    async def _handle_message(self, raw_msg: str):
        """معالجة رسائل Engine.IO و Socket.IO الواردة من السيرفر"""
        # الرد على طلب السيرفر Engine.IO Ping '2' بإرسال Pong '3'
        if raw_msg == "2":
            await self.ws.send("3")
            return

        # رسائل أحداث Socket.IO
        if raw_msg.startswith("42"):
            try:
                data = json.loads(raw_msg[2:])
                event_name = data[0] if len(data) > 0 else ""
                event_body = data[1] if len(data) > 1 else {}

                # 1. نجاح المصادقة
                if event_name in ["successauth", "auth", "profile", "success_auth"]:
                    self.is_authenticated = True
                    self.user_profile = event_body if isinstance(event_body, dict) else {}
                    self.balance = self.user_profile.get("balance", self.balance)
                    logger.info(f"✅ تم تأكيد المصادقة! الرصيد: {self.balance} (isDemo: {self.is_demo})")

                # 2. رفض المصادقة NotAuthorized
                elif "notauthorized" in event_name.lower() or "notauthorized" in str(event_body).lower():
                    logger.error(f"❌ خطأ NotAuthorized: تم رفض الجلسة من قبل بوابة Pocket Option.")
                    self.is_authenticated = False
                    if self.is_demo == 0:
                        logger.warning("🔄 التحول التلقائي للوضع التجريبي (isDemo=1) لاستمرار عمل الصفقات...")
                        self.is_demo = 1
                        await self._send_auth()

                # 3. نجاح فتح الصفقة
                elif event_name in ["successopenOrder", "openOrder"]:
                    deal_id = event_body.get("id") or event_body.get("dealId")
                    logger.info(
                        f"🎉 [تم فتح الصفقة بنجاح]: تذكرة #{deal_id} | "
                        f"الأصل: {event_body.get('asset')} | "
                        f"المبلغ: ${event_body.get('amount')} | "
                        f"سعر الفتح: {event_body.get('openPrice')}"
                    )
                    if deal_id:
                        self.active_deals[str(deal_id)] = event_body

                # 4. فشل فتح الصفقة
                elif event_name in ["failopenOrder"]:
                    logger.error(f"❌ [فشل تنفيذ الصفقة]: {event_body}")

                # 5. إغلاق الصفقة ونتيجتها (ربح / خسارة)
                elif event_name in ["closeOrder", "deals_close"]:
                    logger.info(f"🏁 [إغلاق الصفقة وصدور النتيجة]: {event_body}")
                    deal_id = str(event_body.get("id") or "")
                    if deal_id in self.active_deals:
                        self.active_deals.pop(deal_id, None)

                    if self.on_deal_result:
                        try:
                            self.on_deal_result(event_body)
                        except Exception as e:
                            logger.error(f"خطأ في رد نداء نتيجة الصفقة: {e}")

            except Exception as e:
                logger.debug(f"تجاهل خطأ تحليل حزمة: {e}")

    async def _listen_loop(self):
        """حلقة الاستماع المستمر للرسائل الواردة"""
        try:
            async for msg in self.ws:
                await self._handle_message(msg)
        except websockets.exceptions.ConnectionClosed as e:
            logger.warning(f"⚠️ أُغلق الاتصال من الخادم: {e.reason or e.code}")
        except Exception as e:
            logger.error(f"خطأ غير متوقع في قناة الاستماع: {e}")
        finally:
            self.is_connected = False
            self.is_authenticated = False

    async def single_connect(self) -> bool:
        """محاولة فتح جلسة واحدة"""
        if not websockets:
            return False

        endpoint = self.get_active_endpoint()
        logger.info(f"🌐 جاري الاتصال بخادم Pocket Option: {endpoint}")

        try:
            self.ws = await websockets.connect(
                endpoint,
                extra_headers=self.headers,
                ping_interval=None,
                open_timeout=10,
                close_timeout=10
            )
            self.is_connected = True
            logger.info("🔗 تم تأسيس قناة WebSocket بنجاح.")

            await self._send_auth()

            self.listener_task = asyncio.create_task(self._listen_loop())
            self.keep_alive_task = asyncio.create_task(self._send_keep_alive_loop())

            # انتظار قصير لتأكيد استجابة المصادقة
            for _ in range(8):
                if self.is_authenticated:
                    return True
                if not self.is_connected:
                    return False
                await asyncio.sleep(0.5)

            return self.is_connected
        except Exception as e:
            logger.error(f"فشل الاتصال بـ {endpoint}: {e}")
            self.is_connected = False
            self.is_authenticated = False
            return False

    async def start(self):
        """بدء الاتصال مع دورة إعادة المحاولة التلقائية"""
        self._stop_event.clear()
        attempts = 0

        while not self._stop_event.is_set():
            ok = await self.single_connect()
            if ok:
                attempts = 0
                logger.info("🚀 اتصال السوكيت مستقر ومستمر.")
                if self.listener_task:
                    await self.listener_task
            else:
                attempts += 1
                logger.warning(f"محاولة اتصال فاشلة ({attempts}/{self.max_reconnect_attempts})")

            if self.keep_alive_task and not self.keep_alive_task.done():
                self.keep_alive_task.cancel()

            if self._stop_event.is_set():
                break

            if attempts >= self.max_reconnect_attempts:
                logger.warning(
                    f"⚠️ استمرار الفشل بعد {self.max_reconnect_attempts} محاولات. "
                    "جاري التدوير للخادم البديل والتحول للوضع التجريبي (Demo) فوراً..."
                )
                self.rotate_endpoint()
                self.is_demo = 1
                attempts = 0

            await asyncio.sleep(self.reconnect_delay)

    async def place_order(
        self,
        asset: str,
        amount: float,
        action: str,
        duration_seconds: int = 60
    ) -> bool:
        """
        إرسال أمر فتح صفقة تداول حقيقي لمنصة Pocket Option
        action: "call" (شراء/صعود) أو "put" (بيع/هبوط)
        """
        if not self.is_connected or not self.ws:
            logger.error("❌ لا يمكن تنفيذ الصفقة: السوكيت غير متصل حالياً!")
            return False

        self.request_counter += 1
        order_payload = {
            "asset": asset,
            "amount": round(amount, 2),
            "action": action.lower(),
            "isDemo": self.is_demo,
            "requestId": self.request_counter,
            "optionType": 100,
            "time": duration_seconds
        }

        packet = f'42["openOrder",{json.dumps(order_payload, separators=(",", ":"))}]'
        logger.info(
            f"⚡ [إرسال صفقة فورية]: {action.upper()} على {asset} | "
            f"مبلغ: ${amount:.2f} | مدة: {duration_seconds}s | حساب: {'تجريبي' if self.is_demo else 'حقيقي'}"
        )

        try:
            await self.ws.send(packet)
            return True
        except Exception as e:
            logger.error(f"❌ خطأ أثناء إرسال أمر الصفقة: {e}")
            return False

    async def stop(self):
        """إيقاف الاتصال والمهام بأمان"""
        self._stop_event.set()
        if self.keep_alive_task and not self.keep_alive_task.done():
            self.keep_alive_task.cancel()
        if self.ws:
            try:
                await self.ws.close()
            except Exception:
                pass
        self.is_connected = False
        self.is_authenticated = False
        logger.info("🛑 تم قطع اتصال WebSocket بنجاح.")
