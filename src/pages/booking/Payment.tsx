import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Lock, CreditCard } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { Elements, useStripe, useElements, CardElement } from '@stripe/react-stripe-js';
import PublicLayout from '@/components/layout/PublicLayout';
import BookingTimer from '@/components/booking/BookingTimer';
import { useLang } from '@/contexts/LanguageContext';
import { useLangNavigate } from '@/hooks/useLangNavigate';
import { stripePromise } from '@/integrations/stripe/client';
import StripeCardInput from '@/components/stripe/StripeCardInput';
import { createReservation, type ReservationPayload } from '@/integrations/supabase/createReservation';
import { toast } from '@/hooks/use-toast';

function PaymentForm() {
  const [params] = useSearchParams();
  const { t } = useLang();
  const navigate = useLangNavigate();
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);

  const startDate = params.get('pickupDate') || '';
  const endDate = params.get('returnDate') || '';
  const days = startDate && endDate ? Math.max(differenceInDays(new Date(endDate), new Date(startDate)), 1) : 1;

  const baseTotal = 39 * days;
  const extrasParam = params.get('extras') || '';
  const selectedExtras = extrasParam ? extrasParam.split(',') : [];
  const extrasTotal = selectedExtras.reduce((sum, id) => {
    const prices: Record<string, number> = { gps: 5, 'baby-seat': 7 };
    return sum + (prices[id] || 0) * days;
  }, 0);
  const subtotal = baseTotal + extrasTotal;
  const total = Math.round(subtotal * 0.85);

  const handlePay = async () => {
    if (!stripe || !elements) return;
    setLoading(true);
    try {
      const cardElement = elements.getElement(CardElement);
      if (!cardElement) throw new Error(t('booking.card_not_found'));
      const { error: pmError, paymentMethod } = await stripe.createPaymentMethod({ type: 'card', card: cardElement });
      if (pmError) throw new Error(pmError.message);

      const payload: ReservationPayload = {
        customer: { first_name: params.get('firstName') || '', last_name: params.get('lastName') || '', email: params.get('email') || '', phone: params.get('phone') || '', license_number: params.get('licenseNumber') || '', license_expiry: params.get('licenseExpiry') || '' },
        category_id: params.get('categoryId') || '', pickup_branch_id: params.get('pickup') || '',
        return_branch_id: params.get('return') || params.get('pickup') || '',
        start_date: startDate, end_date: endDate,
        start_time: params.get('pickupTime') || '09:00', end_time: params.get('returnTime') || '09:00',
        insurance_tier: 'premium', extra_ids: selectedExtras, payment_method: 'card_online',
        stripe_payment_intent_id: paymentMethod?.id, sale_channel: 'web',
      };
      const { reservation_number } = await createReservation(payload);
      navigate(`/reservar/confirmacion?ref=${reservation_number}`);
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
