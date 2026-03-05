import { Link } from 'react-router-dom';
import { Tag, Percent, Clock, Gift } from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import { useLangPath } from '@/hooks/useLangNavigate';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface SpecialOffer {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  discount_type: string | null;
  discount_value: number | null;
  sort_order: number | null;
  is_active: boolean;
}

export default function OffersSection() {
  const { t } = useLang();
  const lp = useLangPath();

  const { data: offers = [], isLoading } = useQuery<SpecialOffer[]>({
    queryKey: ['public-special-offers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('special_offers')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return data ?? [];
    },
  });

  if (isLoading || offers.length === 0) return null;

  const icons = [Percent, Clock, Gift];

  return (
    <section className="section-padding bg-[#0F172A]">
      <div className="container">
        <h2 className="section-title !text-white">{t('offers.title')}</h2>
        <div className="section-line" />
        <p className="section-subtitle !text-white/50 mb-10">{t('offers.subtitle')}</p>

        {/* Main banner from first offer */}
        {offers[0] && (
          <div className="border-2 border-cta rounded-2xl bg-[#1E293B] p-8 md:p-10 mb-8">
            <span className="inline-flex items-center gap-1.5 bg-cta text-cta-foreground text-xs font-bold uppercase px-3 py-1 rounded-full mb-4">
              <Tag className="h-3.5 w-3.5" /> {t('offers.special')}
            </span>
            <h3 className="text-2xl md:text-3xl font-bold text-white mb-2">{offers[0].title}</h3>
            <p className="text-white/60 mb-6 max-w-lg">{offers[0].description}</p>
            <Link to={lp('/ofertas')} className="inline-block bg-cta text-cta-foreground font-bold px-6 py-3 rounded-lg hover:opacity-90 transition-opacity">
              {t('offers.see_all')} →
            </Link>
          </div>
        )}

        {/* Remaining offers as cards */}
        {offers.length > 1 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {offers.slice(1, 4).map((offer, i) => {
              const Icon = icons[i % icons.length];
              const badge = offer.discount_type === 'percentage'
                ? `-${offer.discount_value}%`
                : offer.discount_value ? `-${offer.discount_value}€` : '';
              return (
                <div key={offer.id} className="bg-[#1E293B] border border-[#334155] rounded-xl p-7">
                  <div className="w-12 h-12 rounded-full bg-cta/20 flex items-center justify-center mb-4">
                    <Icon className="h-5 w-5 text-cta" />
                  </div>
                  {badge && <p className="text-3xl font-extrabold text-cta mb-1">{badge}</p>}
                  <h4 className="text-white font-bold text-lg mb-1">{offer.title}</h4>
                  {offer.description && <p className="text-white/50 text-sm">{offer.description}</p>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
