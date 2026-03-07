import { Link } from 'react-router-dom';
import { Fuel, Users, Settings2 } from 'lucide-react';

interface VehicleResult {
  vehicleId: string;
  brand: string;
  model: string;
  year?: number;
  imageUrl: string | null;
  categoryId: string;
  categoryName: string;
  transmission?: string;
  fuelType?: string;
  seats?: number;
  quote: any;
  pricePerDay: number;
  isRecommended?: boolean;
}

interface Props {
  vehicle: VehicleResult;
  days: number;
  params: URLSearchParams;
  lp: (path: string) => string;
  t: (key: string) => string;
}

export default function VehicleResultCard({ vehicle, days, params, lp, t }: Props) {
  const totalOffice = vehicle.quote?.total_amount ?? vehicle.pricePerDay * days;
  const perDay = vehicle.quote?.price_per_day ?? vehicle.pricePerDay;
  const totalOnline = Math.round(totalOffice * 0.90);
  const savings = totalOffice - totalOnline;

  const displayName = `${vehicle.brand} ${vehicle.model}${vehicle.year ? ` (${vehicle.year})` : ''}`;
  const baseQuery = `${params.toString()}&categoryId=${vehicle.categoryId}`;

  return (
    <div
      className={`rounded-2xl overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.08)] hover:shadow-lg transition-shadow flex flex-col md:flex-row ${
        vehicle.isRecommended ? 'ring-2 ring-primary' : 'bg-card'
      }`}
    >
      {/* Recommended banner */}
      {vehicle.isRecommended && (
        <div className="absolute top-0 left-0 right-0 bg-primary text-primary-foreground text-center text-xs font-bold py-1 uppercase tracking-wider z-10">
          ⭐ {t('booking.recommended') || 'Recomendado'}
        </div>
      )}

      {/* Image */}
      <div className="relative w-full md:w-[40%] shrink-0">
        {vehicle.isRecommended && (
          <div className="absolute top-3 left-3 bg-primary text-primary-foreground text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full z-10">
            ⭐ {t('booking.recommended') || 'Recomendado'}
          </div>
        )}
        {vehicle.imageUrl ? (
          <img
            src={vehicle.imageUrl}
            alt={displayName}
            className="w-full h-full min-h-[220px] object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full min-h-[220px] bg-muted flex items-center justify-center">
            <Fuel className="h-12 w-12 text-muted-foreground/30" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 p-5 flex flex-col justify-between gap-4 bg-card">
        <div>
          <span className="inline-block text-[11px] font-bold uppercase tracking-wider bg-accent text-muted-foreground px-2.5 py-1 rounded-full mb-2">
            {vehicle.categoryName}
          </span>
          <h3 className="font-bold text-lg text-foreground">{displayName}</h3>

          {/* Specs */}
          <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
            {vehicle.seats && (
              <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{vehicle.seats} plazas</span>
            )}
            {vehicle.transmission && (
              <span className="flex items-center gap-1"><Settings2 className="h-3.5 w-3.5" />{vehicle.transmission}</span>
            )}
            {vehicle.fuelType && (
              <span className="flex items-center gap-1"><Fuel className="h-3.5 w-3.5" />{vehicle.fuelType}</span>
            )}
          </div>
        </div>

        {/* Price */}
        <div>
          <p className="text-3xl font-extrabold text-foreground">{perDay} €<span className="text-sm font-normal text-muted-foreground">/{t('booking.day')}</span></p>
          <p className="text-sm text-muted-foreground mt-0.5">
            Total: {totalOffice} € · {days} {days > 1 ? t('booking.days') : t('booking.day')}
          </p>
        </div>

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row gap-2">
          <Link
            to={lp(`/reservar/extras?${baseQuery}&paymentMode=online`)}
            className="flex-1 font-bold text-sm text-center py-3 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
          >
            {t('booking.pay_now')} — {totalOnline} €
            <span className="block text-[11px] font-normal opacity-80">Ahorras {savings} €</span>
          </Link>
          <Link
            to={lp(`/reservar/extras?${baseQuery}&paymentMode=office`)}
            className="flex-1 font-bold text-sm text-center py-3 rounded-lg bg-cta text-cta-foreground hover:opacity-90 transition-opacity"
          >
            {t('booking.pay_office')} — {totalOffice} €
          </Link>
        </div>
      </div>
    </div>
  );
}
