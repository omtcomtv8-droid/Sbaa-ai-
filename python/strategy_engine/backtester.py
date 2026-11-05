#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
backtester.py - محرك الاختبار التاريخي المتقدم للاستراتيجيات (Backtester)
Rule 11: Chronological, No Look-Ahead Bias, Drawdown & Profit Factor Metrics
"""

import math
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional
from base_strategy import BaseStrategy, Candle, DecisionType


@dataclass
class BacktestTrade:
    entry_index: int
    entry_time: int
    exit_time: int
    action: str  # "BUY" or "SELL"
    entry_price: float
    exit_price: float
    stake: float
    pnl: float
    is_win: bool
    reason: str


@dataclass
class BacktestResult:
    strategy_name: str
    total_candles: int
    total_trades: int
    winning_trades: int
    losing_trades: int
    win_rate: float
    net_profit: float
    profit_factor: float
    max_drawdown_percent: float
    max_drawdown_usd: float
    avg_win: float
    avg_loss: float
    trades: List[BacktestTrade] = field(default_factory=list)
    disclaimer: str = "تنبيه هام: الأداء والنتائج التاريخية لا تشكل ضماناً للأرباح المستقبلية وتخضع لتقلبات السوق وظروف التنفيذ."


class StrategyBacktester:
    """
    محرك الاختبار التاريخي الخالي من التحيز المستقبلي:
    - يمرر الشموع تاريخياً شمعة بشمعة (No look-ahead bias).
    - يحسب نسبة العائد الرسمية لخيارات الباينري (Payout e.g. 85% - 92%).
    - يحسب Win Rate, Net PnL, Max Drawdown, Profit Factor.
    """

    def __init__(
        self,
        strategy: BaseStrategy,
        initial_balance: float = 1000.0,
        stake_per_trade: float = 10.0,
        payout_ratio: float = 0.88,  # 88% payout on OTC pairs
        expiry_candles: int = 1
    ):
        self.strategy = strategy
        self.initial_balance = initial_balance
        self.stake_per_trade = stake_per_trade
        self.payout_ratio = payout_ratio
        self.expiry_candles = expiry_candles

    def run(self, candles: List[Candle]) -> BacktestResult:
        min_req = self.strategy.min_candles_required()
        if len(candles) < min_req + self.expiry_candles:
            return BacktestResult(
                strategy_name=self.strategy.name,
                total_candles=len(candles),
                total_trades=0,
                winning_trades=0,
                losing_trades=0,
                win_rate=0.0,
                net_profit=0.0,
                profit_factor=0.0,
                max_drawdown_percent=0.0,
                max_drawdown_usd=0.0,
                avg_win=0.0,
                avg_loss=0.0,
                trades=[]
            )

        balance = self.initial_balance
        peak_balance = balance
        max_drawdown_usd = 0.0
        max_drawdown_pct = 0.0

        trades: List[BacktestTrade] = []
        gross_profit = 0.0
        gross_loss = 0.0

        i = min_req
        while i < len(candles) - self.expiry_candles:
            # تغذية الاستراتيجية فقط بالبيانات حتى اللحظة الحالية دون النظر للمستقبل
            historical_slice = candles[:i + 1]
            decision = self.strategy.evaluate(historical_slice)

            if decision.decision in [DecisionType.BUY, DecisionType.SELL]:
                entry_candle = candles[i]
                exit_candle = candles[i + self.expiry_candles]

                entry_price = entry_candle.close
                exit_price = exit_candle.close
                stake = self.stake_per_trade

                is_win = False
                if decision.decision == DecisionType.BUY:
                    is_win = exit_price > entry_price
                elif decision.decision == DecisionType.SELL:
                    is_win = exit_price < entry_price

                pnl = (stake * self.payout_ratio) if is_win else -stake
                balance += pnl

                if is_win:
                    gross_profit += pnl
                else:
                    gross_loss += abs(pnl)

                # حساب التراجع في رأس المال (Drawdown)
                if balance > peak_balance:
                    peak_balance = balance
                dd_usd = peak_balance - balance
                dd_pct = (dd_usd / peak_balance * 100.0) if peak_balance > 0 else 0.0

                if dd_usd > max_drawdown_usd:
                    max_drawdown_usd = dd_usd
                if dd_pct > max_drawdown_pct:
                    max_drawdown_pct = dd_pct

                trade = BacktestTrade(
                    entry_index=i,
                    entry_time=entry_candle.timestamp,
                    exit_time=exit_candle.timestamp,
                    action=decision.decision.value,
                    entry_price=entry_price,
                    exit_price=exit_price,
                    stake=stake,
                    pnl=round(pnl, 2),
                    is_win=is_win,
                    reason=decision.reason
                )
                trades.push(trade) if hasattr(trades, 'push') else trades.append(trade)

                # قفز بعد الشمعة المنتهية لتفادي التداخل
                i += self.expiry_candles
            else:
                i += 1

        total_trades = len(trades)
        winning_trades = sum(1 for t in trades if t.is_win)
        losing_trades = total_trades - winning_trades
        win_rate = (winning_trades / total_trades * 100.0) if total_trades > 0 else 0.0

        profit_factor = (gross_profit / gross_loss) if gross_loss > 0 else (99.0 if gross_profit > 0 else 0.0)
        avg_win = (gross_profit / winning_trades) if winning_trades > 0 else 0.0
        avg_loss = (gross_loss / losing_trades) if losing_trades > 0 else 0.0

        return BacktestResult(
            strategy_name=self.strategy.name,
            total_candles=len(candles),
            total_trades=total_trades,
            winning_trades=winning_trades,
            losing_trades=losing_trades,
            win_rate=round(win_rate, 1),
            net_profit=round(balance - self.initial_balance, 2),
            profit_factor=round(profit_factor, 2),
            max_drawdown_percent=round(max_drawdown_pct, 1),
            max_drawdown_usd=round(max_drawdown_usd, 2),
            avg_win=round(avg_win, 2),
            avg_loss=round(avg_loss, 2),
            trades=trades
        )
