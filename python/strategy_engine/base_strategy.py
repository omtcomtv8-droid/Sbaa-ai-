#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
base_strategy.py - الواجهة الأساسية لاستراتيجيات التداول الآلي
Base Strategy Interface for Python Trading Engine
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional


class DecisionType(str, Enum):
    BUY = "BUY"
    SELL = "SELL"
    WAIT = "WAIT"


@dataclass
class Candle:
    timestamp: int
    open: float
    high: float
    low: float
    close: float
    volume: Optional[float] = 1.0


@dataclass
class StrategyDecision:
    decision: DecisionType
    confidence: float  # 0.0 to 100.0%
    reason: str
    indicators: Dict[str, Any] = field(default_factory=dict)
    rejection_reasons: List[str] = field(default_factory=list)
    strategy_name: str = ""
    strategy_version: str = "1.0.0"


class BaseStrategy(ABC):
    """
    النموذج المجرد لجميع استراتيجيات التداول
    كل استراتيجية يجب أن تكون وحدة مستقلة وقابلة للاختبار
    """

    def __init__(self, name: str, version: str = "1.0.0", config: Optional[Dict[str, Any]] = None):
        self.name = name
        self.version = version
        self.config = config or {}

    @abstractmethod
    def evaluate(self, candles: List[Candle]) -> StrategyDecision:
        """
        تقييم بيانات الشموع وإصدار قرار (BUY, SELL, WAIT)
        """
        pass

    @abstractmethod
    def get_metadata(self) -> Dict[str, Any]:
        """
        وصف قواعد الاستراتيجية والمؤشرات المستخدمة والحدود المسموحة
        """
        pass

    def min_candles_required(self) -> int:
        return 30
