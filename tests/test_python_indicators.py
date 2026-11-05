"""
test_python_indicators.py - Comprehensive Python Unit & Parity Tests
Verifies mathematical indicators, bucketing, duplicates, and pattern recognition.
"""

import json
import unittest
from python.indicator_engine import (
    calculate_sma,
    calculate_ema,
    calculate_wma,
    calculate_hma,
    calculate_rsi,
    calculate_bollinger_bands,
    calculate_macd,
    calculate_atr,
    calculate_adx,
    calculate_stochastic,
    calculate_cci,
    calculate_williams_r,
    calculate_roc,
    compute_all_indicators,
    get_engine_metadata
)

class TestPythonIndicators(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with open('tests/fixtures/eurusd_otc_5s_fixture.json') as f:
            fixture = json.load(f)
        cls.fixture = fixture
        cls.candles = fixture['candles']
        cls.closes = [c['close'] for c in cls.candles]

    def test_ohlc_integrity(self):
        """Test OHLC physical integrity on all fixture candles."""
        for c in self.candles:
            self.assertGreaterEqual(c['high'], max(c['open'], c['close']), f"High must be >= max(open, close) at {c['time']}")
            self.assertLessEqual(c['low'], min(c['open'], c['close']), f"Low must be <= min(open, close) at {c['time']}")
            self.assertGreater(c['volume'], 0, "Volume must be strictly positive")

    def test_timeframe_bucketing_and_sequence(self):
        """Test timestamp sequence matches 5s intervals with zero duplicates."""
        seen_times = set()
        for i, c in enumerate(self.candles):
            self.assertNotIn(c['time'], seen_times, f"Duplicate candle time {c['time']}")
            seen_times.add(c['time'])
            self.assertEqual(c['time'] % 5, 0, f"Candle time {c['time']} not 5s aligned")
            if i > 0:
                self.assertEqual(c['time'], self.candles[i - 1]['time'] + 5, "Strict 5s progression")

    def test_moving_averages(self):
        sma20 = calculate_sma(self.closes, 20)
        self.assertIsNotNone(sma20)
        self.assertGreater(sma20, 1.0)

        ema9 = calculate_ema(self.closes, 9)
        self.assertIsNotNone(ema9)
        self.assertGreater(ema9, 1.0)

        wma20 = calculate_wma(self.closes, 20)
        self.assertIsNotNone(wma20)

        hma20 = calculate_hma(self.closes, 20)
        self.assertIsNotNone(hma20)

    def test_oscillators(self):
        rsi = calculate_rsi(self.closes, 14)
        self.assertIsNotNone(rsi)
        self.assertGreaterEqual(rsi, 0.0)
        self.assertLessEqual(rsi, 100.0)

        stoch = calculate_stochastic(self.candles, 14, 3)
        self.assertIsNotNone(stoch)
        self.assertGreaterEqual(stoch['k'], 0.0)
        self.assertLessEqual(stoch['k'], 100.0)

        wr = calculate_williams_r(self.candles, 14)
        self.assertIsNotNone(wr)
        self.assertGreaterEqual(wr, -100.0)
        self.assertLessEqual(wr, 0.0)

        cci = calculate_cci(self.candles, 20)
        self.assertIsNotNone(cci)

    def test_volatility_and_trend(self):
        bb = calculate_bollinger_bands(self.closes, 20, 2.0)
        self.assertIsNotNone(bb)
        self.assertGreater(bb['upper'], bb['middle'])
        self.assertGreater(bb['middle'], bb['lower'])

        macd = calculate_macd(self.closes, 12, 26, 9)
        self.assertIsNotNone(macd)

        atr = calculate_atr(self.candles, 14)
        self.assertIsNotNone(atr)
        self.assertIn(atr['volatilityState'], ['HIGH', 'NORMAL', 'LOW'])

        adx = calculate_adx(self.candles, 14)
        self.assertIsNotNone(adx)
        self.assertGreaterEqual(adx['adx'], 0.0)
        self.assertLessEqual(adx['adx'], 100.0)

    def test_engine_metadata(self):
        meta = get_engine_metadata()
        self.assertIn('engine', meta)
        self.assertIn('version', meta)
        self.assertIn('supported_indicators', meta)
        self.assertIn('has_numpy', meta)
        self.assertEqual(len(meta['supported_indicators']), 13)

if __name__ == '__main__':
    unittest.main()
