import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Navigation, Baby, Package } from 'lucide-react';
import PublicLayout from '@/components/layout/PublicLayout';
import { useLang } from '@/contexts/LanguageContext';
import { useLangNavigate } from '@/hooks/useLangNavigate';
import { supabase } from '@/integrations/supabase/client';

interface ExtraItem {
  id: string;
  name: string;
  price_per_reservation: number;
}

const ICON_MAP: Record<string, any> = {
  gps: Navigation,
  navegador: Navigation,
  silla: Baby,
  baby: Baby,
};

function getIcon(name: string) {
  const lower = name.toLowerCase();
  for (const [key, icon] of Object.entries(ICON_MAP)) {
    if (lower.includes(key)) return icon;
  }
  return Package;
}

export default function Extras() {
  const [params] = useSearchParams();
  const { t } = useLang();
  const navigate = useLangNavigate();
  const rawNavigate = useNavigate();
  const [selected, setSelected] = useState<string[]>([]);
  const [extras, setExtras] = useState<ExtraItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('extras')
      .select('id, name, price_per_reservation')
      .eq('is_active', true)
      .then(({ data }) => {
        if (data) setExtras(data);
        setLoading(false);
      });
  }, []);

  const toggle = (id: string) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleContinue = () => {
    const p = new URLSearchParams(params);
    if (selected.length > 0) {
      p.set('extras', selected.join(','));
      // Pass prices so Summary/Payment can calculate without another query
      const priceMap = selected.map(id => {
        const ext = extras.find(e => e.id === id);
        return `${id}:${ext?.price_per_reservation || 0}`;
      }).join(',');
      p.set('extrasPrices', priceMap);
    }
    navigate(`/reservar/resumen?${p.toString()}`);
  };

  return (
    <PublicLayout>
      <div className="pt-20 section-padding min-h-screen bg-accent">
        <div className="container max-w-3xl">
          <h1 className="text-2xl font-bold text-primary mb-2">{t('booking.extras_title')}</h1>
          <div className="w-[60px] h-[3px] bg-cta rounded-full mb-8" />

          {loading ? (
            <p className="text-muted-foreground">{t('booking.loading') || 'Cargando...'}</p>
          ) : extras.length === 0 ? (
            <p className="text-muted-foreground">{t('booking.no_extras') || 'No hay extras disponibles'}</p>
          ) : (
            <div className="space-y-4">
              {extras.map((ext) => {
                const Icon = getIcon(ext.name);
                return (
                  <div
                    key={ext.id}
                    onClick={() => toggle(ext.id)}
                    className={`bg-card rounded-xl p-5 flex items-center justify-between shadow-sm border-2 transition-colors cursor-pointer ${selected.includes(ext.id) ? 'border-cta' : 'border-transparent'}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-bold text-foreground">{ext.name}</h3>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-4">
                      <p className="font-bold text-primary">+{ext.price_per_reservation} €</p>
                      <p className="text-xs text-muted-foreground">{t('vehicles.per_day')}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-8 flex gap-4">
            <button onClick={() => rawNavigate(-1)} className="px-6 py-3.5 border-2 border-primary text-primary font-bold rounded-lg hover:bg-primary hover:text-primary-foreground transition-colors">
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
