import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getLocales } from "expo-localization";
import { translations, Language, TranslationKey } from "@/i18n/translations";

const LANG_KEY = "fleettool_language";

function deviceLanguage(): Language {
  const tag = getLocales()[0]?.languageCode ?? "en";
  return tag === "sv" ? "sv" : "en";
}

type LanguageContextType = {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
};

const LanguageContext = createContext<LanguageContextType | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(deviceLanguage);

  useEffect(() => {
    AsyncStorage.getItem(LANG_KEY).then((stored) => {
      if (stored === "en" || stored === "sv") setLanguageState(stored);
    });
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    void AsyncStorage.setItem(LANG_KEY, lang);
  };

  const t = (key: TranslationKey, params?: Record<string, string | number>): string => {
    let str = translations[language][key] as string;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        str = str.replace(`{${k}}`, String(v));
      });
    }
    return str;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
