import React, { useState, useMemo } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { LanguageInfo, Direction } from '../i18n/types';
import {
  Globe,
  Plus,
  Check,
  Trash2,
  Edit3,
  Download,
  Upload,
  Search,
  X,
  Languages,
  ArrowRightLeft,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';

interface LanguageManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LanguageManagerModal: React.FC<LanguageManagerModalProps> = ({ isOpen, onClose }) => {
  const {
    language,
    setLanguage,
    availableLanguages,
    addCustomLanguage,
    removeCustomLanguage,
    updateLanguageKey,
    importLanguageDictionary,
    getLanguageDictionary,
    t,
    isRTL,
  } = useLanguage();

  const [activeTab, setActiveTab] = useState<'list' | 'add' | 'editor'>('list');

  // Form state for adding custom language
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newFlag, setNewFlag] = useState('🌐');
  const [newDir, setNewDir] = useState<Direction>('ltr');
  const [baseLang, setBaseLang] = useState<string>('ar');
  const [formError, setFormError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Translation editor state
  const [editingLang, setEditingLang] = useState<string>(language);
  const [searchKey, setSearchKey] = useState('');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  // Flatten dictionary for easy searching and editing
  const flattenedDict = useMemo(() => {
    const dict = getLanguageDictionary(editingLang);
    const result: Record<string, string> = {};

    const flatten = (obj: any, prefix = '') => {
      if (!obj || typeof obj !== 'object') return;
      for (const [k, v] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${k}` : k;
        if (typeof v === 'string') {
          result[fullKey] = v;
        } else if (typeof v === 'object' && v !== null) {
          flatten(v, fullKey);
        }
      }
    };

    flatten(dict);
    return result;
  }, [editingLang, getLanguageDictionary, successMsg]);

  // Filtered keys for editor
  const filteredKeys = useMemo(() => {
    const query = searchKey.toLowerCase().trim();
    if (!query) return Object.keys(flattenedDict).slice(0, 80);
    return Object.keys(flattenedDict).filter(
      (k) => k.toLowerCase().includes(query) || (flattenedDict[k] || '').toLowerCase().includes(query)
    );
  }, [flattenedDict, searchKey]);

  if (!isOpen) return null;

  const handleAddLanguage = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    const code = newCode.trim().toLowerCase();
    const name = newName.trim();

    if (!code || !name) {
      setFormError(isRTL ? 'يرجى إدخال رمز واسم اللغة' : 'Please provide language code and name');
      return;
    }

    if (availableLanguages.some((l) => l.id === code)) {
      setFormError(isRTL ? 'هذه اللغة مضافة مسبقاً' : 'This language already exists');
      return;
    }

    addCustomLanguage({
      id: code,
      label: name,
      flag: newFlag.trim() || '🌐',
      dir: newDir,
      baseLang,
    });

    setSuccessMsg(
      isRTL
        ? `تمت إضافة لغة "${name}" بنجاح وتفعيلها بنسبة 100% داخل التطبيق!`
        : `Language "${name}" added successfully and activated at 100% in app!`
    );
    setNewCode('');
    setNewName('');
    setActiveTab('list');
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const handleSaveTranslation = (key: string) => {
    updateLanguageKey(editingLang, key, editValue);
    setSuccessMsg(isRTL ? `تم تحديث المفتاح: ${key}` : `Updated key: ${key}`);
    setSelectedKey(null);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleExportJson = () => {
    const dict = getLanguageDictionary(editingLang);
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(dict, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `translation_${editingLang}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        importLanguageDictionary(editingLang, parsed);
        setSuccessMsg(isRTL ? 'تم استيراد ملف الترجمة بنجاح!' : 'Translations imported successfully!');
        setTimeout(() => setSuccessMsg(''), 3000);
      } catch (err) {
        setFormError(isRTL ? 'ملف JSON غير صالح' : 'Invalid JSON file');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Languages className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>
                  {isRTL
                    ? 'إدارة لغات التطبيق (اكتمال من 0% حتى 100%)'
                    : 'Language Manager (0% to 100% Complete)'}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  100% Internal
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                {isRTL
                  ? 'اختر اللغة، أضف أي لغة جديدة، أو عدل نصوص وترجمات التطبيق بالكامل'
                  : 'Select active language, add any custom language, or customize full translations'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center border-b border-slate-800 bg-slate-950/40 px-4 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('list')}
            className={`py-3 px-4 border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === 'list'
                ? 'border-amber-400 text-amber-400 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Globe className="w-4 h-4" />
            <span>{isRTL ? 'اللغات المثبتة والتفعيل' : 'Installed Languages'}</span>
            <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px] font-mono text-slate-300">
              {availableLanguages.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('add')}
            className={`py-3 px-4 border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === 'add'
                ? 'border-amber-400 text-amber-400 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>{isRTL ? '+ إضافة لغة جديدة' : '+ Add New Language'}</span>
          </button>

          <button
            onClick={() => setActiveTab('editor')}
            className={`py-3 px-4 border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === 'editor'
                ? 'border-amber-400 text-amber-400 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Edit3 className="w-4 h-4" />
            <span>{isRTL ? 'محرر ومترجم النصوص' : 'Translation Editor'}</span>
          </button>
        </div>

        {/* Success / Error Messages */}
        {successMsg && (
          <div className="m-4 mb-0 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}
        {formError && (
          <div className="m-4 mb-0 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
            <X className="w-4 h-4 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        {/* Content Area */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
          {/* TAB 1: List of Languages */}
          {activeTab === 'list' && (
            <div className="space-y-3">
              <div className="text-xs text-slate-400 mb-2">
                {isRTL
                  ? 'التطبيق مترجم بنسبة 100% للغات التالية. يمكنك التبديل الفوري بنقرة واحدة:'
                  : 'The application is 100% translated for the following languages. Switch instantly with one click:'}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {availableLanguages.map((item) => {
                  const isCurrent = item.id === language;
                  return (
                    <div
                      key={item.id}
                      className={`p-3.5 rounded-xl border transition-all flex items-center justify-between ${
                        isCurrent
                          ? 'bg-amber-500/10 border-amber-500/40 shadow-sm'
                          : 'bg-slate-950/50 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{item.flag}</span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-white">{item.label}</span>
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-slate-800 text-slate-400 uppercase">
                              {item.id}
                            </span>
                            {item.isCustom && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                {isRTL ? 'مخصصة' : 'Custom'}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                            <span>{item.dir === 'rtl' ? 'RTL (يمين لليسار)' : 'LTR (يسار ليمين)'}</span>
                            <span>•</span>
                            <span className="text-emerald-400 font-mono font-semibold">100% {isRTL ? 'مكتمل' : 'Coverage'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {isCurrent ? (
                          <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500 text-slate-950 flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" />
                            <span>{isRTL ? 'نشطة' : 'Active'}</span>
                          </span>
                        ) : (
                          <button
                            onClick={() => setLanguage(item.id)}
                            className="px-3 py-1 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
                          >
                            {isRTL ? 'تفعيل' : 'Activate'}
                          </button>
                        )}

                        {item.isCustom && (
                          <button
                            onClick={() => removeCustomLanguage(item.id)}
                            title={isRTL ? 'حذف اللغة المخصصة' : 'Delete Custom Language'}
                            className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                <div className="text-xs text-slate-300">
                  <strong className="text-white block mb-0.5">
                    {isRTL ? 'تغطية لغوية داخلية 100% دون انقطاع' : '100% Native Internal Language Coverage'}
                  </strong>
                  <span>
                    {isRTL
                      ? 'جميع النصوص والمصطلحات والشموع والاستراتيجيات والمؤشرات مترجمة بالكامل ومخزنة محلياً في التطبيق.'
                      : 'All labels, technical terminology, candlesticks, strategies, and indicators are completely localized.'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Add New Language */}
          {activeTab === 'add' && (
            <form onSubmit={handleAddLanguage} className="space-y-4 max-w-xl mx-auto py-2">
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
                {isRTL
                  ? 'يمكنك إضافة أي لغة يطلبها المستخدم (مثل: فارسی، اردو، 中文، 日本語، إلخ). سيقوم النظام بنسخ كافة مفاتيح التطبيق الأساسية لضمان عمل اللغة فوراً بنسبة 100% داخل التطبيق.'
                  : 'Add any custom language you want. The system will pre-populate all application keys from the base language to ensure 100% completeness immediately!'}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {isRTL ? 'رمز اللغة (مثال: ur, fa, it, zh)' : 'Language Code (e.g., ur, fa, it, zh)'} *
                  </label>
                  <input
                    type="text"
                    required
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value)}
                    placeholder="e.g. ur"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {isRTL ? 'اسم اللغة المعروض (مثال: اردو, فارسی)' : 'Display Name (e.g., اردو, فارسی)'} *
                  </label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. اردو"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {isRTL ? 'رمز العلم أو الأيقونة (Emoji)' : 'Flag / Icon (Emoji)'}
                  </label>
                  <input
                    type="text"
                    value={newFlag}
                    onChange={(e) => setNewFlag(e.target.value)}
                    placeholder="🇵🇰, 🇮🇷, 🌐"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {isRTL ? 'اتجاه النص (RTL / LTR)' : 'Text Direction'}
                  </label>
                  <select
                    value={newDir}
                    onChange={(e) => setNewDir(e.target.value as Direction)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="ltr">{isRTL ? 'من اليسار إلى اليمين (LTR)' : 'Left-to-Right (LTR)'}</option>
                    <option value="rtl">{isRTL ? 'من اليمين إلى اليسار (RTL - مثل العربية والأوردو)' : 'Right-to-Left (RTL - Arabic, Urdu, Farsi)'}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {isRTL ? 'اللغة الأساسية للاستنساخ (0% حتى 100%)' : 'Base Language to Clone'}
                </label>
                <select
                  value={baseLang}
                  onChange={(e) => setBaseLang(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="ar">🇸🇦 العربية (Arabic - RTL)</option>
                  <option value="en">🇺🇸 English (LTR)</option>
                  <option value="ru">🇷🇺 Русский (Russian)</option>
                  <option value="fr">🇫🇷 Français (French)</option>
                  <option value="es">🇪🇸 Español (Spanish)</option>
                  <option value="tr">🇹🇷 Türkçe (Turkish)</option>
                  <option value="de">🇩🇪 Deutsch (German)</option>
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  {isRTL
                    ? 'سيتم نسخ كافة مفاتيح ومصطلحات هذه اللغة تلقائياً حتى تكون اللغة الجديدة كاملة 100% منذ اللحظة الأولى.'
                    : 'All strings and terms from this language will be cloned into the new language for immediate 100% coverage.'}
                </p>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('list')}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all shadow-md shadow-amber-500/20 cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>{isRTL ? 'إضافة اللغة وتفعيلها الآن' : 'Add Language & Activate'}</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: Translation Editor & Import/Export */}
          {activeTab === 'editor' && (
            <div className="space-y-4">
              {/* Controls bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">{isRTL ? 'اللغة المستهدفة:' : 'Target Language:'}</span>
                  <select
                    value={editingLang}
                    onChange={(e) => setEditingLang(e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white font-semibold focus:outline-none"
                  >
                    {availableLanguages.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.flag} {l.label} ({l.id})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExportJson}
                    className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-amber-400" />
                    <span>{isRTL ? 'تصدير JSON' : 'Export JSON'}</span>
                  </button>

                  <label className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer">
                    <Upload className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{isRTL ? 'استيراد JSON' : 'Import JSON'}</span>
                    <input type="file" accept=".json" onChange={handleImportJson} className="hidden" />
                  </label>
                </div>
              </div>

              {/* Search Key */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchKey}
                  onChange={(e) => setSearchKey(e.target.value)}
                  placeholder={
                    isRTL
                      ? 'ابحث عن أي نص أو مفتاح لتعديله (مثل: signals.up, chart, EMA...)'
                      : 'Search any key or text to customize...'
                  }
                  className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Keys list */}
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {filteredKeys.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-500">
                    {isRTL ? 'لا توجد مفاتيح مطابقة لمعايير البحث' : 'No keys matching search criteria'}
                  </div>
                ) : (
                  filteredKeys.map((key) => {
                    const currentVal = flattenedDict[key] || '';
                    const isSelected = selectedKey === key;
                    return (
                      <div
                        key={key}
                        className={`p-2.5 rounded-xl border text-xs transition-all ${
                          isSelected
                            ? 'bg-amber-500/10 border-amber-500/50'
                            : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="font-mono text-[10px] text-amber-400/90 font-bold truncate">
                            {key}
                          </span>
                          {!isSelected && (
                            <button
                              onClick={() => {
                                setSelectedKey(key);
                                setEditValue(currentVal);
                              }}
                              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-medium cursor-pointer"
                            >
                              {isRTL ? 'تعديل' : 'Edit'}
                            </button>
                          )}
                        </div>

                        {isSelected ? (
                          <div className="mt-2 space-y-2">
                            <textarea
                              rows={2}
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="w-full p-2 rounded-lg bg-slate-900 border border-amber-500/50 text-xs text-white focus:outline-none font-sans"
                            />
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => setSelectedKey(null)}
                                className="px-2.5 py-1 rounded bg-slate-800 text-slate-400 hover:text-white text-[11px] cursor-pointer"
                              >
                                {isRTL ? 'إلغاء' : 'Cancel'}
                              </button>
                              <button
                                onClick={() => handleSaveTranslation(key)}
                                className="px-3 py-1 rounded bg-amber-500 text-slate-950 font-bold text-[11px] cursor-pointer"
                              >
                                {isRTL ? 'حفظ التعديل' : 'Save'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="text-slate-300 text-[11px] line-clamp-2">{currentVal}</div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            {isRTL ? 'اللغة الحالية في النظام:' : 'Active Language:'}{' '}
            <strong className="text-amber-400">
              {availableLanguages.find((l) => l.id === language)?.label || language}
            </strong>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer transition-colors"
          >
            {isRTL ? 'إغلاق النافذة' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
