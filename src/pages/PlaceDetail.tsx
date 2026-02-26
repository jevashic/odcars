import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MapPin, Car } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import PublicLayout from '@/components/layout/PublicLayout';
import { useLang } from '@/contexts/LanguageContext';

export default function PlaceDetail() {
  const { slug } = useParams();
  const { lang } = useLang();
  const [place, setPlace] = useState<any>(null);

  useEffect(() => {
    if (!slug) return;
    supabase
      .from('tourist_places')
      .select('*, tourist_place_translations(*), tourist_place_photos(*)')
      .eq('slug', slug)
      .single()
      .then(({ data }) => { if (data) setPlace(data); });
  }, [slug, lang]);

  if (!place) return <PublicLayout><div className="pt-24 text-center text-muted-foreground min-h-screen">Cargando...</div></PublicLayout>;

  const tr = place.tourist_place_translations?.find((t: any) => t.lang === lang) ?? place.tourist_place_translations?.[0];
  const photos = place.tourist_place_photos ?? [];

  return (
    <PublicLayout>
      <div className="pt-20 section-padding">
        <div className="container max-w-4xl">
          {photos.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              {photos.slice(0, 4).map((p: any, i: number) => (
                <img key={i} src={p.url} alt={tr?.name} className="w-full aspect-video object-cover rounded-xl" loading="lazy" />
              ))}
            </div>
          )}
          <h1 className="text-3xl md:text-4xl font-bold text-primary">{tr?.name}</h1>
          <div className="w-[60px] h-[3px] bg-cta rounded-full mt-3 mb-6" />
          <div className="prose prose-lg max-w-none text-foreground leading-relaxed" dangerouslySetInnerHTML={{ __html: tr?.long_description ?? tr?.short_description ?? '' }} />
          <div className="flex flex-wrap gap-4 mt-10">
            {place.google_maps_url && (
              <a href={place.google_maps_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 border-2 border-primary text-primary font-bold px-6 py-3 rounded-lg hover:bg-primary hover:text-primary-foreground transition-colors">
                <MapPin className="h-4 w-4" /> Ver en Google Maps
              </a>
            )}
            <Link to="/reservar" className="inline-flex items-center gap-2 bg-cta text-cta-foreground font-bold px-6 py-3 rounded-lg hover:opacity-90 transition-opacity">
              <Car className="h-4 w-4" /> RESERVA TU COCHE
            </Link>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
