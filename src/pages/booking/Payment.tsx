import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Lock, CreditCard, Building2 } from 'lucide-react';
import PublicLayout from '@/components/layout/PublicLayout';

export default function Payment() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [option, setOption] = useState<'online' | 'office'>('online');
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (!accepted) return;
    setLoading(true);
    // Stripe integration placeholder — will use stripe.confirmPayment / confirmSetup
    setTimeout(() => {
      navigate('/reservar/confirmacion');
    }, 1500);
  };

  return (
    <PublicLayout>
      <div className="pt-20 section-padding min-h-screen bg-accent">
        <div className="container max-w-xl">
          <div className="bg-card rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.08)] p-8">
            <div className="flex items-center gap-2 mb-6">
              <Lock className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-bold text-primary">Tu reserva está protegida</h1>
            </div>

            {/* Option A */}
            <button
              onClick={() => setOption('online')}
              className={`w-full text-left p-5 rounded-xl border-2 mb-4 transition-colors ${option === 'online' ? 'border-cta bg-cta/5' : 'border-border'}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CreditCard className="h-5 w-5 text-cta" />
                  <div>
                    <p className="font-bold text-foreground">Pagar ahora y ahorrar 15%</p>
                    <p className="text-sm text-muted-foreground">Pago seguro con tarjeta</p>
                  </div>
                </div>
                {option === 'online' && <span className="text-xs bg-emerald-100 text-emerald-700 font-bold px-2 py-1 rounded-full">RECOMENDADO</span>}
              </div>
            </button>

            {/* Option B */}
            <button
              onClick={() => setOption('office')}
              className={`w-full text-left p-5 rounded-xl border-2 mb-6 transition-colors ${option === 'office' ? 'border-primary bg-primary/5' : 'border-border'}`}
            >
              <div className="flex items-center gap-3">
                <Building2 className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-bold text-foreground">Pagar en oficina al recoger</p>
                  <p className="text-sm text-muted-foreground">Tu tarjeta se vincula solo como garantía</p>
                </div>
              </div>
            </button>

            {option === 'office' && (
              <p className="text-xs text-muted-foreground bg-accent p-3 rounded-lg mb-4">
                Tu tarjeta se vincula únicamente como garantía para la reserva y posibles extras al recoger o devolver (combustible, multas, daños). No se realizará ningún cargo sin tu autorización expresa.
              </p>
            )}

            {/* Stripe Card Element placeholder */}
            <div className="border border-border rounded-lg p-4 mb-4 bg-white">
              <p className="text-sm text-muted-foreground text-center">💳 Stripe Card Element</p>
              <p className="text-xs text-muted-foreground text-center mt-1">Pago seguro · Powered by Stripe</p>
            </div>

            <label className="flex items-start gap-2 text-sm cursor-pointer mb-6">
              <input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)} className="mt-0.5 accent-cta" />
              <span>He leído y acepto las condiciones de garantía y gestión de cargos</span>
            </label>

            <button
              onClick={handleConfirm}
              disabled={!accepted || loading}
              className="w-full bg-cta text-cta-foreground font-bold py-4 rounded-lg text-lg hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? 'Procesando...' : 'CONFIRMAR RESERVA'}
            </button>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
