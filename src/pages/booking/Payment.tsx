import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Lock, CreditCard } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { Elements, useStripe, useElements, CardElement } from '@stripe/react-stripe-js';
import PublicLayout from '@/components/layout/PublicLayout';
import BookingTimer, { markBookingCompleted } from '@/components/booking/BookingTimer';
import { useLang } from '@/contexts/LanguageContext';
import { useLangNavigate } from '@/hooks/useLangNavigate';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/integrations/supabase/client';
import { stripePromise } from '@/integrations/stripe/client';
import StripeCardInput from '@/components/stripe/StripeCardInput';
import { toast } from '@/hooks/use-toast';
import { useConfig } from '@/contexts/ConfigContext';

function PaymentForm() {
  const [params] = useSearchParams();
  const { t } = useLang();
  const navigate = useLangNavigate();
  const stripe = useStripe();
  const elements = useElements();
  const { online_multiplier } = useConfig();
  const [loading, setLoading] = useState(false);

  const startDate = params.get('pickupDate') || '';
  const endDate = params.get('returnDate') || '';
  const days = startDate && endDate ? Math.max(differenceInDays(new Date(endDate), new Date(startDate)), 1) : 1;

  const quoteTotal = parseFloat(params.get('quoteTotal') || '0');
  const extrasParam = params.get('extras') || '';
  const selectedExtras = extrasParam ? extrasParam.split(',') : [];
  const extrasPricesParam = params.get('extrasPrices') || '';
  const extrasPricesMap: Record<string, number> = {};
  extrasPricesParam.split(',').forEach(entry => {
    const [id, price] = entry.split(':');
    if (id && price) extrasPricesMap[id] = parseFloat(price);
  });
  const extrasTotal = selectedExtras.reduce((sum, id) => sum + (extrasPricesMap[id] || 0), 0);
  const subtotal = quoteTotal + extrasTotal;
  const total = Math.round(subtotal * online_multiplier);

  const handlePay = async () => {
    if (!stripe || !elements) return;
    setLoading(true);
    try {
      const cardElement = elements.getElement(CardElement);
      if (!cardElement) throw new Error(t('booking.card_not_found'));
      const firstName = params.get('firstName') || '';
      const lastName = params.get('lastName') || '';
      const email = params.get('email') || '';

      const body = {
        customer: { first_name: firstName, last_name: lastName, email, phone: params.get('phone') || '', license_number: params.get('licenseNumber') || '', license_expiry: params.get('licenseExpiry') || '' },
        category_id: params.get('categoryId') || '',
        pickup_location_id: params.get('pickup') || '',
        return_location_id: params.get('return') || params.get('pickup') || '',
        start_date: startDate, end_date: endDate,
        start_time: params.get('pickupTime') || '09:00', end_time: params.get('returnTime') || '09:00',
        insurance_tier: 'premium', extra_ids: selectedExtras, payment_method: 'card_online',
        sale_channel: 'web',
        sale_branch_id: 'a58b7a55-b6a3-456a-b0f6-eed247cf3137',
        pickup_branch_id: 'a58b7a55-b6a3-456a-b0f6-eed247cf3137',
        return_branch_id: 'a58b7a55-b6a3-456a-b0f6-eed247cf3137',
        pay_signal: true,
        pay_office_guarantee: false,
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
      console.log('Respuesta reserva online:', data);

      if (!data.success || !data.data?.reservation_number) {
        throw new Error(data.error || data.message || 'Error al crear la reserva');
      }

      if (!data.data.signal_client_secret) {
        throw new Error('No se recibió client_secret de Stripe');
      }

      const { error: stripeError } = await stripe.confirmCardPayment(data.data.signal_client_secret, {
        payment_method: {
          card: cardElement,
          billing_details: { name: `${firstName} ${lastName}`, email },
        },
      });
      if (stripeError) throw new Error(stripeError.message);

      markBookingCompleted();
      navigate(`/reservar/confirmacion`, {
        state: {
          reservation: {
            reservation_number: data.data.reservation_number,
            start_date: startDate, end_date: endDate,
            start_time: params.get('pickupTime') || '09:00', end_time: params.get('returnTime') || '09:00',
            category_name: params.get('categoryName') || '',
            insurance_tier: 'premium', extras: selectedExtras,
            payment_method: 'card_online', total_amount: total,
            ...data.data,
          },
          customer: { first_name: firstName, last_name: lastName, email, phone: params.get('phone') || '' },
        },
      });
    } catch (err: any) {
      toast({ title: t('booking.error_payment'), description: err.message, variant: 'destructive' });
    } finally { setLoading(false); }
  };

  return (
    <PublicLayout>
      <div className="pt-20">
        <BookingTimer />
      </div>
      <div className="section-padding min-h-screen bg-accent">
        <div className="container max-w-xl">
          <div className="bg-card rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.08)] p-8">
            <div className="bg-accent rounded-xl p-4 mb-6 text-sm space-y-1">
              {startDate && endDate && (
                <p className="text-muted-foreground">
                  📅 {format(new Date(startDate), 'dd/MM/yyyy')} → {format(new Date(endDate), 'dd/MM/yyyy')} · {days} {days > 1 ? t('booking.days') : t('booking.day')}
                </p>
              )}
              {selectedExtras.length > 0 && (
                <p className="text-muted-foreground">✚ {t('booking.extras_label')} {selectedExtras.join(', ')}</p>
              )}
              <p className="font-bold text-primary text-lg mt-2">{t('booking.total')} {total} €</p>
              <p className="text-[10px] text-muted-foreground">{t('booking.igic_discount')}</p>
            </div>

            <div className="flex items-center gap-2 mb-4">
              <CreditCard className="h-5 w-5 text-primary" />
              <h2 className="font-bold text-lg">{t('booking.enter_card')}</h2>
            </div>
            <div className="mb-6"><StripeCardInput /></div>

            <button onClick={handlePay} disabled={loading || !stripe} className="w-full bg-cta text-cta-foreground font-bold py-4 rounded-lg text-lg hover:opacity-90 transition-opacity disabled:opacity-50">
              {loading ? t('booking.processing') : `${t('booking.pay_now_button')} ${total} €`}
            </button>

            <p className="text-xs text-muted-foreground text-center mt-4 flex items-center justify-center gap-1">
              <Lock className="h-3 w-3" /> {t('booking.pay_secure')}
            </p>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}

export default function Payment() {
  return (
    <Elements stripe={stripePromise}>
      <PaymentForm />
    </Elements>
  );
}
