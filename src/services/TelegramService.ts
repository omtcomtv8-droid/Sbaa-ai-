export interface TelegramStatus {
  success: boolean;
  configured: boolean;
  enabled: boolean;
  botUsername: string;
  botFirstName: string;
  chatId: string;
  autoBroadcastSignals: boolean;
  minConfidence: number;
  lastTestStatus?: 'SUCCESS' | 'FAILED' | 'IDLE';
  lastTestMessage?: string;
  lastBroadcastAt?: string;
  broadcastCount?: number;
}

export class TelegramService {
  private static instance: TelegramService;

  private constructor() {}

  public static getInstance(): TelegramService {
    if (!TelegramService.instance) {
      TelegramService.instance = new TelegramService();
    }
    return TelegramService.instance;
  }

  public async getStatus(): Promise<TelegramStatus> {
    try {
      const res = await fetch('/api/telegram/status');
      return await res.json();
    } catch (e: any) {
      return {
        success: false,
        configured: false,
        enabled: false,
        botUsername: '',
        botFirstName: '',
        chatId: '',
        autoBroadcastSignals: false,
        minConfidence: 70,
        lastTestStatus: 'FAILED',
        lastTestMessage: e?.message || 'Failed to connect to Telegram service',
      };
    }
  }

  public async updateConfig(params: {
    botToken?: string;
    chatId?: string;
    enabled?: boolean;
    autoBroadcastSignals?: boolean;
    minConfidence?: number;
    password?: string;
    adminToken?: string;
  }): Promise<{ success: boolean; config?: any; error?: string }> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (params.adminToken) {
        headers['x-admin-token'] = params.adminToken;
      }

      const res = await fetch('/api/telegram/config', {
        method: 'POST',
        headers,
        body: JSON.stringify(params),
      });

      return await res.json();
    } catch (e: any) {
      return { success: false, error: e?.message || 'Error updating Telegram configuration' };
    }
  }

  public async testConnection(chatId?: string): Promise<{ success: boolean; message: string }> {
    try {
      const res = await fetch('/api/telegram/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId }),
      });
      return await res.json();
    } catch (e: any) {
      return { success: false, message: e?.message || 'Failed to send test message' };
    }
  }

  public async shareKeyToTelegram(params: {
    code: string;
    durationLabel?: string;
    maxDevices?: number;
    expiresAt?: string;
    targetChatId?: string;
  }): Promise<{ success: boolean; deepLink?: string; message?: string }> {
    try {
      const res = await fetch('/api/telegram/share-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      return await res.json();
    } catch (e: any) {
      return { success: false, message: e?.message || 'Failed to share key' };
    }
  }

  public async broadcastSignal(signal: {
    asset: string;
    timeframe: number | string;
    type: 'UP' | 'DOWN';
    confidence: number;
    price?: number;
    expirySeconds?: number;
    strategy?: string;
    confirmations?: number;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch('/api/telegram/broadcast-signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(signal),
      });
      return await res.json();
    } catch (e: any) {
      return { success: false, error: e?.message || 'Failed to broadcast signal' };
    }
  }
}

export const telegramService = TelegramService.getInstance();
