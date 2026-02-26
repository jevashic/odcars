import { useEffect, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { Users, Settings2, Fuel, ShieldCheck, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import PublicLayout from '@/components/layout/PublicLayout';
import InsuranceBadges from '@/components/InsuranceBadges';
import { useLangPath } from '@/hooks/useLangNavigate';

const FALLBACK_CATEGORY = {
  id: 'demo',
  name: 'Seat Ibiza o similar',
  image_url: 'https://images.unsplash.com/photo-1549317661-bd32c8ce0ffe?w=800&q=80',
  seats_min: 5,
  seats_max: 5,
  transmission_note: 'Manual',
  energy_type: 'Gasolina',
  price_per_day: 30,
  description: 'Vehículo compacto ideal para recorrer Gran Canaria con total comodidad. Equipado con aire acondicionado, dirección asistida y sistema de audio Bluetooth.',
};

const FALLBACK_QUOTE = { days: 7, rental_amount: 210, delivery_surcharge: 0, total_amount: 210 };

export default function VehicleDetail() {
  const { categoryId } = useParams();
  const [params] = useSearchParams();
  const lp = useLangPath();
  const [category, setCategory] = useState<any>(null);
  const [quote, setQuote] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!categoryId) { setCategory(FALLBACK_CATEGORY); setQuote(FALLBACK_QUOTE); setLoading(false); return; }

    const loadData = async () => {
      setLoading(true);
      const { data: cat } = await supabase.from('vehicle_categories').select('*').eq('id', categoryId).maybeSingle();
      setCategory(cat || FALLBACK_CATEGORY);

      const { data: q } = await supabase.rpc('get_quote', {
        p_category_id: categoryId,
        p_start_date: params.get('pickupDate'),
        p_end_date: params.get('returnDate'),
        p_pickup_branch_id: params.get('pickup'),
        p_return_branch_id: params.get('dropoff') || params.get('pickup'),
        p_driver_age: params.get('age') || '+30',
      });
      setQuote(q || FALLBACK_QUOTE);
      setLoading(false);
    };
    loadData();
  }, [categoryId, params]);

  if (loading) return <PublicLayout><div className="pt-24 text-center min-h-screen text-muted-foreground">Cargando vehículo…</div></PublicLayout>;

  const cat = category || FALLBACK_CATEGORY;
  const q = quote || FALLBACK_QUOTE;

  return (
    <PublicLayout>
      <div className="pt-20 section-padding min-h-screen">
        <div className="container">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8">
            {/* Left – vehicle info */}
            <div>
              {cat.image_url && (
                <img src={cat.image_url} alt={cat.name} className="w-full rounded-2xl mb-6 aspect-video object-cover" />
              )}
              <h1 className="text-3xl font-bold text-primary">{cat.name}</h1>
              <p className="text-muted-foreground mt-1">o similar</p>

              {/* Specs */}
              <div className="flex flex-wrap gap-4 mt-5 text-sm text-muted-foreground">
                {cat.seats_min && (
                  <span className="flex items-center gap-1.5"><Users className="h-4 w-4" />{cat.seats_min}-{cat.seats_max} plazas</span>
                )}
                {cat.transmission_note && (
                  <span className="flex items-center gap-1.5"><Settings2 className="h-4 w-4" />{cat.transmission_note}</span>
                )}
                {cat.energy_type && (
                  <span className="flex items-center gap-1.5"><Fuel className="h-4 w-4" />{cat.energy_type}</span>
                )}
              </div>

              <InsuranceBadges className="mt-4" />

              {cat.description && <p className="mt-6 text-foreground leading-relaxed">{cat.description}</p>}
            </div>

            {/* Right – price sidebar */}
            <div className="lg:sticky lg:top-24 self-start">
              <div className="bg-card rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.08)] p-6">
                <h3 className="font-bold text-lg text-foreground mb-4">Resumen del precio</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between"><span>Alquiler {q.days} días</span><span>€{q.rental_amount}</span></div>
                  {q.delivery_surcharge > 0 && <div className="flex justify-between"><span>Suplemento entrega</span><span>€{q.delivery_surcharge}</span></div>}
                  <div className="flex justify-between text-primary"><span className="flex items-center gap-1"><ShieldCheck className="h-4 w-4" />Seguro Premium</span><span>INCLUIDO ✓</span></div>
                  <div className="flex justify-between text-primary"><span className="flex items-center gap-1"><Check className="h-4 w-4" />Fianza</span><span>0 € ✓</span></div>
                  <hr className="border-border" />
                  <div className="flex justify-between text-xl font-bold text-primary"><span>TOTAL</span><span>€{q.total_amount}</span></div>
                  <p className="text-xs text-muted-foreground">Impuestos IGIC incluidos</p>
                </div>
                <Link
                  to={lp(`/reservar/extras?${params.toString()}&categoryId=${categoryId}`)}
                  className="mt-6 block w-full bg-cta text-cta-foreground font-bold text-center py-3.5 rounded-lg hover:opacity-90 transition-opacity"
                >
                  Continuar con los extras →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
