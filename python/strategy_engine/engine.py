#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
engine.py - المحرك الموحد للاستراتيجيات والاختبار التاريخي
Unified Strategy Engine & Execution Controller
==============================================
"""

import json
import os
import sys
from typing import Any, Dict, List, Optional

# إضافة المسار الحالي لاستيراد الوحدات
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)

from base_strategy import BaseStrategy, Candle, DecisionType, StrategyDecision
from data_validator import DataValidator, DataValidationResult
from backtester import StrategyBacktester, BacktestResult
from strategies.ema_trend import EmaTrendStrategy
from strategies.rsi_macd import RsiMacdStrategy
from strategies.bollinger_bands import BollingerBandsStrategy
from strategies.support_resistance import SupportResistanceStrategy
from strategies.breakout import BreakoutStrategy
from strategies.smc import SmcStrategy


class StrategyRegistry:
    """سجل الاستراتيجيات المعتمدة"""

    def __init__(self):
        self._strategies: Dict[str, BaseStrategy] = {
            "ema_trend": EmaTrendStrategy(),
            "rsi_macd": RsiMacdStrategy(),
            "bollinger_bands": BollingerBandsStrategy(),
            "support_resistance": SupportResistanceStrategy(),
            "breakout": BreakoutStrategy(),
            "smc": SmcStrategy()
        }

    def get(self, strategy_id: str) -> Optional[BaseStrategy]:
        clean_id = strategy_id.lower().strip().replace(" ", "_").replace("&", "").replace("+", "_")
        for k, v in self._strategies.items():
            if k == clean_id or k in clean_id or clean_id in k:
                return v
        return None

    def list_all(self) -> List[Dict[str, Any]]:
        return [
            {"id": k, **v.get_metadata()}
            for k, v in self._strategies.items()
        ]


class TradingEngine:
    """المحرك الرئيسي لتشغيل وتقييم واختبار الاستراتيجيات"""

    def __init__(self):
        self.registry = StrategyRegistry()
        self.validator = DataValidator()

    def analyze(
        self,
        strategy_id: str,
        candles_raw: List[Dict[str, Any]],
        symbol: str = "EURUSD_otc",
        timeframe: int = 60
    ) -> Dict[str, Any]:
        strategy = self.registry.get(strategy_id)
        if not strategy:
            return {
                "decision": "WAIT",
                "confidence": 0.0,
                "reason": f"الاستراتيجية المطلوبة '{strategy_id}' غير مسجلة في المحرك.",
                "rejection_reasons": ["استراتيجية غير معروفة"],
                "indicators": {},
                "symbol": symbol,
                "timeframe": timeframe
            }

        candles = [
            Candle(
                timestamp=int(c.get("timestamp") or c.get("time") or 0),
                open=float(c["open"]),
                high=float(c["high"]),
                low=float(c["low"]),
                close=float(c["close"]),
                volume=float(c.get("volume", 1.0))
            )
            for c in candles_raw
        ]

        # 1. تدقيق جودة وحداثة البيانات أولاً
        val_res = self.validator.validate_candles(
            candles=candles,
            min_required=strategy.min_candles_required(),
            max_freshness_seconds=900,
            expected_timeframe_sec=timeframe
        )

        if not val_res.is_valid:
            return {
                "decision": "WAIT",
                "confidence": 0.0,
                "reason": "فشل فحص سلامة البيانات: بيانات الأسعار ناقصة أو قديمة",
                "rejection_reasons": val_res.errors,
                "indicators": {},
                "symbol": symbol,
                "timeframe": timeframe,
                "data_valid": False
            }

        # 2. تقييم الاستراتيجية بالبيانات النظيفة
        decision: StrategyDecision = strategy.evaluate(val_res.clean_candles)

        return {
            "decision": decision.decision.value,
            "confidence": decision.confidence,
            "reason": decision.reason,
            "rejection_reasons": decision.rejection_reasons,
            "indicators": decision.indicators,
            "strategy_name": decision.strategy_name,
            "strategy_version": decision.strategy_version,
            "symbol": symbol,
            "timeframe": timeframe,
            "data_valid": True,
            "candles_analyzed": len(val_res.clean_candles)
        }

    def backtest(
        self,
        strategy_id: str,
        candles_raw: List[Dict[str, Any]],
        initial_balance: float = 1000.0,
        stake: float = 10.0,
        payout_ratio: float = 0.88
    ) -> Dict[str, Any]:
        candles = [
            Candle(
                timestamp=int(c.get("timestamp") or c.get("time") or 0),
                open=float(c["open"]),
                high=float(c["high"]),
                low=float(c["low"]),
                close=float(c["close"]),
                volume=float(c.get("volume", 1.0))
            )
            for c in candles_raw
        ]

        # إذا طلب مقارنة كل الاستراتيجيات
        if strategy_id.lower() in ["all", "compare", "matrix"]:
            results = []
            for strat_info in self.registry.list_all():
                strat = self.registry.get(strat_info["id"])
                if strat:
                    bt = StrategyBacktester(
                        strategy=strat,
                        initial_balance=initial_balance,
                        stake_per_trade=stake,
                        payout_ratio=payout_ratio
                    )
                    res = bt.run(candles)
                    results.append({
                        "id": strat_info["id"],
                        "name": res.strategy_name,
                        "trades": res.total_trades,
                        "wins": res.winning_trades,
                        "losses": res.losing_trades,
                        "win_rate": res.win_rate,
                        "net_profit": res.net_profit,
                        "profit_factor": res.profit_factor,
                        "max_drawdown": res.max_drawdown_percent
                    })
            return {"mode": "COMPARISON", "results": results}

        # اختبار استراتيجية منفردة
        strat = self.registry.get(strategy_id)
        if not strat:
            return {"error": f"استراتيجية غير معروفة: {strategy_id}"}

        bt = StrategyBacktester(
            strategy=strat,
            initial_balance=initial_balance,
            stake_per_trade=stake,
            payout_ratio=payout_ratio
        )
        res = bt.run(candles)

        return {
            "mode": "SINGLE",
            "strategy": res.strategy_name,
            "total_candles": res.total_candles,
            "total_trades": res.total_trades,
            "winning_trades": res.winning_trades,
            "losing_trades": res.losing_trades,
            "win_rate": res.win_rate,
            "net_profit": res.net_profit,
            "profit_factor": res.profit_factor,
            "max_drawdown_percent": res.max_drawdown_percent,
            "max_drawdown_usd": res.max_drawdown_usd,
            "avg_win": res.avg_win,
            "avg_loss": res.avg_loss,
            "disclaimer": res.disclaimer,
            "recent_trades": [
                {
                    "entry_time": t.entry_time,
                    "action": t.action,
                    "entry_price": t.entry_price,
                    "exit_price": t.exit_price,
                    "pnl": t.pnl,
                    "is_win": t.is_win,
                    "reason": t.reason
                }
                for t in res.trades[-20:]
            ]
        }


def main():
    """واجهة سطر الأوامر والتواصل عبر JSON"""
    engine = TradingEngine()

    if len(sys.argv) > 1 and sys.argv[1] == "--list":
        print(json.dumps(engine.registry.list_all(), ensure_ascii=False, indent=2))
        return

    # استقبال الأمر والبيانات عبر stdin بتنسيق JSON
    try:
        raw_input = sys.stdin.read()
        if not raw_input.strip():
            print(json.dumps({"error": "No input JSON provided on stdin"}))
            return

        payload = json.loads(raw_input)
        command = payload.get("command", "analyze")

        if command == "analyze":
            res = engine.analyze(
                strategy_id=payload.get("strategy", "confluence"),
                candles_raw=payload.get("candles", []),
                symbol=payload.get("symbol", "EURUSD_otc"),
                timeframe=payload.get("timeframe", 60)
            )
            print(json.dumps(res, ensure_ascii=False))

        elif command == "backtest":
            res = engine.backtest(
                strategy_id=payload.get("strategy", "ema_trend"),
                candles_raw=payload.get("candles", []),
                initial_balance=payload.get("initial_balance", 1000.0),
                stake=payload.get("stake", 10.0),
                payout_ratio=payload.get("payout", 0.88)
            )
            print(json.dumps(res, ensure_ascii=False))

        elif command == "list_strategies":
            print(json.dumps(engine.registry.list_all(), ensure_ascii=False))

        else:
            print(json.dumps({"error": f"Unknown command: {command}"}))

    except Exception as e:
        print(json.dumps({"error": str(e)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
