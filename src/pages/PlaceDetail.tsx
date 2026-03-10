import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MapPin, Car, ChevronRight, ArrowLeft } from 'lucide-react';
import BannerZone from '@/components/home/BannerZone';
import { supabase } from '@/integrations/supabase/client';
import PublicLayout from '@/components/layout/PublicLayout';
import { useLang } from '@/contexts/LanguageContext';
import { useLangPath } from '@/hooks/useLangNavigate';
import { useIsMobile } from '@/hooks/use-mobile';
import useEmblaCarousel from 'embla-carousel-react';

const PLACEHOLDER_PHOTOS = [
  'https://images.unsplash.com/photo-1580746738099-78d6833b3301?w=800&q=80',
  'https://images.unsplash.com/photo-1590523741831-ab7e8b8f9c7f?w=800&q=80',
  'https://images.unsplash.com/photo-1500313830540-7b6650a74fd0?w=800&q=80',
];

function MobilePhotoCarousel({ photos, altName }: { photos: string[]; altName: string }) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false });
  const [current, setCurrent] = useState(0);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setCurrent(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on('select', onSelect);
    return () => { emblaApi.off('select', onSelect); };
  }, [emblaApi, onSelect]);

  const scrollNext = useCallback(() => {
    emblaApi?.scrollNext();
  }, [emblaApi]);

  return (
    <div className="relative -mx-4 mb-6">
      {/* Counter */}
      <div className="absolute top-3 right-3 z-10 bg-black/60 text-white text-xs font-semibold px-2.5 py-1 rounded-full">
        {current + 1} / {photos.length}
      </div>

      {/* Carousel */}
      <div ref={emblaRef} className="overflow-hidden">
        <div className="flex">
          {photos.map((url, i) => (
            <div key={i} className="min-w-0 shrink-0 grow-0 basis-full">
              <img
                src={url}
                alt={`${altName} – foto ${i + 1}`}
                className="w-full aspect-[4/3] object-cover"
                loading="lazy"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Next arrow */}
      {current < photos.length - 1 && (
        <button
          onClick={scrollNext}
          className="absolute right-2 top-1/2 -translate-y-1/2 z-10 bg-black/40 hover:bg-black/60 text-white rounded-full p-1.5 transition-colors"
          aria-label="Siguiente foto"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}

export default function PlaceDetail() {
  const { slug } = useParams();
  const { t, lang } = useLang();
  const lp = useLangPath();
  const isMobile = useIsMobile();
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

  const backLink = (
    <Link to={lp('/conoce-gran-canaria')} className="inline-flex items-center gap-2 text-primary font-semibold hover:underline">
      <ArrowLeft className="h-4 w-4" /> {t('discover.back')}
    </Link>
  );

  return (
    <PublicLayout>
      <div className="pt-20 section-padding">
        <div className="container max-w-4xl">
          <div className="mb-6">{backLink}</div>

          {/* Photo gallery: carousel on mobile, grid on desktop */}
          {isMobile ? (
            <MobilePhotoCarousel photos={photos} altName={tr?.name ?? 'Gran Canaria'} />
          ) : (
            <div className="grid grid-cols-3 gap-3 mb-8">
              {photos.map((url, i) => (
                <img key={i} src={url} alt={`${tr?.name ?? 'Gran Canaria'} – foto ${i + 1}`} className="w-full aspect-[4/3] object-cover rounded-xl" loading="lazy" />
              ))}
            </div>
          )}

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

          <BannerZone position="gc_bottom" />

          {/* Bottom back button */}
          <div className="mt-10 mb-4">{backLink}</div>
        </div>
      </div>
    </PublicLayout>
  );
}
