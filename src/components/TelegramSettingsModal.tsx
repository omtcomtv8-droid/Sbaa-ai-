import React, { useState, useEffect } from 'react';
import {
  Send,
  Bot,
  Settings,
  X,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  ShieldAlert,
  Clock,
  MapPin,
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { telegramService, TelegramStatus } from '../services/TelegramService';
import {
  TIMEZONE_OPTIONS,
  normalizeTimezoneValue,
  getBrowserLocationSummary,
  formatTimestampInZone,
} from '../utils/timezoneUtils';

interface TelegramSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  adminToken?: string | null;
}

export const TelegramSettingsModal: React.FC<TelegramSettingsModalProps> = ({
  isOpen,
  onClose,
  adminToken,
}) => {
  const { isRTL } = useLanguage();
  const [status, setStatus] = useState<TelegramStatus | null>(null);
  const [botToken, setBotToken] = useState('');
  const [chatId, setChatId] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [autoBroadcast, setAutoBroadcast] = useState(true);
  const [autoBroadcastTrades, setAutoBroadcastTrades] = useState(true);
  const [displayTimezone, setDisplayTimezone] = useState('UTC+3');
  const [minConfidence, setMinConfidence] = useState(70);
  const [password, setPassword] = useState('sbaa0000');
  const [isLoading, setIsLoading] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [nowTick, setNowTick] = useState<number>(() => Date.now());
  const browserLoc = getBrowserLocationSummary();

  useEffect(() => {
    if (!isOpen) return;
    const t = setInterval(() => setNowTick(Date.now()), 1000);
    telegramService.getStatus().then((st) => {
      setStatus(st);
      if (st.chatId) setChatId(st.chatId);
      setEnabled(st.configured ? st.enabled : true);
      setAutoBroadcast(st.autoBroadcastSignals);
      setAutoBroadcastTrades(st.autoBroadcastTrades !== false);
      setDisplayTimezone(normalizeTimezoneValue(st.displayTimezone || 'UTC+3'));
      setMinConfidence(st.minConfidence || 70);
    });
    return () => clearInterval(t);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTestResult(null);

    const res = await telegramService.updateConfig({
      botToken: botToken.trim() || undefined,
      chatId: chatId.trim() || undefined,
      enabled,
      autoBroadcastSignals: autoBroadcast,
      autoBroadcastTrades,
      displayTimezone,
      minConfidence,
      password: password || 'sbaa0000',
      adminToken: adminToken || undefined,
    });

    setIsLoading(false);
    if (res.success) {
      setTestResult(isRTL ? '✅ تم حفظ وتفعيل إعدادات بوت التلجرام بنجاح!' : 'Telegram settings saved & enabled!');
      telegramService.getStatus().then(setStatus);
    } else {
      setTestResult(`❌ ${res.error || 'Failed to update'}`);
    }
  };

  const handleTest = async () => {
    setIsLoading(true);
    const res = await telegramService.testConnection(chatId);
    setIsLoading(false);
    setTestResult(res.message);
    telegramService.getStatus().then(setStatus);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-6 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-blue-500/15 text-blue-400 border border-blue-500/30">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-100">{isRTL ? 'إعدادات وبث التلجرام' : 'Telegram Bot Integration'}</h3>
              <p className="text-[11px] text-slate-400">{isRTL ? 'بث الإشارات وربط المفاتيح عبر API' : 'Broadcast signals and verify keys via API'}</p>
            </div>
          </div>

          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Pill */}
        <div className="my-4 p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${status?.configured ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
            <span className="text-slate-300">
              {status?.configured ? (status.botUsername ? `@${status.botUsername}` : 'Configured') : (isRTL ? 'غير مهيأ' : 'Not Configured')}
            </span>
          </div>
          {status?.botUsername && (
            <a
              href={`https://t.me/${status.botUsername}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 flex items-center gap-1 text-[11px]"
            >
              <span>{isRTL ? 'فتح البوت' : 'Open Bot'}</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>

        {testResult && (
          <div className="mb-4 p-3 rounded-xl bg-slate-950 border border-slate-700 text-xs font-mono">
            {testResult}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSave} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-200 mb-1">
              {isRTL ? 'توكن البوت (Bot Token from @BotFather):' : 'Telegram Bot Token:'}
            </label>
            <input
              type="password"
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
              placeholder={
                status?.configured
                  ? (isRTL ? 'التوكن محفوظ بالفعل (اتركه فارغاً للإبقاء عليه)' : 'Token saved (leave blank to keep current)')
                  : '123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ...'
              }
              className="w-full py-2 px-3 bg-slate-950 border border-slate-700 rounded-xl text-slate-200 font-mono focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-200 mb-1">
              {isRTL ? 'معرف القناة أو الشات المستهدف للبث:' : 'Target Channel / Chat ID:'}
            </label>
            <input
              type="text"
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
              placeholder="@SabaaSignalsChannel"
              className="w-full py-2 px-3 bg-slate-950 border border-slate-700 rounded-xl text-slate-200 font-mono focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Timezone Selector matching Pocket Option UTC +3:00 */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-200 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-sky-400" />
                <span>{isRTL ? 'منطقة التوقيت لرسائل التلجرام:' : 'Signal & Trade Timezone:'}</span>
              </label>
              <span className="text-[11px] font-mono text-emerald-400 font-bold" dir="ltr">
                {formatTimestampInZone(nowTick, displayTimezone)} ({displayTimezone})
              </span>
            </div>
            <select
              value={displayTimezone}
              onChange={(e) => setDisplayTimezone(e.target.value)}
              dir="ltr"
              className="w-full py-2.5 px-3 bg-[#1d2332] border border-slate-700/80 rounded-xl text-slate-100 font-mono text-xs font-semibold focus:outline-none focus:border-sky-500 cursor-pointer"
            >
              {TIMEZONE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <div
              dir="ltr"
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#252c3d] border border-slate-700/60 text-slate-200 text-[11px] font-medium"
            >
              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>
                Your location: {browserLoc.timeZone} {browserLoc.offsetLabel}
              </span>
            </div>
          </div>

          <div className="space-y-2.5 pt-1">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="tgEnabledModal"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-500 bg-slate-950 border-slate-700 cursor-pointer"
              />
              <label htmlFor="tgEnabledModal" className="text-slate-200 font-bold cursor-pointer">
                {isRTL ? 'تفعيل بوت التلجرام للربط المباشر' : 'Enable Telegram Bot Integration'}
              </label>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="autoTradesModal"
                checked={autoBroadcastTrades}
                onChange={(e) => setAutoBroadcastTrades(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-500 bg-slate-950 border-slate-700 cursor-pointer"
              />
              <label htmlFor="autoTradesModal" className="text-slate-300 font-bold cursor-pointer">
                {isRTL ? 'إرسال صفقات التداول الآلي للبوت فوراً (الزوج، الاتجاه، وقت الدخول)' : 'Send Auto-Trader Deals to Bot'}
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="autoModal"
                  checked={autoBroadcast}
                  onChange={(e) => setAutoBroadcast(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-500 bg-slate-950 border-slate-700 cursor-pointer"
                />
                <label htmlFor="autoModal" className="text-slate-300 font-bold cursor-pointer">
                  {isRTL ? 'بث الإشارات آلياً' : 'Auto Broadcast Signals'}
                </label>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  {isRTL ? 'الحد الأدنى للقوة (%):' : 'Min Confidence (%):'}
                </label>
                <input
                  type="number"
                  min="50"
                  max="95"
                  value={minConfidence}
                  onChange={(e) => setMinConfidence(Number(e.target.value))}
                  className="w-full py-1.5 px-3 bg-slate-950 border border-slate-700 rounded-xl text-slate-200 font-mono"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-200 mb-1">
              {isRTL ? 'كلمة المرور للمصادقة (sbaa0000):' : 'Admin Auth Password (sbaa0000):'}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="sbaa0000"
              className="w-full py-2 px-3 bg-slate-950 border border-slate-700 rounded-xl text-slate-200 font-mono text-center"
            />
          </div>

          <div className="flex items-center gap-3 pt-3 border-t border-slate-800">
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold cursor-pointer transition-all flex items-center justify-center gap-2"
            >
              {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Settings className="w-4 h-4" />}
              <span>{isRTL ? 'حفظ التكوين' : 'Save Config'}</span>
            </button>

            <button
              type="button"
              onClick={handleTest}
              disabled={isLoading || !chatId}
              className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold cursor-pointer transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>{isRTL ? 'تجربة إرسال' : 'Test'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
