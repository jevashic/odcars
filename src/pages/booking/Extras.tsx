import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import PublicLayout from '@/components/layout/PublicLayout';

export default function Extras() {
  const [params] = useSearchParams();
  const [extras, setExtras] = useState<any[]>([]);
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    supabase.from('extras').select('*').eq('is_active', true).order('name').then(({ data }) => {
      if (data) setExtras(data);
    });
  }, []);

  const toggle = (id: string) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  return (
    <PublicLayout>
      <div className="pt-20 section-padding min-h-screen bg-accent">
        <div className="container max-w-3xl">
          <h1 className="text-2xl font-bold text-primary mb-2">¿Quieres añadir algo más?</h1>
          <div className="w-[60px] h-[3px] bg-cta rounded-full mb-8" />

          <div className="space-y-4">
            {extras.map((ext) => (
              <div key={ext.id} className={`bg-card rounded-xl p-5 flex items-center justify-between shadow-sm border-2 transition-colors cursor-pointer ${selected.includes(ext.id) ? 'border-cta' : 'border-transparent'}`} onClick={() => toggle(ext.id)}>
                <div>
                  <h3 className="font-bold text-foreground">{ext.name}</h3>
                  {ext.description && <p className="text-sm text-muted-foreground mt-1">{ext.description}</p>}
                </div>
                <div className="text-right shrink-0 ml-4">
                  <p className="font-bold text-primary">+€{ext.price}</p>
                  <p className="text-xs text-muted-foreground">/reserva</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 flex gap-4">
            <Link to={`/reservar/resumen?${params.toString()}&extras=${selected.join(',')}`} className="flex-1 bg-cta text-cta-foreground font-bold text-center py-3.5 rounded-lg hover:opacity-90 transition-opacity">
              Continuar →
            </Link>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
