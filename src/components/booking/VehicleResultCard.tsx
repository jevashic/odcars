import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Car, Users, DoorOpen, Settings2, Fuel, Snowflake, Check, ChevronRight, ChevronLeft } from 'lucide-react';
import { useConfig } from '@/contexts/ConfigContext';
import { useIsMobile } from '@/hooks/use-mobile';

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
  const isMobile = useIsMobile();
  const [showDetails, setShowDetails] = useState(false);

  const totalOffice = vehicle.quote?.total_amount ?? vehicle.pricePerDay * days;
  const perDayOffice = Math.round(totalOffice / days);
  const totalOnline = Math.round(totalOffice * online_multiplier);
  const perDayOnline = Math.round(totalOnline / days);
  const savings = totalOffice - totalOnline;

  const displayName = `${vehicle.brand} ${vehicle.model}${vehicle.year ? ` ${vehicle.year}` : ''}`.trim();
  const baseQuery = `${params.toString()}&categoryId=${vehicle.categoryId}&quoteTotal=${totalOffice}`;

  const seatsLabel = vehicle.seats ? `${vehicle.seats}` : null;
  const transmissionLabel = vehicle.transmission || null;
  const fuelLabel = vehicle.fuelType || null;

  /* ─── MOBILE LAYOUT ─── */
  if (isMobile) {
    return (
      <div className="rounded-2xl overflow-hidden shadow-[0_2px_16px_rgba(0,0,0,0.08)] bg-card">
        {/* Animated container */}
        <div className="relative overflow-hidden">
          {/* STATE 1 — Summary */}
          <div
            className="transition-all duration-300 ease-in-out"
            style={{
              maxHeight: showDetails ? '0px' : '600px',
              opacity: showDetails ? 0 : 1,
              overflow: 'hidden',
            }}
          >
            {/* Header row: name + "El precio incluye" button */}
            <div className="flex items-start justify-between p-4 pb-2">
              <div>
                <h3 className="font-bold text-base text-foreground leading-tight">
                  {displayName}{' '}
                  <span className="text-xs font-normal text-muted-foreground">o similar</span>
                </h3>
                <p className="text-xs text-muted-foreground">{vehicle.categoryName}</p>
              </div>
              <button
                onClick={() => setShowDetails(true)}
                className="flex items-center gap-0.5 text-[11px] font-semibold whitespace-nowrap shrink-0 mt-1 px-2 py-1 rounded-full bg-primary/10 text-primary"
              >
                Incluye <ChevronRight className="h-3 w-3" />
              </button>
            </div>

            {/* Vehicle image */}
            <div className="flex items-center justify-center px-4 py-2">
              {vehicle.imageUrl ? (
                <img
                  src={vehicle.imageUrl}
                  alt={displayName}
                  className="max-h-[120px] w-full object-contain"
                  loading="lazy"
                />
              ) : (
                <Car className="h-16 w-16 text-muted-foreground/30" />
              )}
            </div>

            {/* Specs row */}
            <div className="flex items-center justify-center gap-4 px-4 pb-3 text-[11px] text-muted-foreground">
              {seatsLabel && (
                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5 shrink-0" />{seatsLabel}
                </span>
              )}
              <span className="flex items-center gap-1">
                <DoorOpen className="h-3.5 w-3.5 shrink-0" />{vehicle.doors ?? 5}
              </span>
              {transmissionLabel && (
                <span className="flex items-center gap-1">
                  <Settings2 className="h-3.5 w-3.5 shrink-0" />{transmissionLabel}
                </span>
              )}
            </div>

            {/* Two-column pricing */}
            <div className="grid grid-cols-2 border-t border-border">
              {/* Pay at office */}
              <div className="p-3 flex flex-col items-center gap-1 border-r border-border">
                <p className="font-bold text-[10px] uppercase tracking-wider text-primary">
                  Pagar al recoger
                </p>
                <p className="text-xl font-bold leading-none text-primary">
                  {perDayOffice}€<span className="text-[10px] font-normal text-muted-foreground">/día</span>
                </p>
                <p className="text-[11px] text-muted-foreground">Total: {totalOffice}€</p>
                <Link
                  to={lp(`/reservar/extras?${baseQuery}&paymentMode=office`)}
                  className="mt-1 w-full text-center font-bold text-[11px] py-2 rounded-lg border-2 border-primary text-primary transition-colors active:bg-primary active:text-primary-foreground"
                >
                  SELECCIONAR
                </Link>
              </div>

              {/* Pay online */}
              <div className="p-3 flex flex-col items-center gap-1" style={{ backgroundColor: '#1A3A4A' }}>
                <p className="font-bold text-[10px] uppercase tracking-wider text-cta">
                  Pagar ahora
                </p>
                <p className="text-xl font-bold leading-none text-primary-foreground">
                  {perDayOnline}€<span className="text-[10px] font-normal text-primary-foreground/70">/día</span>
                </p>
                <p className="text-[11px] text-primary-foreground/70">Total: {totalOnline}€</p>
                {savings > 0 && (
                  <span className="inline-block font-bold text-[10px] rounded-full px-2 py-0.5 bg-cta text-cta-foreground">
                    AHORRAS {savings}€
                  </span>
                )}
                <Link
                  to={lp(`/reservar/extras?${baseQuery}&paymentMode=online`)}
                  className="mt-1 w-full text-center font-bold text-[11px] py-2 rounded-lg bg-cta text-cta-foreground transition-opacity active:opacity-80"
                >
                  SELECCIONAR
                </Link>
              </div>
            </div>
          </div>

          {/* STATE 2 — Details */}
          <div
            className="transition-all duration-300 ease-in-out"
            style={{
              maxHeight: showDetails ? '600px' : '0px',
              opacity: showDetails ? 1 : 0,
              overflow: 'hidden',
            }}
          >
            <div className="p-4">
              {/* Back button */}
              <button
                onClick={() => setShowDetails(false)}
                className="flex items-center gap-1 text-sm font-semibold text-primary mb-3"
              >
                <ChevronLeft className="h-4 w-4" /> Volver
              </button>

              {/* Vehicle name */}
              <h3 className="font-bold text-base text-foreground mb-3">
                {displayName}{' '}
                <span className="text-xs font-normal text-muted-foreground">o similar</span>
              </h3>

              {/* Full specs */}
              <div className="grid grid-cols-3 gap-x-3 gap-y-2 text-[11px] text-muted-foreground mb-4">
                <span className="flex items-center gap-1"><Car className="h-3.5 w-3.5 shrink-0" />{vehicle.categoryName}</span>
                {seatsLabel && <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5 shrink-0" />{seatsLabel}</span>}
                <span className="flex items-center gap-1"><DoorOpen className="h-3.5 w-3.5 shrink-0" />{vehicle.doors ?? 5}</span>
                {transmissionLabel && <span className="flex items-center gap-1"><Settings2 className="h-3.5 w-3.5 shrink-0" />{transmissionLabel}</span>}
                {fuelLabel && <span className="flex items-center gap-1"><Fuel className="h-3.5 w-3.5 shrink-0" />{fuelLabel}</span>}
                <span className="flex items-center gap-1"><Snowflake className="h-3.5 w-3.5 shrink-0" />A/C</span>
              </div>

              {/* Benefits */}
              <p className="font-bold text-[13px] uppercase tracking-wider text-primary mb-2">
                El precio incluye
              </p>
              <ul className="space-y-2 mb-4">
                {benefits.map((b, i) => (
                  <li key={i} className="flex items-start gap-2 text-[13px] text-muted-foreground">
                    <Check className="h-4 w-4 shrink-0 mt-0.5 text-cta" />
                    {b}
                  </li>
                ))}
              </ul>

              {/* Min age */}
              <p className="text-xs text-muted-foreground">
                Edad mínima para alquilar: <strong>21 años</strong>
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ─── DESKTOP LAYOUT (unchanged) ─── */
  return (
    <div className="rounded-2xl overflow-hidden shadow-[0_2px_16px_rgba(0,0,0,0.08)] bg-card flex flex-col md:flex-row">
      {/* ZONE 1 — Vehicle Info */}
      <div className="md:w-1/4 p-4 flex flex-col items-center justify-between border-b md:border-b-0 md:border-r border-border">
        <h3 className="font-bold text-base text-foreground text-center leading-tight">
          {displayName} <span className="text-xs font-normal text-muted-foreground">o similar</span>
        </h3>
        <p className="text-xs text-muted-foreground">{vehicle.categoryName}</p>

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
