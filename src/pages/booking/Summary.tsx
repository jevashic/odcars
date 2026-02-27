import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { format, differenceInDays } from 'date-fns';
import { Lock, Check } from 'lucide-react';
import { Elements, useStripe, useElements, CardElement } from '@stripe/react-stripe-js';
import PublicLayout from '@/components/layout/PublicLayout';
import { useLangNavigate } from '@/hooks/useLangNavigate';
import { supabase } from '@/integrations/supabase/client';
import { stripePromise } from '@/integrations/stripe/client';
import StripeCardInput from '@/components/stripe/StripeCardInput';
import { createReservation, type ReservationPayload } from '@/integrations/supabase/createReservation';
import { toast } from '@/hooks/use-toast';

const EXTRAS_MAP: Record<string, { name: string; pricePerDay: number }> = {
  gps: { name: 'GPS Navegador', pricePerDay: 5 },
  'baby-seat': { name: 'Silla de bebé', pricePerDay: 7 },
};

function SummaryForm() {
  const [params] = useSearchParams();
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

  const baseTotal = 39 * days;
  const extrasTotal = selectedExtras.reduce((sum, id) => sum + (EXTRAS_MAP[id]?.pricePerDay || 0) * days, 0);
  const surchargeAmount = hasSurcharge ? 15 : 0;
  const subtotal = baseTotal + extrasTotal + surchargeAmount;
  const discount = paymentMode === 'online' ? Math.round(subtotal * 0.15) : 0;
  const total = subtotal - discount;

  useEffect(() => {
    const pickupId = params.get('pickup');
    if (pickupId) {
      supabase.from('branches').select('name, show_surcharge_warning').eq('id', pickupId).single().then(({ data }) => {
        if (data) {
          setBranchName(data.name);
          setHasSurcharge(data.show_surcharge_warning);
        }
      });
    }
  }, [params]);

  const update = (key: string, val: string) => setForm(prev => ({ ...prev, [key]: val }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isOffice) {
      // Office flow: create SetupIntent-like guarantee + call edge function
      if (!accepted || !stripe || !elements) return;
      setLoading(true);

      try {
        const cardElement = elements.getElement(CardElement);
        if (!cardElement) throw new Error('No se encontró el elemento de tarjeta');

        const { error: pmError, paymentMethod } = await stripe.createPaymentMethod({
          type: 'card',
          card: cardElement,
        });
        if (pmError) throw new Error(pmError.message);

        const payload: ReservationPayload = {
          customer: {
            first_name: form.firstName,
            last_name: form.lastName,
            email: form.email,
            phone: form.phone,
            license_number: form.licenseNumber,
            license_expiry: form.licenseExpiry,
          },
          category_id: params.get('categoryId') || '',
          pickup_branch_id: params.get('pickup') || '',
          return_branch_id: params.get('return') || params.get('pickup') || '',
          start_date: startDate,
          end_date: endDate,
          start_time: params.get('pickupTime') || '09:00',
          end_time: params.get('returnTime') || '09:00',
          insurance_tier: 'premium',
          extra_ids: selectedExtras,
          payment_method: 'card_office',
          stripe_setup_intent_id: paymentMethod?.id,
          sale_channel: 'web',
        };

        const { reservation_number } = await createReservation(payload);
        navigate(`/reservar/confirmacion?ref=${reservation_number}`);
      } catch (err: any) {
        toast({ title: 'Error al confirmar', description: err.message, variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    } else {
      // Online flow: go to payment page with form data
      const p = new URLSearchParams(params);
      Object.entries(form).forEach(([k, v]) => { if (v) p.set(k, v); });
      navigate(`/reservar/pago?${p.toString()}`);
    }
  };

  const inputCls = 'w-full px-4 py-3 rounded-lg border border-border focus:border-primary outline-none text-sm bg-background';

  const Breakdown = () => (
    <div className="bg-card rounded-2xl shadow-sm p-6">
      <h2 className="font-bold text-lg mb-4">Resumen de la reserva</h2>
      {branchName && <p className="text-xs text-muted-foreground mb-3">📍 {branchName}</p>}
      {startDate && endDate && (
        <p className="text-xs text-muted-foreground mb-4">
          {format(new Date(startDate), 'dd/MM/yyyy')} → {format(new Date(endDate), 'dd/MM/yyyy')} · {days} día{days > 1 ? 's' : ''}
        </p>
      )}
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span>Alquiler ({days} días)</span>
          <span className="font-medium">{baseTotal} €</span>
        </div>
        {selectedExtras.map(id => EXTRAS_MAP[id] && (
          <div key={id} className="flex justify-between">
            <span>{EXTRAS_MAP[id].name}</span>
            <span className="font-medium">{EXTRAS_MAP[id].pricePerDay * days} €</span>
          </div>
        ))}
        {hasSurcharge && (
          <div className="flex justify-between text-cta">
            <span>Suplemento entrega</span>
            <span className="font-medium">{surchargeAmount} €</span>
          </div>
        )}
        {discount > 0 && (
          <div className="flex justify-between text-emerald-600">
            <span>Descuento online (−15%)</span>
            <span className="font-medium">−{discount} €</span>
          </div>
        )}
        <div className="border-t border-border pt-2 flex justify-between font-bold text-base">
          <span>Total</span>
          <span className="text-primary">{total} €</span>
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground mt-3 text-center">IGIC (7%) incluido · Sin cargos ocultos</p>
    </div>
  );

  return (
    <PublicLayout>
      <div className="pt-20 section-padding min-h-screen bg-accent">
        <div className="container max-w-5xl">
          <h1 className="text-2xl font-bold text-primary mb-2">Resumen de tu reserva</h1>
          <div className="w-[60px] h-[3px] bg-cta rounded-full mb-8" />

          <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8">
            {/* LEFT column */}
            <div className="space-y-6">
              {/* Block 1: Billing data */}
              <div className="bg-card rounded-2xl shadow-sm p-6 space-y-4">
                <h2 className="font-bold text-lg">Datos de facturación</h2>
                <div className="grid grid-cols-2 gap-4">
                  <input placeholder="Nombre *" required value={form.firstName} onChange={e => update('firstName', e.target.value)} className={inputCls} />
                  <input placeholder="Apellidos *" required value={form.lastName} onChange={e => update('lastName', e.target.value)} className={inputCls} />
                </div>
                <input type="email" placeholder="Email *" required value={form.email} onChange={e => update('email', e.target.value)} className={inputCls} />
                <input type="tel" placeholder="Teléfono" value={form.phone} onChange={e => update('phone', e.target.value)} className={inputCls} />
                <input placeholder="Dirección" value={form.address} onChange={e => update('address', e.target.value)} className={inputCls} />
                <div className="grid grid-cols-3 gap-4">
                  <input placeholder="Ciudad" value={form.city} onChange={e => update('city', e.target.value)} className={inputCls} />
                  <input placeholder="Código postal" value={form.postalCode} onChange={e => update('postalCode', e.target.value)} className={inputCls} />
                  <input placeholder="País" value={form.country} onChange={e => update('country', e.target.value)} className={inputCls} />
                </div>
                <input placeholder="Nº licencia de conducir *" required value={form.licenseNumber} onChange={e => update('licenseNumber', e.target.value)} className={inputCls} />
                <input type="date" required value={form.licenseExpiry} onChange={e => update('licenseExpiry', e.target.value)} className={inputCls} />
              </div>

              {/* Block 2: Guarantee (office) or Discount code (online) */}
              {isOffice ? (
                <div className="bg-card rounded-2xl shadow-sm p-6 space-y-5">
                  <div className="flex items-center gap-2">
                    <Lock className="h-5 w-5 text-primary" />
                    <h2 className="font-bold text-lg">Garantiza tu reserva</h2>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    No se realizará ningún cargo hasta que recojas el vehículo.
                  </p>

                  <StripeCardInput />

                  <ul className="space-y-2">
                    {[
                      'Sin cargos ahora',
                      'Tu tarjeta cubre posibles extras: combustible, multas o daños',
                      'Nunca almacenamos los datos de tu tarjeta',
                    ].map(t => (
                      <li key={t} className="flex items-center gap-2 text-sm text-foreground">
                        <Check className="h-4 w-4 text-cta shrink-0" />
                        {t}
                      </li>
                    ))}
                  </ul>

                  <label className="flex items-start gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)} className="mt-0.5 accent-primary" />
                    <span>Acepto las condiciones de garantía</span>
                  </label>

                  <button
                    type="submit"
                    disabled={!accepted || loading || !stripe}
                    className="w-full bg-primary text-primary-foreground font-bold py-4 rounded-lg text-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {loading ? 'Procesando…' : 'CONFIRMAR RESERVA'}
                  </button>
                </div>
              ) : (
                <div className="bg-card rounded-2xl shadow-sm p-6">
                  <h2 className="font-bold text-lg mb-2">Código descuento</h2>
                  <div className="flex gap-2">
                    <input placeholder="Código" value={form.discountCode} onChange={e => update('discountCode', e.target.value)} className={`flex-1 ${inputCls}`} />
                    <button type="button" className="px-4 py-3 bg-primary text-primary-foreground font-bold rounded-lg text-sm">Aplicar</button>
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT column: breakdown + CTA */}
            <div className="space-y-4">
              <Breakdown />
              {!isOffice && (
                <button type="submit" className="w-full bg-cta text-cta-foreground font-bold py-4 rounded-lg text-lg hover:opacity-90 transition-opacity">
                  Ir al pago →
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
