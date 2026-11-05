import { IndicatorMetrics } from './types';

export interface IndicatorValidationResult {
  isValid: boolean;
  errors: string[];
  validatedCount: number;
}

export class IndicatorValidation {
  /**
   * Validates calculated indicator metrics according to strict mathematical integrity.
   * Every required indicator value must satisfy Number.isFinite(val) === true.
   * Rejects NaN, Infinity, undefined, and null.
   */
  public static validateIndicators(indicators: Partial<IndicatorMetrics> | null): IndicatorValidationResult {
    const errors: string[] = [];
    let validatedCount = 0;

    if (!indicators) {
      return { isValid: false, errors: ['Indicator metrics object is null or undefined'], validatedCount: 0 };
    }

    // Helper to validate single finite numeric field
    const checkFinite = (name: string, val: any): boolean => {
      if (typeof val !== 'number' || !Number.isFinite(val) || isNaN(val)) {
        errors.push(`${name} is non-finite or unavailable: ${val}`);
        return false;
      }
      validatedCount++;
      return true;
    };

    // 1. RSI (14 Wilder)
    checkFinite('RSI', indicators.rsi);

    // 2. Moving Averages
    checkFinite('EMA9', (indicators as any).ema9 ?? indicators.emaFast);
    checkFinite('EMA21', (indicators as any).ema21 ?? indicators.emaSlow);
    checkFinite('SMA20', (indicators as any).sma20 ?? indicators.sma);
    checkFinite('SMA50', (indicators as any).sma50);

    // 3. Bollinger Bands (20, 2)
    if (!indicators.bollinger) {
      errors.push('Bollinger Bands block is missing');
    } else {
      checkFinite('Bollinger.upper', indicators.bollinger.upper);
      checkFinite('Bollinger.middle', indicators.bollinger.middle);
      checkFinite('Bollinger.lower', indicators.bollinger.lower);
      checkFinite('Bollinger.bandwidth', indicators.bollinger.bandwidth);
      checkFinite('Bollinger.percentB', indicators.bollinger.percentB);
    }

    // 4. MACD (12, 26, 9)
    if (!indicators.macd) {
      errors.push('MACD block is missing');
    } else {
      checkFinite('MACD.macd', indicators.macd.macd);
      checkFinite('MACD.signal', indicators.macd.signal);
      checkFinite('MACD.histogram', indicators.macd.histogram);
    }

    // 5. ADX (14)
    if (!indicators.adx) {
      errors.push('ADX block is missing');
    } else {
      checkFinite('ADX.adx', indicators.adx.adx);
      checkFinite('ADX.plusDI', indicators.adx.plusDI);
      checkFinite('ADX.minusDI', indicators.adx.minusDI);
    }

    // 6. ATR (14)
    checkFinite('ATR', indicators.atr);

    return {
      isValid: errors.length === 0,
      errors,
      validatedCount,
    };
  }
}
