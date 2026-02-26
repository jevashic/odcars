import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, Settings2, Fuel } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import PublicLayout from '@/components/layout/PublicLayout';
import InsuranceBadges from '@/components/InsuranceBadges';
import { useLang } from '@/contexts/LanguageContext';

export default function Fleet() {
  const { t } = useLang();
  const [categories, setCategories] = useState<any[]>([]);

  useEffect(() => {
    supabase.from('vehicle_categories').select('*').eq('is_active', true).order('sort_order').then(({ data }) => {
      if (data) setCategories(data);
    });
  }, []);

  return (
    <PublicLayout>
      <div className="pt-20 section-padding bg-accent min-h-screen">
        <div className="container">
          <h1 className="section-title">{t('nav.fleet')}</h1>
          <div className="section-line" />
          <p className="section-subtitle mb-10">{t('vehicles.subtitle')}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {categories.map((cat) => (
              <div key={cat.id} className="bg-card rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.08)] overflow-hidden hover:shadow-lg transition-shadow">
                {cat.image_url && <img src={cat.image_url} alt={cat.name} className="w-full aspect-video object-cover" loading="lazy" />}
                <div className="p-5">
                  <InsuranceBadges className="mb-3" />
                  <h3 className="font-bold text-lg text-foreground">{cat.name}</h3>
                  <div className="grid grid-cols-2 gap-2 mt-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5"><Users className="h-4 w-4" />{cat.seats_min}-{cat.seats_max}p</span>
                    <span className="flex items-center gap-1.5"><Settings2 className="h-4 w-4" />{cat.transmission_note}</span>
                    <span className="flex items-center gap-1.5"><Fuel className="h-4 w-4" />{cat.energy_type}</span>
                  </div>
                  <p className="mt-4 text-xl font-bold text-primary">Desde €{cat.price_per_day}/día</p>
                  <Link to="/reservar" className="mt-4 block w-full bg-cta text-cta-foreground font-bold text-sm text-center py-3 rounded-lg hover:opacity-90 transition-opacity">
                    {t('vehicles.book')} →
                  </Link>
                </div>
              </div>
            ))}
          </div>
          {categories.length === 0 && <p className="text-center text-muted-foreground mt-10">Cargando flota...</p>}
        </div>
      </div>
    </PublicLayout>
  );
}
