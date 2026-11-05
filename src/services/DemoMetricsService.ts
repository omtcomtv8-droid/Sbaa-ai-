/**
 * src/services/DemoMetricsService.ts
 *
 * SIMULATED / DEMO METRICS SERVICE ONLY.
 * Exclusively used on the Login / Landing Page for visual interface activity preview.
 *
 * STRICT SEPARATION GUARANTEE:
 * - This file contains ONLY synthetic/simulated figures for visual preview.
 * - Absolutely NO real person names, identities, or accounts.
 * - This service MUST NEVER be imported into real trading terminal, signal gate,
 *   real performance metrics, or account order execution components.
 */

export interface DemoActivityEvent {
  id: string;
  userTag: string; // Anonymous tag e.g. "مستخدم تجريبي #142"
  action: string;  // e.g. "مستخدم جديد سجّل الدخول"
  timeAgo: string; // e.g. "منذ لحظات"
  timestamp: number;
  type: 'LOGIN' | 'BROWSE_MARKET' | 'VIEW_ANALYSIS' | 'CHECK_STRATEGY';
  badge: string;   // "نشاط تجريبي — Demo"
}

export interface DemoProfitCard {
  id: string;
  amount: number;
  formatted: string; // e.g. "+$27.80"
  asset: string;     // e.g. "EUR/USD (Demo)"
  timeAgo: string;
  timestamp: number;
  label: string;     // "SIMULATED"
}

export interface DemoMetricsSnapshot {
  activeUsers: number;
  activeUsersLabel: string;
  minUsersRange: number;
  maxUsersRange: number;
  recentActivities: DemoActivityEvent[];
  recentProfits: DemoProfitCard[];
  lastUpdated: number;
  isSimulated: true;
}

type MetricsListener = (snapshot: DemoMetricsSnapshot) => void;

class DemoMetricsServiceClass {
  // Configured bounds: 50 to 700 users
  private readonly MIN_USERS = 50;
  private readonly MAX_USERS = 700;

  private currentUsers: number = 186;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private listeners: Set<MetricsListener> = new Set();

  private activityCatalog = [
    { action: 'مستخدم جديد سجّل الدخول', type: 'LOGIN' as const },
    { action: 'مستخدم يشاهد الأسواق', type: 'BROWSE_MARKET' as const },
    { action: 'مستخدم فتح صفحة التحليل', type: 'VIEW_ANALYSIS' as const },
    { action: 'مستخدم جديد سجّل الدخول', type: 'LOGIN' as const },
    { action: 'مستخدم يشاهد الأسواق', type: 'BROWSE_MARKET' as const },
    { action: 'مستخدم فتح صفحة التحليل', type: 'VIEW_ANALYSIS' as const },
  ];

  private profitCatalog = [
    { amount: 18.40, formatted: '+ $18.40', asset: 'EUR/USD (Demo)' },
    { amount: 32.10, formatted: '+ $32.10', asset: 'GBP/USD (Demo)' },
    { amount: 51.70, formatted: '+ $51.70', asset: 'USD/JPY (Demo)' },
    { amount: 12.40, formatted: '+ $12.40', asset: 'EUR/GBP (Demo)' },
    { amount: 27.80, formatted: '+ $27.80', asset: 'AUD/USD (Demo)' },
    { amount: 46.20, formatted: '+ $46.20', asset: 'Gold (Demo)' },
  ];

  private activities: DemoActivityEvent[] = [
    {
      id: 'demo-act-1',
      userTag: 'مستخدم تجريبي #128',
      action: 'مستخدم فتح صفحة التحليل',
      timeAgo: 'منذ دقيقة',
      timestamp: Date.now() - 60000,
      type: 'VIEW_ANALYSIS',
      badge: 'نشاط تجريبي — Demo',
    },
    {
      id: 'demo-act-2',
      userTag: 'مستخدم تجريبي #245',
      action: 'مستخدم جديد سجّل الدخول',
      timeAgo: 'منذ دقيقتين',
      timestamp: Date.now() - 120000,
      type: 'LOGIN',
      badge: 'نشاط تجريبي — Demo',
    },
    {
      id: 'demo-act-3',
      userTag: 'مستخدم تجريبي #309',
      action: 'مستخدم يشاهد الأسواق',
      timeAgo: 'منذ 3 دقائق',
      timestamp: Date.now() - 180000,
      type: 'BROWSE_MARKET',
      badge: 'نشاط تجريبي — Demo',
    },
  ];

  private profits: DemoProfitCard[] = [
    {
      id: 'demo-prof-1',
      amount: 18.40,
      formatted: '+ $18.40',
      asset: 'EUR/USD (Demo)',
      timeAgo: 'منذ دقيقة',
      timestamp: Date.now() - 60000,
      label: 'SIMULATED',
    },
    {
      id: 'demo-prof-2',
      amount: 32.10,
      formatted: '+ $32.10',
      asset: 'GBP/USD (Demo)',
      timeAgo: 'منذ 3 دقائق',
      timestamp: Date.now() - 180000,
      label: 'SIMULATED',
    },
    {
      id: 'demo-prof-3',
      amount: 51.70,
      formatted: '+ $51.70',
      asset: 'Gold (Demo)',
      timeAgo: 'منذ 6 دقائق',
      timestamp: Date.now() - 360000,
      label: 'SIMULATED',
    },
  ];

  constructor() {
    this.startSimulationLoop();
  }

  /**
   * Smooth simulation loop that updates active users gradually every 4-6 seconds,
   * avoiding jerky second-by-second changes while keeping natural movement.
   */
  private startSimulationLoop(): void {
    const nextInterval = 4000 + Math.floor(Math.random() * 2500); // 4.0s - 6.5s

    this.timer = setTimeout(() => {
      this.tick();
      this.startSimulationLoop();
    }, nextInterval);
  }

  private tick(): void {
    // 1. Natural gradual user count shift: -3 to +4 users
    const delta = Math.floor(Math.random() * 8) - 3;
    let nextCount = this.currentUsers + delta;

    // Keep strictly within [50, 700] range
    if (nextCount > this.MAX_USERS - 20) {
      nextCount -= Math.floor(Math.random() * 6) + 2;
    } else if (nextCount < this.MIN_USERS + 20) {
      nextCount += Math.floor(Math.random() * 6) + 2;
    }
    this.currentUsers = Math.max(this.MIN_USERS, Math.min(this.MAX_USERS, nextCount));

    // 2. Occasionally add a fresh simulated activity (every ~8-12 seconds)
    if (Math.random() > 0.45) {
      const template = this.activityCatalog[Math.floor(Math.random() * this.activityCatalog.length)];
      const randomTagNum = Math.floor(Math.random() * 890) + 100;
      const newActivity: DemoActivityEvent = {
        id: `demo-act-${Date.now()}`,
        userTag: `مستخدم تجريبي #${randomTagNum}`,
        action: template.action,
        timeAgo: 'منذ لحظات',
        timestamp: Date.now(),
        type: template.type,
        badge: 'نشاط تجريبي — Demo',
      };
      this.activities = [newActivity, ...this.activities.slice(0, 4)];
    }

    // 3. Occasionally cycle a simulated profit card (every ~10-15 seconds)
    if (Math.random() > 0.6) {
      const template = this.profitCatalog[Math.floor(Math.random() * this.profitCatalog.length)];
      const newProfit: DemoProfitCard = {
        id: `demo-prof-${Date.now()}`,
        amount: template.amount,
        formatted: template.formatted,
        asset: template.asset,
        timeAgo: 'منذ لحظات',
        timestamp: Date.now(),
        label: 'SIMULATED',
      };
      this.profits = [newProfit, ...this.profits.slice(0, 2)];
    }

    this.notify();
  }

  public getSnapshot(): DemoMetricsSnapshot {
    return {
      activeUsers: this.currentUsers,
      activeUsersLabel: 'المستخدمون النشطون الآن — تجريبي',
      minUsersRange: this.MIN_USERS,
      maxUsersRange: this.MAX_USERS,
      recentActivities: [...this.activities],
      recentProfits: [...this.profits],
      lastUpdated: Date.now(),
      isSimulated: true,
    };
  }

  public subscribe(listener: MetricsListener): () => void {
    this.listeners.add(listener);
    // Send immediate initial state
    listener(this.getSnapshot());

    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) {
      try {
        listener(snapshot);
      } catch (err) {
        console.error('Error in DemoMetricsService listener:', err);
      }
    }
  }

  public stop(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.listeners.clear();
  }
}

export const DemoMetricsService = new DemoMetricsServiceClass();
