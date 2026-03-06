import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import PublicLayout from '@/components/layout/PublicLayout';
import { useLang } from '@/contexts/LanguageContext';
import CategoryCard from '@/components/fleet/CategoryCard';
import FleetBookingModal from '@/components/fleet/FleetBookingModal';

interface Vehicle { id: string; brand: string; model: string; year: number; color: string; category_id: string; }

export default function Fleet() {
  const { t, lang } = useLang();
  const [categories, setCategories] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [bookingCatId, setBookingCatId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    async function load() {
      setError(null);
      const { data: cats, error: catError } = await supabase
        .from('vehicle_categories')
        .select('*, vehicle_category_translations(*)')
        .eq('is_active', true)
        .order('created_at');

      if (catError) {
        console.error('Error categorias:', catError);
        setError(catError.message);
        setLoaded(true);
        return;
      }
      setCategories(cats ?? []);

      // Load sample vehicles for each category
      const allVehicles: Vehicle[] = [];
      for (const cat of (cats ?? [])) {
        const { data: vehs, error: vehError } = await supabase
          .from('vehicles')
          .select('id, brand, model, year, color, category_id')
          .eq('category_id', cat.id)
          .eq('status', 'available')
          .limit(2);
        if (vehError) {
          console.error('Error vehiculos:', vehError);
        } else if (vehs) {
          allVehicles.push(...(vehs as Vehicle[]));
        }
      }
      setVehicles(allVehicles);
      setLoaded(true);
    }
    load();
  }, [lang]);

  const bookingCategory = categories.find(c => c.id === bookingCatId);

  return (
    <PublicLayout>
      <div className="pt-20 section-padding bg-accent min-h-screen">
        <div className="container">
          <h1 className="section-title">{t('nav.fleet')}</h1>
          <div className="section-line" />
          <p className="section-subtitle mb-10">{t('vehicles.subtitle')}</p>

          {error && (
            <div className="bg-destructive/10 border border-destructive text-destructive rounded-lg p-4 mb-6 text-sm">
              <strong>Error:</strong> {error}
            </div>
          )}

          <div className="flex flex-wrap justify-center gap-6">
            {categories.map(cat => (
              <div key={cat.id} className="w-full sm:w-[calc(50%-12px)] lg:w-[calc(33.333%-16px)]">
                <CategoryCard
                  category={cat}
                  vehicles={vehicles.filter(v => v.category_id === cat.id).slice(0, 2)}
                  onBook={setBookingCatId}
                />
              </div>
            ))}
          </div>

          {!loaded && <p className="text-center text-muted-foreground mt-10">{t('vehicles.loading')}</p>}
          {loaded && categories.length === 0 && !error && (
            <p className="text-center text-muted-foreground mt-10">No hay categorías activas.</p>
          )}
        </div>
      </div>

      {bookingCatId && bookingCategory && (
        <FleetBookingModal
          categoryId={bookingCatId}
          category={bookingCategory}
          onClose={() => setBookingCatId(null)}
        />
      )}
    </PublicLayout>
  );
}
