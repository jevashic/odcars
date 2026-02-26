import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { esFallback } from '@/i18n/es';

type Lang = 'es' | 'en' | 'de';

interface LangCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LangCtx>({
  lang: 'es',
  setLang: () => {},
  t: (k) => esFallback[k] ?? k,
});

export const useLang = () => useContext(LanguageContext);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('es');
  const [translations, setTranslations] = useState<Record<string, string>>(esFallback);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    document.documentElement.lang = l;
  }, []);

  useEffect(() => {
    if (lang === 'es') {
      setTranslations(esFallback);
      return;
    }
    supabase
      .from('translations')
      .select('key, value')
      .eq('lang', lang)
      .then(({ data }) => {
        if (data && data.length > 0) {
          const map: Record<string, string> = {};
          data.forEach((r: any) => { map[r.key] = r.value; });
          setTranslations({ ...esFallback, ...map });
        } else {
          setTranslations(esFallback);
        }
      });
  }, [lang]);

  const t = useCallback((key: string) => translations[key] ?? esFallback[key] ?? key, [translations]);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}
