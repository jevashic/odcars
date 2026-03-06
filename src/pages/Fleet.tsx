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

  useEffect(() => {
    supabase.from('vehicle_categories').select('*, vehicle_category_translations(*)').eq('is_active', true).order('sort_order').then(({ data }) => {
      if (data) setCategories(data);
    });
    supabase.from('vehicles').select('id, brand, model, year, color, category_id').eq('status', 'available').then(({ data }) => {
      if (data) setVehicles(data as Vehicle[]);
    });
  }, [lang]);

  const bookingCategory = categories.find(c => c.id === bookingCatId);

  return (
    <PublicLayout>
      <div className="pt-20 section-padding bg-accent min-h-screen">
        <div className="container">
          <h1 className="section-title">{t('nav.fleet')}</h1>
          <div className="section-line" />
          <p className="section-subtitle mb-10">{t('vehicles.subtitle')}</p>

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

          {categories.length === 0 && (
            <p className="text-center text-muted-foreground mt-10">{t('vehicles.loading')}</p>
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
