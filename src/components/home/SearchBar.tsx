import { useState, useEffect } from 'react';
import { useLangNavigate } from '@/hooks/useLangNavigate';
import { Calendar as CalendarIcon, MapPin, Search } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useLang } from '@/contexts/LanguageContext';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';

const TIMES = Array.from({ length: 48 }, (_, i) => {
  const h = String(Math.floor(i / 2)).padStart(2, '0');
  const m = i % 2 === 0 ? '00' : '30';
  return `${h}:${m}`;
});

interface PickupLocation { id: string; name: string; type: string; extra_charge: number; }

interface SearchBarProps {
  onSearch?: (params: URLSearchParams) => void;
  initialParams?: URLSearchParams;
}

export default function SearchBar({ onSearch, initialParams }: SearchBarProps) {
  const { t } = useLang();
  const navigate = useLangNavigate();
  const [locations, setLocations] = useState<PickupLocation[]>([]);
  const [pickup, setPickup] = useState(initialParams?.get('pickup') || '');
  const [dropoff, setDropoff] = useState(initialParams?.get('dropoff') || '');
  const [differentReturn, setDifferentReturn] = useState(!!initialParams?.get('dropoff'));
  const [pickupDate, setPickupDate] = useState<Date>(initialParams?.get('pickupDate') ? new Date(initialParams.get('pickupDate')!) : undefined as any);
  const [returnDate, setReturnDate] = useState<Date>(initialParams?.get('returnDate') ? new Date(initialParams.get('returnDate')!) : undefined as any);
  const [pickupTime, setPickupTime] = useState(initialParams?.get('pickupTime') || '10:00');
  const [returnTime, setReturnTime] = useState(initialParams?.get('returnTime') || '10:00');
  const [age, setAge] = useState(initialParams?.get('age') || '+30');
  const [address, setAddress] = useState(initialParams?.get('address') || '');
  const [dropAddress, setDropAddress] = useState(initialParams?.get('dropAddress') || '');
  const [errors, setErrors] = useState<Record<string, boolean>>({});

  useEffect(() => {
    supabase.from('pickup_locations').select('*').eq('is_active', true).order('sort_order').then(({ data }) => {
      if (data) setLocations(data as PickupLocation[]);
    });
  }, []);

  const TYPE_ICONS: Record<string, string> = { office: '🏢', airport: '✈️', hotel: '🏨', other: '📍' };

  const selectedLoc = locations.find(l => l.id === pickup);
  const selectedDropLoc = locations.find(l => l.id === dropoff);
  const isOtherPickup = selectedLoc?.type === 'other' || selectedLoc?.type === 'hotel';
  const isOtherDrop = selectedDropLoc?.type === 'other' || selectedDropLoc?.type === 'hotel';

  const pickupCharge = selectedLoc?.extra_charge ?? 0;
  const dropoffCharge = differentReturn ? (selectedDropLoc?.extra_charge ?? 0) : 0;
  

  // Set default pickup to "Oficina Maspalomas" or first office
  useEffect(() => {
    if (locations.length > 0 && !pickup) {
      const maspalomas = locations.find(l => l.name.toLowerCase().includes('maspalomas') && l.type === 'office');
      setPickup(maspalomas?.id ?? locations.find(l => l.type === 'office')?.id ?? locations[0].id);
    }
  }, [locations, pickup]);

  const handleSearch = () => {
    const errs: Record<string, boolean> = {};
    if (!pickup) errs.pickup = true;
    if (!pickupDate) errs.pickupDate = true;
    if (!returnDate) errs.returnDate = true;
    if (isOtherPickup && !address) errs.address = true;
    if (differentReturn && isOtherDrop && !dropAddress) errs.dropAddress = true;
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    const fmtLocal = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${dd}`;
    };

    const params = new URLSearchParams({
      pickup,
      pickupDate: fmtLocal(pickupDate!),
      returnDate: fmtLocal(returnDate!),
      pickupTime,
      returnTime,
      age,
      ...(isOtherPickup && { address }),
      ...(differentReturn && { dropoff }),
      ...(differentReturn && isOtherDrop && { dropAddress }),
      ...((pickupCharge + dropoffCharge > 0) && { deliveryCharge: String(pickupCharge + dropoffCharge) }),
    });

    if (onSearch) {
      onSearch(params);
    } else {
      navigate(`/reservar?${params.toString()}`);
    }
  };

  const Chip = ({ value, current, onChange, label }: { value: string; current: string; onChange: (v: string) => void; label: string }) => (
    <button
      onClick={() => onChange(value)}
      className={cn(
        'px-4 py-2 rounded-lg text-sm font-medium transition-colors border',
        current === value
          ? 'bg-cta text-cta-foreground border-cta'
          : 'border-white/20 text-white hover:border-white/40'
      )}
    >
      {label}
    </button>
  );

  return (
    <section id="search-bar" className="bg-primary py-8 px-4">
      <div className="container max-w-6xl">
        {/* Row 1 */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_auto] gap-3">
          {/* Location */}
          <div>
            <label className="text-xs text-white/60 mb-1 block">{t('search.pickup_location')}</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
              <select
                value={pickup}
                onChange={(e) => setPickup(e.target.value)}
                className={cn(
                  'w-full pl-10 pr-3 py-3 rounded-lg bg-white/10 border text-white text-sm appearance-none',
                  errors.pickup ? 'border-red-500' : 'border-white/20 focus:border-cta'
                )}
              >
                {locations.map(loc => (
                  <option key={loc.id} value={loc.id} className="text-foreground">
                    {TYPE_ICONS[loc.type] ?? '📍'} {loc.name}
                  </option>
                ))}
              </select>
            </div>
            {pickupCharge > 0 && (
              <div className="mt-2 text-xs text-white/50">
                ℹ️ Este servicio puede incluir un cargo adicional que se reflejará en el precio final.
              </div>
            )}
            {isOtherPickup && (
              <input
                value={address}
                onChange={e => setAddress(e.target.value)}
                placeholder={t('search.address_placeholder')}
                className={cn(
                  'w-full mt-2 px-3 py-2.5 rounded-lg bg-white/10 border text-white text-sm placeholder:text-white/40',
                  errors.address ? 'border-red-500' : 'border-white/20 focus:border-cta'
                )}
              />
            )}
          </div>

          {/* Pickup date + time */}
          <div>
            <label className="text-xs text-white/60 mb-1 block">{t('search.pickup_date')}</label>
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <button className={cn(
                    'flex-1 flex items-center gap-2 px-3 py-3 rounded-lg bg-white/10 border text-sm text-white',
                    errors.pickupDate ? 'border-red-500' : 'border-white/20'
                  )}>
                    <CalendarIcon className="h-4 w-4 text-white/50" />
                    {pickupDate ? format(pickupDate, 'dd/MM/yyyy') : t('search.date_placeholder')}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single" selected={pickupDate} onSelect={setPickupDate}
                    disabled={(d) => d < new Date(new Date().setHours(0,0,0,0))}
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              <select
                value={pickupTime} onChange={e => setPickupTime(e.target.value)}
                className="w-24 px-2 py-3 rounded-lg bg-white/10 border border-white/20 text-white text-sm appearance-none focus:border-cta"
              >
                {TIMES.map(t => <option key={t} value={t} className="text-foreground">{t}</option>)}
              </select>
            </div>
          </div>

          {/* Return date + time */}
          <div>
            <label className="text-xs text-white/60 mb-1 block">{t('search.return_date')}</label>
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <button className={cn(
                    'flex-1 flex items-center gap-2 px-3 py-3 rounded-lg bg-white/10 border text-sm text-white',
                    errors.returnDate ? 'border-red-500' : 'border-white/20'
                  )}>
                    <CalendarIcon className="h-4 w-4 text-white/50" />
                    {returnDate ? format(returnDate, 'dd/MM/yyyy') : t('search.date_placeholder')}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single" selected={returnDate} onSelect={setReturnDate}
                    disabled={(d) => d < (pickupDate ?? new Date())}
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              <select
                value={returnTime} onChange={e => setReturnTime(e.target.value)}
                className="w-24 px-2 py-3 rounded-lg bg-white/10 border border-white/20 text-white text-sm appearance-none focus:border-cta"
              >
                {TIMES.map(t => <option key={t} value={t} className="text-foreground">{t}</option>)}
              </select>
            </div>
          </div>

          {/* Search button */}
          <div className="flex items-end">
            <button
              onClick={handleSearch}
              className="w-full md:w-auto bg-cta text-cta-foreground font-bold uppercase px-8 py-3 rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
            >
              <Search className="h-4 w-4" />
              {t('search.button')}
            </button>
          </div>
        </div>

        {/* Row 2 - Filters */}
        <div className="mt-4 flex flex-wrap items-center gap-4">
          {/* Different return toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox" checked={differentReturn}
              onChange={e => setDifferentReturn(e.target.checked)}
              className="w-4 h-4 rounded accent-cta"
            />
            <span className="text-sm text-white">{t('search.different_return')}</span>
          </label>

          

          <div className="h-6 w-px bg-white/20 hidden md:block" />

          {/* Age chips */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/60">{t('search.age')}:</span>
            {[
              { v: '21-24', l: '21-24' },
              { v: '25-29', l: '25-29' },
              { v: '+30', l: '+30' },
            ].map(c => <Chip key={c.v} value={c.v} current={age} onChange={setAge} label={c.l} />)}
          </div>
        </div>

        {/* Different return selector */}
        {differentReturn && (
          <div className="mt-3 max-w-md">
            <label className="text-xs text-white/60 mb-1 block">{t('search.return_location')}</label>
            <select
              value={dropoff} onChange={e => setDropoff(e.target.value)}
              className="w-full px-3 py-3 rounded-lg bg-white/10 border border-white/20 text-white text-sm appearance-none focus:border-cta"
            >
              <option value="" className="text-foreground">{t('search.select')}</option>
              {locations.map(loc => (
                <option key={loc.id} value={loc.id} className="text-foreground">
                  {TYPE_ICONS[loc.type] ?? '📍'} {loc.name}
                </option>
              ))}
            </select>
            {isOtherDrop && (
              <input
                value={dropAddress} onChange={e => setDropAddress(e.target.value)}
                placeholder={t('search.address_placeholder')}
                className={cn(
                  'w-full mt-2 px-3 py-2.5 rounded-lg bg-white/10 border text-white text-sm placeholder:text-white/40',
                  errors.dropAddress ? 'border-red-500' : 'border-white/20 focus:border-cta'
                )}
              />
            )}
          </div>
        )}
      </div>
    </section>
  );
}
