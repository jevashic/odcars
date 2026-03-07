import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Banner {
  id: string;
  name: string;
  image_url: string;
  link_url: string | null;
  link_target: string | null;
  position: string;
  sort_order: number;
}

interface BannerContextType {
  banners: Banner[];
}

const BannerContext = createContext<BannerContextType>({ banners: [] });

export function BannerProvider({ children }: { children: ReactNode }) {
  const [banners, setBanners] = useState<Banner[]>([]);

  useEffect(() => {
    const hoy = new Date().toISOString().split('T')[0];
    supabase
      .from('banners')
      .select('id, name, image_url, link_url, link_target, position, sort_order')
      .eq('is_active', true)
      .lte('valid_from', hoy)
      .or(`valid_until.is.null,valid_until.gte.${hoy}`)
      .order('sort_order')
      .then(({ data }) => {
        if (data) setBanners(data as Banner[]);
      });
  }, []);

  return (
    <BannerContext.Provider value={{ banners }}>
      {children}
    </BannerContext.Provider>
  );
}

export function useBanners() {
  return useContext(BannerContext);
}
