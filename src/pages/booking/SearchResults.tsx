import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Users, Settings2, Fuel, DoorOpen, Wind, Car, Check, AlertTriangle, Star } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import PublicLayout from '@/components/layout/PublicLayout';
import { useLang } from '@/contexts/LanguageContext';
import { useLangPath } from '@/hooks/useLangNavigate';
import { differenceInDays } from 'date-fns';

const FALLBACK_CATEGORIES = [
  { id: 'eco-1', name: 'Económico', example_model: 'Fiat Panda', image_url: 'https://images.unsplash.com/photo-1502877338535-766e1452684a?w=600', seats_min: 4, seats_max: 5, doors: 5, transmission_note: 'Manual', energy_type: 'Gasolina', has_ac: true, is_active: true, base_price_per_day: 29, sort_order: 1 },
  { id: 'std-1', name: 'Standard', example_model: 'Seat León', image_url: 'https://images.unsplash.com/photo-1549317661-bd32c8ce0afa?w=600', seats_min: 5, seats_max: 5, doors: 5, transmission_note: 'Manual', energy_type: 'Gasolina', has_ac: true, is_active: true, base_price_per_day: 39, sort_order: 2 },
  { id: 'pre-1', name: 'Premium', example_model: 'VW T-Roc', image_url: 'https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?w=600', seats_min: 5, seats_max: 5, doors: 5, transmission_note: 'Automático', energy_type: 'Híbrido', has_ac: true, is_active: true, base_price_per_day: 59, sort_order: 3 },
];

const INCLUDED = [
  'Seguro Premium a Todo Riesgo',
  '0 € Fianza',
  'Kilómetros ilimitados',
  'Segundo conductor gratis',
  'Cancelación gratuita 48 h',
];

export default function SearchResults() {
  const { lang: _lang } = useLang();
  const lp = useLangPath();
  const [params] = useSearchParams();
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSurcharge, setShowSurcharge] = useState(false);

  const startDate = params.get('pickupDate');
  const endDate = params.get('returnDate');
  const days = startDate && endDate ? Math.max(differenceInDays(new Date(endDate), new Date(startDate)), 1) : 1;

  useEffect(() => {
    const pickupId = params.get('pickup') || '';

    // Check if surcharge warning needed
    const checkSurcharge = async () => {
      if (!pickupId) return;
      const { data } = await supabase.from('branches').select('show_surcharge_warning').eq('id', pickupId).single();
      if (data?.show_surcharge_warning) setShowSurcharge(true);
    };

    const loadResults = async () => {
      setLoading(true);
      const { data: categories } = await supabase
        .from('vehicle_categories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

      const cats = categories && categories.length > 0 ? categories : FALLBACK_CATEGORIES;

      if (startDate && endDate) {
        const enriched = await Promise.all(cats.map(async (cat: any) => {
          try {
            const { data: avail } = await supabase.rpc('check_availability', {
              p_category_id: cat.id,
              p_start_date: startDate,
              p_end_date: endDate,
            });
            const { data: quote } = await supabase.rpc('get_quote', {
              p_category_id: cat.id,
              p_start_date: startDate,
              p_end_date: endDate,
              p_pickup_branch_id: params.get('pickup') || '',
              p_return_branch_id: params.get('dropoff') || params.get('pickup') || '',
              p_driver_age: params.get('age') || '+30',
            });
            return { ...cat, available: avail ?? true, quote };
          } catch {
            return { ...cat, available: true, quote: null };
          }
        }));
        setResults(enriched);
      } else {
        setResults(cats.map((c: any) => ({ ...c, available: true, quote: null })));
      }
      setLoading(false);
    };

    checkSurcharge();
    loadResults();
  }, [params]);

  const getPrice = (cat: any) => {
    if (cat.quote?.total_amount) return cat.quote.total_amount;
    return (cat.base_price_per_day || 39) * days;
  };

  return (
    <PublicLayout>
      <div className="pt-20 section-padding min-h-screen bg-accent">
        <div className="container max-w-6xl">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-primary">Elige tu vehículo</h1>
              <p className="text-sm text-muted-foreground mt-1">{days} día{days > 1 ? 's' : ''} de alquiler</p>
            </div>
            <Link to={lp('/')} className="text-sm text-cta font-bold hover:underline">← Modificar búsqueda</Link>
          </div>

          {/* Surcharge banner */}
          {showSurcharge && (
            <div className="mb-6 flex items-start gap-3 bg-cta/15 border border-cta/30 rounded-xl px-5 py-4">
              <AlertTriangle className="h-5 w-5 text-cta shrink-0 mt-0.5" />
              <p className="text-sm text-foreground">
                <strong>Aviso:</strong> Tu selección incluye entrega/recogida fuera de oficina. Pueden aplicarse cargos adicionales que se mostrarán al finalizar la reserva.
              </p>
            </div>
          )}

          {loading ? (
            <div className="py-20 text-center">
              <div className="inline-block h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-muted-foreground">Buscando vehículos disponibles…</p>
            </div>
          ) : results.length === 0 ? (
            <p className="text-center text-muted-foreground py-20">No se encontraron vehículos disponibles.</p>
          ) : (
            <div className="space-y-6">
              {results.map((cat, idx) => {
                const totalOffice = getPrice(cat);
                const pricePerDayOffice = Math.round(totalOffice / days);
                const totalOnline = Math.round(totalOffice * 0.85);
                const pricePerDayOnline = Math.round(totalOnline / days);
                const savings = totalOffice - totalOnline;
                const isRecommended = idx === 0;

                return (
                  <div key={cat.id} className={`bg-card rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.08)] overflow-hidden relative ${!cat.available ? 'opacity-50 pointer-events-none' : ''}`}>
                    {/* Recommended badge */}
                    {isRecommended && cat.available && (
                      <div className="bg-primary text-primary-foreground px-5 py-3 flex items-center gap-2">
                        <Star className="h-4 w-4 fill-cta text-cta" />
                        <span className="font-bold text-sm">Nuestra mejor opción para tu viaje</span>
                        <span className="text-xs text-primary-foreground/70 ml-1">— Más reservado en esta categoría</span>
                      </div>
                    )}

                    {!cat.available && (
                      <div className="absolute top-3 left-3 bg-destructive text-destructive-foreground text-xs font-bold px-3 py-1 rounded-full z-10">Sin unidades</div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_auto] gap-0">
                      {/* Left: image + info */}
                      <div className="p-5 flex flex-col">
                        {cat.image_url && (
                          <img src={cat.image_url} alt={cat.name} className="w-full aspect-[4/3] object-cover rounded-xl mb-4" loading="lazy" />
                        )}
                        <h3 className="font-bold text-lg text-foreground">{cat.name}</h3>
                        <p className="text-xs text-muted-foreground mb-3">Por ejemplo {cat.example_model || cat.name} o similar</p>
                        <div className="grid grid-cols-3 gap-x-3 gap-y-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Car className="h-3.5 w-3.5" />{cat.name}</span>
                          <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{cat.seats_min ?? 5}p</span>
                          <span className="flex items-center gap-1"><DoorOpen className="h-3.5 w-3.5" />{cat.doors ?? 5}p</span>
                          <span className="flex items-center gap-1"><Settings2 className="h-3.5 w-3.5" />{cat.transmission_note ?? 'Manual'}</span>
                          <span className="flex items-center gap-1"><Fuel className="h-3.5 w-3.5" />{cat.energy_type ?? 'Gasolina'}</span>
                          <span className="flex items-center gap-1"><Wind className="h-3.5 w-3.5" />{cat.has_ac !== false ? 'A/C' : '—'}</span>
                        </div>
                      </div>

                      {/* Center: price includes */}
                      <div className="p-5 border-t lg:border-t-0 lg:border-l border-border flex flex-col justify-center">
                        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">El precio incluye</h4>
                        <ul className="space-y-2">
                          {INCLUDED.map((item) => (
                            <li key={item} className="flex items-center gap-2 text-sm text-foreground">
                              <Check className="h-4 w-4 text-cta shrink-0" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Right: pricing columns */}
                      <div className="p-5 border-t lg:border-t-0 lg:border-l border-border">
                        <div className="grid grid-cols-2 gap-4 h-full">
                          {/* Pay at office */}
                          <div className="flex flex-col items-center text-center justify-between py-2">
                            <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Pagar en oficina</h4>
                            <div>
                              <p className="text-2xl font-bold text-foreground">{pricePerDayOffice} €<span className="text-xs font-normal text-muted-foreground">/día</span></p>
                              <p className="text-xs text-muted-foreground mt-1">Total: {totalOffice} €</p>
                            </div>
                            <Link
                              to={lp(`/reservar/extras?${params.toString()}&categoryId=${cat.id}&paymentMode=office`)}
                              className="mt-3 w-full border-2 border-primary text-primary font-bold text-sm text-center py-2.5 rounded-lg hover:bg-primary hover:text-primary-foreground transition-colors"
                            >
                              Seleccionar
                            </Link>
                          </div>

                          {/* Pay online */}
                          <div className="flex flex-col items-center text-center justify-between py-2 bg-accent/50 rounded-xl px-3 -m-1">
                            <h4 className="text-[10px] font-bold text-primary uppercase tracking-wider mb-2">Pagar ahora (−15%)</h4>
                            <div>
                              <p className="text-2xl font-bold text-primary">{pricePerDayOnline} €<span className="text-xs font-normal text-muted-foreground">/día</span></p>
                              <p className="text-xs text-muted-foreground mt-1">Total: {totalOnline} €</p>
                              <span className="inline-block mt-1 text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Ahorras {savings} €</span>
                            </div>
                            <Link
                              to={lp(`/reservar/extras?${params.toString()}&categoryId=${cat.id}&paymentMode=online`)}
                              className="mt-3 w-full bg-cta text-cta-foreground font-bold text-sm text-center py-2.5 rounded-lg hover:opacity-90 transition-opacity"
                            >
                              Seleccionar
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </PublicLayout>
  );
}
