import fs from 'fs';
import path from 'path';
import { dbService } from './DatabaseService';
import { ActivationManager } from './ActivationManager';

export interface TelegramConfig {
  botToken: string;
  chatId: string; // Default channel or group for signals
  botUsername?: string;
  botFirstName?: string;
  enabled: boolean;
  autoBroadcastSignals: boolean;
  minConfidence: number; // Minimum confidence percentage (e.g. 70)
  lastTestStatus?: 'SUCCESS' | 'FAILED' | 'IDLE';
  lastTestMessage?: string;
  lastBroadcastAt?: string;
  broadcastCount?: number;
}

export interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from?: {
      id: number;
      is_bot: boolean;
      first_name?: string;
      last_name?: string;
      username?: string;
    };
    chat: {
      id: number;
      type: string;
      title?: string;
      username?: string;
    };
    date: number;
    text?: string;
  };
}

export class TelegramBotService {
  private static instance: TelegramBotService;
  private config: TelegramConfig;
  private pollingActive = false;
  private pollingTimer: any = null;
  private lastUpdateId = 0;
  private poServiceGetter?: () => any;

  private constructor() {
    this.config = this.loadConfig();
    if (this.config.enabled && this.config.botToken) {
      this.initBotInfo();
      this.startPolling();
    }
  }

  public setPocketOptionService(getter: () => any): void {
    this.poServiceGetter = getter;
  }

  public getPocketOptionService(): any {
    return this.poServiceGetter ? this.poServiceGetter() : null;
  }

  public static getInstance(): TelegramBotService {
    if (!TelegramBotService.instance) {
      TelegramBotService.instance = new TelegramBotService();
    }
    return TelegramBotService.instance;
  }

  private getConfigFilePath(): string {
    const dir = path.resolve(process.cwd(), '.data');
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch {
        // ignore
      }
    }
    return path.join(dir, 'telegram_config.json');
  }

  private loadConfig(): TelegramConfig {
    const defaultCfg: TelegramConfig = {
      botToken: process.env.TELEGRAM_BOT_TOKEN || '',
      chatId: process.env.TELEGRAM_CHAT_ID || '',
      botUsername: process.env.TELEGRAM_BOT_USERNAME || 'SabaaTradingBot',
      enabled: Boolean(process.env.TELEGRAM_BOT_TOKEN),
      autoBroadcastSignals: true,
      minConfidence: 70,
      lastTestStatus: 'IDLE',
      broadcastCount: 0,
    };

    try {
      const p = this.getConfigFilePath();
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, 'utf8');
        const parsed = JSON.parse(raw);
        return { ...defaultCfg, ...parsed };
      }
    } catch (e) {
      console.warn('[TelegramBotService] Error reading config file:', e);
    }

    return defaultCfg;
  }

  public saveConfig(newConfig: Partial<TelegramConfig>): TelegramConfig {
    this.config = {
      ...this.config,
      ...newConfig,
    };

    try {
      const p = this.getConfigFilePath();
      fs.writeFileSync(p, JSON.stringify(this.config, null, 2), 'utf8');
    } catch (e) {
      console.warn('[TelegramBotService] Error saving config file:', e);
    }

    if (this.config.enabled && this.config.botToken) {
      this.initBotInfo();
      this.startPolling();
    } else {
      this.stopPolling();
    }

    return this.config;
  }

  public getConfig(): TelegramConfig {
    return { ...this.config };
  }

  /**
   * Fetch bot info from Telegram getMe API
   */
  public async initBotInfo(): Promise<{ success: boolean; username?: string; firstName?: string; error?: string }> {
    if (!this.config.botToken) {
      return { success: false, error: 'Telegram Bot Token is not configured.' };
    }

    try {
      const res = await fetch(`https://api.telegram.org/bot${this.config.botToken}/getMe`);
      const data = await res.json();

      if (data.ok && data.result) {
        this.config.botUsername = data.result.username || '';
        this.config.botFirstName = data.result.first_name || '';
        this.saveConfig({
          botUsername: this.config.botUsername,
          botFirstName: this.config.botFirstName,
        });
        console.log(`[TelegramBotService] Connected to Telegram Bot: @${this.config.botUsername} (${this.config.botFirstName})`);
        return { success: true, username: this.config.botUsername, firstName: this.config.botFirstName };
      } else {
        return { success: false, error: data.description || 'Failed to authenticate Telegram Bot token.' };
      }
    } catch (err: any) {
      console.warn('[TelegramBotService] getMe error:', err?.message || err);
      return { success: false, error: err?.message || 'Connection error with Telegram API.' };
    }
  }

  /**
   * Send text message to specific chatId or default configured chatId
   */
  public async sendMessage(
    text: string,
    targetChatId?: string,
    options: { parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2'; replyMarkup?: any } = {}
  ): Promise<{ success: boolean; error?: string; messageId?: number }> {
    const token = this.config.botToken;
    const destChat = targetChatId || this.config.chatId;

    if (!token) {
      return { success: false, error: 'Telegram Bot Token missing.' };
    }
    if (!destChat) {
      return { success: false, error: 'Telegram Chat ID / Channel ID missing.' };
    }

    try {
      const payload: any = {
        chat_id: destChat,
        text,
        parse_mode: options.parseMode || 'HTML',
        disable_web_page_preview: true,
      };

      if (options.replyMarkup) {
        payload.reply_markup = options.replyMarkup;
      }

      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.ok) {
        return { success: true, messageId: data.result?.message_id };
      } else {
        return { success: false, error: data.description || 'Telegram sendMessage rejected.' };
      }
    } catch (err: any) {
      return { success: false, error: err?.message || 'Network error reaching Telegram API.' };
    }
  }

  /**
   * Send test message to verify configuration
   */
  public async testConnection(chatId?: string): Promise<{ success: boolean; message: string }> {
    const dest = chatId || this.config.chatId;

    const po = this.getPocketOptionService();
    let brokerText = '';
    if (po) {
      po.requestBalance();
      const isAuth = po.isAuthVerified();
      const acc = po.getDiagnostics()?.account;
      if (isAuth && acc?.balance !== null && acc?.balance !== undefined && !isNaN(acc.balance)) {
        const mode = acc.isDemo ? 'DEMO' : 'REAL';
        brokerText = `\n💼 <b>حساب الوسيط:</b> متصل وموثق\n💰 <b>الرصيد:</b> $${Number(acc.balance).toFixed(2)} (${mode})\n`;
      }
    }

    const testMsg = `<b>⚡️ تجربة اتصال بوت التلجرام - SABAA AI</b>\n\n` +
      `✅ تم التحقق من ربط بوت التلجرام بنجاح مع غرفة توليد المفاتيح ومنصة التداول!\n` +
      brokerText +
      `🕒 <b>التوقيت:</b> ${new Date().toLocaleString()}\n` +
      `🤖 <b>معرف البوت:</b> @${this.config.botUsername || 'SabaaTradingBot'}\n` +
      `🔗 <b>نظام التفعيل:</b> جاهز للتحقق من المفاتيح وربط الحسابات فورياً عبر API.`;

    const res = await this.sendMessage(testMsg, dest);
    if (res.success) {
      this.config.lastTestStatus = 'SUCCESS';
      this.config.lastTestMessage = 'Connection verified successfully!';
      this.saveConfig({
        lastTestStatus: 'SUCCESS',
        lastTestMessage: 'Connection verified successfully!',
      });
      return { success: true, message: 'Test message delivered successfully to Telegram!' };
    } else {
      this.config.lastTestStatus = 'FAILED';
      this.config.lastTestMessage = res.error || 'Failed to send message';
      this.saveConfig({
        lastTestStatus: 'FAILED',
        lastTestMessage: res.error || 'Failed to send message',
      });
      return { success: false, message: res.error || 'Failed to send test message.' };
    }
  }

  /**
   * Real-time Trading Signal Broadcast to Telegram
   */
  public async broadcastTradingSignal(signal: {
    asset: string;
    timeframe: number | string;
    type: 'UP' | 'DOWN';
    confidence: number;
    price?: number;
    expirySeconds?: number;
    strategy?: string;
    confirmations?: number;
    reasons?: string[];
  }): Promise<{ success: boolean; error?: string }> {
    if (!this.config.enabled || !this.config.botToken || !this.config.chatId) {
      return { success: false, error: 'Telegram broadcasting is disabled or not configured.' };
    }

    if (signal.confidence < (this.config.minConfidence || 60)) {
      return { success: false, error: `Confidence ${signal.confidence}% below threshold ${this.config.minConfidence}%` };
    }

    const isCall = signal.type === 'UP';
    const directionIcon = isCall ? '🟢' : '🔴';
    const directionArabic = isCall ? 'شراء (CALL / UP)' : 'بيع (PUT / DOWN)';
    const expirySec = signal.expirySeconds || (typeof signal.timeframe === 'number' ? signal.timeframe * 2 : 120);
    const expiryMin = Math.ceil(expirySec / 60);

    const messageHtml =
      `<b>${directionIcon} إشارة تداول خوارزمية جديدة - SABAA AI</b>\n\n` +
      `📊 <b>الأصل:</b> <code>${signal.asset}</code>\n` +
      `🎯 <b>الاتجاه:</b> <b>${directionArabic}</b>\n` +
      `⚡️ <b>نسبة القوة والتأكيد:</b> <b>${signal.confidence}%</b>\n` +
      `⏱ <b>مدة الصفقة (Expiry):</b> ${expiryMin} دقيقة (${expirySec} ثانية)\n` +
      (signal.price ? `💵 <b>سعر الدخول المقترح:</b> <code>${signal.price}</code>\n` : '') +
      `🏆 <b>الاستراتيجية:</b> ${signal.strategy || 'Multi-Strategy Confluence'}\n` +
      (signal.confirmations ? `🔬 <b>المؤشرات المؤكدة:</b> ${signal.confirmations} استراتيجيات\n` : '') +
      `\n` +
      `🌐 <b>المنصة المعتمدة:</b> منصة الويب المؤسسية نشطة ومتاحة للمشتركين المرخصين.`;

    const result = await this.sendMessage(messageHtml);
    if (result.success) {
      this.config.lastBroadcastAt = new Date().toISOString();
      this.config.broadcastCount = (this.config.broadcastCount || 0) + 1;
      this.saveConfig({
        lastBroadcastAt: this.config.lastBroadcastAt,
        broadcastCount: this.config.broadcastCount,
      });
    }

    return result;
  }

  /**
   * Handle user commands sent to the Telegram Bot:
   * /start [code]
   * /activate <code>
   * /status
   * /signals
   * /help
   * STRICT DIRECTIVE: ZERO PHONE/APK INSTALL MENTION.
   */
  public async handleBotCommand(
    text: string,
    sender: { id: number; username?: string; firstName?: string }
  ): Promise<string> {
    const raw = (text || '').trim();
    const parts = raw.split(/\s+/);
    const command = (parts[0] || '').toLowerCase();
    const param = parts[1] || '';

    const senderName = sender.firstName || sender.username || 'عزيزي المتداول';

    // 1. /start [code]
    if (command === '/start') {
      if (param) {
        // Deep link with activation code
        return await this.verifyAndExplainCode(param, sender);
      }

      const po = this.getPocketOptionService();
      let accountSnippet = '';
      if (po) {
        // Proactively request balance update from broker
        po.requestBalance();
        const isAuth = po.isAuthVerified();
        const acc = po.getDiagnostics()?.account;
        if (isAuth && acc?.balance !== null && acc?.balance !== undefined && !isNaN(acc.balance)) {
          const mode = acc.isDemo ? 'تجريبي (DEMO)' : 'حقيقي (REAL)';
          accountSnippet = `\n💼 <b>حساب Pocket Option المربوط:</b>\n` +
            `💰 <b>الرصيد:</b> <code>$${Number(acc.balance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${acc.currency || 'USD'}</code> (${mode})\n` +
            `🆔 <b>معرف الحساب:</b> <code>${acc.uidMasked || acc.uid || 'موثق'}</code>\n`;
        }
      }

      return (
        `👋 <b>أهلاً بك يا ${senderName} في بوت SABAA AI الرسمي!</b>\n\n` +
        `🤖 هذا البوت مرتبط مباشرة بغرفة توليد وتفعيل المفاتيح، ورصيد حساب Pocket Option، ونظام الإشارات الحية للمنصة.\n` +
        accountSnippet +
        `\n<b>الأوامر المتاحة:</b>\n` +
        `💰 <code>/balance</code> - للاستعلام المباشر عن رصيد حساب التداول (DEMO / REAL)\n` +
        `📊 <code>/status</code> - للاستعلام عن حالة اشتراكك، رصيد الحساب، والأجهزة المصرحة\n` +
        `🔑 <code>/activate [الكود]</code> - للتحقق من كود التفعيل وربطه بحسابك\n` +
        `📈 <code>/signals</code> - لعرض أحدث الإشارات الخوارزمية الفورية\n` +
        `ℹ️ <code>/help</code> - لعرض دليل الاستخدام الكامل\n\n` +
        `🌐 <i>للوصول إلى المنصة، افتح الرابط في متصفحك وسجّل الدخول أو أدخل كود التفعيل مباشرة.</i>`
      );
    }

    // 2. /balance or /account or /رصيد or /حسابي
    if (
      command === '/balance' ||
      command === '/account' ||
      command === '/رصيد' ||
      command === '/حساب' ||
      command === '/حسابي'
    ) {
      const po = this.getPocketOptionService();
      if (!po) {
        return (
          `⚠️ <b>خادم التداول غير مهيأ حالياً.</b>\n` +
          `يرجى التأكد من تشغيل خادم المنصة الرئيسي.`
        );
      }

      const isAuth = po.isAuthVerified();
      const isConnected = po.isConnected();
      const diag = po.getDiagnostics();
      const acc = diag?.account;
      const isDemo = Boolean(acc?.isDemo);
      const modeText = isDemo ? 'تجريبي (DEMO Sandbox)' : 'حقيقي (REAL Account)';
      let rawBal = acc?.balance;

      if (!isConnected) {
        return (
          `🔴 <b>الاتصال بالوسيط مقطوع:</b>\n\n` +
          `يرجى فتح المنصة في المتصفح والاتصال برمز جلسة SSD أو الدخول التجريبي لتفعيل المزامنة المباشرة.`
        );
      }

      if (!isAuth) {
        return (
          `🟡 <b>جاري توثيق جلسة Pocket Option:</b>\n\n` +
          `الاتصال جارٍ ولم يكتمل التوثيق بعد. يرجى الانتظار بضع ثوانٍ أو فحص رمز SSD في إعدادات المنصة.`
        );
      }

      // If balance is not yet cached or loaded, proactively request and await briefly
      if (rawBal === null || rawBal === undefined || isNaN(rawBal)) {
        po.requestBalance();
        await new Promise((r) => setTimeout(r, 1200));
        const updatedAcc = po.getDiagnostics()?.account;
        if (updatedAcc?.balance !== null && updatedAcc?.balance !== undefined && !isNaN(updatedAcc.balance)) {
          rawBal = updatedAcc.balance;
        }
      }

      if (rawBal !== null && rawBal !== undefined && !isNaN(rawBal)) {
        const balNum = Number(rawBal);
        const uidStr = acc?.uidMasked || acc?.uid || diag?.authUid || 'موثق';
        return (
          `💰 <b>بيانات رصيد الحساب المباشر - SABAA AI</b>\n\n` +
          `💵 <b>الرصيد المتاح:</b> <code>$${balNum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${acc?.currency || 'USD'}</code>\n` +
          `🏷 <b>نوع الحساب:</b> ${modeText}\n` +
          `🆔 <b>معرف الحساب (UID):</b> <code>${uidStr}</code>\n` +
          `🟢 <b>حالة الاتصال:</b> متصل بالوسيط وموثق بنجاح (Live WebSocket)\n` +
          `🕒 <b>آخر تحديث:</b> الآن عبر خادم Pocket Option المباشر`
        );
      } else {
        // Proactively request balance update from broker again
        po.requestBalance();
        return (
          `🔄 <b>جاري جلب الرصيد من وسيط Pocket Option...</b>\n\n` +
          `🏷 <b>نوع الحساب:</b> ${modeText}\n` +
          `🟢 <b>حالة الجلسة:</b> موثقة بنجاح\n\n` +
          `📡 تم إرسال أمر تحديث الرصيد للوسيط الآن. أرسل <code>/balance</code> بعد ثوانٍ لعرض القيمة.`
        );
      }
    }

    // 3. /activate <code>
    if (command === '/activate') {
      if (!param) {
        return (
          `⚠️ <b>يرجى كتابة كود التفعيل بعد الأمر:</b>\n` +
          `مثال: <code>/activate SABAA-XXXX-XXXX-XXXX</code>`
        );
      }
      return await this.verifyAndExplainCode(param, sender);
    }

    // 4. /status
    if (command === '/status') {
      const po = this.getPocketOptionService();
      let brokerInfo = '';

      if (po) {
        const isAuth = po.isAuthVerified();
        const isConnected = po.isConnected();
        const diag = po.getDiagnostics();
        const acc = diag?.account;
        const rawBal = acc?.balance;

        if (isAuth && rawBal !== null && rawBal !== undefined && !isNaN(rawBal)) {
          const mode = acc?.isDemo ? 'DEMO Sandbox' : 'REAL Account';
          brokerInfo =
            `\n\n💼 <b>حساب الوسيط (Pocket Option):</b>\n` +
            `🟢 <b>الحالة:</b> متصل وموثق\n` +
            `💵 <b>الرصيد:</b> <code>$${Number(rawBal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${acc?.currency || 'USD'}</code> (${mode})\n` +
            `🆔 <b>معرف الحساب:</b> <code>${acc?.uidMasked || acc?.uid || 'موثق'}</code>`;
        } else if (isAuth) {
          po.requestBalance();
          brokerInfo =
            `\n\n💼 <b>حساب الوسيط (Pocket Option):</b>\n` +
            `🟢 <b>الحالة:</b> موثق — <i>جاري جلب الرصيد...</i>`;
        } else if (isConnected) {
          brokerInfo =
            `\n\n💼 <b>حساب الوسيط (Pocket Option):</b>\n` +
            `🟡 <b>الحالة:</b> متصل بالخادم وبانتظار التوثيق`;
        } else {
          brokerInfo =
            `\n\n💼 <b>حساب الوسيط (Pocket Option):</b>\n` +
            `⚪️ <b>الحالة:</b> غير متصل (أدخل SSD في المنصة)`;
        }
      }

      return (
        `📊 <b>استعلام التراخيص والحسابات - SABAA AI</b>\n\n` +
        `👤 <b>معرف التلجرام الخاص بك:</b> <code>${sender.id}</code>\n` +
        (sender.username ? `🔹 <b>اسم المستخدم:</b> @${sender.username}\n` : '') +
        `🕒 <b>خادم التراخيص:</b> متصل ونشط عبر API 🟢` +
        brokerInfo +
        `\n\n💡 <i>للتحقق من صلاحية مفتاح محدد، أرسل:</i>\n` +
        `<code>/activate [رمز المفتاح]</code>\n` +
        `<i>لطلب تحديث الرصيد، أرسل:</i> <code>/balance</code>`
      );
    }

    // 5. /signals
    if (command === '/signals') {
      return (
        `📈 <b>مركز الإشارات الفورية - SABAA AI</b>\n\n` +
        `⚡️ يتم بث الإشارات تلقائياً في القناة والمجموعات المعتمدة عند توفر شروط الدخول الخوارزمية المؤكدة (Confluence >= 3).\n` +
        `🔍 يرجى متابعة بث الإشارات في القناة أو فتح منصة التداول عبر المتصفح لمشاهدة التحليل على الشارت الحي.`
      );
    }

    // 6. /help
    if (command === '/help') {
      return (
        `📖 <b>دليل استخدام بوت التلجرام - SABAA AI</b>\n\n` +
        `💰 <b>استعلام الرصيد:</b> أرسل <code>/balance</code> لعرض رصيد حساب Pocket Option المتصل ونوعه (تجريبي أو حقيقي).\n` +
        `📊 <b>حالة النظام:</b> أرسل <code>/status</code> لعرض حالة الخادم والحساب واشتراكك.\n` +
        `1️⃣ <b>تفعيل المفتاح:</b> أرسل <code>/activate [الكود]</code> للتحقق من صلاحية الكود والمدة والأجهزة المسموحة.\n` +
        `2️⃣ <b>دخول المنصة:</b> افتح رابط منصة التداول عبر المتصفح، وسجّل الدخول وضع كود التفعيل لتفتح لك كامل الأدوات.\n` +
        `3️⃣ <b>الإشارات المباشرة:</b> يقدم النظام إشارات تداول مبنية على توافق مؤشرات EMA و RSI و SuperTrend بدون أي توقعات عشوائية.\n\n` +
        `<i>ملاحظة: هذا النظام خاضع لغرفة تحكم المشرف المعتمدة (sbaa0000).</i>`
      );
    }

    // Fallback if user just entered a code directly
    if (raw.toUpperCase().startsWith('SABAA') || raw.toUpperCase().startsWith('SBAA')) {
      return await this.verifyAndExplainCode(raw, sender);
    }

    return (
      `❓ أمر غير معروف. أرسل <code>/help</code> لمعرفة الأوامر المتاحة أو <code>/activate [الكود]</code> للتحقق من كود التفعيل.`
    );
  }

  /**
   * Verify activation code and return rich Telegram message
   */
  public async verifyAndExplainCode(
    rawCode: string,
    sender: { id: number; username?: string; firstName?: string }
  ): Promise<string> {
    const actManager = ActivationManager.getInstance();
    const isMaster = actManager.isMasterAdminCode(rawCode);
    const cleanCode = isMaster ? 'SBAA0000' : rawCode.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');

    const record = await dbService.getActivationCode(cleanCode);

    if (!record) {
      return (
        `❌ <b>كود التفعيل غير صالح!</b>\n\n` +
        `لم يتم العثور على الكود <code>${cleanCode}</code> في قاعدة بيانات المنصة.\n` +
        `يرجى مراجعة المشرف للحصول على كود تفعيل معتمد من غرفة المفاتيح.`
      );
    }

    if (record.status === 'REVOKED') {
      return (
        `🚫 <b>تم إلغاء هذا الكود!</b>\n\n` +
        `الكود <code>${record.code}</code> تم إلغاؤه بواسطة المشرف.\n` +
        `السبب: ${record.revocationReason || 'إلغاء إداري'}`
      );
    }

    if (record.status === 'DISABLED') {
      return (
        `⏸ <b>هذا الكود معطل مؤقتاً!</b>\n\n` +
        `الكود <code>${record.code}</code> موقوف حالياً بواسطة المشرف.`
      );
    }

    const now = new Date();
    if (record.expiresAt && new Date(record.expiresAt).getTime() <= now.getTime()) {
      return (
        `⏳ <b>انتهت صلاحية هذا الكود!</b>\n\n` +
        `الكود <code>${record.code}</code> انتهى بتاريخ: ${new Date(record.expiresAt).toLocaleString()}`
      );
    }

    const statusBadge = record.status === 'ACTIVE' ? 'نشط ومفعّل 🟢' : 'غير مستخدم بعد 🔵';
    const expiresText = record.expiresAt
      ? new Date(record.expiresAt).toLocaleString()
      : 'يبدأ الحساب عند أول تفعيل بالمتصفح';

    return (
      `✅ <b>معلومات كود التفعيل المعتمد - SABAA AI</b>\n\n` +
      `🔑 <b>رمز الكود:</b> <code>${record.code}</code>\n` +
      `📋 <b>الحالة:</b> ${statusBadge}\n` +
      `⏳ <b>المدة المصرحة:</b> ${record.durationLabel}\n` +
      `📅 <b>تاريخ الانتهاء:</b> ${expiresText}\n` +
      `📱 <b>الحد الأقصى للأجهزة:</b> ${record.maxDevices} جهاز\n` +
      `👥 <b>الأجهزة النشطة حالياً:</b> ${record.activeDevicesCount || 0} / ${record.maxDevices}\n` +
      (record.boundUserEmail ? `📧 <b>الحساب المقترن:</b> <code>${record.boundUserEmail}</code>\n` : `🔓 <b>الاقتران:</b> متاح لربطه بحساب Google عند أول دخول\n`) +
      `\n` +
      `🌐 <b>خطوات الاستخدام في الموقع:</b>\n` +
      `1. افتح منصة التداول عبر المتصفح (خارج التلجرام للحصول على أفضل أداء).\n` +
      `2. سجّل الدخول بحساب Google أو أدخل الكود مباشرة في خانة التفعيل السريع.\n` +
      `3. ضع الكود <code>${record.code}</code> لتفعيل المنصة وفتح كامل ميزات التحليل المؤسسي فوراً!`
    );
  }

  /**
   * Internal Telegram polling worker for updates
   */
  private startPolling() {
    if (this.pollingActive) return;
    this.pollingActive = true;

    const poll = async () => {
      if (!this.pollingActive || !this.config.enabled || !this.config.botToken) {
        return;
      }

      try {
        const url = `https://api.telegram.org/bot${this.config.botToken}/getUpdates?offset=${this.lastUpdateId + 1}&timeout=5`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.ok && Array.isArray(data.result)) {
          for (const update of data.result as TelegramUpdate[]) {
            this.lastUpdateId = Math.max(this.lastUpdateId, update.update_id);
            if (update.message && update.message.text) {
              const reply = await this.handleBotCommand(update.message.text, {
                id: update.message.from?.id || update.message.chat.id,
                username: update.message.from?.username,
                firstName: update.message.from?.first_name,
              });

              if (reply) {
                await this.sendMessage(reply, String(update.message.chat.id));
              }
            }
          }
        }
      } catch {
        // network retry
      }

      if (this.pollingActive) {
        this.pollingTimer = setTimeout(poll, 2500);
      }
    };

    poll();
  }

  private stopPolling() {
    this.pollingActive = false;
    if (this.pollingTimer) {
      clearTimeout(this.pollingTimer);
      this.pollingTimer = null;
    }
  }
}

export const telegramBotService = TelegramBotService.getInstance();
