import { Users, Settings2, Fuel, ShieldCheck, Check, Zap } from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import { getVehicleTranslation } from '@/utils/vehicleTranslation';

interface Vehicle {
  id: string;
  brand: string;
  model: string;
  year: number;
  color: string;
}

interface Props {
  category: any;
  vehicles: Vehicle[];
  onBook: (categoryId: string) => void;
}

export default function CategoryCard({ category, vehicles, onBook }: Props) {
  const { t, lang } = useLang();
  const tr = getVehicleTranslation(category, lang);

  return (
    <div className="bg-card rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.08)] overflow-hidden hover:shadow-lg transition-shadow">
      {category.image_url && (
        <img src={category.image_url} alt={tr.name} className="w-full aspect-video object-cover" loading="lazy" />
      )}
      <div className="p-5 space-y-4">
        {/* Badges */}
        <div className="flex flex-wrap gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-700 px-2.5 py-0.5 text-[11px] font-bold">
            <ShieldCheck className="h-3 w-3" /> Seguro Premium incluido
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-700 px-2.5 py-0.5 text-[11px] font-bold">
            <Check className="h-3 w-3" /> 0€ Fianza
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-700 px-2.5 py-0.5 text-[11px] font-bold">
            <Zap className="h-3 w-3" /> Km ilimitados
          </span>
        </div>

        {/* Name + description */}
        <div>
          <h3 className="font-bold text-lg text-foreground">{tr.name}</h3>
          {tr.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{tr.description}</p>}
        </div>

        {/* Specs */}
        <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5"><Users className="h-4 w-4" />{category.seats_min}-{category.seats_max} {t('vehicles.seats')}</span>
          <span className="flex items-center gap-1.5"><Settings2 className="h-4 w-4" />{tr.transmission_note}</span>
          <span className="flex items-center gap-1.5"><Fuel className="h-4 w-4" />{tr.energy_type}</span>
        </div>

        {/* Sample vehicles */}
        {vehicles.length > 0 && (
          <div className="border-t border-border pt-3">
            <p className="text-xs text-muted-foreground mb-1.5">{t('booking.example')}:</p>
            <div className="space-y-1">
              {vehicles.map(v => (
                <p key={v.id} className="text-xs text-foreground">
                  {v.brand} {v.model} ({v.year}) — {v.color} <span className="text-muted-foreground">{t('vehicles.or_similar')}</span>
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Price */}
        <p className="text-xl font-bold text-primary">
          {t('vehicles.from')} €{category.price_per_day}{t('vehicles.per_day')}
        </p>

        {/* CTA */}
        <button
          onClick={() => onBook(category.id)}
          className="w-full bg-cta text-cta-foreground font-bold text-sm text-center py-3 rounded-lg hover:opacity-90 transition-opacity"
        >
          RESERVAR ESTE VEHÍCULO →
        </button>
      </div>
    </div>
  );
}
