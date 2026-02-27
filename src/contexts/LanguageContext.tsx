import { createContext, useContext, useCallback, ReactNode, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import i18n, { isSupportedLang, type Lang } from '@/i18n';

interface LangCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LangCtx>({
  lang: 'es',
  setLang: () => {},
  t: (k) => k,
});

export const useLang = () => useContext(LanguageContext);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { lang: paramLang } = useParams<{ lang: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { t: i18t } = useTranslation();

  const lang: Lang = paramLang && isSupportedLang(paramLang) ? paramLang : 'es';

  // Sync i18next language with URL param
  useEffect(() => {
    if (i18n.language !== lang) {
      i18n.changeLanguage(lang);
    }
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback(
    (newLang: Lang) => {
      // Replace /:oldLang/ with /:newLang/ in current path
      const currentPath = location.pathname;
      const rest = currentPath.replace(/^\/(es|en|de|sv|no|fr)/, '');
      navigate(`/${newLang}${rest || '/'}${location.search}`, { replace: true });
    },
    [navigate, location],
  );

  const t = useCallback(
    (key: string) => {
      const val = i18t(key);
      return val === key ? key : val;
    },
    [i18t],
  );

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}
