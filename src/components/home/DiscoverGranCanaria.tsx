import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLang } from '@/contexts/LanguageContext';

interface Place { slug: string; name: string; short_description: string; cover: string; }

const fallbackPlaces: Place[] = [
  { slug: 'dunas-maspalomas', name: 'Dunas de Maspalomas', short_description: 'Paisaje desértico único junto al océano', cover: 'https://images.unsplash.com/photo-1500375592092-40eb2168fd21?w=600&q=80' },
  { slug: 'roque-nublo', name: 'Roque Nublo', short_description: 'Símbolo natural de Gran Canaria', cover: 'https://images.unsplash.com/photo-1482938289607-e9573fc25ebb?w=600&q=80' },
  { slug: 'puerto-mogan', name: 'Puerto de Mogán', short_description: 'La pequeña Venecia de Canarias', cover: 'https://images.unsplash.com/photo-1506929562872-bb421503ef21?w=600&q=80' },
  { slug: 'vegueta', name: 'Vegueta', short_description: 'Casco histórico de Las Palmas', cover: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=600&q=80' },
  { slug: 'tejeda', name: 'Tejeda', short_description: 'Uno de los pueblos más bonitos de España', cover: 'https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07?w=600&q=80' },
  { slug: 'playa-amadores', name: 'Playa de Amadores', short_description: 'Aguas cristalinas y arena blanca', cover: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&q=80' },
];

export default function DiscoverGranCanaria() {
  const { t, lang } = useLang();
  const [places, setPlaces] = useState<Place[]>(fallbackPlaces);

  useEffect(() => {
    supabase
      .from('tourist_places')
      .select('slug, tourist_place_translations(name, short_description), tourist_place_photos(url)')
      .eq('is_featured', true)
      .eq('is_active', true)
      .order('sort_order')
      .limit(6)
      .then(({ data }) => {
        if (data && data.length > 0) {
          setPlaces(data.map((p: any) => ({
            slug: p.slug,
            name: p.tourist_place_translations?.[0]?.name ?? p.slug,
            short_description: p.tourist_place_translations?.[0]?.short_description ?? '',
            cover: p.tourist_place_photos?.[0]?.url ?? fallbackPlaces[0].cover,
          })));
        }
      });
  }, [lang]);

  return (
    <section className="section-padding bg-card">
      <div className="container">
        <h2 className="section-title">{t('discover.title')}</h2>
        <div className="section-line" />
        <p className="section-subtitle mb-10">{t('discover.subtitle')}</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {places.map((place) => (
            <Link
              key={place.slug}
              to={`/conoce-gran-canaria/${place.slug}`}
              className="group rounded-2xl overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.08)] hover:shadow-lg transition-shadow"
            >
              <div className="relative aspect-[4/3] overflow-hidden">
                <img src={place.cover} alt={place.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/60 transition-colors duration-300 flex items-center justify-center">
                  <span className="text-white font-bold opacity-0 group-hover:opacity-100 transition-opacity border border-white px-4 py-2 rounded-lg">
                    {t('discover.button')} →
                  </span>
                </div>
              </div>
              <div className="bg-card p-4">
                <h3 className="font-bold text-foreground">{place.name}</h3>
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{place.short_description}</p>
              </div>
            </Link>
          ))}
        </div>

        <div className="text-center mt-10">
          <Link to="/conoce-gran-canaria" className="inline-flex items-center gap-2 bg-cta text-cta-foreground font-bold px-6 py-3 rounded-lg hover:opacity-90 transition-opacity">
            {t('discover.see_all')} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
