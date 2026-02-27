import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';
import PublicLayout from '@/components/layout/PublicLayout';

export default function Confirmation() {
  const [params] = useSearchParams();
  const refNumber = params.get('ref') || 'OD-XXXX-XXXX';

  return (
    <PublicLayout>
      <div className="pt-20 section-padding min-h-screen bg-accent flex items-center justify-center">
        <div className="text-center max-w-md">
          <CheckCircle className="h-20 w-20 text-emerald-500 mx-auto mb-6 animate-in zoom-in duration-500" />
          <h1 className="text-3xl font-black text-primary mb-2">¡Reserva Confirmada!</h1>
          <p className="text-2xl font-extrabold text-cta mb-4">{refNumber}</p>
          <p className="text-muted-foreground mb-8">Email de confirmación enviado</p>
          <div className="flex flex-col gap-3">
            <Link to="/mis-reservas" className="border-2 border-primary text-primary font-bold py-3 rounded-lg hover:bg-primary hover:text-primary-foreground transition-colors">
              Ver mi reserva
            </Link>
            <Link to="/" className="bg-cta text-cta-foreground font-bold py-3 rounded-lg hover:opacity-90 transition-opacity">
              Volver al inicio
            </Link>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
