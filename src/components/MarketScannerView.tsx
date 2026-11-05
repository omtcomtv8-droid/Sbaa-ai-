import React, { useState, useEffect } from 'react';
import {
  Globe,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  Activity,
  Terminal,
  ExternalLink,
} from 'lucide-react';
import { ScannerItem } from '../types';
import { useLanguage } from '../i18n/LanguageContext';

interface MarketScannerViewProps {
  onSelectAsset: (symbol: string) => void;
}

export const MarketScannerView: React.FC<MarketScannerViewProps> = ({ onSelectAsset }) => {
  const { t, tTerm, isRTL } = useLanguage();
  const [items, setItems] = useState<ScannerItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now());

  const fetchScanner = async () => {
    try {
      const res = await fetch('/api/scanner');
      if (res.ok) {
        const data = await res.json();
        setItems(data);
        setLastUpdated(Date.now());
      }
    } catch (err) {
      console.error('Failed to fetch scanner items:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchScanner();
    const interval = setInterval(fetchScanner, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div id="market-scanner-view" className={`space-y-6 max-w-6xl mx-auto font-sans ${isRTL ? 'text-right' : 'text-left'}`}>
      {/* Header Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-sky-950/20 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-400 flex items-center justify-center shrink-0">
            <Globe className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <span>{t('scanner.title', 'Real-Time Multi-Asset Market Scanner')}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30 font-mono font-bold">
                REAL-TIME SCANNER
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {t('scanner.subtitle', 'Simultaneous algorithmic monitoring of currency pairs, commodities, crypto, and market regimes.')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[11px] text-slate-400 font-mono">
            {t('common.lastUpdated', 'Last update')}: {new Date(lastUpdated).toLocaleTimeString()}
          </span>
          <button
            onClick={fetchScanner}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
            title={t('common.refresh', 'Refresh')}
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Grid of Assets */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className={`w-full text-xs font-mono ${isRTL ? 'text-right' : 'text-left'}`}>
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950 text-slate-400 font-sans">
                <th className="py-3 px-4 font-semibold">{t('history.asset', 'Asset')}</th>
                <th className="py-3 px-4 font-semibold">{t('market.livePrice', 'Live Price')}</th>
                <th className="py-3 px-4 font-semibold">{t('market.change24h', '24h Change')}</th>
                <th className="py-3 px-4 font-semibold">{t('gauges.rsiTitle', 'RSI (14)')}</th>
                <th className="py-3 px-4 font-semibold">{t('gauges.macdAndAtr', 'MACD')}</th>
                <th className="py-3 px-4 font-semibold">{t('scoreTable.confluence', 'Confluence')}</th>
                <th className="py-3 px-4 font-semibold">{t('history.direction', 'Signal')}</th>
                <th className="py-3 px-4 font-semibold">{t('common.action', 'Action')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {items.map((item) => (
                <tr key={item.symbol} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-3.5 px-4 font-bold text-slate-200">
                    <div className="font-sans font-bold">{item.label}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{item.symbol}</div>
                  </td>
                  <td className="py-3.5 px-4 font-bold text-slate-100 text-sm">
                    {item.currentPrice}
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-flex items-center gap-0.5 font-bold ${
                        item.change24h >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {item.change24h >= 0 ? (
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      ) : (
                        <ArrowDownRight className="w-3.5 h-3.5" />
                      )}
                      <span>{item.change24h >= 0 ? `+${item.change24h}` : item.change24h}%</span>
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`px-2 py-0.5 rounded font-mono font-bold ${
                        item.rsi <= 30
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : item.rsi >= 70
                          ? 'bg-rose-500/20 text-rose-400'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {item.rsi}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-sans text-xs">
                    {tTerm(item.macdStatus)}
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-1.5 font-mono">
                      <div className="w-12 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className="h-full bg-amber-400 rounded-full"
                          style={{ width: `${item.confluenceScore}%` }}
                        />
                      </div>
                      <span className="font-bold text-amber-300">{item.confluenceScore}%</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    {item.signal === 'BUY' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        <TrendingUp className="w-3.5 h-3.5" />
                        <span>{tTerm('BUY')}</span>
                      </span>
                    ) : item.signal === 'SELL' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                        <TrendingUp className="w-3.5 h-3.5 rotate-180" />
                        <span>{tTerm('SELL')}</span>
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700">
                        {tTerm('WAIT')}
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4">
                    <button
                      onClick={() => onSelectAsset(item.symbol)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 text-xs font-sans font-semibold transition-colors cursor-pointer"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>{t('market.selectAsset', 'Focus Chart')}</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
