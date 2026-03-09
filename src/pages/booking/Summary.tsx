import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { format, differenceInDays } from 'date-fns';
import { Lock, Check } from 'lucide-react';
import { Elements, useStripe, useElements, CardElement } from '@stripe/react-stripe-js';
import PublicLayout from '@/components/layout/PublicLayout';
import BookingTimer, { markBookingCompleted } from '@/components/booking/BookingTimer';
import { useLang } from '@/contexts/LanguageContext';
import { useConfig } from '@/contexts/ConfigContext';
import { useLangNavigate } from '@/hooks/useLangNavigate';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '@/integrations/supabase/client';
import { stripePromise } from '@/integrations/stripe/client';
import StripeCardInput from '@/components/stripe/StripeCardInput';
import { toast } from '@/hooks/use-toast';

function parseExtrasPrices(param: string): Record<string, number> {
  if (!param) return {};
  const map: Record<string, number> = {};
  param.split(',').forEach(entry => {
    const [id, price] = entry.split(':');
    if (id && price) map[id] = parseFloat(price);
  });
  return map;
}

function SummaryForm() {
  const [params] = useSearchParams();
  const { t } = useLang();
  const { online_multiplier, online_discount_percent } = useConfig();
  const navigate = useLangNavigate();
  const stripe = useStripe();
  const elements = useElements();
  const paymentMode = params.get('paymentMode') || 'office';
  const isOffice = paymentMode === 'office';

  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', phone: '',
    address: '', city: '', postalCode: '', country: '',
    licenseNumber: '', licenseExpiry: '', discountCode: '',
  });
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [branchName, setBranchName] = useState('');
  const [hasSurcharge, setHasSurcharge] = useState(false);

  const startDate = params.get('pickupDate') || '';
  const endDate = params.get('returnDate') || '';
  const days = startDate && endDate ? Math.max(differenceInDays(new Date(endDate), new Date(startDate)), 1) : 1;
  const extrasParam = params.get('extras') || '';
  const selectedExtras = extrasParam ? extrasParam.split(',') : [];
  const extrasPricesMap = parseExtrasPrices(params.get('extrasPrices') || '');

  const quoteTotal = parseFloat(params.get('quoteTotal') || '0');
  const extrasTotal = selectedExtras.reduce((sum, id) => sum + (extrasPricesMap[id] || 0), 0);
  const surchargeAmount = hasSurcharge ? 15 : 0;
  const subtotal = quoteTotal + extrasTotal + surchargeAmount;
  const discount = paymentMode === 'online' ? Math.round(subtotal * (1 - online_multiplier)) : 0;
  const total = subtotal - discount;

  useEffect(() => {
    const pickupId = params.get('pickup');
    if (pickupId) {
      supabase.from('branches').select('name, show_surcharge_warning').eq('id', pickupId).single().then(({ data }) => {
        if (data) { setBranchName(data.name); setHasSurcharge(data.show_surcharge_warning); }
      });
    }
  }, [params]);

  const update = (key: string, val: string) => setForm(prev => ({ ...prev, [key]: val }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isOffice) {
      if (!accepted || !stripe || !elements) return;
      setLoading(true);
      try {
        const cardElement = elements.getElement(CardElement);
        if (!cardElement) throw new Error(t('booking.card_not_found'));
        const { error: pmError, paymentMethod } = await stripe.createPaymentMethod({
          type: 'card',
          card: cardElement,
          billing_details: {
            name: `${form.firstName} ${form.lastName}`,
            email: form.email,
          },
        });
        if (pmError) throw new Error(pmError.message);

        const pickupTime = params.get('pickupTime') || '09:00';
        const returnTime = params.get('returnTime') || '09:00';
        const body = {
          customer: { first_name: form.firstName, last_name: form.lastName, email: form.email, phone: form.phone, license_number: form.licenseNumber, license_expiry: form.licenseExpiry },
          category_id: params.get('categoryId') || '',
          pickup_location_id: params.get('pickup') || '',
          return_location_id: params.get('return') || params.get('pickup') || '',
          start_date: startDate, end_date: endDate,
          start_time: pickupTime, end_time: returnTime,
          pickup_time: pickupTime, return_time: returnTime,
          insurance_tier: 'premium', extra_ids: selectedExtras, payment_method: 'card_office',
          sale_channel: 'web',
          sale_branch_id: 'a58b7a55-b6a3-456a-b0f6-eed247cf3137',
          pickup_branch_id: 'a58b7a55-b6a3-456a-b0f6-eed247cf3137',
          return_branch_id: 'a58b7a55-b6a3-456a-b0f6-eed247cf3137',
          pay_signal: false,
          pay_office_guarantee: true,
          payment_method_id: paymentMethod!.id,
        };

        const response = await fetch(
          `${SUPABASE_URL}/functions/v1/create_reservation`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify(body),
          }
        );
        const data = await response.json();
        console.log('Respuesta reserva oficina:', data);

        if (!data.success || !data.data?.reservation_number) {
          throw new Error(data.error || data.message || 'Error al crear la reserva');
        }

        markBookingCompleted();
        navigate(`/reservar/confirmacion`, {
          state: {
            reservation: {
              reservation_number: data.data.reservation_number,
              start_date: startDate, end_date: endDate,
              start_time: params.get('pickupTime') || '09:00', end_time: params.get('returnTime') || '09:00',
              category_name: params.get('categoryName') || '',
              pickup_location: branchName || '', return_location: branchName || '',
              insurance_tier: 'premium', extras: selectedExtras,
              payment_method: 'card_office', total_amount: total,
              ...data.data,
            },
            customer: { first_name: form.firstName, last_name: form.lastName, email: form.email, phone: form.phone },
          },
        });
      } catch (err: any) {
        toast({ title: t('booking.error_confirm'), description: err.message, variant: 'destructive' });
      } finally { setLoading(false); }
    } else {
      const p = new URLSearchParams(params);
      Object.entries(form).forEach(([k, v]) => { if (v) p.set(k, v); });
      navigate(`/reservar/pago?${p.toString()}`);
    }
  };

  const inputCls = 'w-full px-4 py-3 rounded-lg border border-border focus:border-primary outline-none text-sm bg-background';

  const Breakdown = () => (
    <div className="bg-card rounded-2xl shadow-sm p-6">
      <h2 className="font-bold text-lg mb-4">{t('booking.reservation_summary')}</h2>
      {branchName && <p className="text-xs text-muted-foreground mb-3">📍 {branchName}</p>}
      {startDate && endDate && (
        <p className="text-xs text-muted-foreground mb-4">
          {format(new Date(startDate), 'dd/MM/yyyy')} → {format(new Date(endDate), 'dd/MM/yyyy')} · {days} {days > 1 ? t('booking.days') : t('booking.day')}
        </p>
      )}
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span>{t('booking.rental')} ({days} {days > 1 ? t('booking.days') : t('booking.day')})</span>
          <span className="font-medium">{quoteTotal} €</span>
        </div>
        {selectedExtras.map(id => extrasPricesMap[id] !== undefined && (
          <div key={id} className="flex justify-between">
            <span>Extra</span>
            <span className="font-medium">{extrasPricesMap[id]} €</span>
          </div>
        ))}
        {hasSurcharge && (
          <div className="flex justify-between text-cta">
            <span>{t('booking.delivery_surcharge')}</span>
            <span className="font-medium">{surchargeAmount} €</span>
          </div>
        )}
        {discount > 0 && (
          <div className="flex justify-between text-emerald-600">
            <span>{t('booking.online_discount', { discount: online_discount_percent })}</span>
            <span className="font-medium">−{discount} €</span>
          </div>
        )}
        <div className="border-t border-border pt-2 flex justify-between font-bold text-base">
          <span>{t('booking.total_label')}</span>
          <span className="text-primary">{total} €</span>
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground mt-3 text-center">{t('booking.igic_included')}</p>
    </div>
  );

  return (
    <PublicLayout>
      <div className="pt-20">
        <BookingTimer />
      </div>
      <div className="section-padding min-h-screen bg-accent">
        <div className="container max-w-5xl">
          <h1 className="text-2xl font-bold text-primary mb-2">{t('booking.summary_title')}</h1>
          <div className="w-[60px] h-[3px] bg-cta rounded-full mb-8" />

          <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8">
            <div className="space-y-6">
              <div className="bg-card rounded-2xl shadow-sm p-6 space-y-4">
                <h2 className="font-bold text-lg">{t('booking.billing_title')}</h2>
                <div className="grid grid-cols-2 gap-4">
                  <input placeholder={t('booking.first_name')} required value={form.firstName} onChange={e => update('firstName', e.target.value)} className={inputCls} />
                  <input placeholder={t('booking.last_name')} required value={form.lastName} onChange={e => update('lastName', e.target.value)} className={inputCls} />
                </div>
                <input type="email" placeholder={t('booking.email')} required value={form.email} onChange={e => update('email', e.target.value)} className={inputCls} />
                <input type="tel" placeholder={t('booking.phone')} value={form.phone} onChange={e => update('phone', e.target.value)} className={inputCls} />
                <input placeholder={t('booking.address')} value={form.address} onChange={e => update('address', e.target.value)} className={inputCls} />
                <div className="grid grid-cols-3 gap-4">
                  <input placeholder={t('booking.city')} value={form.city} onChange={e => update('city', e.target.value)} className={inputCls} />
                  <input placeholder={t('booking.postal_code')} value={form.postalCode} onChange={e => update('postalCode', e.target.value)} className={inputCls} />
                  <input placeholder={t('booking.country')} value={form.country} onChange={e => update('country', e.target.value)} className={inputCls} />
                </div>
                <input placeholder={t('booking.license_number')} required value={form.licenseNumber} onChange={e => update('licenseNumber', e.target.value)} className={inputCls} />
                <input type="date" required value={form.licenseExpiry} onChange={e => update('licenseExpiry', e.target.value)} className={inputCls} />
              </div>

              {isOffice ? (
                <div className="bg-card rounded-2xl shadow-sm p-6 space-y-5">
                  <div className="flex items-center gap-2">
                    <Lock className="h-5 w-5 text-primary" />
                    <h2 className="font-bold text-lg">{t('booking.guarantee_title')}</h2>
                  </div>
                  <p className="text-sm text-muted-foreground">{t('booking.guarantee_desc')}</p>
                  <StripeCardInput />
                  <ul className="space-y-2">
                    {[t('booking.guarantee_no_charge'), t('booking.guarantee_covers'), t('booking.guarantee_secure')].map(text => (
                      <li key={text} className="flex items-center gap-2 text-sm text-foreground">
                        <Check className="h-4 w-4 text-cta shrink-0" />
                        {text}
                      </li>
                    ))}
                  </ul>
                  <label className="flex items-start gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)} className="mt-0.5 accent-primary" />
                    <span>{t('booking.accept_guarantee')}</span>
                  </label>
                  <button type="submit" disabled={!accepted || loading || !stripe} className="w-full bg-primary text-primary-foreground font-bold py-4 rounded-lg text-lg hover:bg-primary/90 transition-colors disabled:opacity-50">
                    {loading ? t('booking.processing') : t('booking.confirm_reservation')}
                  </button>
                </div>
              ) : (
                <div className="bg-card rounded-2xl shadow-sm p-6">
                  <h2 className="font-bold text-lg mb-2">{t('booking.discount_code')}</h2>
                  <div className="flex gap-2">
                    <input placeholder={t('booking.discount_code_placeholder')} value={form.discountCode} onChange={e => update('discountCode', e.target.value)} className={`flex-1 ${inputCls}`} />
                    <button type="button" className="px-4 py-3 bg-primary text-primary-foreground font-bold rounded-lg text-sm">{t('booking.apply')}</button>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <Breakdown />
              {!isOffice && (
                <button type="submit" className="w-full bg-cta text-cta-foreground font-bold py-4 rounded-lg text-lg hover:opacity-90 transition-opacity">
                  {t('booking.go_to_payment')}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </PublicLayout>
  );
}

export default function Summary() {
  return (
    <Elements stripe={stripePromise}>
      <SummaryForm />
    </Elements>
  );
}
