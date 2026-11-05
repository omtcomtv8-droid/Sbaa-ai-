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
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { telegramService, TelegramStatus } from '../services/TelegramService';

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
  const [autoBroadcast, setAutoBroadcast] = useState(true);
  const [minConfidence, setMinConfidence] = useState(70);
  const [password, setPassword] = useState('sbaa0000');
  const [isLoading, setIsLoading] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      telegramService.getStatus().then((st) => {
        setStatus(st);
        if (st.chatId) setChatId(st.chatId);
        setAutoBroadcast(st.autoBroadcastSignals);
        setMinConfidence(st.minConfidence || 70);
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTestResult(null);

    const res = await telegramService.updateConfig({
      botToken: botToken || undefined,
      chatId: chatId || undefined,
      autoBroadcastSignals: autoBroadcast,
      minConfidence,
      password: password || 'sbaa0000',
      adminToken: adminToken || undefined,
    });

    setIsLoading(false);
    if (res.success) {
      setTestResult(isRTL ? '✅ تم حفظ إعدادات البوت بنجاح!' : 'Telegram settings saved!');
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
              placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ..."
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
                {isRTL ? 'بث الإشارات آلياً' : 'Auto Broadcast'}
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
