import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { esFallback } from './es';
import { supabase } from '@/integrations/supabase/client';

const SUPPORTED_LANGS = ['es', 'en', 'de'] as const;
export type Lang = (typeof SUPPORTED_LANGS)[number];
export const isSupportedLang = (l: string): l is Lang => (SUPPORTED_LANGS as readonly string[]).includes(l);

// Cache loaded translations to avoid redundant fetches
const cache: Partial<Record<Lang, Record<string, string>>> = { es: esFallback };

async function loadTranslations(lng: string): Promise<Record<string, string>> {
  if (cache[lng as Lang]) return cache[lng as Lang]!;
  const { data } = await supabase.from('translations').select('key, value').eq('lang', lng);
  const map: Record<string, string> = { ...esFallback };
  if (data) data.forEach((r: any) => { map[r.key] = r.value; });
  cache[lng as Lang] = map;
  return map;
}

const backendPlugin = {
  type: 'backend' as const,
  init() {},
  read(language: string, _namespace: string, callback: (err: any, data?: any) => void) {
    loadTranslations(language).then(
      (data) => callback(null, data),
      (err) => callback(err),
    );
  },
};

i18n
  .use(backendPlugin)
  .use(initReactI18next)
  .init({
    lng: 'es',
    fallbackLng: 'es',
    supportedLngs: [...SUPPORTED_LANGS],
    ns: ['translation'],
    defaultNS: 'translation',
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
    // preload es so it's available synchronously
    resources: { es: { translation: esFallback } },
  });

export default i18n;
