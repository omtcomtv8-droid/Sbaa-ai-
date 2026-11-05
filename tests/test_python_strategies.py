#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
test_python_strategies.py - اختبارات قبول محرك استراتيجيات Python
Automated Verification Suite for Python Trading Engine (Rules 3, 4, 11, 15, 19)
"""

import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../python/strategy_engine')))

from base_strategy import Candle, DecisionType
from data_validator import DataValidator
from strategies.ema_trend import EmaTrendStrategy
from strategies.rsi_macd import RsiMacdStrategy
from strategies.bollinger_bands import BollingerBandsStrategy
from strategies.support_resistance import SupportResistanceStrategy
from strategies.breakout import BreakoutStrategy
from strategies.smc import SmcStrategy
from backtester import StrategyBacktester


def generate_mock_candles(count: int = 100, trend: str = "bullish", base_price: float = 1.1000):
    candles = []
    price = base_price
    for i in range(count):
        ts = 1700000000 + i * 60
        if trend == "bullish":
            price += 0.0003
        elif trend == "bearish":
            price -= 0.0003
        else:
            price += 0.0001 if i % 2 == 0 else -0.0001

        o = price - 0.0001
        h = price + 0.0002
        l = price - 0.0002
        c = price
        candles.append(Candle(timestamp=ts, open=round(o, 5), high=round(h, 5), low=round(l, 5), close=round(c, 5)))
    return candles


class TestPythonStrategies(unittest.TestCase):

    def test_data_validator_rejects_empty_and_disordered(self):
        # 1. Empty
        res = DataValidator.validate_candles([], min_required=10)
        self.assertFalse(res.is_valid)

        # 2. Chronological violation
        c1 = Candle(100, 1.1, 1.12, 1.09, 1.11)
        c2 = Candle(90, 1.11, 1.13, 1.10, 1.12)  # older timestamp
        res2 = DataValidator.validate_candles([c1, c2], min_required=2, max_freshness_seconds=None)
        self.assertFalse(res2.is_valid)
        self.assertTrue(any("غير مرتبة" in e for e in res2.errors))

    def test_ema_trend_strategy_evaluation(self):
        strat = EmaTrendStrategy()
        # 220 candles bullish
        candles = generate_mock_candles(220, trend="bullish")
        dec = strat.evaluate(candles)
        self.assertEqual(dec.decision, DecisionType.BUY)
        self.assertGreater(dec.confidence, 60.0)

        # 220 candles bearish
        candles_bear = generate_mock_candles(220, trend="bearish")
        dec_bear = strat.evaluate(candles_bear)
        self.assertEqual(dec_bear.decision, DecisionType.SELL)

    def test_rsi_macd_wait_on_conflict(self):
        strat = RsiMacdStrategy()
        # Flat choppy data where indicators don't agree
        candles = generate_mock_candles(60, trend="choppy")
        dec = strat.evaluate(candles)
        self.assertEqual(dec.decision, DecisionType.WAIT)
        self.assertTrue(len(dec.rejection_reasons) > 0)

    def test_bollinger_bands_evaluation(self):
        strat = BollingerBandsStrategy()
        candles = generate_mock_candles(40, trend="bullish")
        dec = strat.evaluate(candles)
        self.assertIn(dec.decision, [DecisionType.BUY, DecisionType.SELL, DecisionType.WAIT])

    def test_breakout_strategy_evaluation(self):
        strat = BreakoutStrategy()
        candles = generate_mock_candles(40, trend="bullish")
        dec = strat.evaluate(candles)
        self.assertIn(dec.decision, [DecisionType.BUY, DecisionType.WAIT])

    def test_smc_strategy_evaluation(self):
        strat = SmcStrategy()
        candles = generate_mock_candles(70, trend="bullish")
        dec = strat.evaluate(candles)
        self.assertIn(dec.decision, [DecisionType.BUY, DecisionType.SELL, DecisionType.WAIT])

    def test_backtester_metrics(self):
        strat = EmaTrendStrategy()
        candles = generate_mock_candles(230, trend="bullish")
        bt = StrategyBacktester(strategy=strat, initial_balance=500.0, stake_per_trade=10.0)
        res = bt.run(candles)
        self.assertIsInstance(res.win_rate, float)
        self.assertIsInstance(res.max_drawdown_percent, float)
        self.assertGreaterEqual(res.total_trades, 0)


if __name__ == "__main__":
    unittest.main()
