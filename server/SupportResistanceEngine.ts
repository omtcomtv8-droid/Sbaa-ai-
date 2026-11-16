import { Candle, SupportResistanceLevel } from './types';
import { calculateATR } from './indicators';

export class SupportResistanceEngine {
  /**
   * Calculates key support and resistance zones from historical candle swing points.
   */
  public static calculateLevels(
    candles: Candle[],
    lookback: number = 50,
    clusterTolerancePercent: number = 0.08
  ): {
    supports: SupportResistanceLevel[];
    resistances: SupportResistanceLevel[];
    nearestSupport: SupportResistanceLevel | null;
    nearestResistance: SupportResistanceLevel | null;
    isTestingSupport: boolean;
    isTestingResistance: boolean;
  } {
    if (candles.length < 15) {
      return {
        supports: [],
        resistances: [],
        nearestSupport: null,
        nearestResistance: null,
        isTestingSupport: false,
        isTestingResistance: false,
      };
    }

    const currentPrice = candles[candles.length - 1].close;
    const window = candles.slice(-lookback);

    // Extract swing highs and lows
    const swingPoints: { price: number; type: 'HIGH' | 'LOW' }[] = [];
    for (let i = 2; i < window.length - 2; i++) {
      const c = window[i];
      if (
        c.high > window[i - 1].high &&
        c.high > window[i - 2].high &&
        c.high > window[i + 1].high &&
        c.high > window[i + 2].high
      ) {
        swingPoints.push({ price: c.high, type: 'HIGH' });
      }
      if (
        c.low < window[i - 1].low &&
        c.low < window[i - 2].low &&
        c.low < window[i + 1].low &&
        c.low < window[i + 2].low
      ) {
        swingPoints.push({ price: c.low, type: 'LOW' });
      }
    }

    // Cluster swing points within tolerance
    const tolerance = (currentPrice * clusterTolerancePercent) / 100;
    const clusters: { prices: number[]; type: 'SUPPORT' | 'RESISTANCE' }[] = [];

    for (const pt of swingPoints) {
      const isAbove = pt.price >= currentPrice;
      const targetType: 'SUPPORT' | 'RESISTANCE' = isAbove ? 'RESISTANCE' : 'SUPPORT';

      let matchedCluster = clusters.find((cl) => {
        if (cl.type !== targetType) return false;
        const avg = cl.prices.reduce((a, b) => a + b, 0) / cl.prices.length;
        return Math.abs(avg - pt.price) <= tolerance;
      });

      if (matchedCluster) {
        matchedCluster.prices.push(pt.price);
      } else {
        clusters.push({ prices: [pt.price], type: targetType });
      }
    }

    const supports: SupportResistanceLevel[] = [];
    const resistances: SupportResistanceLevel[] = [];

    for (const cl of clusters) {
      const avgPrice = Number((cl.prices.reduce((a, b) => a + b, 0) / cl.prices.length).toFixed(5));
      const distance = Number(Math.abs(currentPrice - avgPrice).toFixed(5));
      const distancePercent = Number(((distance / currentPrice) * 100).toFixed(3));
      const touches = cl.prices.length;
      const strength = Math.min(5, touches + (touches > 2 ? 1 : 0));

      const level: SupportResistanceLevel = {
        price: avgPrice,
        type: cl.type,
        touches,
        strength,
        distance,
        distancePercent,
      };

      if (cl.type === 'SUPPORT') {
        supports.push(level);
      } else {
        resistances.push(level);
      }
    }

    // Sort supports descending (closest to current price first)
    supports.sort((a, b) => b.price - a.price);
    // Sort resistances ascending (closest to current price first)
    resistances.sort((a, b) => a.price - b.price);

    const nearestSupport = supports.length > 0 ? supports[0] : null;
    const nearestResistance = resistances.length > 0 ? resistances[0] : null;

    // Dynamic ATR-scaled testing zone (capped at 0.05%, floor 0.008%)
    const atrData = calculateATR(candles, 14);
    const atrPercent = atrData && currentPrice > 0 ? (atrData.currentATR / currentPrice) * 100 : 0.05;
    const testZonePercent = Math.min(0.05, Math.max(0.008, atrPercent * 0.45));

    const isTestingSupport = nearestSupport ? nearestSupport.distancePercent <= testZonePercent : false;
    const isTestingResistance = nearestResistance ? nearestResistance.distancePercent <= testZonePercent : false;

    return {
      supports: supports.slice(0, 5),
      resistances: resistances.slice(0, 5),
      nearestSupport,
      nearestResistance,
      isTestingSupport,
      isTestingResistance,
    };
  }
}
