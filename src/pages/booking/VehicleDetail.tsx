import { useEffect, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import PublicLayout from '@/components/layout/PublicLayout';
import InsuranceBadges from '@/components/InsuranceBadges';

export default function VehicleDetail() {
  const { categoryId } = useParams();
  const [params] = useSearchParams();
  const [category, setCategory] = useState<any>(null);
  const [quote, setQuote] = useState<any>(null);

  useEffect(() => {
    if (!categoryId) return;
    supabase.from('vehicle_categories').select('*').eq('id', categoryId).single().then(({ data }) => setCategory(data));
    supabase.rpc('get_quote', {
      p_category_id: categoryId,
      p_start_date: params.get('pickupDate'),
      p_end_date: params.get('returnDate'),
      p_pickup_branch_id: params.get('pickup'),
      p_return_branch_id: params.get('dropoff') || params.get('pickup'),
      p_driver_age: params.get('age') || '+30',
    }).then(({ data }) => setQuote(data));
  }, [categoryId, params]);

  if (!category) return <PublicLayout><div className="pt-24 text-center min-h-screen">Cargando...</div></PublicLayout>;

  return (
    <PublicLayout>
      <div className="pt-20 section-padding min-h-screen">
        <div className="container">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8">
            <div>
              {category.image_url && <img src={category.image_url} alt={category.name} className="w-full rounded-2xl mb-6" />}
              <h1 className="text-3xl font-bold text-primary">{category.name}</h1>
              <p className="text-muted-foreground mt-1">o similar</p>
              <InsuranceBadges className="mt-4" />
              {category.description && <p className="mt-6 text-foreground leading-relaxed">{category.description}</p>}
            </div>
            <div className="lg:sticky lg:top-24 self-start">
              <div className="bg-card rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.08)] p-6">
                <h3 className="font-bold text-lg text-foreground mb-4">Resumen del precio</h3>
                {quote ? (
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between"><span>Alquiler {quote.days} días</span><span>€{quote.rental_amount}</span></div>
                    {quote.delivery_surcharge > 0 && <div className="flex justify-between"><span>Suplemento entrega</span><span>€{quote.delivery_surcharge}</span></div>}
                    <div className="flex justify-between text-emerald-600"><span>Seguro Premium</span><span>INCLUIDO ✓</span></div>
                    <div className="flex justify-between text-emerald-600"><span>Fianza</span><span>0€ ✓</span></div>
                    <hr />
                    <div className="flex justify-between text-xl font-bold text-primary"><span>TOTAL</span><span>€{quote.total_amount}</span></div>
                    <p className="text-xs text-muted-foreground">Impuestos IGIC incluidos</p>
                  </div>
                ) : (
                  <p className="text-muted-foreground">Calculando precio...</p>
                )}
                <Link
                  to={`/reservar/extras?${params.toString()}&categoryId=${categoryId}`}
                  className="mt-6 block w-full bg-cta text-cta-foreground font-bold text-center py-3.5 rounded-lg hover:opacity-90 transition-opacity"
                >
                  Continuar →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
