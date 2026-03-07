import { Link } from 'react-router-dom';
import { Fuel, Users, Settings2, ShieldCheck, Gauge, CreditCard, Headphones } from 'lucide-react';


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

const benefits = [
  { icon: ShieldCheck, label: 'Seguro Premium incluido' },
  { icon: CreditCard, label: '0€ Fianza' },
  { icon: Gauge, label: 'Km ilimitados' },
  { icon: Headphones, label: 'Asistencia 24h' },
];

export default function VehicleResultCard({ vehicle, days, params, lp, t }: Props) {
  const totalOffice = vehicle.quote?.total_amount ?? vehicle.pricePerDay * days;
  const perDay = vehicle.quote?.price_per_day ?? vehicle.pricePerDay;
  const totalOnline = Math.round(totalOffice * 0.90);
  const savings = totalOffice - totalOnline;

  const displayName = `${vehicle.brand} ${vehicle.model}${vehicle.year ? ` (${vehicle.year})` : ''}`;
  const baseQuery = `${params.toString()}&categoryId=${vehicle.categoryId}`;

  return (
    <div className="bg-card rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.08)] overflow-hidden hover:shadow-lg transition-shadow flex flex-col md:flex-row">
      {/* Image */}
      {vehicle.imageUrl ? (
        <img
          src={vehicle.imageUrl}
          alt={displayName}
          className="w-full md:w-[280px] lg:w-[320px] aspect-[4/3] md:aspect-auto object-cover shrink-0"
          loading="lazy"
        />
      ) : (
        <div className="w-full md:w-[280px] lg:w-[320px] aspect-[4/3] md:aspect-auto min-h-[220px] bg-muted flex items-center justify-center shrink-0">
          <Fuel className="h-12 w-12 text-muted-foreground/30" />
        </div>
      )}

      {/* Content */}
      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Left: vehicle info + specs + benefits */}
        <div className="flex-1 p-5 flex flex-col gap-3">
          <div>
            <span className="inline-block text-[11px] font-bold uppercase tracking-wider bg-accent text-muted-foreground px-2.5 py-1 rounded-full mb-1.5">
              {vehicle.categoryName}
            </span>
            <h3 className="font-bold text-lg text-foreground leading-tight">{displayName}</h3>
          </div>

          {/* Specs */}
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
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

          {/* Benefits */}
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-1">
            {benefits.map((b, i) => (
              <span key={i} className="flex items-center gap-1.5 text-xs text-primary font-medium">
                <b.icon className="h-3.5 w-3.5" />
                {b.label}
              </span>
            ))}
          </div>
        </div>

        {/* Right: pricing + CTAs */}
        <div className="lg:w-[240px] shrink-0 p-5 lg:border-l border-border flex flex-col justify-between gap-4 bg-accent/30">
          <div>
            <p className="text-xs text-muted-foreground mb-1">
              {perDay} €/{t('booking.day')} · {days} {days > 1 ? t('booking.days') : t('booking.day')}
            </p>
            <p className="text-2xl font-extrabold text-foreground">{totalOffice} €</p>
            <p className="text-[11px] text-muted-foreground">{t('booking.total')}</p>
          </div>

          <div className="flex flex-col gap-2">
            <Link
              to={lp(`/reservar/extras?${baseQuery}&paymentMode=online`)}
              className="block font-bold text-sm text-center py-3 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
            >
              {t('booking.pay_now')} — {totalOnline} €
            </Link>
            <p className="text-center text-xs font-semibold text-primary">
              {t('booking.save')} {savings} € (10%)
            </p>

            <Link
              to={lp(`/reservar/extras?${baseQuery}&paymentMode=office`)}
              className="block font-bold text-sm text-center py-3 rounded-lg bg-cta text-cta-foreground hover:opacity-90 transition-opacity"
            >
              {t('booking.pay_office')} — {totalOffice} €
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
