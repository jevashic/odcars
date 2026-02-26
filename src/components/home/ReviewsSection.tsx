import { useEffect, useState } from 'react';
import { Star, Quote } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLang } from '@/contexts/LanguageContext';

interface Review { id: string; name: string; text: string; rating: number; date: string; }

const fallbackReviews: Review[] = [
  { id: '1', name: 'María García', text: 'Excelente servicio. El coche estaba impecable y el proceso de recogida fue muy rápido. Sin duda repetiré.', rating: 5, date: '2025-01-15' },
  { id: '2', name: 'John Smith', text: 'Great experience! No deposit, full insurance included. The car was perfect for exploring the island.', rating: 5, date: '2025-01-20' },
  { id: '3', name: 'Hans Müller', text: 'Sehr zufrieden mit dem Service. Einfache Abholung am Flughafen und fairer Preis. Empfehlenswert!', rating: 5, date: '2025-02-01' },
  { id: '4', name: 'Laura Fernández', text: 'Recomiendo 100%. Todo incluido, sin sorpresas. El equipo es muy amable y profesional.', rating: 5, date: '2025-02-10' },
  { id: '5', name: 'Peter Johnson', text: 'Best car rental in Gran Canaria. Fair prices and excellent customer service. Will come back!', rating: 4, date: '2025-02-15' },
  { id: '6', name: 'Ana López', text: 'Muy contentos con el alquiler. Coche nuevo, seguro incluido y sin fianza. ¡Perfecto para vacaciones!', rating: 5, date: '2025-02-20' },
];

export default function ReviewsSection() {
  const { t } = useLang();
  const [reviews, setReviews] = useState<Review[]>(fallbackReviews);

  useEffect(() => {
    supabase
      .from('reviews')
      .select('*')
      .eq('is_active', true)
      .order('sort_order')
      .limit(6)
      .then(({ data }) => {
        if (data && data.length > 0) setReviews(data as any);
      });
  }, []);

  return (
    <section className="section-padding bg-accent">
      <div className="container">
        <h2 className="section-title">{t('reviews.title')}</h2>
        <div className="section-line" />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-10">
          {reviews.map((r) => (
            <div key={r.id} className="bg-card rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.06)] p-6 relative">
              <Quote className="absolute top-4 right-4 h-8 w-8 text-cta/20" />
              <p className="text-muted-foreground italic leading-relaxed line-clamp-4 mb-4">{r.text}</p>
              <div className="border-t pt-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground font-bold text-sm">
                  {r.name.charAt(0)}
                </div>
                <div>
                  <p className="font-bold text-foreground text-sm">{r.name}</p>
                  <div className="flex gap-0.5">
                    {Array.from({ length: r.rating }).map((_, i) => (
                      <Star key={i} className="h-3.5 w-3.5 fill-cta text-cta" />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
