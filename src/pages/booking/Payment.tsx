import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Lock, CreditCard } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import PublicLayout from '@/components/layout/PublicLayout';
import { useLangNavigate } from '@/hooks/useLangNavigate';

export default function Payment() {
  const [params] = useSearchParams();
  const navigate = useLangNavigate();
  const [loading, setLoading] = useState(false);

  const startDate = params.get('pickupDate');
  const endDate = params.get('returnDate');
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
    setLoading(true);
    // Stripe PaymentIntent placeholder
    setTimeout(() => {
      navigate('/reservar/confirmacion');
    }, 1500);
  };

  return (
    <PublicLayout>
      <div className="pt-20 section-padding min-h-screen bg-accent">
        <div className="container max-w-xl">
          <div className="bg-card rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.08)] p-8">
            {/* Compact summary */}
            <div className="bg-accent rounded-xl p-4 mb-6 text-sm space-y-1">
              {startDate && endDate && (
                <p className="text-muted-foreground">
                  📅 {format(new Date(startDate), 'dd/MM/yyyy')} → {format(new Date(endDate), 'dd/MM/yyyy')} · {days} día{days > 1 ? 's' : ''}
                </p>
              )}
              {selectedExtras.length > 0 && (
                <p className="text-muted-foreground">
                  ✚ Extras: {selectedExtras.join(', ')}
                </p>
              )}
              <p className="font-bold text-primary text-lg mt-2">Total: {total} €</p>
              <p className="text-[10px] text-muted-foreground">IGIC incluido · Descuento −15% aplicado</p>
            </div>

            {/* Stripe CardElement placeholder */}
            <div className="flex items-center gap-2 mb-4">
              <CreditCard className="h-5 w-5 text-primary" />
              <h2 className="font-bold text-lg">Introduce tu tarjeta</h2>
            </div>
            <div className="border border-border rounded-lg p-4 mb-6 bg-background">
              <p className="text-sm text-muted-foreground text-center">💳 Stripe Card Element</p>
              <p className="text-xs text-muted-foreground text-center mt-1">Pago seguro · Powered by Stripe</p>
            </div>

            <button
              onClick={handlePay}
              disabled={loading}
              className="w-full bg-cta text-cta-foreground font-bold py-4 rounded-lg text-lg hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? 'Procesando…' : `PAGAR ${total} € AHORA`}
            </button>

            <p className="text-xs text-muted-foreground text-center mt-4 flex items-center justify-center gap-1">
              <Lock className="h-3 w-3" /> Pago seguro con Stripe. Sin cargos ocultos.
            </p>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
