import { Link } from 'react-router-dom';
import { Fuel } from 'lucide-react';

interface VehicleResult {
  vehicleId: string;
  brand: string;
  model: string;
  imageUrl: string | null;
  categoryId: string;
  categoryName: string;
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

  const displayName = vehicle.model
    ? `${vehicle.brand} ${vehicle.model}`
    : vehicle.brand;

  const baseQuery = `${params.toString()}&categoryId=${vehicle.categoryId}`;

  return (
    <div className="bg-card rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.08)] overflow-hidden hover:shadow-lg transition-shadow flex flex-col md:flex-row">
      {/* Image — left side */}
      {vehicle.imageUrl ? (
        <img
          src={vehicle.imageUrl}
          alt={displayName}
          className="w-full md:w-[38%] aspect-[4/3] md:aspect-auto object-cover shrink-0"
          loading="lazy"
        />
      ) : (
        <div className="w-full md:w-[38%] aspect-[4/3] md:aspect-auto bg-muted flex items-center justify-center shrink-0">
          <Fuel className="h-12 w-12 text-muted-foreground/30" />
        </div>
      )}

      {/* Content — right side */}
      <div className="p-5 flex flex-col flex-1 justify-between gap-4">
        {/* Top: name + category */}
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            {vehicle.categoryName}
          </span>
          <h3 className="font-bold text-lg text-foreground mt-0.5">{displayName}</h3>
        </div>

        {/* Pricing */}
        <div>
          <p className="text-2xl font-bold text-primary">{totalAmount} €</p>
          <p className="text-xs text-muted-foreground">
            {perDay} €{t('booking.per_day')} · {days} {days > 1 ? t('booking.days') : t('booking.day')}
          </p>
        </div>

        {/* CTA Buttons */}
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
