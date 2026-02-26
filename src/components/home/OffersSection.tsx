import { Link } from 'react-router-dom';
import { Tag, Percent, Clock, Gift } from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import { useLangPath } from '@/hooks/useLangNavigate';

const cards = [
  { icon: Percent, pct: '-30%', title: 'Reserva anticipada', desc: 'Reserva con más de 30 días y ahorra' },
  { icon: Clock, pct: '-20%', title: 'Última hora', desc: 'Ofertas para salidas en menos de 48h' },
  { icon: Gift, pct: '-15%', title: 'Larga estancia', desc: 'Descuentos para alquileres de +7 días' },
];

export default function OffersSection() {
  const { t } = useLang();
  const lp = useLangPath();

  return (
    <section className="section-padding bg-[#0F172A]">
      <div className="container">
        <h2 className="section-title !text-white">{t('offers.title')}</h2>
        <div className="section-line" />
        <p className="section-subtitle !text-white/50 mb-10">{t('offers.subtitle')}</p>

        {/* Main banner */}
        <div className="border-2 border-cta rounded-2xl bg-[#1E293B] p-8 md:p-10 mb-8">
          <span className="inline-flex items-center gap-1.5 bg-cta text-cta-foreground text-xs font-bold uppercase px-3 py-1 rounded-full mb-4">
            <Tag className="h-3.5 w-3.5" /> {t('offers.special')}
          </span>
          <h3 className="text-2xl md:text-3xl font-bold text-white mb-2">Semana Santa en Gran Canaria</h3>
          <p className="text-white/60 mb-6 max-w-lg">Reserva tu coche para Semana Santa con precios exclusivos. Seguro premium y kilómetros ilimitados incluidos.</p>
          <Link to={lp('/ofertas')} className="inline-block bg-cta text-cta-foreground font-bold px-6 py-3 rounded-lg hover:opacity-90 transition-opacity">
            {t('offers.see_all')} →
          </Link>
        </div>

        {/* 3 cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {cards.map((c, i) => (
            <div key={i} className="bg-[#1E293B] border border-[#334155] rounded-xl p-7">
              <div className="w-12 h-12 rounded-full bg-cta/20 flex items-center justify-center mb-4">
                <c.icon className="h-5 w-5 text-cta" />
              </div>
              <p className="text-3xl font-extrabold text-cta mb-1">{c.pct}</p>
              <h4 className="text-white font-bold text-lg mb-1">{c.title}</h4>
              <p className="text-white/50 text-sm">{c.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
