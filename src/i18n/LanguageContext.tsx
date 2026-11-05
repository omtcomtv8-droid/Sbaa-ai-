import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { LanguageInfo, Direction, LanguageContextType } from './types';
import { en } from './en';
import { ar } from './ar';
import { ru } from './ru';
import { fr } from './fr';
import { es } from './es';
import { tr } from './tr';
import { de } from './de';
import { translateTerm, translateDynamicMessage } from './terminology';
import { Globe, Check, Settings2, Plus } from 'lucide-react';
import { LanguageManagerModal } from '../components/LanguageManagerModal';

// Built-in dictionaries
const baseDictionaries: Record<string, any> = { en, ar, ru, fr, es, tr, de };

// Built-in language definitions
const defaultLanguages: LanguageInfo[] = [
  { id: 'ar', label: 'العربية', flag: '🇸🇦', dir: 'rtl', completionPercent: 100 },
  { id: 'en', label: 'English', flag: '🇺🇸', dir: 'ltr', completionPercent: 100 },
  { id: 'ru', label: 'Русский', flag: '🇷🇺', dir: 'ltr', completionPercent: 100 },
  { id: 'fr', label: 'Français', flag: '🇫🇷', dir: 'ltr', completionPercent: 100 },
  { id: 'es', label: 'Español', flag: '🇪🇸', dir: 'ltr', completionPercent: 100 },
  { id: 'tr', label: 'Türkçe', flag: '🇹🇷', dir: 'ltr', completionPercent: 100 },
  { id: 'de', label: 'Deutsch', flag: '🇩🇪', dir: 'ltr', completionPercent: 100 },
];

const LanguageContext = createContext<LanguageContextType | null>(null);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // 1. Custom languages list from localStorage
  const [customLanguages, setCustomLanguages] = useState<LanguageInfo[]>(() => {
    try {
      const saved = localStorage.getItem('sabaa_custom_languages');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {}
    return [];
  });

  // 2. Custom dictionaries from localStorage
  const [customDicts, setCustomDicts] = useState<Record<string, any>>(() => {
    try {
      const saved = localStorage.getItem('sabaa_custom_dicts');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {}
    return {};
  });

  // Available languages = default + custom
  const availableLanguages = useMemo(() => {
    return [...defaultLanguages, ...customLanguages];
  }, [customLanguages]);

  // 3. Current active language
  const [language, setLanguageState] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('selectedLanguage');
      if (saved) {
        return saved;
      }
    } catch {}
    // Default to 'ar' (Arabic) if document lang is ar or default
    if (typeof document !== 'undefined' && document.documentElement.lang === 'ar') {
      return 'ar';
    }
    return 'ar';
  });

  const activeLangInfo = availableLanguages.find((l) => l.id === language) || defaultLanguages[0];
  const isRTL = activeLangInfo.dir === 'rtl';
  const dir: Direction = activeLangInfo.dir;

  // Persist language and update DOM
  useEffect(() => {
    try {
      localStorage.setItem('selectedLanguage', language);
    } catch {}
    if (typeof document !== 'undefined') {
      document.documentElement.lang = language;
      document.documentElement.dir = dir;
    }
  }, [language, dir]);

  // Set language callback
  const setLanguage = useCallback((newLang: string) => {
    setLanguageState(newLang);
  }, []);

  // Add custom language
  const addCustomLanguage = useCallback(
    ({
      id,
      label,
      flag,
      dir: lDir,
      baseLang = 'ar',
    }: {
      id: string;
      label: string;
      flag: string;
      dir: Direction;
      baseLang?: string;
    }) => {
      const newLangInfo: LanguageInfo = {
        id,
        label,
        flag: flag || '🌐',
        dir: lDir,
        isCustom: true,
        completionPercent: 100,
      };

      const updatedLangs = [...customLanguages.filter((l) => l.id !== id), newLangInfo];
      setCustomLanguages(updatedLangs);
      try {
        localStorage.setItem('sabaa_custom_languages', JSON.stringify(updatedLangs));
      } catch {}

      // Clone base language dictionary so new language is 100% complete immediately
      const baseDictionary = customDicts[baseLang] || baseDictionaries[baseLang] || baseDictionaries.ar;
      const clonedDict = JSON.parse(JSON.stringify(baseDictionary));

      const updatedDicts = { ...customDicts, [id]: clonedDict };
      setCustomDicts(updatedDicts);
      try {
        localStorage.setItem('sabaa_custom_dicts', JSON.stringify(updatedDicts));
      } catch {}

      // Automatically activate new language
      setLanguageState(id);
    },
    [customLanguages, customDicts]
  );

  // Remove custom language
  const removeCustomLanguage = useCallback(
    (id: string) => {
      const updatedLangs = customLanguages.filter((l) => l.id !== id);
      setCustomLanguages(updatedLangs);
      try {
        localStorage.setItem('sabaa_custom_languages', JSON.stringify(updatedLangs));
      } catch {}

      const updatedDicts = { ...customDicts };
      delete updatedDicts[id];
      setCustomDicts(updatedDicts);
      try {
        localStorage.setItem('sabaa_custom_dicts', JSON.stringify(updatedDicts));
      } catch {}

      if (language === id) {
        setLanguageState('ar');
      }
    },
    [customLanguages, customDicts, language]
  );

  // Update specific translation key
  const updateLanguageKey = useCallback(
    (langId: string, key: string, value: string) => {
      const base = customDicts[langId] || baseDictionaries[langId] || baseDictionaries.ar;
      const cloned = JSON.parse(JSON.stringify(base));

      const keys = key.split('.');
      let current = cloned;
      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]] || typeof current[keys[i]] !== 'object') {
          current[keys[i]] = {};
        }
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = value;

      const updatedDicts = { ...customDicts, [langId]: cloned };
      setCustomDicts(updatedDicts);
      try {
        localStorage.setItem('sabaa_custom_dicts', JSON.stringify(updatedDicts));
      } catch {}
    },
    [customDicts]
  );

  // Import full JSON dictionary
  const importLanguageDictionary = useCallback(
    (langId: string, dictionary: Record<string, any>) => {
      const updatedDicts = { ...customDicts, [langId]: dictionary };
      setCustomDicts(updatedDicts);
      try {
        localStorage.setItem('sabaa_custom_dicts', JSON.stringify(updatedDicts));
      } catch {}
    },
    [customDicts]
  );

  // Get active dictionary for language
  const getLanguageDictionary = useCallback(
    (langId: string): Record<string, any> => {
      return customDicts[langId] || baseDictionaries[langId] || baseDictionaries.ar;
    },
    [customDicts]
  );

  // Translation function t(key, defaultText)
  const t = useCallback(
    (key: string, defaultText?: string): string => {
      const dict = customDicts[language] || baseDictionaries[language] || baseDictionaries.ar;
      const fallbackDict = baseDictionaries.ar; // Arabic primary fallback
      const enDict = baseDictionaries.en;

      const lookup = (targetDict: any): string | undefined => {
        if (!targetDict) return undefined;
        const keys = key.split('.');
        let val: any = targetDict;
        for (const k of keys) {
          if (val && typeof val === 'object' && k in val) {
            val = val[k];
          } else {
            return undefined;
          }
        }
        return typeof val === 'string' ? val : undefined;
      };

      const found = lookup(dict) ?? lookup(fallbackDict) ?? lookup(enDict);
      if (found !== undefined) return found;

      return defaultText !== undefined ? defaultText : key;
    },
    [language, customDicts]
  );

  // Technical term translation function tTerm(term)
  const tTerm = useCallback(
    (term: string): string => {
      // First check technical terminology
      const translated = translateTerm(term, language as any);
      if (translated && translated !== term) return translated;

      // If user language is Arabic and term is English, check Arabic dictionary
      if (language === 'ar') {
        const arabicTerm = translateTerm(term, 'ar');
        if (arabicTerm) return arabicTerm;
      }

      return translated || term;
    },
    [language]
  );

  // Dynamic sentence/message translation function tDynamic(text)
  const tDynamic = useCallback(
    (text: string): string => {
      return translateDynamicMessage(text, language as any);
    },
    [language]
  );

  const contextValue = useMemo(
    () => ({
      language,
      setLanguage,
      availableLanguages,
      addCustomLanguage,
      removeCustomLanguage,
      updateLanguageKey,
      importLanguageDictionary,
      getLanguageDictionary,
      t,
      tTerm,
      tDynamic,
      dir,
      isRTL,
    }),
    [
      language,
      setLanguage,
      availableLanguages,
      addCustomLanguage,
      removeCustomLanguage,
      updateLanguageKey,
      importLanguageDictionary,
      getLanguageDictionary,
      t,
      tTerm,
      tDynamic,
      dir,
      isRTL,
    ]
  );

  return <LanguageContext.Provider value={contextValue}>{children}</LanguageContext.Provider>;
};

export function useLanguage(): LanguageContextType {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}

export const LanguageSwitcher: React.FC<{ className?: string; compact?: boolean }> = ({
  className = '',
  compact = false,
}) => {
  const { language, setLanguage, availableLanguages, isRTL } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [isManagerOpen, setIsManagerOpen] = useState(false);

  const activeLang = availableLanguages.find((l) => l.id === language) || availableLanguages[0];

  return (
    <>
      <div className={`relative inline-block ${className}`} id="language-switcher-container">
        <button
          id="btn-language-selector"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-semibold transition-colors cursor-pointer select-none"
          title="Change Application Language / تغيير لغة التطبيق / Сменить язык"
        >
          <Globe className="w-3.5 h-3.5 text-amber-400" />
          <span>{activeLang.flag}</span>
          <span>{compact ? activeLang.label : activeLang.label}</span>
        </button>

        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <div className="absolute right-0 mt-1.5 w-44 bg-slate-900 border border-slate-800 rounded-xl shadow-xl shadow-black/50 z-50 py-1 overflow-hidden">
              <div className="max-h-60 overflow-y-auto">
                {availableLanguages.map((item) => {
                  const isSelected = item.id === language;
                  return (
                    <button
                      key={item.id}
                      id={`lang-opt-${item.id}`}
                      onClick={() => {
                        setLanguage(item.id);
                        setIsOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-left transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-amber-500/10 text-amber-400 font-bold'
                          : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span>{item.flag}</span>
                        <span>{item.label}</span>
                      </span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-amber-400" />}
                    </button>
                  );
                })}
              </div>

              {/* Language Manager / Add Language Button */}
              <div className="border-t border-slate-800 p-1 bg-slate-950/60">
                <button
                  onClick={() => {
                    setIsOpen(false);
                    setIsManagerOpen(true);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-amber-400 hover:bg-slate-800/80 rounded-lg transition-colors cursor-pointer font-semibold"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isRTL ? 'إدارة اللغات (+)' : 'Language Manager (+)'}</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Language Manager Modal */}
      <LanguageManagerModal isOpen={isManagerOpen} onClose={() => setIsManagerOpen(false)} />
    </>
  );
};
