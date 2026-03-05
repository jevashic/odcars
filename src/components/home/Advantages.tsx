import { ShieldCheck, BadgeCheck, Gauge, X, Users, PlaneTakeoff, Leaf, Phone } from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import * as LucideIcons from 'lucide-react';

const fallbackItems = [
  { icon: ShieldCheck, key: 'advantages.insurance' },
  { icon: BadgeCheck, key: 'advantages.deposit' },
  { icon: Gauge, key: 'advantages.km' },
  { icon: X, key: 'advantages.cancel' },
  { icon: Users, key: 'advantages.driver' },
  { icon: PlaneTakeoff, key: 'advantages.delivery' },
  { icon: Leaf, key: 'advantages.eco' },
  { icon: Phone, key: 'advantages.support' },
];

interface WhyChooseRow {
  id: string;
  icon_name: string | null;
  title: string;
  description: string | null;
  lang: string;
  sort_order: number | null;
  is_active: boolean;
}

function getIcon(name: string | null): React.ElementType {
  if (!name) return ShieldCheck;
  const icon = (LucideIcons as any)[name] || (LucideIcons as any)[name.charAt(0).toUpperCase() + name.slice(1)];
  return icon || ShieldCheck;
}

export default function Advantages() {
  const { t, lang } = useLang();

  const { data: dbItems } = useQuery<WhyChooseRow[]>({
    queryKey: ['public-why-choose-us', lang],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('why_choose_us')
        .select('*')
        .eq('is_active', true)
        .eq('lang', lang)
        .order('sort_order');
      if (error) throw error;
      return data ?? [];
    },
  });

  const useFallback = !dbItems || dbItems.length === 0;

  return (
    <section className="section-padding bg-gradient-to-b from-primary to-[hsl(200,55%,14%)]">
      <div className="container">
        <h2 className="section-title !text-white">{t('advantages.title')}</h2>
        <div className="section-line" />
        <p className="section-subtitle !text-white/70 mb-10">{t('advantages.subtitle')}</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {useFallback
            ? fallbackItems.map((item, i) => (
                <div key={i} className="rounded-xl border border-white/[0.08] bg-white/[0.06] p-6 hover:border-secondary transition-colors">
                  <div className="w-11 h-11 rounded-[10px] bg-cta flex items-center justify-center mb-4">
                    <item.icon className="h-5 w-5 text-cta-foreground" />
                  </div>
                  <p className="text-white font-bold text-[15px] leading-snug">{t(item.key)}</p>
                </div>
              ))
            : dbItems.map((item) => {
                const Icon = getIcon(item.icon_name);
                return (
                  <div key={item.id} className="rounded-xl border border-white/[0.08] bg-white/[0.06] p-6 hover:border-secondary transition-colors">
                    <div className="w-11 h-11 rounded-[10px] bg-cta flex items-center justify-center mb-4">
                      <Icon className="h-5 w-5 text-cta-foreground" />
                    </div>
                    <p className="text-white font-bold text-[15px] leading-snug">{item.title}</p>
                    {item.description && <p className="text-white/50 text-sm mt-1">{item.description}</p>}
                  </div>
                );
              })}
        </div>
      </div>
    </section>
  );
}
