import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Users, Settings2, Fuel } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import PublicLayout from '@/components/layout/PublicLayout';
import InsuranceBadges from '@/components/InsuranceBadges';
import { useLang } from '@/contexts/LanguageContext';

export default function SearchResults() {
  const { t } = useLang();
  const [params] = useSearchParams();
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadResults = async () => {
      setLoading(true);
      const { data: categories } = await supabase.from('vehicle_categories').select('*').eq('is_active', true).order('sort_order');
      if (!categories) { setLoading(false); return; }

      const startDate = params.get('pickupDate');
      const endDate = params.get('returnDate');

      const enriched = await Promise.all(categories.map(async (cat: any) => {
        const { data: avail } = await supabase.rpc('check_availability', {
          p_category_id: cat.id,
          p_start_date: startDate,
          p_end_date: endDate,
        });
        const { data: quote } = await supabase.rpc('get_quote', {
          p_category_id: cat.id,
          p_start_date: startDate,
          p_end_date: endDate,
          p_pickup_branch_id: params.get('pickup'),
          p_return_branch_id: params.get('dropoff') || params.get('pickup'),
          p_driver_age: params.get('age') || '+30',
        });
        return { ...cat, available: avail ?? false, quote };
      }));

      setResults(enriched);
      setLoading(false);
    };
    loadResults();
  }, [params]);

  return (
    <PublicLayout>
      <div className="pt-20 section-padding min-h-screen bg-accent">
        <div className="container">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-2xl font-bold text-primary">Resultados de búsqueda</h1>
            <Link to="/" className="text-sm text-cta font-bold hover:underline">Modificar búsqueda</Link>
          </div>

          {loading ? (
            <p className="text-center text-muted-foreground py-20">Buscando vehículos disponibles...</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {results.map((cat) => (
                <div key={cat.id} className={`bg-card rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.08)] overflow-hidden relative ${!cat.available ? 'opacity-60 cursor-not-allowed' : ''}`}>
                  {!cat.available && (
                    <div className="absolute top-3 left-3 bg-destructive text-destructive-foreground text-xs font-bold px-3 py-1 rounded-full z-10">Sin unidades para estas fechas</div>
                  )}
                  {cat.image_url && <img src={cat.image_url} alt={cat.name} className="w-full aspect-video object-cover" loading="lazy" />}
                  <div className="p-5">
                    <InsuranceBadges className="mb-3" />
                    <h3 className="font-bold text-lg text-foreground">{cat.name}</h3>
                    <p className="text-xs text-muted-foreground">o similar</p>
                    <div className="grid grid-cols-2 gap-2 mt-3 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1.5"><Users className="h-4 w-4" />{cat.seats_min}-{cat.seats_max}p</span>
                      <span className="flex items-center gap-1.5"><Settings2 className="h-4 w-4" />{cat.transmission_note}</span>
                      <span className="flex items-center gap-1.5"><Fuel className="h-4 w-4" />{cat.energy_type}</span>
                    </div>
                    {cat.quote && (
                      <p className="mt-4 text-2xl font-bold text-primary">€{cat.quote.total_amount}</p>
                    )}
                    {cat.available ? (
                      <Link to={`/reservar/detalle/${cat.id}?${params.toString()}`} className="mt-4 block w-full bg-cta text-cta-foreground font-bold text-sm text-center py-3 rounded-lg hover:opacity-90 transition-opacity">
                        Seleccionar →
                      </Link>
                    ) : (
                      <div className="mt-4 block w-full bg-muted text-muted-foreground text-sm text-center py-3 rounded-lg">No disponible</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </PublicLayout>
  );
}
