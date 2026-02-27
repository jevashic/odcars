import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Navigation, Baby } from 'lucide-react';
import PublicLayout from '@/components/layout/PublicLayout';
import { useLang } from '@/contexts/LanguageContext';
import { useLangNavigate } from '@/hooks/useLangNavigate';

export default function Extras() {
  const [params] = useSearchParams();
  const { t } = useLang();
  const navigate = useLangNavigate();
  const [selected, setSelected] = useState<string[]>([]);

  const EXTRAS_LIST = [
    { id: 'gps', name: t('booking.extra_gps'), description: t('booking.extra_gps_desc'), price: 5, icon: Navigation },
    { id: 'baby-seat', name: t('booking.extra_baby'), description: t('booking.extra_baby_desc'), price: 7, icon: Baby },
  ];

  const toggle = (id: string) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleContinue = () => {
    const p = new URLSearchParams(params);
    if (selected.length > 0) p.set('extras', selected.join(','));
    navigate(`/reservar/resumen?${p.toString()}`);
  };

  return (
    <PublicLayout>
      <div className="pt-20 section-padding min-h-screen bg-accent">
        <div className="container max-w-3xl">
          <h1 className="text-2xl font-bold text-primary mb-2">{t('booking.extras_title')}</h1>
          <div className="w-[60px] h-[3px] bg-cta rounded-full mb-8" />

          <div className="space-y-4">
            {EXTRAS_LIST.map((ext) => (
              <div
                key={ext.id}
                onClick={() => toggle(ext.id)}
                className={`bg-card rounded-xl p-5 flex items-center justify-between shadow-sm border-2 transition-colors cursor-pointer ${selected.includes(ext.id) ? 'border-cta' : 'border-transparent'}`}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <ext.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground">{ext.name}</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">{ext.description}</p>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-4">
                  <p className="font-bold text-primary">+{ext.price} €</p>
                  <p className="text-xs text-muted-foreground">{t('vehicles.per_day')}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 flex gap-4">
            <button onClick={() => navigate(-1 as any)} className="px-6 py-3.5 border-2 border-primary text-primary font-bold rounded-lg hover:bg-primary hover:text-primary-foreground transition-colors">
              {t('booking.back')}
            </button>
            <button onClick={handleContinue} className="flex-1 bg-cta text-cta-foreground font-bold text-center py-3.5 rounded-lg hover:opacity-90 transition-opacity">
              {t('booking.continue')}
            </button>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
