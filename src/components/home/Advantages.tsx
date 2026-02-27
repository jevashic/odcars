import { ShieldCheck, BadgeCheck, Gauge, X, Users, PlaneTakeoff, Leaf, Phone } from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';

const items = [
  { icon: ShieldCheck, key: 'advantages.insurance' },
  { icon: BadgeCheck, key: 'advantages.deposit' },
  { icon: Gauge, key: 'advantages.km' },
  { icon: X, key: 'advantages.cancel' },
  { icon: Users, key: 'advantages.driver' },
  { icon: PlaneTakeoff, key: 'advantages.delivery' },
  { icon: Leaf, key: 'advantages.eco' },
  { icon: Phone, key: 'advantages.support' },
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
              <p className="text-white font-bold text-[15px] leading-snug">{t(item.key)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
