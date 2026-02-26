import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Banner { image_url: string; link_url: string; open_in_new: boolean; }

export default function BannerSection({ position = 'home_middle' }: { position?: string }) {
  const [banner, setBanner] = useState<Banner | null>(null);

  useEffect(() => {
    supabase
      .from('banners')
      .select('*')
      .in('position', [position])
      .eq('is_active', true)
      .order('sort_order')
      .limit(1)
      .single()
      .then(({ data }) => {
        if (data) setBanner({ image_url: (data as any).image_url, link_url: (data as any).link_url, open_in_new: (data as any).open_in_new ?? true });
      });
  }, [position]);

  if (!banner) return null;

  const Wrapper = banner.link_url ? 'a' : 'div';
  const linkProps = banner.link_url ? { href: banner.link_url, target: banner.open_in_new ? '_blank' : '_self', rel: 'noopener noreferrer' } : {};

  return (
    <section className="px-4 md:px-10 py-4">
      <Wrapper {...linkProps} className="block">
        <img
          src={banner.image_url}
          alt="Promoción"
          className="w-full max-h-[200px] object-cover rounded-xl"
          loading="lazy"
        />
      </Wrapper>
    </section>
  );
}
