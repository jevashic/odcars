import { ShieldCheck, BadgeCheck, Gauge, X, Users, PlaneTakeoff, Leaf, Phone } from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';

const items = [
  { icon: ShieldCheck, text: 'Seguro Premium a Todo Riesgo incluido' },
  { icon: BadgeCheck, text: '0€ Fianza — Sin sorpresas al devolver' },
  { icon: Gauge, text: 'Kilómetros ilimitados' },
  { icon: X, text: 'Cancelación gratuita hasta 48h antes' },
  { icon: Users, text: 'Conductor adicional gratis' },
  { icon: PlaneTakeoff, text: 'Entrega en aeropuerto y en tu hotel' },
  { icon: Leaf, text: 'Flota ecológica disponible' },
  { icon: Phone, text: 'Atención personalizada 7 días' },
];

export default function Advantages() {
  const { t } = useLang();

  return (
    <section className="section-padding bg-gradient-to-b from-primary to-[hsl(200,55%,14%)]">
      <div className="container">
        <h2 className="section-title !text-white">{t('advantages.title')}</h2>
        <div className="section-line" />
        <p className="section-subtitle !text-white/70 mb-10">{t('advantages.subtitle')}</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {items.map((item, i) => (
            <div
              key={i}
              className="rounded-xl border border-white/[0.08] bg-white/[0.06] p-6 hover:border-secondary transition-colors"
            >
              <div className="w-11 h-11 rounded-[10px] bg-cta flex items-center justify-center mb-4">
                <item.icon className="h-5 w-5 text-cta-foreground" />
              </div>
              <p className="text-white font-bold text-[15px] leading-snug">{item.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
