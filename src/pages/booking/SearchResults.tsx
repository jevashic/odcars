import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Users, Settings2, Fuel, Car, Check, AlertTriangle, Star, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import PublicLayout from '@/components/layout/PublicLayout';
import SearchBar from '@/components/home/SearchBar';
import { useLang } from '@/contexts/LanguageContext';
import { useLangPath } from '@/hooks/useLangNavigate';
import { differenceInDays } from 'date-fns';
import { getVehicleImage } from '@/utils/vehicleImage';

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

  const INCLUDED = [
    t('booking.included_insurance'),
    t('booking.included_deposit'),
    t('booking.included_km'),
    t('booking.included_driver'),
    t('booking.included_cancel'),
  ];

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

    // Load all available vehicles with their category data
    const { data: vehicles, error: vehError } = await supabase
      .from('vehicles')
      .select(`
        id, brand, model, year, color,
        transmission, seats, category_id, images,
        vehicle_categories(
          id, name, price_per_day, image_url,
          energy_type, transmission_note, seats_min, seats_max,
          is_active
        )
      `)
      .eq('status', 'available');

    if (vehError || !vehicles) {
      console.error('Error vehicles:', vehError);
      setResults([]);
      setLoading(false);
      return;
    }

    // Filter only vehicles from active categories
    const activeVehicles = vehicles.filter((v: any) => {
      const cat = v.vehicle_categories as any;
      return cat && cat.is_active;
    });

    // Check availability + get quotes per category (cache to avoid duplicate RPC calls)
    const quoteCache: Record<string, any> = {};
    const availCache: Record<string, boolean> = {};

    // First, check availability for each unique category
    const uniqueCategoryIds = [...new Set(activeVehicles.map((v: any) => v.category_id))];
    if (sd && ed) {
      await Promise.all(uniqueCategoryIds.map(async (catId: string) => {
        try {
          const { data: avail } = await supabase.rpc('check_availability', {
            p_category_id: catId,
            p_start_date: sd,
            p_end_date: ed,
            p_exclude_reservation_id: null,
          });
          availCache[catId] = avail?.available ?? false;
        } catch (err) {
          console.error('Error check_availability:', catId, err);
          availCache[catId] = false;
        }
      }));
    }

    const enriched = await Promise.all(activeVehicles.map(async (v: any) => {
      const cat = v.vehicle_categories as any;
      const resolvedImage = getVehicleImage(v.images, cat?.image_url);
      const isAvailable = availCache[v.category_id] ?? true;

      let quote: any = null;
      if (sd && ed && cat && isAvailable) {
        if (!quoteCache[v.category_id]) {
          try {
            const { data: q } = await supabase.rpc('get_quote', {
              p_category_id: v.category_id,
              p_start_date: sd,
              p_end_date: ed,
              p_insurance_tier: 'premium',
              p_extra_ids: [],
              p_discount_code: null,
            });
            quoteCache[v.category_id] = q ?? null;
          } catch (err) {
            console.error('Error get_quote:', v.category_id, err);
            quoteCache[v.category_id] = null;
          }
        }
        quote = quoteCache[v.category_id];
      }

      return {
        ...v,
        cat,
        resolvedImage,
        quote,
        isAvailable,
      };
    }));

    // Sort: available first, unavailable last
    enriched.sort((a, b) => (a.isAvailable === b.isAvailable ? 0 : a.isAvailable ? -1 : 1));

    setResults(enriched);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (startDate && endDate) loadResults(params);
  }, []);

  const handleSearch = (newParams: URLSearchParams) => {
    setParams(newParams);
    loadResults(newParams);
  };

  const getTotal = (v: any) => {
    if (v.quote?.total_amount) return v.quote.total_amount;
    return (v.cat?.price_per_day || 0) * days;
  };

  const getPerDay = (v: any) => {
    if (v.quote?.price_per_day) return v.quote.price_per_day;
    return v.cat?.price_per_day || 0;
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
                <p className="text-sm text-muted-foreground mt-1">{days} {days > 1 ? t('booking.days') : t('booking.day')} {t('booking.days_rental')}</p>
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
                  {results.map((v, idx) => {
                    const totalOffice = getTotal(v);
                    const perDayOffice = getPerDay(v);
                    const totalOnline = Math.round(totalOffice * 0.85);
                    const perDayOnline = Math.round(perDayOffice * 0.85);
                    const savings = totalOffice - totalOnline;
                    const isRecommended = idx === 0;

                    return (
                      <div key={v.id} className="bg-card rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.08)] overflow-hidden relative">
                        {isRecommended && (
                          <div className="bg-primary text-primary-foreground px-5 py-3 flex items-center gap-2">
                            <Star className="h-4 w-4 fill-cta text-cta" />
                            <span className="font-bold text-sm">{t('booking.recommended')}</span>
                            <span className="text-xs text-primary-foreground/70 ml-1">{t('booking.recommended_sub')}</span>
                          </div>
                        )}

                        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_auto] gap-0">
                          {/* Vehicle image + details */}
                          <div className="p-5 flex flex-col">
                            {v.resolvedImage ? (
                              <img src={v.resolvedImage} alt={`${v.brand} ${v.model}`} className="w-full aspect-[4/3] object-cover rounded-xl mb-4" loading="lazy" />
                            ) : (
                              <div className="w-full aspect-[4/3] rounded-xl mb-4 bg-muted flex items-center justify-center">
                                <Car className="h-12 w-12 text-muted-foreground/30" />
                              </div>
                            )}
                            <h3 className="font-bold text-lg text-foreground">{v.brand} {v.model}</h3>
                            <p className="text-xs text-muted-foreground mb-3">{v.year} · {v.color}</p>
                            <div className="grid grid-cols-3 gap-x-3 gap-y-2 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{v.seats}p</span>
                              <span className="flex items-center gap-1"><Settings2 className="h-3.5 w-3.5" />{v.transmission}</span>
                              <span className="flex items-center gap-1"><Fuel className="h-3.5 w-3.5" />{v.cat?.energy_type ?? '—'}</span>
                            </div>
                          </div>

                          {/* Included benefits */}
                          <div className="p-5 border-t lg:border-t-0 lg:border-l border-border flex flex-col justify-center">
                            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">{t('booking.price_includes')}</h4>
                            <ul className="space-y-2">
                              {INCLUDED.map((item) => (
                                <li key={item} className="flex items-center gap-2 text-sm text-foreground">
                                  <Check className="h-4 w-4 text-cta shrink-0" />
                                  {item}
                                </li>
                              ))}
                            </ul>
                          </div>

                          {/* Pricing columns */}
                          <div className="p-5 border-t lg:border-t-0 lg:border-l border-border">
                            <div className="grid grid-cols-2 gap-4 h-full">
                              <div className="flex flex-col items-center text-center justify-between py-2">
                                <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">{t('booking.pay_office')}</h4>
                                <div>
                                  <p className="text-2xl font-bold text-foreground">{perDayOffice} €<span className="text-xs font-normal text-muted-foreground">{t('booking.per_day')}</span></p>
                                  <p className="text-xs text-muted-foreground mt-1">{t('booking.total')} {totalOffice} €</p>
                                </div>
                                <Link
                                  to={lp(`/reservar/extras?${params.toString()}&categoryId=${v.category_id}&vehicleId=${v.id}&paymentMode=office`)}
                                  className="mt-3 w-full border-2 border-primary text-primary font-bold text-sm text-center py-2.5 rounded-lg hover:bg-primary hover:text-primary-foreground transition-colors"
                                >
                                  {t('booking.select')}
                                </Link>
                              </div>

                              <div className="flex flex-col items-center text-center justify-between py-2 bg-accent/50 rounded-xl px-3 -m-1">
                                <h4 className="text-[10px] font-bold text-primary uppercase tracking-wider mb-2">{t('booking.pay_now')}</h4>
                                <div>
                                  <p className="text-2xl font-bold text-primary">{perDayOnline} €<span className="text-xs font-normal text-muted-foreground">{t('booking.per_day')}</span></p>
                                  <p className="text-xs text-muted-foreground mt-1">{t('booking.total')} {totalOnline} €</p>
                                  <span className="inline-block mt-1 text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">{t('booking.savings')} {savings} €</span>
                                </div>
                                <Link
                                  to={lp(`/reservar/extras?${params.toString()}&categoryId=${v.category_id}&vehicleId=${v.id}&paymentMode=online`)}
                                  className="mt-3 w-full bg-cta text-cta-foreground font-bold text-sm text-center py-2.5 rounded-lg hover:opacity-90 transition-opacity"
                                >
                                  {t('booking.select')}
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
            </>
          )}
        </div>
      </div>
    </PublicLayout>
  );
}
