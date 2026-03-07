import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import PublicLayout from '@/components/layout/PublicLayout';
import { useLang } from '@/contexts/LanguageContext';
import { useLangPath } from '@/hooks/useLangNavigate';
import BannerZone from '@/components/home/BannerZone';

export default function DiscoverGC() {
  const { t, lang } = useLang();
  const lp = useLangPath();
  const [places, setPlaces] = useState<any[]>([]);

  useEffect(() => {
    supabase
      .from('tourist_places')
      .select('*, tourist_place_translations(*), tourist_place_photos(*)')
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data }) => {
        if (data) setPlaces(data);
      });
  }, []);

  const half = Math.ceil(places.length / 2);
  const firstHalf = places.slice(0, half);
  const secondHalf = places.slice(half);

  const renderCard = (p: any) => {
    const tr = p.tourist_place_translations?.find((t: any) => t.lang === lang) ?? p.tourist_place_translations?.[0];
    const cover = p.tourist_place_photos?.find((ph: any) => ph.is_cover)?.url ?? p.tourist_place_photos?.[0]?.url;
    return (
      <Link key={p.id} to={lp(`/conoce-gran-canaria/${p.slug}`)} className="group rounded-2xl overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.08)] bg-card hover:shadow-lg transition-shadow">
        <div className="aspect-[4/3] overflow-hidden">
          <img src={cover} alt={tr?.name ?? p.slug} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
        </div>
        <div className="p-4">
          <h3 className="font-bold text-foreground">{tr?.name ?? p.slug}</h3>
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{tr?.short_description}</p>
        </div>
      </Link>
    );
  };

  return (
    <PublicLayout>
      <div className="relative h-[400px] bg-cover bg-center" style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1500375592092-40eb2168fd21?w=1920&q=80)' }}>
        <div className="absolute inset-0 bg-primary/60" />
        <div className="relative z-10 h-full flex items-center justify-center">
          <h1 className="text-4xl md:text-5xl font-black text-white text-center">{t('discover.title')}</h1>
        </div>
      </div>
      <BannerZone position="gc_top" />
      <div className="section-padding bg-accent">
        <div className="container">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {firstHalf.map(renderCard)}
          </div>
        </div>
      </div>
      <BannerZone position="gc_between" />
      {secondHalf.length > 0 && (
        <div className="section-padding bg-accent">
          <div className="container">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {secondHalf.map(renderCard)}
            </div>
          </div>
        </div>
      )}
      <BannerZone position="gc_bottom" />
      {places.length === 0 && (
        <div className="section-padding bg-accent">
          <div className="container">
            <p className="text-center text-muted-foreground mt-10">{t('discover.loading')}</p>
          </div>
        </div>
      )}
    </PublicLayout>
  );
}
