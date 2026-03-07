import { useEffect, useState } from 'react';
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

export default function BannerSection({ position = 'home_middle' }: { position?: string }) {
  const [banners, setBanners] = useState<Banner[]>([]);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    supabase
      .from('banners')
      .select('id, name, image_url, link_url, link_target, position, sort_order')
      .eq('is_active', true)
      .eq('position', position)
      .lte('valid_from', today)
      .or(`valid_until.is.null,valid_until.gte.${today}`)
      .order('sort_order')
      .then(({ data }) => {
        if (data && data.length > 0) setBanners(data as Banner[]);
      });
  }, [position]);

  if (banners.length === 0) return null;

  return (
    <section className="px-4 md:px-10 py-4 space-y-4">
      {banners.map((banner) => {
        const Wrapper = banner.link_url ? 'a' : 'div';
        const linkProps = banner.link_url
          ? { href: banner.link_url, target: banner.link_target || '_blank', rel: 'noopener noreferrer' }
          : {};
        return (
          <Wrapper key={banner.id} {...linkProps} className="block">
            <img
              src={banner.image_url}
              alt={banner.name || 'Promoción'}
              className="w-full max-h-[200px] object-cover rounded-xl"
              loading="lazy"
            />
          </Wrapper>
        );
      })}
    </section>
  );
}
