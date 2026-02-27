import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MapPin, Car } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import PublicLayout from '@/components/layout/PublicLayout';
import { useLang } from '@/contexts/LanguageContext';
import { useLangPath } from '@/hooks/useLangNavigate';

const PLACEHOLDER_PHOTOS = [
  'https://images.unsplash.com/photo-1580746738099-78d6833b3301?w=800&q=80',
  'https://images.unsplash.com/photo-1590523741831-ab7e8b8f9c7f?w=800&q=80',
  'https://images.unsplash.com/photo-1500313830540-7b6650a74fd0?w=800&q=80',
];

export default function PlaceDetail() {
  const { slug } = useParams();
  const { t, lang } = useLang();
  const lp = useLangPath();
  const [place, setPlace] = useState<any>(null);
  const [photos, setPhotos] = useState<string[]>([]);

  useEffect(() => {
    if (!slug) return;
    supabase
      .from('tourist_places')
      .select('*, tourist_place_translations(*)')
      .eq('slug', slug)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setPlace(data);
          supabase
            .from('tourist_place_photos')
            .select('*')
            .eq('place_id', data.id)
            .order('sort_order', { ascending: true })
            .limit(3)
            .then(({ data: photoData }) => {
              const urls = (photoData ?? [])
                .map((p: any) => p.photo_url || p.url || p.image_url)
                .filter(Boolean);
              setPhotos(urls.length > 0 ? urls : PLACEHOLDER_PHOTOS);
            });
        }
      });
  }, [slug, lang]);

  if (!place) return <PublicLayout><div className="pt-24 text-center text-muted-foreground min-h-screen">{t('place.loading')}</div></PublicLayout>;

  const tr = place.tourist_place_translations?.find((t: any) => t.lang === lang) ?? place.tourist_place_translations?.[0];

  const fallbackDescription = `<p>${tr?.name ?? 'Este lugar'} es uno de los destinos más emblemáticos de Gran Canaria.</p>`;

  return (
    <PublicLayout>
      <div className="pt-20 section-padding">
        <div className="container max-w-4xl">
          <Link to={lp('/conoce-gran-canaria')} className="inline-flex items-center gap-2 text-primary font-semibold hover:underline mb-6">
            {t('discover.back')}
          </Link>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-8">
            {photos.map((url, i) => (
              <img key={i} src={url} alt={`${tr?.name ?? 'Gran Canaria'} – foto ${i + 1}`} className="w-full aspect-[4/3] object-cover rounded-xl" loading="lazy" />
            ))}
          </div>

          <h1 className="text-3xl md:text-4xl font-bold text-primary">{tr?.name}</h1>
          <div className="w-[60px] h-[3px] bg-cta rounded-full mt-3 mb-6" />
          <div className="prose prose-lg max-w-none text-foreground leading-relaxed" dangerouslySetInnerHTML={{ __html: tr?.long_description || tr?.short_description || fallbackDescription }} />
          <div className="flex flex-wrap gap-4 mt-10">
            {place.google_maps_url && (
              <a href={place.google_maps_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 border-2 border-primary text-primary font-bold px-6 py-3 rounded-lg hover:bg-primary hover:text-primary-foreground transition-colors">
                <MapPin className="h-4 w-4" /> {t('place.google_maps')}
              </a>
            )}
            <Link to={lp('/reservar')} className="inline-flex items-center gap-2 bg-cta text-cta-foreground font-bold px-6 py-3 rounded-lg hover:opacity-90 transition-opacity">
              <Car className="h-4 w-4" /> {t('place.book_car')}
            </Link>
          </div>

          {/* Banner 1 – Reservar */}
          <Link to={lp('/reservar')} className="block mt-8 rounded-xl p-8 text-primary-foreground no-underline hover:opacity-95 transition-opacity" style={{ background: 'linear-gradient(135deg, hsl(var(--primary)), #0F2A38)' }}>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="text-2xl">🚗</span>
                <div>
                  <p className="font-bold text-lg text-white">{t('place.banner1_title')}</p>
                  <p className="text-white/70 text-sm mt-1">{t('place.banner1_subtitle')}</p>
                </div>
              </div>
              <span className="inline-flex items-center justify-center bg-cta text-cta-foreground font-bold px-6 py-3 rounded-lg whitespace-nowrap shrink-0">
                {t('place.banner1_cta')}
              </span>
            </div>
          </Link>

          {/* Banner 2 – Ver flota */}
          <Link to={lp('/flota')} className="block mt-4 rounded-xl p-8 bg-cta no-underline hover:opacity-95 transition-opacity">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="text-2xl">🛡️</span>
                <div>
                  <p className="font-bold text-lg text-cta-foreground">{t('place.banner2_title')}</p>
                  <p className="text-cta-foreground/70 text-sm mt-1">{t('place.banner2_subtitle')}</p>
                </div>
              </div>
              <span className="inline-flex items-center justify-center bg-primary text-primary-foreground font-bold px-6 py-3 rounded-lg whitespace-nowrap shrink-0">
                {t('place.banner2_cta')}
              </span>
            </div>
          </Link>
        </div>
      </div>
    </PublicLayout>
  );
}
