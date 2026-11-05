import React, { useState } from 'react';
import { AssetInfo } from '../types';
import { Search, CheckCircle, ArrowRight, Shield } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

interface MarketBrowserProps {
  assets: AssetInfo[];
  activeAsset?: string;
  selectedAsset?: string;
  currentPrice?: number;
  onSelectAsset: (asset: string) => void;
}

export const MarketBrowser: React.FC<MarketBrowserProps> = ({
  assets,
  activeAsset,
  selectedAsset,
  currentPrice,
  onSelectAsset,
}) => {
  const { t, tTerm, isRTL } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'CURRENCIES' | 'CRYPTO' | 'COMMODITIES' | 'STOCKS'>('ALL');
  const [onlyOtc, setOnlyOtc] = useState(false);

  const filterLabels: Record<string, string> = {
    ALL: t('market.all', 'ALL'),
    CURRENCIES: t('market.currencies', 'CURRENCIES'),
    CRYPTO: t('market.crypto', 'CRYPTO'),
    COMMODITIES: t('market.commodities', 'COMMODITIES'),
    STOCKS: t('market.stocks', 'STOCKS'),
  };

  const filteredAssets = assets.filter((item) => {
    // Search filter
    const matchesSearch =
      item.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.asset.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    // OTC filter
    if (onlyOtc && !item.is_otc) return false;

    // Category filter
    if (filterType === 'ALL') return true;
    if (filterType === 'CURRENCIES' && (item.type.includes('currency') || item.type.includes('forex'))) return true;
    if (filterType === 'CRYPTO' && item.type.includes('crypto')) return true;
    if (filterType === 'COMMODITIES' && item.type.includes('commodit')) return true;
    if (filterType === 'STOCKS' && (item.type.includes('stock') || item.type.includes('share'))) return true;

    return false;
  });

  return (
    <div id="market-browser" className="space-y-4">
      {/* Search and Filters Bar */}
      <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search className={`w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 ${isRTL ? 'right-3' : 'left-3'}`} />
          <input
            type="text"
            placeholder={t('market.searchPlaceholder', 'Search currency pairs, crypto, OTC...')}
            value={searchTerm || ''}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`w-full py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 ${
              isRTL ? 'pr-9 pl-3' : 'pl-9 pr-3'
            }`}
          />
        </div>

        {/* Category Buttons & OTC toggle */}
        <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
          {(['ALL', 'CURRENCIES', 'CRYPTO', 'COMMODITIES', 'STOCKS'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                filterType === type
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {filterLabels[type] || type}
            </button>
          ))}

          <label className="flex items-center space-x-1.5 text-xs text-slate-300 ml-2 cursor-pointer">
            <input
              type="checkbox"
              checked={onlyOtc}
              onChange={(e) => setOnlyOtc(e.target.checked)}
              className="rounded border-slate-700 bg-slate-950 text-blue-600 focus:ring-0"
            />
            <span className="mx-1">{t('market.otcOnly', 'OTC Only')}</span>
          </label>
        </div>
      </div>

      {/* Asset Table */}
      <div className="border border-slate-800 rounded-xl bg-slate-900/50 overflow-hidden">
        <div className="overflow-x-auto max-h-[520px] scrollbar-thin scrollbar-thumb-slate-700">
          <table className={`w-full text-xs ${isRTL ? 'text-right' : 'text-left'}`}>
            <thead className="bg-slate-950/80 text-slate-400 font-semibold sticky top-0 border-b border-slate-800 uppercase tracking-wider text-[10px] z-10 backdrop-blur">
              <tr>
                <th className="py-2.5 px-4">{t('market.assetPair', 'Asset / Pair')}</th>
                <th className="py-2.5 px-3">{t('market.type', 'Type')}</th>
                <th className="py-2.5 px-3">{t('market.market', 'Market')}</th>
                <th className="py-2.5 px-3">{t('market.payout', 'Payout')}</th>
                <th className={`py-2.5 px-3 ${isRTL ? 'text-left' : 'text-right'}`}>{t('market.action', 'Action')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredAssets.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    {t('market.noAssets', 'No assets match current filters')}
                  </td>
                </tr>
              ) : (
                filteredAssets.map((item) => {
                  const isActive = item.asset === activeAsset;

                  return (
                    <tr
                      key={item.asset}
                      className={`hover:bg-slate-800/40 transition-colors ${
                        isActive ? 'bg-blue-950/20' : ''
                      }`}
                    >
                      <td className="py-3 px-4 font-semibold text-slate-200">
                        <div className="flex items-center space-x-2">
                          {isActive && (
                            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                          )}
                          <span>{item.label}</span>
                          <span className="text-[10px] font-mono text-slate-500 font-normal">
                            ({item.asset})
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-slate-400 capitalize">
                        {item.type || 'Standard'}
                      </td>
                      <td className="py-3 px-3">
                        {item.is_otc ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            {tTerm('OTC 24/7')}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            {tTerm('LIVE MARKET')}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 font-mono font-semibold">
                        <span className="text-emerald-400">{item.payout}%</span>
                      </td>
                      <td className={`py-3 px-3 ${isRTL ? 'text-left' : 'text-right'}`}>
                        {isActive ? (
                          <span className="inline-flex items-center space-x-1 text-blue-400 font-semibold text-xs">
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span>{t('market.active', 'Active')}</span>
                          </span>
                        ) : (
                          <button
                            onClick={() => onSelectAsset(item.asset)}
                            className="inline-flex items-center space-x-1 px-3 py-1 rounded bg-slate-800 hover:bg-blue-600 text-slate-300 hover:text-white transition-colors"
                          >
                            <span>{t('market.analyze', 'Analyze')}</span>
                            <ArrowRight className={`w-3 h-3 ${isRTL ? 'rotate-180' : ''}`} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
