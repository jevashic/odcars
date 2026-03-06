import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, Settings2, Fuel, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLang } from '@/contexts/LanguageContext';
import { useLangPath } from '@/hooks/useLangNavigate';
import InsuranceBadges from '@/components/InsuranceBadges';
import { getVehicleTranslation } from '@/utils/vehicleTranslation';

interface Category {
  id: string;
  name: string;
  image_url: string;
  seats_min: number;
  seats_max: number;
  transmission_note: string;
  energy_type: string;
  price_per_day: number;
}

const fallback: Category[] = [
  { id: '1', name: 'Fiat 500 o similar', image_url: 'https://images.unsplash.com/photo-1502877338535-766e1452684a?w=600&q=80', seats_min: 4, seats_max: 4, transmission_note: 'Manual', energy_type: 'Gasolina', price_per_day: 25 },
  { id: '2', name: 'VW Polo o similar', image_url: 'https://images.unsplash.com/photo-1549317661-bd32c8ce0ffe?w=600&q=80', seats_min: 5, seats_max: 5, transmission_note: 'Manual', energy_type: 'Gasolina', price_per_day: 30 },
  { id: '3', name: 'Seat León o similar', image_url: 'https://images.unsplash.com/photo-1583121274602-3e2820c69888?w=600&q=80', seats_min: 5, seats_max: 5, transmission_note: 'Automático', energy_type: 'Híbrido', price_per_day: 40 },
  { id: '4', name: 'BMW Serie 3 o similar', image_url: 'https://images.unsplash.com/photo-1555215695-3004980ad54e?w=600&q=80', seats_min: 5, seats_max: 5, transmission_note: 'Automático', energy_type: 'Gasolina', price_per_day: 65 },
];

export default function FeaturedVehicles() {
  const { t, lang } = useLang();
  const lp = useLangPath();
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    supabase
      .from('vehicle_categories')
      .select('*, vehicle_category_translations(*)')
      .eq('is_active', true)
      .order('price_per_day')
      .limit(4)
      .then(({ data }) => {
        if (data && data.length > 0) setCategories(data as any);
        else setCategories(fallback);
      });
  }, [lang]);

  const items = categories.length > 0 ? categories : fallback;

  return (
    <section className="section-padding bg-accent">
      <div className="container">
        <h2 className="section-title">{t('vehicles.title')}</h2>
        <div className="section-line" />
        <p className="section-subtitle mb-10">{t('vehicles.subtitle')}</p>

        <div className="flex flex-wrap justify-center gap-6">
          {items.map((cat) => {
            const tr = getVehicleTranslation(cat, lang);
            return (
            <div key={cat.id} className="bg-card rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.08)] overflow-hidden hover:shadow-lg hover:scale-[1.02] transition-all duration-300 group">
              <div className="relative aspect-video">
                <img src={cat.image_url} alt={tr.name} className="w-full h-full object-cover" loading="lazy" />
                <span className="absolute top-3 right-3 bg-cta text-cta-foreground text-xs font-bold px-3 py-1.5 rounded-full">
                  {tr.energy_type}
                </span>
              </div>
              <div className="p-5">
                <InsuranceBadges className="mb-3" />
                <h3 className="font-bold text-lg text-foreground">{tr.name}</h3>
                <div className="grid grid-cols-2 gap-2 mt-3 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5"><Users className="h-4 w-4" />{cat.seats_min}-{cat.seats_max}p</span>
                  <span className="flex items-center gap-1.5"><Settings2 className="h-4 w-4" />{tr.transmission_note}</span>
                  <span className="flex items-center gap-1.5"><Fuel className="h-4 w-4" />{tr.energy_type}</span>
                </div>
                <p className="mt-4 text-xl font-bold text-primary">
                  {t('vehicles.from')} €{cat.price_per_day}{t('vehicles.per_day')}
                </p>
                <Link
                  to={lp(`/reservar/detalle/${cat.id}`)}
                  className="mt-4 block w-full bg-cta text-cta-foreground font-bold text-sm text-center py-3 rounded-lg hover:opacity-90 transition-opacity"
                >
                  {t('vehicles.book')} →
                </Link>
              </div>
            </div>
            );
          })}
        </div>

        <div className="text-center mt-10">
          <Link to={lp('/flota')} className="inline-flex items-center gap-2 border-2 border-primary text-primary font-bold px-6 py-3 rounded-lg hover:bg-primary hover:text-primary-foreground transition-colors">
            {t('vehicles.see_all')} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
