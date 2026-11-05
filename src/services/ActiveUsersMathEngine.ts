export interface ActiveUsersState {
  count: number;
  minRange: number;
  maxRange: number;
}

type Subscriber = (state: ActiveUsersState) => void;

class ActiveUsersMathEngineService {
  private static instance: ActiveUsersMathEngineService;
  private state: ActiveUsersState = {
    count: 164,
    minRange: 140,
    maxRange: 195,
  };
  private subscribers = new Set<Subscriber>();
  private intervalId: any = null;

  private constructor() {
    this.startSimulation();
  }

  public static getInstance(): ActiveUsersMathEngineService {
    if (!ActiveUsersMathEngineService.instance) {
      ActiveUsersMathEngineService.instance = new ActiveUsersMathEngineService();
    }
    return ActiveUsersMathEngineService.instance;
  }

  public getState(): ActiveUsersState {
    return { ...this.state };
  }

  public subscribe(callback: Subscriber): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  private startSimulation() {
    if (typeof window === 'undefined') return;
    this.intervalId = setInterval(() => {
      // Small delta: -2, -1, 0, +1, +2
      const delta = Math.floor(Math.random() * 5) - 2;
      let newCount = this.state.count + delta;
      if (newCount < this.state.minRange) newCount = this.state.minRange + 1;
      if (newCount > this.state.maxRange) newCount = this.state.maxRange - 1;

      this.state.count = newCount;
      this.subscribers.forEach((cb) => {
        try {
          cb(this.getState());
        } catch {}
      });
    }, 4500);
  }
}

export const ActiveUsersMathEngine = ActiveUsersMathEngineService.getInstance();
