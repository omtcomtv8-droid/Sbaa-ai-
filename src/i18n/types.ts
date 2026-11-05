export type BuiltInLanguage = 'ar' | 'en' | 'ru' | 'fr' | 'es' | 'tr' | 'de';
export type Language = BuiltInLanguage | (string & {});

export type Direction = 'rtl' | 'ltr';

export interface LanguageInfo {
  id: string;
  label: string;
  flag: string;
  dir: Direction;
  isCustom?: boolean;
  completionPercent?: number;
}

export interface LanguageContextType {
  language: string;
  setLanguage: (lang: string) => void;
  availableLanguages: LanguageInfo[];
  addCustomLanguage: (lang: { id: string; label: string; flag: string; dir: Direction; baseLang?: string }) => void;
  removeCustomLanguage: (id: string) => void;
  updateLanguageKey: (langId: string, key: string, value: string) => void;
  importLanguageDictionary: (langId: string, dictionary: Record<string, any>) => void;
  getLanguageDictionary: (langId: string) => Record<string, any>;
  t: (key: string, defaultText?: string) => string;
  tTerm: (term: string) => string;
  tDynamic: (text: string) => string;
  dir: Direction;
  isRTL: boolean;
}
