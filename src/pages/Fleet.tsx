import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import PublicLayout from '@/components/layout/PublicLayout';
import { useLang } from '@/contexts/LanguageContext';
import { useLangNavigate } from '@/hooks/useLangNavigate';
import BannerZone from '@/components/home/BannerZone';
import CategoryCard from '@/components/fleet/CategoryCard';

export default function Fleet() {
  const { t } = useLang();
  const navigate = useLangNavigate();
  const [categories, setCategories] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    async function load() {
      setError(null);
      const { data, error: err } = await supabase
        .from('vehicle_categories')
        .select('*, vehicle_category_translations(*)')
        .eq('is_active', true)
        .order('price_per_day');

      if (err) {
        console.error('Error categorías:', err);
        setError(err.message);
        setLoaded(true);
        return;
      }

      setCategories(data ?? []);
      setLoaded(true);
    }
    load();
  }, []);

  return (
    <PublicLayout>
      <div className="pt-20 section-padding bg-accent min-h-screen">
        <div className="container">
          <h1 className="section-title">{t('nav.fleet')}</h1>
          <div className="section-line" />
          <p className="section-subtitle mb-10">{t('vehicles.subtitle')}</p>

          <BannerZone position="fleet_top" />

          {error && (
            <div className="bg-destructive/10 border border-destructive text-destructive rounded-lg p-4 mb-6 text-sm">
              <strong>Error:</strong> {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {categories.map(cat => (
              <CategoryCard
                key={cat.id}
                category={cat}
                vehicles={[]}
                onBook={(categoryId) => navigate(`/reservar?category_id=${categoryId}`)}
              />
            ))}
          </div>

          {!loaded && <p className="text-center text-muted-foreground mt-10">{t('vehicles.loading')}</p>}
          {loaded && categories.length === 0 && !error && (
            <p className="text-center text-muted-foreground mt-10">No hay vehículos disponibles.</p>
          )}
        </div>
      </div>
    </PublicLayout>
  );
}
