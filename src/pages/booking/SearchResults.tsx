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

  const loadResults = useCallback(async (searchParams: URLSearchParams) => {
    const pickupId = searchParams.get('pickup') || '';
    const sd = searchParams.get('pickupDate');
    const ed = searchParams.get('returnDate');

    if (pickupId) {
      const { data } = await supabase.from('branches').select('show_surcharge_warning').eq('id', pickupId).single();
      setShowSurcharge(!!data?.show_surcharge_warning);
    }

    setLoading(true);
    setHasSearched(true);

    // 1. Load all active categories
    const { data: categories, error: catError } = await supabase
      .from('vehicle_categories')
      .select('id, name, image_url, price_per_day, energy_type, transmission_note, seats_min, seats_max')
      .eq('is_active', true)
      .order('price_per_day');

    if (catError || !categories) {
      console.error('Error categorías:', catError);
      setResults([]);
      setLoading(false);
      return;
    }

    // 2. For each category: check availability → load vehicles + quote
    const vehicleCards: any[] = [];

    await Promise.all(categories.map(async (cat: any) => {
      if (!sd || !ed) return;

      // Check availability via RPC
      let isAvailable = false;
      try {
        const { data: avail } = await supabase.rpc('check_availability', {
          p_category_id: cat.id,
          p_start_date: sd,
          p_end_date: ed,
          p_exclude_reservation_id: null,
        });
        isAvailable = typeof avail === 'boolean' ? avail : (avail?.available ?? false);
      } catch (err) {
        console.error('Error check_availability:', cat.id, err);
      }

      if (!isAvailable) return;

      // Get quote
      let quote: any = null;
      try {
        const { data: q } = await supabase.rpc('get_quote', {
          p_category_id: cat.id,
          p_start_date: sd,
          p_end_date: ed,
          p_insurance_tier: 'premium',
          p_extra_ids: [],
          p_discount_code: null,
        });
        quote = q ?? null;
      } catch (err) {
        console.error('Error get_quote:', cat.id, err);
      }

      // Load up to 2 vehicles with status = 'available'
      const { data: vehicles } = await supabase
        .from('vehicles')
        .select('id, brand, model, images, category_id')
        .eq('category_id', cat.id)
        .eq('status', 'available')
        .limit(2);

      if (vehicles && vehicles.length > 0) {
        vehicles.forEach((v: any) => {
          vehicleCards.push({
            vehicleId: v.id,
            brand: v.brand,
            model: v.model,
            imageUrl: getVehicleImage(v.images, cat.image_url),
            categoryId: cat.id,
            categoryName: cat.name,
            quote,
            pricePerDay: cat.price_per_day,
          });
        });
      } else {
        // No individual vehicles but category is available — show category card
        vehicleCards.push({
          vehicleId: cat.id,
          brand: cat.name,
          model: '',
          imageUrl: cat.image_url,
          categoryId: cat.id,
          categoryName: cat.name,
          quote,
          pricePerDay: cat.price_per_day,
        });
      }
    }));

    // Sort by price
    vehicleCards.sort((a, b) => (a.pricePerDay || 0) - (b.pricePerDay || 0));
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
