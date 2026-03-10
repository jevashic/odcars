import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { AlertTriangle, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import PublicLayout from '@/components/layout/PublicLayout';
import SearchBar from '@/components/home/SearchBar';
import { useLang } from '@/contexts/LanguageContext';
import { useLangPath } from '@/hooks/useLangNavigate';
import { differenceInDays } from 'date-fns';
import { getVehicleImage } from '@/utils/vehicleImage';
import VehicleResultCard from '@/components/booking/VehicleResultCard';

export default function SearchResults() {
  const { t } = useLang();
  const lp = useLangPath();
  const [params, setParams] = useSearchParams();
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSurcharge, setShowSurcharge] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const startDate = params.get('pickupDate');
  const endDate = params.get('returnDate');
  const days = startDate && endDate ? Math.max(differenceInDays(new Date(endDate), new Date(startDate)), 1) : 1;

  const formatDateToISO = (date: string | Date): string => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const loadResults = useCallback(async (searchParams: URLSearchParams) => {
    const pickupId = searchParams.get('pickup') || '';
    const rawSd = searchParams.get('pickupDate');
    const rawEd = searchParams.get('returnDate');

    if (pickupId) {
      const { data } = await supabase.from('branches').select('show_surcharge_warning').eq('id', pickupId).maybeSingle();
      setShowSurcharge(!!data?.show_surcharge_warning);
    }

    setLoading(true);
    setHasSearched(true);

    if (!rawSd || !rawEd) { setResults([]); setLoading(false); return; }

    const sd = formatDateToISO(rawSd);
    const ed = formatDateToISO(rawEd);
    console.log('Fechas normalizadas:', { raw: { rawSd, rawEd }, normalized: { sd, ed } });

    // PASO 1: Load all active categories and check availability
    const { data: categories, error: catError } = await supabase
      .from('vehicle_categories')
      .select('id, name, image_url, price_per_day')
      .eq('is_active', true)
      .order('price_per_day');

    if (catError || !categories) {
      console.error('PASO 1 ERROR categorías:', catError);
      setResults([]); setLoading(false); return;
    }
    console.log('PASO 1: Categorías activas:', categories.map(c => ({ id: c.id, name: c.name })));

    const availableCatIds: string[] = [];
    await Promise.all(categories.map(async (cat) => {
      try {
        const { data: avail } = await supabase.rpc('check_availability', {
          p_category_id: cat.id,
          p_start_date: sd,
          p_end_date: ed,
          p_exclude_reservation_id: null,
        });
        const isAvail = typeof avail === 'boolean' ? avail : (avail?.available ?? false);
        console.log(`PASO 1 check_availability cat=${cat.name} (${cat.id}):`, avail, '→', isAvail);
        if (isAvail) availableCatIds.push(cat.id);
      } catch (err) {
        console.error('PASO 1 check_availability error:', cat.id, err);
      }
    }));
    console.log('PASO 1 RESULT: category_ids disponibles:', availableCatIds);

    if (availableCatIds.length === 0) {
      console.log('PASO 1: No hay categorías disponibles');
      setResults([]); setLoading(false); return;
    }

    // PASO 2: Single query for vehicles in available categories
    const { data: vehicles, error: vehError } = await supabase
      .from('vehicles')
      .select('*, vehicle_categories(name, image_url, price_per_day)')
      .in('category_id', availableCatIds)
      .eq('status', 'available')
      .order('created_at', { ascending: true });

    console.log('PASO 2: Vehículos encontrados:', vehicles?.length, vehicles?.map(v => ({ id: v.id, brand: v.brand, model: v.model, cat: v.category_id, status: v.status })));
    if (vehError) console.error('PASO 2 ERROR:', vehError);

    if (!vehicles || vehicles.length === 0) {
      console.log('PASO 2: No hay vehículos con status=available');
      setResults([]); setLoading(false); return;
    }

    // PASO 3: Group by category_id, max 2 per category
    const grouped: Record<string, any[]> = {};
    vehicles.forEach(v => {
      if (!grouped[v.category_id]) grouped[v.category_id] = [];
      if (grouped[v.category_id].length < 2) grouped[v.category_id].push(v);
    });
    const selectedVehicles = Object.values(grouped).flat();
    console.log('PASO 3: Vehículos seleccionados (max 2/cat):', selectedVehicles.map(v => ({ id: v.id, brand: v.brand, model: v.model, cat: v.category_id })));

    // PASO 4: Get quotes for each unique category
    const uniqueCatIds = [...new Set(selectedVehicles.map(v => v.category_id))];
    const quotes: Record<string, any> = {};
    await Promise.all(uniqueCatIds.map(async (catId) => {
      try {
        const { data: q } = await supabase.rpc('get_quote', {
          p_category_id: catId,
          p_start_date: sd,
          p_end_date: ed,
          p_insurance_tier: 'premium',
          p_extra_ids: [],
          p_discount_code: null,
        });
        quotes[catId] = q ?? null;
        console.log(`PASO 4 get_quote cat=${catId}:`, q);
      } catch (err) {
        console.error('PASO 4 get_quote error:', catId, err);
      }
    }));

    // Build result cards
    const vehicleCards = selectedVehicles.map(v => {
      const cat = v.vehicle_categories as any;
      return {
        vehicleId: v.id,
        brand: v.brand,
        model: v.model,
        year: v.year,
        transmission: v.transmission,
        fuelType: v.fuel_type,
        seats: v.seats,
        doors: v.doors,
        imageUrl: getVehicleImage(v.images, cat?.image_url),
        categoryId: v.category_id,
        categoryName: cat?.name || '',
        quote: quotes[v.category_id],
        pricePerDay: cat?.price_per_day || 0,
      };
    });

    // Sort by price
    vehicleCards.sort((a, b) => (a.pricePerDay || 0) - (b.pricePerDay || 0));

    // Mark middle category as recommended
    const recCats = [...new Set(vehicleCards.map(v => v.categoryId))];
    if (recCats.length >= 2) {
      const recommendedCatId = recCats[Math.floor(recCats.length / 2)];
      vehicleCards.forEach(v => { (v as any).isRecommended = v.categoryId === recommendedCatId; });
    }

    console.log('RESULTADO FINAL:', vehicleCards.length, 'tarjetas');
    setResults(vehicleCards);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (startDate && endDate) loadResults(params);
  }, []);

  const handleSearch = (newParams: URLSearchParams) => {
    setParams(newParams);
    loadResults(newParams);
  };

  return (
    <PublicLayout>
      <div className="pt-20">
        <SearchBar onSearch={handleSearch} initialParams={params} />
      </div>

      <div className="section-padding min-h-[60vh] bg-accent">
        <div className="container max-w-6xl">
          {!hasSearched ? (
            <div className="py-20 text-center">
              <Search className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
              <p className="text-lg text-muted-foreground">{t('booking.enter_dates')}</p>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h1 className="text-2xl md:text-3xl font-bold text-primary">{t('booking.choose_vehicle')}</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {days} {days > 1 ? t('booking.days') : t('booking.day')} {t('booking.days_rental')}
                </p>
              </div>

              {showSurcharge && (
                <div className="mb-6 flex items-start gap-3 bg-cta/15 border border-cta/30 rounded-xl px-5 py-4">
                  <AlertTriangle className="h-5 w-5 text-cta shrink-0 mt-0.5" />
                  <p className="text-sm text-foreground">
                    <strong>{t('booking.warning')}</strong> {t('booking.surcharge_warning')}
                  </p>
                </div>
              )}

              {loading ? (
                <div className="py-20 text-center">
                  <div className="inline-block h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
                  <p className="text-muted-foreground">{t('booking.searching')}</p>
                </div>
              ) : results.length === 0 ? (
                <p className="text-center text-muted-foreground py-20">{t('booking.no_results')}</p>
              ) : (
                <div className="space-y-6">
                  {results.map((vehicle) => (
                    <VehicleResultCard
                      key={vehicle.vehicleId}
                      vehicle={vehicle}
                      days={days}
                      params={params}
                      lp={lp}
                      t={t}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </PublicLayout>
  );
}
