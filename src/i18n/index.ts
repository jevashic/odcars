import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { es } from './es';
import { en } from './en';
import { de } from './de';

const SUPPORTED_LANGS = ['es', 'en', 'de'] as const;
export type Lang = (typeof SUPPORTED_LANGS)[number];
export const isSupportedLang = (l: string): l is Lang => (SUPPORTED_LANGS as readonly string[]).includes(l);

i18n
  .use(initReactI18next)
  .init({
    lng: 'es',
    fallbackLng: 'es',
    supportedLngs: [...SUPPORTED_LANGS],
    ns: ['translation'],
    defaultNS: 'translation',
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
    resources: {
      es: { translation: es },
      en: { translation: en },
      de: { translation: de },
    },
  });

export default i18n;
