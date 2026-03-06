import { useNavigate, useParams, type NavigateOptions } from 'react-router-dom';
import { useCallback } from 'react';
import { type Lang } from '@/i18n';

/** Returns a navigate wrapper that preserves the /:lang prefix */
export function useLangNavigate() {
  const navigate = useNavigate();
  const { lang } = useParams<{ lang: string }>();
  const prefix = `/${lang ?? 'es'}`;

  const langNavigate = useCallback(
    (to: string, options?: NavigateOptions) => {
      const path = to.startsWith('/') ? `${prefix}${to}` : to;
      navigate(path, options);
    },
    [navigate, prefix],
  );

  return langNavigate;
}

/** Build a path with the current lang prefix */
export function useLangPath() {
  const { lang } = useParams<{ lang: string }>();
  const prefix = `/${lang ?? 'es'}`;
  return useCallback((to: string) => (to.startsWith('/') ? `${prefix}${to}` : to), [prefix]);
}
