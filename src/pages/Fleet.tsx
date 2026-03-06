import { useEffect, useState } from 'react';
import { Users, Settings2, ShieldCheck, Check, Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import PublicLayout from '@/components/layout/PublicLayout';
import { useLang } from '@/contexts/LanguageContext';
import { useLangNavigate } from '@/hooks/useLangNavigate';

interface VehicleCard {
  id: string;
  brand: string;
  model: string;
  year: number;
  color: string;
  transmission: string;
  seats: number;
  category_id: string;
  category_name: string;
  price_per_day: number;
  image_url: string | null;
}

export default function Fleet() {
  const { t } = useLang();
  const navigate = useLangNavigate();
  const [cards, setCards] = useState<VehicleCard[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    async function load() {
      setError(null);
      const { data: cats, error: catError } = await supabase
        .from('vehicle_categories')
        .select('id, name, price_per_day, image_url, transmission_note, seats_min, seats_max')
        .eq('is_active', true);

      if (catError) {
        console.error('Error categorias:', catError);
        setError(catError.message);
        setLoaded(true);
        return;
      }

      const all: VehicleCard[] = [];
      for (const cat of (cats ?? [])) {
        const { data: vehs, error: vehError } = await supabase
          .from('vehicles')
          .select('id, brand, model, year, color, transmission, seats')
          .eq('category_id', cat.id)
          .eq('status', 'available')
          .limit(2);

        if (vehError) {
          console.error('Error vehiculos:', vehError);
          continue;
        }
        for (const v of (vehs ?? [])) {
          all.push({
            ...v,
            category_id: cat.id,
            category_name: cat.name,
            price_per_day: cat.price_per_day,
            image_url: cat.image_url,
          });
        }
      }
      setCards(all);
      setLoaded(true);
    }
    load();
  }, []);

  return (
    <PublicLayout>
      <div className="pt-20 section-padding bg-accent min-h-screen">
        <div className="container">
          <h1 className="section-title">{t('nav.fleet')}</h1>
          <div className="section-line" />
          <p className="section-subtitle mb-10">{t('vehicles.subtitle')}</p>

          {error && (
            <div className="bg-destructive/10 border border-destructive text-destructive rounded-lg p-4 mb-6 text-sm">
              <strong>Error:</strong> {error}
            </div>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {cards.map(v => (
              <div key={v.id} className="bg-card rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.08)] overflow-hidden hover:shadow-lg transition-shadow">
                {v.image_url && (
                  <img src={v.image_url} alt={`${v.brand} ${v.model}`} className="w-full aspect-video object-cover" loading="lazy" />
                )}
                <div className="p-4 space-y-3">
                  <div className="flex flex-wrap gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-[10px] font-bold">
                      <ShieldCheck className="h-3 w-3" /> Seguro Premium
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-[10px] font-bold">
                      <Check className="h-3 w-3" /> 0€ Fianza
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-[10px] font-bold">
                      <Zap className="h-3 w-3" /> Km ilimitados
                    </span>
                  </div>

                  <div>
                    <h3 className="font-bold text-base text-foreground">{v.brand} {v.model}</h3>
                    <p className="text-xs text-muted-foreground">{v.year} · {v.color}</p>
                  </div>

                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Settings2 className="h-3.5 w-3.5" />{v.transmission}</span>
                    <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{v.seats}p</span>
                  </div>

                  <p className="text-lg font-bold text-primary">
                    {t('vehicles.from')} €{v.price_per_day}{t('vehicles.per_day')}
                  </p>

                  <button
                    onClick={() => navigate(`/reservar?category_id=${v.category_id}`)}
                    className="w-full bg-cta text-cta-foreground font-bold text-sm text-center py-2.5 rounded-lg hover:opacity-90 transition-opacity"
                  >
                    RESERVAR →
                  </button>
                </div>
              </div>
            ))}
          </div>

          {!loaded && <p className="text-center text-muted-foreground mt-10">{t('vehicles.loading')}</p>}
          {loaded && cards.length === 0 && !error && (
            <p className="text-center text-muted-foreground mt-10">No hay vehículos disponibles.</p>
          )}
        </div>
      </div>
    </PublicLayout>
  );
}
