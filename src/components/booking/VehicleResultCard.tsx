import { Link } from 'react-router-dom';
import { Car, Users, DoorOpen, Settings2, Fuel, Snowflake, Check } from 'lucide-react';
import { useConfig } from '@/contexts/ConfigContext';

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
  seatsMin?: number;
  seatsMax?: number;
  transmissionNote?: string;
  energyType?: string;
  doors?: number;
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
  'Seguro Premium a Todo Riesgo incluido',
  'Cancelación gratuita hasta 48h antes',
  '0€ Fianza — Sin sorpresas al devolver',
  'Conductor adicional gratis',
  'Kilometraje ilimitado',
];

export default function VehicleResultCard({ vehicle, days, params, lp, t }: Props) {
  const { online_multiplier } = useConfig();
  const totalOffice = vehicle.quote?.total_amount ?? vehicle.pricePerDay * days;
  const perDayOffice = Math.round(totalOffice / days);
  const totalOnline = Math.round(totalOffice * online_multiplier);
  const perDayOnline = Math.round(totalOnline / days);
  const savings = totalOffice - totalOnline;

  const displayName = `${vehicle.brand} ${vehicle.model}`.trim();
  const baseQuery = `${params.toString()}&categoryId=${vehicle.categoryId}`;

  const seatsLabel = vehicle.seatsMin && vehicle.seatsMax
    ? `${vehicle.seatsMin}-${vehicle.seatsMax}`
    : vehicle.seats ? `${vehicle.seats}` : null;

  const transmissionLabel = vehicle.transmissionNote || vehicle.transmission || null;
  const fuelLabel = vehicle.energyType || vehicle.fuelType || null;

  return (
    <div className="rounded-2xl overflow-hidden shadow-[0_2px_16px_rgba(0,0,0,0.08)] bg-card flex flex-col md:flex-row">
      {/* ZONE 1 — Vehicle Info */}
      <div className="md:w-1/4 p-4 flex flex-col items-center justify-between border-b md:border-b-0 md:border-r border-border">
        <h3 className="font-bold text-base text-foreground text-center leading-tight">
          {displayName} <span className="font-normal text-muted-foreground">o similar</span>
        </h3>

        <div className="flex-1 flex items-center justify-center py-3 w-full">
          {vehicle.imageUrl ? (
            <img
              src={vehicle.imageUrl}
              alt={displayName}
              className="max-h-[140px] w-full object-contain"
              loading="lazy"
            />
          ) : (
            <Car className="h-20 w-20 text-muted-foreground/30" />
          )}
        </div>

        <div className="grid grid-cols-3 gap-x-3 gap-y-1.5 text-[11px] text-muted-foreground w-full">
          <span className="flex items-center gap-1"><Car className="h-3.5 w-3.5 shrink-0" />{vehicle.categoryName}</span>
          {seatsLabel && <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5 shrink-0" />{seatsLabel}</span>}
          <span className="flex items-center gap-1"><DoorOpen className="h-3.5 w-3.5 shrink-0" />{vehicle.doors ?? 5}</span>
          {transmissionLabel && <span className="flex items-center gap-1"><Settings2 className="h-3.5 w-3.5 shrink-0" />{transmissionLabel}</span>}
          {fuelLabel && <span className="flex items-center gap-1"><Fuel className="h-3.5 w-3.5 shrink-0" />{fuelLabel}</span>}
          <span className="flex items-center gap-1"><Snowflake className="h-3.5 w-3.5 shrink-0" />A/C</span>
        </div>
      </div>

      {/* ZONE 2 — Benefits */}
      <div className="md:w-1/4 p-4 flex flex-col justify-center border-b md:border-b-0 md:border-r border-border">
        <p className="font-bold text-[13px] uppercase tracking-wider mb-3" style={{ color: '#0D3B5E' }}>
          El precio incluye
        </p>
        <ul className="space-y-2">
          {benefits.map((b, i) => (
            <li key={i} className="flex items-start gap-2 text-[13px]" style={{ color: '#444' }}>
              <Check className="h-4 w-4 shrink-0 mt-0.5" style={{ color: '#F2B705' }} />
              {b}
            </li>
          ))}
        </ul>
      </div>

      {/* ZONE 3 — Pay at Office */}
      <div className="md:w-1/4 p-4 flex flex-col items-center justify-center gap-2 border-b md:border-b-0 md:border-r border-border">
        <p className="font-bold text-xs uppercase tracking-wider" style={{ color: '#0D3B5E' }}>
          Pagar al recoger
        </p>
        <p className="text-[32px] font-bold leading-none" style={{ color: '#0D3B5E' }}>
          {perDayOffice}€<span className="text-sm font-normal text-muted-foreground">/día</span>
        </p>
        <p className="text-sm text-muted-foreground">Total: {totalOffice}€</p>
        <p className="text-xs text-muted-foreground">Cancelación sin coste*</p>
        <Link
          to={lp(`/reservar/extras?${baseQuery}&paymentMode=office`)}
          className="mt-2 w-full text-center font-bold text-sm py-2.5 rounded-lg border-2 transition-colors"
          style={{ borderColor: '#0D3B5E', color: '#0D3B5E' }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#0D3B5E'; e.currentTarget.style.color = '#fff'; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#0D3B5E'; }}
        >
          SELECCIONAR
        </Link>
      </div>

      {/* ZONE 4 — Pay Online */}
      <div className="md:w-1/4 p-4 flex flex-col items-center justify-center gap-2 md:rounded-r-2xl" style={{ backgroundColor: '#0D3B5E' }}>
        <p className="font-bold text-xs uppercase tracking-wider" style={{ color: '#F2B705' }}>
          Pagar ahora
        </p>
        <p className="text-[32px] font-bold leading-none text-white">
          {perDayOnline}€<span className="text-sm font-normal text-white/70">/día</span>
        </p>
        <p className="text-sm text-white/70">Total: {totalOnline}€</p>
        <span
          className="inline-block font-bold text-xs rounded-full px-3 py-1"
          style={{ backgroundColor: '#F2B705', color: '#0D3B5E' }}
        >
          AHORRAS {savings}€
        </span>
        <Link
          to={lp(`/reservar/extras?${baseQuery}&paymentMode=online`)}
          className="mt-2 w-full text-center font-bold text-sm py-2.5 rounded-lg transition-opacity hover:opacity-90"
          style={{ backgroundColor: '#F2B705', color: '#0D3B5E' }}
        >
          SELECCIONAR
        </Link>
      </div>
    </div>
  );
}
