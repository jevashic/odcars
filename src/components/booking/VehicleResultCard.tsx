import { Link } from 'react-router-dom';
import { Fuel, Users, Settings2 } from 'lucide-react';
import { getVehicleImage } from '@/utils/vehicleImage';

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
}

interface Props {
  vehicle: VehicleResult;
  days: number;
  params: URLSearchParams;
  lp: (path: string) => string;
  t: (key: string) => string;
}

export default function VehicleResultCard({ vehicle, days, params, lp, t }: Props) {
  const totalAmount = vehicle.quote?.total_amount ?? vehicle.pricePerDay * days;
  const perDay = vehicle.quote?.price_per_day ?? vehicle.pricePerDay;
  const totalOnline = Math.round(totalAmount * 0.85);

  const displayName = `${vehicle.brand} ${vehicle.model}${vehicle.year ? ` (${vehicle.year})` : ''}`;
  const baseQuery = `${params.toString()}&categoryId=${vehicle.categoryId}`;

  return (
    <div className="bg-card rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.08)] overflow-hidden hover:shadow-lg transition-shadow flex flex-col md:flex-row">
      {/* Image */}
      {vehicle.imageUrl ? (
        <img
          src={vehicle.imageUrl}
          alt={displayName}
          className="w-full md:w-[40%] aspect-[4/3] md:aspect-auto object-cover shrink-0"
          loading="lazy"
        />
      ) : (
        <div className="w-full md:w-[40%] aspect-[4/3] md:aspect-auto min-h-[200px] bg-muted flex items-center justify-center shrink-0">
          <Fuel className="h-12 w-12 text-muted-foreground/30" />
        </div>
      )}

      {/* Content */}
      <div className="p-5 flex flex-col flex-1 justify-between gap-3">
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
          <p className="text-2xl font-bold text-primary">{totalAmount} €</p>
          <p className="text-xs text-muted-foreground">
            {perDay} €{t('booking.per_day')} · {days} {days > 1 ? t('booking.days') : t('booking.day')}
          </p>
        </div>

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row gap-2">
          <Link
            to={lp(`/reservar/extras?${baseQuery}&paymentMode=online`)}
            className="flex-1 font-bold text-sm text-center py-3 rounded-lg transition-opacity hover:opacity-90 bg-primary text-primary-foreground"
          >
            {t('booking.pay_now')} — {totalOnline} €
          </Link>
          <Link
            to={lp(`/reservar/extras?${baseQuery}&paymentMode=office`)}
            className="flex-1 font-bold text-sm text-center py-3 rounded-lg transition-opacity hover:opacity-90 bg-cta text-cta-foreground"
          >
            {t('booking.pay_office')} — {totalAmount} €
          </Link>
        </div>
      </div>
    </div>
  );
}
