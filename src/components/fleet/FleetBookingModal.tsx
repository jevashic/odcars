import { useState, useEffect, useCallback } from 'react';
import { format, differenceInDays } from 'date-fns';
import { X, CalendarIcon, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLang } from '@/contexts/LanguageContext';
import { useLangNavigate } from '@/hooks/useLangNavigate';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { getVehicleTranslation } from '@/utils/vehicleTranslation';
import { createReservation, type ReservationPayload } from '@/integrations/supabase/createReservation';
import { Elements, useStripe, useElements, CardElement } from '@stripe/react-stripe-js';
import { stripePromise } from '@/integrations/stripe/client';
import StripeCardInput from '@/components/stripe/StripeCardInput';
import { toast } from '@/hooks/use-toast';

interface PickupLocation { id: string; name: string; type: string; extra_charge: number; }
interface Extra { id: string; name: string; price_per_reservation: number; is_active: boolean; }

const TIMES = Array.from({ length: 48 }, (_, i) => {
  const h = String(Math.floor(i / 2)).padStart(2, '0');
  const m = i % 2 === 0 ? '00' : '30';
  return `${h}:${m}`;
});

const TYPE_ICONS: Record<string, string> = { office: '🏢', airport: '✈️', hotel: '🏨', other: '📍' };

// Step labels
type Step = 'search' | 'quote' | 'extras' | 'customer' | 'confirm';

interface Props {
  categoryId: string;
  category: any;
  onClose: () => void;
}

function ModalInner({ categoryId, category, onClose }: Props) {
  const { t, lang } = useLang();
  const navigate = useLangNavigate();
  const stripe = useStripe();
  const elements = useElements();
  const tr = getVehicleTranslation(category, lang);

  const [step, setStep] = useState<Step>('search');
  const [locations, setLocations] = useState<PickupLocation[]>([]);
  const [extras, setExtras] = useState<Extra[]>([]);

  // Step 1 - Search
  const [pickupId, setPickupId] = useState('');
  const [returnId, setReturnId] = useState('');
  const [pickupDate, setPickupDate] = useState<Date | undefined>();
  const [returnDate, setReturnDate] = useState<Date | undefined>();
  const [pickupTime, setPickupTime] = useState('10:00');
  const [returnTime, setReturnTime] = useState('10:00');

  // Step 2 - Quote
  const [quote, setQuote] = useState<any>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);

  // Step 3 - Extras
  const [selectedExtras, setSelectedExtras] = useState<string[]>([]);

  // Step 4 - Customer
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', phone: '',
    licenseNumber: '', licenseExpiry: '',
    flightTime: '', flightNumber: '', hotelName: '', arrivalTime: '', deliveryAddress: '',
    discountCode: '',
  });

  // Step 5 - Payment
  const [paymentMode, setPaymentMode] = useState<'online' | 'office'>('office');
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);

  const selectedPickup = locations.find(l => l.id === pickupId);
  const selectedReturn = locations.find(l => l.id === (returnId || pickupId));
  const isNonOfficePickup = selectedPickup && selectedPickup.type !== 'office';

  useEffect(() => {
    supabase.from('pickup_locations').select('*').eq('is_active', true).order('sort_order').then(({ data }) => {
      if (data) {
        setLocations(data as PickupLocation[]);
        const airport = (data as PickupLocation[]).find(l => l.type === 'airport');
        setPickupId(airport?.id ?? data[0]?.id ?? '');
      }
    });
    supabase.from('extras').select('*').eq('is_active', true).then(({ data }) => {
      if (data) setExtras(data as Extra[]);
    });
  }, []);

  const days = pickupDate && returnDate ? Math.max(differenceInDays(returnDate, pickupDate), 1) : 0;

  const fetchQuote = useCallback(async () => {
    if (!pickupDate || !returnDate) return;
    setQuoteLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_quote', {
        p_category_id: categoryId,
        p_start_date: format(pickupDate, 'yyyy-MM-dd'),
        p_end_date: format(returnDate, 'yyyy-MM-dd'),
        p_insurance_tier: 'premium',
        p_extra_ids: [],
        p_discount_code: null,
      });
      if (error) throw error;
      setQuote(data);
      setStep('quote');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally { setQuoteLoading(false); }
  }, [categoryId, pickupDate, returnDate]);

  const deliveryCharge = (selectedPickup?.extra_charge ?? 0) + (returnId && returnId !== pickupId ? (selectedReturn?.extra_charge ?? 0) : 0);

  const update = (key: string, val: string) => setForm(prev => ({ ...prev, [key]: val }));

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const deliveryDetails: Record<string, string> = {};
      if (selectedPickup?.type === 'airport') {
        deliveryDetails.flight_time = form.flightTime;
        deliveryDetails.flight_number = form.flightNumber;
      } else if (selectedPickup?.type === 'hotel') {
        deliveryDetails.hotel_name = form.hotelName;
        deliveryDetails.arrival_time = form.arrivalTime;
      } else if (selectedPickup?.type === 'other') {
        deliveryDetails.delivery_address = form.deliveryAddress;
      }

      if (paymentMode === 'office') {
        if (!stripe || !elements) return;
        const cardElement = elements.getElement(CardElement);
        if (!cardElement) throw new Error(t('booking.card_not_found'));
        const { error: pmError, paymentMethod } = await stripe.createPaymentMethod({ type: 'card', card: cardElement });
        if (pmError) throw new Error(pmError.message);

        const payload: ReservationPayload = {
          customer: { first_name: form.firstName, last_name: form.lastName, email: form.email, phone: form.phone, license_number: form.licenseNumber, license_expiry: form.licenseExpiry },
          category_id: categoryId,
          pickup_location_id: pickupId,
          return_location_id: returnId || pickupId,
          start_date: format(pickupDate!, 'yyyy-MM-dd'), end_date: format(returnDate!, 'yyyy-MM-dd'),
          start_time: pickupTime, end_time: returnTime,
          insurance_tier: 'premium', extra_ids: selectedExtras, payment_method: 'card_office',
          stripe_setup_intent_id: paymentMethod?.id, sale_channel: 'web',
        };
        const { reservation_number } = await createReservation(payload);
        navigate(`/reservar/confirmacion?ref=${reservation_number}`);
      } else {
        // Online payment – navigate to payment page with params
        const p = new URLSearchParams({
          categoryId,
          pickup: pickupId,
          return: returnId || pickupId,
          pickupDate: pickupDate!.toISOString(),
          returnDate: returnDate!.toISOString(),
          pickupTime, returnTime,
          extras: selectedExtras.join(','),
          paymentMode: 'online',
          firstName: form.firstName, lastName: form.lastName,
          email: form.email, phone: form.phone,
          licenseNumber: form.licenseNumber, licenseExpiry: form.licenseExpiry,
        });
        navigate(`/reservar/pago?${p.toString()}`);
      }
    } catch (err: any) {
      toast({ title: t('booking.error_confirm'), description: err.message, variant: 'destructive' });
    } finally { setLoading(false); }
  };

  const inputCls = 'w-full px-4 py-3 rounded-lg border border-border focus:border-primary outline-none text-sm bg-background';
  const selectCls = 'w-full px-4 py-3 rounded-lg border border-border focus:border-primary outline-none text-sm bg-background appearance-none';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 z-10 bg-primary text-primary-foreground px-6 py-4 rounded-t-2xl flex items-center justify-between">
          <div>
            <h2 className="font-bold text-lg text-primary-foreground">{tr.name}</h2>
            <p className="text-xs text-primary-foreground/70">{t('vehicles.from')} €{category.price_per_day}{t('vehicles.per_day')}</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          {/* ═══ STEP 1: Search ═══ */}
          {step === 'search' && (
            <div className="space-y-4">
              <h3 className="font-bold text-base text-foreground">Selecciona recogida y devolución</h3>

              {/* Pickup location */}
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">{t('search.pickup_location')}</label>
                <select value={pickupId} onChange={e => setPickupId(e.target.value)} className={selectCls}>
                  {locations.map(loc => (
                    <option key={loc.id} value={loc.id}>{TYPE_ICONS[loc.type] ?? '📍'} {loc.name}</option>
                  ))}
                </select>
                {isNonOfficePickup && (
                  <p className="text-xs text-cta mt-1">ℹ️ Este servicio puede incluir un cargo adicional que se reflejará en el precio final.</p>
                )}
              </div>

              {/* Return location */}
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">{t('search.return_location')}</label>
                <select value={returnId} onChange={e => setReturnId(e.target.value)} className={selectCls}>
                  <option value="">Mismo lugar de recogida</option>
                  {locations.map(loc => (
                    <option key={loc.id} value={loc.id}>{TYPE_ICONS[loc.type] ?? '📍'} {loc.name}</option>
                  ))}
                </select>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">{t('search.pickup_date')}</label>
                  <div className="flex gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className={cn('flex-1 flex items-center gap-2 px-3 py-3 rounded-lg border border-border text-sm', !pickupDate && 'text-muted-foreground')}>
                          <CalendarIcon className="h-4 w-4" />
                          {pickupDate ? format(pickupDate, 'dd/MM/yyyy') : t('search.date_placeholder')}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={pickupDate} onSelect={setPickupDate}
                          disabled={d => d < new Date(new Date().setHours(0,0,0,0))}
                          className="p-3 pointer-events-auto" />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">{t('search.return_date')}</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className={cn('w-full flex items-center gap-2 px-3 py-3 rounded-lg border border-border text-sm', !returnDate && 'text-muted-foreground')}>
                        <CalendarIcon className="h-4 w-4" />
                        {returnDate ? format(returnDate, 'dd/MM/yyyy') : t('search.date_placeholder')}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={returnDate} onSelect={setReturnDate}
                        disabled={d => d < (pickupDate ?? new Date())}
                        className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Times */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">{t('search.time')} recogida</label>
                  <select value={pickupTime} onChange={e => setPickupTime(e.target.value)} className={selectCls}>
                    {TIMES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">{t('search.time')} devolución</label>
                  <select value={returnTime} onChange={e => setReturnTime(e.target.value)} className={selectCls}>
                    {TIMES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              <button
                onClick={fetchQuote}
                disabled={!pickupDate || !returnDate || quoteLoading}
                className="w-full bg-cta text-cta-foreground font-bold py-3.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {quoteLoading ? t('booking.processing') : 'VER PRECIO Y RESERVAR →'}
              </button>
            </div>
          )}

          {/* ═══ STEP 2: Quote ═══ */}
          {step === 'quote' && quote && (
            <div className="space-y-4">
              <h3 className="font-bold text-base text-foreground">{t('booking.price_summary')}</h3>

              <div className="bg-accent rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between"><span>{tr.name}</span></div>
                <div className="flex justify-between text-muted-foreground">
                  <span>{format(pickupDate!, 'dd/MM/yyyy')} → {format(returnDate!, 'dd/MM/yyyy')} · {days} {days > 1 ? t('booking.days') : t('booking.day')}</span>
                </div>
                <div className="border-t border-border my-2" />
                <div className="flex justify-between">
                  <span>{t('booking.rental_days')} ({days} {days > 1 ? t('booking.days') : t('booking.day')})</span>
                  <span className="font-medium">{quote.rental_total ?? (category.price_per_day * days)} €</span>
                </div>
                <div className="flex justify-between text-emerald-600">
                  <span>{t('booking.premium_insurance')}</span>
                  <span className="font-medium">{t('booking.included')}</span>
                </div>
                <div className="flex justify-between text-emerald-600">
                  <span>{t('booking.deposit')}</span>
                  <span className="font-medium">{t('booking.deposit_free')}</span>
                </div>
                {deliveryCharge > 0 && (
                  <div className="flex justify-between text-cta">
                    <span>{t('booking.delivery_surcharge')}</span>
                    <span className="font-medium">+{deliveryCharge} €</span>
                  </div>
                )}
                <div className="border-t border-border pt-2 flex justify-between font-bold text-lg">
                  <span>{t('booking.total_label')}</span>
                  <span className="text-primary">{(quote.total ?? (category.price_per_day * days + deliveryCharge))} €</span>
                </div>
                <p className="text-[10px] text-muted-foreground text-center">{t('booking.igic_included')}</p>
              </div>

              {/* Payment mode selection */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => { setPaymentMode('online'); setStep('extras'); }}
                  className="border-2 border-cta rounded-xl p-4 text-center hover:bg-cta/5 transition-colors"
                >
                  <p className="font-bold text-sm text-foreground">PAGAR AHORA ONLINE</p>
                  {quote.discount_pct > 0 && <p className="text-xs text-emerald-600 mt-1">−{quote.discount_pct}% descuento</p>}
                </button>
                <button
                  onClick={() => { setPaymentMode('office'); setStep('extras'); }}
                  className="border-2 border-border rounded-xl p-4 text-center hover:bg-accent transition-colors"
                >
                  <p className="font-bold text-sm text-foreground">{t('booking.pay_office').toUpperCase()}</p>
                  <p className="text-xs text-muted-foreground mt-1">Paga al recoger</p>
                </button>
              </div>

              <button onClick={() => setStep('search')} className="text-sm text-muted-foreground hover:text-foreground">
                ← {t('booking.back')}
              </button>
            </div>
          )}

          {/* ═══ STEP 3: Extras ═══ */}
          {step === 'extras' && (
            <div className="space-y-4">
              <h3 className="font-bold text-base text-foreground">{t('booking.extras_title')}</h3>

              {extras.length === 0 && <p className="text-sm text-muted-foreground">No hay extras disponibles.</p>}
              {extras.map(ext => (
                <label key={ext.id} className="flex items-center gap-3 p-3 border border-border rounded-xl cursor-pointer hover:bg-accent transition-colors">
                  <input
                    type="checkbox"
                    checked={selectedExtras.includes(ext.id)}
                    onChange={e => setSelectedExtras(prev => e.target.checked ? [...prev, ext.id] : prev.filter(x => x !== ext.id))}
                    className="w-4 h-4 accent-primary"
                  />
                  <div className="flex-1">
                    <span className="text-sm font-medium text-foreground">{ext.name}</span>
                  </div>
                  <span className="text-sm font-bold text-primary">{ext.price_per_reservation} €</span>
                </label>
              ))}

              <div className="flex gap-3">
                <button onClick={() => setStep('quote')} className="flex-1 border border-border py-3 rounded-lg text-sm font-medium hover:bg-accent transition-colors">
                  ← {t('booking.back')}
                </button>
                <button onClick={() => setStep('customer')} className="flex-1 bg-cta text-cta-foreground font-bold py-3 rounded-lg hover:opacity-90 transition-opacity">
                  {t('booking.continue')}
                </button>
              </div>
            </div>
          )}

          {/* ═══ STEP 4: Customer ═══ */}
          {step === 'customer' && (
            <div className="space-y-4">
              <h3 className="font-bold text-base text-foreground">{t('booking.billing_title')}</h3>

              <div className="grid grid-cols-2 gap-3">
                <input placeholder={t('booking.first_name')} required value={form.firstName} onChange={e => update('firstName', e.target.value)} className={inputCls} />
                <input placeholder={t('booking.last_name')} required value={form.lastName} onChange={e => update('lastName', e.target.value)} className={inputCls} />
              </div>
              <input type="email" placeholder={t('booking.email')} required value={form.email} onChange={e => update('email', e.target.value)} className={inputCls} />
              <input type="tel" placeholder={t('booking.phone')} value={form.phone} onChange={e => update('phone', e.target.value)} className={inputCls} />
              <input placeholder={t('booking.license_number')} required value={form.licenseNumber} onChange={e => update('licenseNumber', e.target.value)} className={inputCls} />
              <input type="date" placeholder={t('booking.license_expiry')} required value={form.licenseExpiry} onChange={e => update('licenseExpiry', e.target.value)} className={inputCls} />

              {/* Conditional fields based on pickup type */}
              {selectedPickup?.type === 'airport' && (
                <div className="border-t border-border pt-3 space-y-3">
                  <p className="text-xs font-bold text-foreground">✈️ Datos del vuelo</p>
                  <input placeholder="Hora de llegada del vuelo" value={form.flightTime} onChange={e => update('flightTime', e.target.value)} className={inputCls} />
                  <input placeholder="Nº de vuelo o localizador" value={form.flightNumber} onChange={e => update('flightNumber', e.target.value)} className={inputCls} />
                </div>
              )}
              {selectedPickup?.type === 'hotel' && (
                <div className="border-t border-border pt-3 space-y-3">
                  <p className="text-xs font-bold text-foreground">🏨 Datos del hotel</p>
                  <input placeholder="Nombre del hotel" value={form.hotelName} onChange={e => update('hotelName', e.target.value)} className={inputCls} />
                  <input placeholder="Hora de llegada estimada" value={form.arrivalTime} onChange={e => update('arrivalTime', e.target.value)} className={inputCls} />
                </div>
              )}
              {selectedPickup?.type === 'other' && (
                <div className="border-t border-border pt-3 space-y-3">
                  <p className="text-xs font-bold text-foreground">📍 Dirección de entrega</p>
                  <input placeholder="Dirección completa" value={form.deliveryAddress} onChange={e => update('deliveryAddress', e.target.value)} className={inputCls} />
                  <p className="text-xs text-muted-foreground">Nuestro equipo contactará contigo para confirmar los detalles.</p>
                </div>
              )}

              {/* Discount code */}
              <div className="border-t border-border pt-3">
                <label className="text-xs text-muted-foreground mb-1 block">{t('booking.discount_code')}</label>
                <input placeholder={t('booking.discount_code_placeholder')} value={form.discountCode} onChange={e => update('discountCode', e.target.value)} className={inputCls} />
              </div>

              <div className="flex gap-3">
                <button onClick={() => setStep('extras')} className="flex-1 border border-border py-3 rounded-lg text-sm font-medium hover:bg-accent transition-colors">
                  ← {t('booking.back')}
                </button>
                <button
                  onClick={() => setStep('confirm')}
                  disabled={!form.firstName || !form.lastName || !form.email || !form.licenseNumber}
                  className="flex-1 bg-cta text-cta-foreground font-bold py-3 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {t('booking.continue')}
                </button>
              </div>
            </div>
          )}

          {/* ═══ STEP 5: Confirm / Payment ═══ */}
          {step === 'confirm' && (
            <div className="space-y-4">
              <h3 className="font-bold text-base text-foreground">
                {paymentMode === 'office' ? t('booking.guarantee_title') : t('booking.enter_card')}
              </h3>

              {paymentMode === 'office' && (
                <>
                  <p className="text-sm text-muted-foreground">{t('booking.guarantee_desc')}</p>
                  <StripeCardInput />
                  <ul className="space-y-2">
                    {[t('booking.guarantee_no_charge'), t('booking.guarantee_covers'), t('booking.guarantee_secure')].map(text => (
                      <li key={text} className="flex items-center gap-2 text-sm text-foreground">
                        <Check className="h-4 w-4 text-cta shrink-0" /> {text}
                      </li>
                    ))}
                  </ul>
                  <label className="flex items-start gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)} className="mt-0.5 accent-primary" />
                    <span>{t('booking.accept_guarantee')}</span>
                  </label>
                  <button
                    onClick={handleConfirm}
                    disabled={!accepted || loading || !stripe}
                    className="w-full bg-primary text-primary-foreground font-bold py-4 rounded-lg text-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {loading ? t('booking.processing') : t('booking.confirm_reservation')}
                  </button>
                </>
              )}

              {paymentMode === 'online' && (
                <button
                  onClick={handleConfirm}
                  disabled={loading}
                  className="w-full bg-cta text-cta-foreground font-bold py-4 rounded-lg text-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {loading ? t('booking.processing') : t('booking.go_to_payment')}
                </button>
              )}

              <button onClick={() => setStep('customer')} className="text-sm text-muted-foreground hover:text-foreground">
                ← {t('booking.back')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function FleetBookingModal(props: Props) {
  return (
    <Elements stripe={stripePromise}>
      <ModalInner {...props} />
    </Elements>
  );
}
