import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarIcon, Loader2, Edit, CreditCard, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Elements, CardNumberElement, CardExpiryElement, CardCvcElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { stripePromise } from '@/integrations/stripe/client';

interface Props {
  reservation: any;
  onUpdated: (updated: any) => void;
  onCancel: () => void;
}

interface PickupLocation {
  id: string;
  name: string;
  type: string;
  extra_charge: number | null;
}

interface Extra {
  id: string;
  name: string;
  price_per_reservation: number;
}

const TYPE_ICON: Record<string, string> = {
  office: '🏢',
  airport: '✈️',
  hotel: '🏨',
  other: '📍',
};

const CARD_OPTIONS = {
  hidePostalCode: true,
  style: {
    base: {
      fontSize: '16px',
      color: '#424770',
      '::placeholder': { color: '#aab7c4' },
    },
  },
};

type DiffType = 'charge' | 'refund' | 'none';

function ModifyFormInner({ reservation, onUpdated, onCancel }: Props) {
  const stripe = useStripe();
  const elements = useElements();

  // Section 1 — Dates
  const [startDate, setStartDate] = useState<Date | undefined>(
    reservation.start_date ? parseISO(reservation.start_date) : undefined
  );
  const [endDate, setEndDate] = useState<Date | undefined>(
    reservation.end_date ? parseISO(reservation.end_date) : undefined
  );

  // Section 2 — Locations
  const [pickupLocationId, setPickupLocationId] = useState(reservation.pickup_location_id || '');
  const [returnLocationId, setReturnLocationId] = useState(reservation.return_location_id || '');
  const [locations, setLocations] = useState<PickupLocation[]>([]);

  // Section 3 — Extras
  const [extras, setExtras] = useState<Extra[]>([]);
  const [selectedExtraIds, setSelectedExtraIds] = useState<string[]>([]);

  // Quote & price comparison
  const [quote, setQuote] = useState<any>(null);
  const [deliveryCharge, setDeliveryCharge] = useState(0);
  const [totalFinal, setTotalFinal] = useState(0);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [saving, setSaving] = useState(false);
  const [unavailableMsg, setUnavailableMsg] = useState<string | null>(null);

  // Price difference
  const [diffType, setDiffType] = useState<DiffType>('none');
  const [diffAmount, setDiffAmount] = useState(0);
  const oldTotal = Number(reservation.total_amount) || 0;

  // Stripe card state
  const [cardComplete, setCardComplete] = useState(false);

  // Load locations & extras
  useEffect(() => {
    supabase
      .from('pickup_locations')
      .select('id, name, type, extra_charge')
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data }) => { if (data) setLocations(data); });

    supabase
      .from('extras')
      .select('id, name, price_per_reservation')
      .eq('is_active', true)
      .then(({ data }) => { if (data) setExtras(data); });
  }, []);

  // Pre-select existing extras
  useEffect(() => {
    if (reservation.reservation_extras && extras.length > 0) {
      const existingNames = (reservation.reservation_extras as any[]).map((re: any) => re.extra_name?.toLowerCase());
      const matched = extras
        .filter(e => existingNames.includes(e.name?.toLowerCase()))
        .map(e => e.id);
      setSelectedExtraIds(matched);
    }
  }, [extras, reservation.reservation_extras]);

  const toggleExtra = (extraId: string) => {
    setSelectedExtraIds(prev =>
      prev.includes(extraId) ? prev.filter(id => id !== extraId) : [...prev, extraId]
    );
    setQuote(null);
  };

  const handleGetQuote = async () => {
    if (!startDate || !endDate) {
      toast({ title: 'Error', description: 'Selecciona ambas fechas.', variant: 'destructive' });
      return;
    }
    if (endDate <= startDate) {
      toast({ title: 'Error', description: 'La fecha de devolución debe ser posterior a la de recogida.', variant: 'destructive' });
      return;
    }

    setLoadingQuote(true);
    setQuote(null);
    setUnavailableMsg(null);
    try {
      const { data: quoteData, error: quoteError } = await supabase.rpc('get_quote', {
        p_category_id: reservation.category_id,
        p_start_date: format(startDate, 'yyyy-MM-dd'),
        p_end_date: format(endDate, 'yyyy-MM-dd'),
        p_insurance_tier: reservation.insurance_tier_snapshot ?? 'premium',
        p_extra_ids: selectedExtraIds ?? [],
        p_discount_code: null,
        p_exclude_reservation_id: reservation.id,
      });

      if (quoteError) {
        toast({ title: 'Error calculando precio', description: quoteError.message, variant: 'destructive' });
        setLoadingQuote(false);
        return;
      }
      if (!quoteData) {
        toast({ title: 'Error', description: 'No se recibió respuesta del cálculo.', variant: 'destructive' });
        setLoadingQuote(false);
        return;
      }

      const originalDays = Math.max(1, differenceInDays(parseISO(reservation.end_date), parseISO(reservation.start_date)));
      const newDaysCalc = Math.max(1, differenceInDays(endDate, startDate));

      if (newDaysCalc > originalDays && !quoteData.available) {
        setUnavailableMsg(
          'No hay disponibilidad para las fechas seleccionadas. Si necesitas ampliar tu reserva ponte en contacto con nuestra oficina: reservas@oceandrive.es o llámanos al +34 928 XXX XXX'
        );
        setLoadingQuote(false);
        return;
      }

      const pickupLoc = locations.find(l => l.id === pickupLocationId);
      const dc = pickupLoc?.extra_charge ?? 0;
      const tf = (quoteData.total_amount ?? 0) + dc;

      // Calculate difference
      const diff = tf - oldTotal;
      let dt: DiffType = 'none';
      if (diff > 0.01) dt = 'charge';
      else if (diff < -0.01) dt = 'refund';

      setQuote(quoteData);
      setDeliveryCharge(dc);
      setTotalFinal(tf);
      setDiffType(dt);
      setDiffAmount(Math.abs(diff));
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setLoadingQuote(false);
  };

  const handleSave = async () => {
    if (!quote) return;
    setSaving(true);
    try {
      let paymentMethodId: string | undefined;

      // If charge, create payment method with Stripe
      if (diffType === 'charge') {
        if (!stripe || !elements) {
          toast({ title: 'Error', description: 'Stripe no está listo.', variant: 'destructive' });
          setSaving(false);
          return;
        }
        const cardElement = elements.getElement(CardNumberElement);
        if (!cardElement) {
          toast({ title: 'Error', description: 'Introduce los datos de la tarjeta.', variant: 'destructive' });
          setSaving(false);
          return;
        }
        const { error: pmError, paymentMethod } = await stripe.createPaymentMethod({
          type: 'card',
          card: cardElement,
        });
        if (pmError || !paymentMethod) {
          toast({ title: 'Error de pago', description: pmError?.message || 'No se pudo crear el método de pago.', variant: 'destructive' });
          setSaving(false);
          return;
        }
        paymentMethodId = paymentMethod.id;
      }

      // Call Edge Function to handle everything server-side
      const body: any = {
        reservation_id: reservation.id,
        start_date: format(startDate!, 'yyyy-MM-dd'),
        end_date: format(endDate!, 'yyyy-MM-dd'),
        modified_by_role: 'customer',
      };
      if (paymentMethodId) {
        body.payment_method_id = paymentMethodId;
      }

      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://sqmganbjiisitgumsztv.supabase.co';
      const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxbWdhbmJqaWlzaXRndW1zenR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2NjkwOTEsImV4cCI6MjA4NzI0NTA5MX0.NIVT-p-_wa0PKaufK8vPYsgyegDFAiHAuUw60uWQYrQ';

      const res = await fetch(`${SUPABASE_URL}/functions/v1/modify_reservation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify(body),
      });

      const result = await res.json();
      if (result.error) throw new Error(result.error);

      toast({ title: '✓ Reserva modificada', description: 'Los cambios se han guardado correctamente.' });

      // Re-fetch reservation to get updated data
      const { data: updated } = await supabase
        .from('reservations')
        .select(`id, reservation_number, status, start_date, end_date, total_amount, extras_total, discount_amount, delivery_charge, delivery_details, insurance_tier_snapshot, tax_amount, sale_channel, notes, created_at, category_id, pickup_location_id, return_location_id, customers(first_name, last_name, email, phone), vehicle_categories(name, image_url), vehicles(plate, brand, model), reservation_extras(extra_name, quantity, unit_price, subtotal)`)
        .eq('id', reservation.id)
        .maybeSingle();

      if (updated) onUpdated(updated);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const newDays = startDate && endDate ? Math.max(1, differenceInDays(endDate, startDate)) : 0;

  const canConfirm = quote && !unavailableMsg && (
    diffType !== 'charge' || cardComplete
  );

  return (
    <div className="bg-card rounded-2xl shadow-sm p-6 md:p-8 space-y-8">
      <div className="flex items-center gap-2">
        <Edit className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-bold">Modificar reserva</h2>
      </div>

      {/* SECTION 1 — FECHAS */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Fechas</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Fecha de recogida</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !startDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, 'dd/MM/yyyy') : 'Seleccionar'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={(d) => { setStartDate(d); setQuote(null); }}
                  disabled={(date) => date < new Date()}
                  locale={es}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Fecha de devolución</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !endDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {endDate ? format(endDate, 'dd/MM/yyyy') : 'Seleccionar'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={(d) => { setEndDate(d); setQuote(null); }}
                  disabled={(date) => date < (startDate || new Date())}
                  locale={es}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
        {newDays > 0 && (
          <p className="text-sm text-muted-foreground">{newDays} {newDays > 1 ? 'días' : 'día'}</p>
        )}
      </div>

      {/* SECTION 2 — UBICACIONES */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Ubicaciones</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Lugar de recogida</label>
            <Select value={pickupLocationId} onValueChange={(v) => { setPickupLocationId(v); setQuote(null); }}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccionar lugar" />
              </SelectTrigger>
              <SelectContent>
                {locations.map((loc) => (
                  <SelectItem key={loc.id} value={loc.id}>
                    {TYPE_ICON[loc.type] || '📍'} {loc.name}
                    {loc.extra_charge ? ` (+${Number(loc.extra_charge).toFixed(2)} €)` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Lugar de devolución</label>
            <Select value={returnLocationId} onValueChange={(v) => { setReturnLocationId(v); setQuote(null); }}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccionar lugar" />
              </SelectTrigger>
              <SelectContent>
                {locations.map((loc) => (
                  <SelectItem key={loc.id} value={loc.id}>
                    {TYPE_ICON[loc.type] || '📍'} {loc.name}
                    {loc.extra_charge ? ` (+${Number(loc.extra_charge).toFixed(2)} €)` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* SECTION 3 — EXTRAS */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Extras</h3>
        {extras.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay extras disponibles.</p>
        ) : (
          <div className="space-y-2">
            {extras.map((ext) => (
              <label
                key={ext.id}
                className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-accent/50 cursor-pointer transition-colors"
              >
                <Checkbox
                  checked={selectedExtraIds.includes(ext.id)}
                  onCheckedChange={() => toggleExtra(ext.id)}
                />
                <span className="flex-1 text-sm">{ext.name}</span>
                <span className="text-sm font-medium text-primary">
                  {Number(ext.price_per_reservation).toFixed(2)} €
                </span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Calculate quote button */}
      <Button onClick={handleGetQuote} disabled={loadingQuote} variant="outline" className="w-full">
        {loadingQuote ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        VER PRECIO
      </Button>

      {/* Unavailability message */}
      {unavailableMsg && (
        <div className="bg-orange-50 border border-orange-300 text-orange-800 rounded-lg p-4 text-sm">
          {unavailableMsg}
        </div>
      )}

      {/* Quote preview with price comparison */}
      {quote && (
        <div className="space-y-4">

          {/* Price comparison */}
          <div className="bg-card border border-border rounded-lg p-4 space-y-3">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Precio anterior</span>
              <span className="line-through text-muted-foreground">{oldTotal.toFixed(2)} €</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-bold text-base">Precio nuevo</span>
              <span className="font-bold text-xl text-primary">{totalFinal.toFixed(2)} €</span>
            </div>
            <div className="border-t border-border pt-3">
              {diffType === 'charge' && (
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-sm">Diferencia a cobrar</span>
                  <span className="font-bold text-lg text-destructive">+{diffAmount.toFixed(2)} €</span>
                </div>
              )}
              {diffType === 'refund' && (
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-sm">Diferencia a devolver</span>
                  <span className="font-bold text-lg text-emerald-600">−{diffAmount.toFixed(2)} €</span>
                </div>
              )}
              {diffType === 'none' && (
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-sm">Diferencia</span>
                  <span className="font-bold text-sm text-muted-foreground">Sin coste adicional</span>
                </div>
              )}
            </div>
          </div>

          {/* Conditional: Stripe card for charge */}
          {diffType === 'charge' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <CreditCard className="h-4 w-4 text-primary" />
                <span>Introduce tu tarjeta para abonar la diferencia</span>
              </div>
              <div className="border border-border rounded-lg p-4 bg-background">
                <CardElement
                  options={CARD_OPTIONS}
                  onChange={(e) => setCardComplete(e.complete)}
                />
              </div>
            </div>
          )}

          {/* Refund message */}
          {diffType === 'refund' && (
            <div className="bg-emerald-50 border border-emerald-300 text-emerald-700 rounded-lg p-4 text-sm flex items-start gap-2">
              <CheckCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <p>
                Tienes un saldo a tu favor de <strong>{diffAmount.toFixed(2)} €</strong>.
                Nos pondremos en contacto contigo a la mayor brevedad para gestionar el reembolso.
              </p>
            </div>
          )}

          {/* No difference message */}
          {diffType === 'none' && (
            <div className="bg-accent border border-border text-foreground rounded-lg p-4 text-sm text-center font-medium">
              Sin coste adicional
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3">
        <Button variant="outline" onClick={onCancel} className="flex-1">Cancelar</Button>
        {quote && (
          <Button
            onClick={handleSave}
            disabled={saving || !canConfirm}
            className="flex-1 bg-cta text-cta-foreground hover:opacity-90"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            CONFIRMAR CAMBIOS
          </Button>
        )}
      </div>
    </div>
  );
}

// Wrapper with Stripe Elements provider
export default function ModifyReservationForm(props: Props) {
  return (
    <Elements stripe={stripePromise}>
      <ModifyFormInner {...props} />
    </Elements>
  );
}
