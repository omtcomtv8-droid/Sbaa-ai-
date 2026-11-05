import { SbaaConfig } from './SbaaTypes';

export interface RiskCheckResult {
  allowed: boolean;
  reasonAr?: string;
  reasonEn?: string;
  isCircuitBreakerTripped: boolean;
}

export class SbaaRiskGuardian {
  private dailyLoss: number = 0;
  private dailyProfit: number = 0;
  private concurrentTradesCount: number = 0;
  private circuitBreakerTripped: boolean = false;
  private circuitBreakerReason: string = '';
  private lastTradeTimestamp: number = 0;
  private lastTradeCandleTimestamp: number = 0;
  private processedSignalIds = new Set<string>();

  constructor(private config: SbaaConfig) {}

  public updateConfig(newConfig: Partial<SbaaConfig>) {
    this.config = { ...this.config, ...newConfig };
  }

  public getConfig(): SbaaConfig {
    return { ...this.config };
  }

  /**
   * Pre-trade validation enforcing Section 9 simulation risk boundaries.
   */
  public validateTradeExecution(params: {
    amount: number;
    signalId: string;
    candleTimestamp: number;
    isDemo: boolean;
  }): RiskCheckResult {
    // 1. Mandatory Demo-Only Enforcement
    if (!params.isDemo) {
      return {
        allowed: false,
        reasonAr: 'حظر أمني: محرك استراتيجية سبع مبرمج للتنفيذ على البيئة التجريبية (Demo) أو Paper Trading فقط.',
        reasonEn: 'Security block: SBAA Engine operates strictly on Demo or Paper Trading.',
        isCircuitBreakerTripped: false,
      };
    }

    // 2. Circuit Breaker check
    if (this.circuitBreakerTripped) {
      return {
        allowed: false,
        reasonAr: `قاطع الدائرة مفعل: ${this.circuitBreakerReason}. توقف التداول الآلي لحماية رأس المال.`,
        reasonEn: `Circuit breaker active: ${this.circuitBreakerReason}.`,
        isCircuitBreakerTripped: true,
      };
    }

    // 3. Daily Loss Limit Check
    if (this.dailyLoss >= this.config.maxDailyLoss) {
      this.circuitBreakerTripped = true;
      this.circuitBreakerReason = `تم بلوغ الحد الأقصى للخسائر التجريبية اليومية (-$${this.config.maxDailyLoss.toFixed(2)})`;
      return {
        allowed: false,
        reasonAr: `تجاوز حد الخسارة اليومي المسموح به (-$${this.config.maxDailyLoss.toFixed(2)}). تم إيقاف الدخول الآلي.`,
        reasonEn: `Daily loss limit reached (-$${this.config.maxDailyLoss.toFixed(2)}). Auto trading halted.`,
        isCircuitBreakerTripped: true,
      };
    }

    // 4. Max Concurrent Trades Check
    if (this.concurrentTradesCount >= this.config.maxConcurrentTrades) {
      return {
        allowed: false,
        reasonAr: `تم بلوغ الحد الأقصى للصفقات المتزامنة المفتوحة (${this.config.maxConcurrentTrades}). في انتظار إغلاق الصفقة الجارية.`,
        reasonEn: `Max concurrent trades reached (${this.config.maxConcurrentTrades}).`,
        isCircuitBreakerTripped: false,
      };
    }

    // 5. Duplicate Signal Protection (Section 8)
    if (this.processedSignalIds.has(params.signalId)) {
      return {
        allowed: false,
        reasonAr: 'تم تنفيذ هذه الإشارة سابقاً بالفعل. نظام الحماية من تكرار الإشارات يمنع إعادة الدخول.',
        reasonEn: 'Signal ID already executed. Duplicate protection active.',
        isCircuitBreakerTripped: false,
      };
    }

    // 6. Strict Martingale Prohibition: Reject any attempt to double or multiply stake after loss
    if (params.amount > this.config.baseTradeAmount * 1.5) {
      return {
        allowed: false,
        reasonAr: 'حظر نظام مارتينجال (Martingale Prohibition): يمنع منعاً باتاً مضاعفة مبالغ الدخول لتعويض الخسائر.',
        reasonEn: 'Martingale strictly prohibited: no stake multipliers allowed.',
        isCircuitBreakerTripped: false,
      };
    }

    return {
      allowed: true,
      isCircuitBreakerTripped: false,
    };
  }

  public registerTradeOpened(signalId: string, candleTimestamp: number) {
    this.processedSignalIds.add(signalId);
    this.concurrentTradesCount++;
    this.lastTradeTimestamp = Date.now();
    this.lastTradeCandleTimestamp = candleTimestamp;
  }

  public registerTradeClosed(profit: number) {
    this.concurrentTradesCount = Math.max(0, this.concurrentTradesCount - 1);
    if (profit < 0) {
      this.dailyLoss += Math.abs(profit);
      if (this.dailyLoss >= this.config.maxDailyLoss) {
        this.circuitBreakerTripped = true;
        this.circuitBreakerReason = `تم بلوغ الحد الأقصى للخسائر التجريبية اليومية (-$${this.config.maxDailyLoss.toFixed(2)})`;
      }
    } else if (profit > 0) {
      this.dailyProfit += profit;
      if (this.dailyProfit >= this.config.maxDailyProfitTarget) {
        this.circuitBreakerTripped = true;
        this.circuitBreakerReason = `تم تحقيق هدف الأرباح التجريبية اليومية (+$${this.config.maxDailyProfitTarget.toFixed(2)})! تأمين الأرباح.`;
      }
    }
  }

  public resetDailyLimits() {
    this.dailyLoss = 0;
    this.dailyProfit = 0;
    this.circuitBreakerTripped = false;
    this.circuitBreakerReason = '';
    this.processedSignalIds.clear();
  }

  public getStatus() {
    return {
      dailyLoss: Number(this.dailyLoss.toFixed(2)),
      dailyProfit: Number(this.dailyProfit.toFixed(2)),
      concurrentTradesCount: this.concurrentTradesCount,
      circuitBreakerTripped: this.circuitBreakerTripped,
      circuitBreakerReason: this.circuitBreakerReason,
      maxDailyLoss: this.config.maxDailyLoss,
      maxDailyProfitTarget: this.config.maxDailyProfitTarget,
    };
  }
}
