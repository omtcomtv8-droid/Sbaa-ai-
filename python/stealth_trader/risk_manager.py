#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
risk_manager.py - وحدة إدارة المخاطر وحماية رأس المال
Algorithmic Trading Risk Management Module
=====================================================
"""

import logging
from dataclasses import dataclass
from typing import Optional, Tuple

logger = logging.getLogger("RiskManager")


@dataclass
class RiskStatus:
    allowed: bool
    reason: str
    suggested_amount: float


class RiskManager:
    """
    نظام إدارة المخاطر الصارم:
    - إيقاف التداول عند وصول حد الخسارة اليومي (Daily Stop-Loss).
    - تأمين الأرباح عند وصول الهدف اليومي (Daily Take-Profit).
    - ضبط مستويات المارتينجال بحد أقصى (Max Martingale Depth) لمنع تصفير الحساب.
    """

    def __init__(
        self,
        base_amount: float = 10.0,
        max_amount: float = 50.0,
        daily_stop_loss: float = 30.0,
        daily_take_profit: float = 50.0,
        use_martingale: bool = False,
        martingale_multiplier: float = 2.0,
        max_martingale_depth: int = 2
    ):
        self.base_amount = base_amount
        self.max_amount = max_amount
        self.daily_stop_loss = daily_stop_loss
        self.daily_take_profit = daily_take_profit
        self.use_martingale = use_martingale
        self.martingale_multiplier = martingale_multiplier
        self.max_martingale_depth = max_martingale_depth

        # الإحصاءات اليومية
        self.daily_pnl = 0.0          # صافي الربح / الخسارة اليومي
        self.total_trades = 0
        self.winning_trades = 0
        self.losing_trades = 0
        self.current_martingale_step = 0
        self.is_circuit_breaker_tripped = False
        self.trip_reason = ""

    def evaluate_pre_trade(self) -> RiskStatus:
        """
        التحقق الصارم قبل السماح للبوت بفتح أي صفقة جديدة
        """
        # 1. فحص قاطع الدائرة التلقائي (Circuit Breaker)
        if self.is_circuit_breaker_tripped:
            return RiskStatus(
                allowed=False,
                reason=f"🛑 قاطع الدائرة نشط: {self.trip_reason}",
                suggested_amount=0.0
            )

        # 2. فحص حد الخسارة اليومي (Stop-Loss)
        if self.daily_pnl <= -abs(self.daily_stop_loss):
            self.is_circuit_breaker_tripped = True
            self.trip_reason = f"تم الوصول لحد أقصى خسارة يومية (-${abs(self.daily_pnl):.2f})"
            logger.warning(f"🚨 [إدارة المخاطر]: {self.trip_reason}. إيقاف الصفقات فوراً!")
            return RiskStatus(allowed=False, reason=self.trip_reason, suggested_amount=0.0)

        # 3. فحص هدف الربح اليومي (Take-Profit)
        if self.daily_pnl >= abs(self.daily_take_profit):
            self.is_circuit_breaker_tripped = True
            self.trip_reason = f"تم تحقيق هدف الربح اليومي بنجاح (+${self.daily_pnl:.2f})"
            logger.info(f"🏆 [إدارة المخاطر]: {self.trip_reason}. إيقاف التداول وتأمين الأرباح!")
            return RiskStatus(allowed=False, reason=self.trip_reason, suggested_amount=0.0)

        # 4. حساب مبلغ الصفقة وفقاً لحالة المارتينجال
        calculated_amount = self.base_amount
        if self.use_martingale and self.current_martingale_step > 0:
            step = min(self.current_martingale_step, self.max_martingale_depth)
            calculated_amount = self.base_amount * (self.martingale_multiplier ** step)

        # ضبط السقف الأعلى للمبلغ
        final_amount = min(calculated_amount, self.max_amount)

        return RiskStatus(
            allowed=True,
            reason="جاهز لتنفيذ الصفقة ضمن معايير إدارة المخاطر",
            suggested_amount=final_amount
        )

    def record_trade_result(self, is_win: bool, profit_or_loss: float):
        """
        تسجيل نتيجة الصفقة وتحديث مؤشرات المخاطرة والمارتينجال
        """
        self.total_trades += 1
        self.daily_pnl += profit_or_loss

        if is_win:
            self.winning_trades += 1
            logger.info(
                f"✅ [نتيجة رابحة]: +${profit_or_loss:.2f} | صافي اليوم: ${self.daily_pnl:+.2f}"
            )
            # إعادة ضبط المارتينجال إلى الخطوة الأساسية
            self.current_martingale_step = 0
        else:
            self.losing_trades += 1
            logger.warning(
                f"❌ [نتيجة خاسرة]: -${abs(profit_or_loss):.2f} | صافي اليوم: ${self.daily_pnl:+.2f}"
            )
            # تصعيد خطوة المارتينجال إذا كانت مفعلة ولم تتجاوز الحد الأقصى
            if self.use_martingale:
                if self.current_martingale_step < self.max_martingale_depth:
                    self.current_martingale_step += 1
                    logger.info(
                        f"📈 تصعيد المارتينجال إلى الخطوة {self.current_martingale_step}/"
                        f"{self.max_martingale_depth}"
                    )
                else:
                    logger.warning("⚠️ تم الوصول للحد الأقصى لعمق المارتينجال، العودة للمبلغ الأساسي!")
                    self.current_martingale_step = 0

    def get_summary(self) -> str:
        win_rate = (
            (self.winning_trades / self.total_trades * 100.0)
            if self.total_trades > 0
            else 0.0
        )
        return (
            f"إجمالي الصفقات: {self.total_trades} | رابحة: {self.winning_trades} | "
            f"خاسرة: {self.losing_trades} | نسبة الفوز: {win_rate:.1f}% | "
            f"صافي PnL: ${self.daily_pnl:+.2f}"
        )
