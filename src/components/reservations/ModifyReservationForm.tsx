import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarIcon, Loader2, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

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

export default function ModifyReservationForm({ reservation, onUpdated, onCancel }: Props) {
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

  // Quote
  const [quote, setQuote] = useState<any>(null);
  const [deliveryCharge, setDeliveryCharge] = useState(0);
  const [totalFinal, setTotalFinal] = useState(0);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load locations & extras
  useEffect(() => {
    supabase
      .from('pickup_locations')
      .select('id, name, type, extra_charge')
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data }) => {
        if (data) setLocations(data);
      });

    supabase
      .from('extras')
      .select('id, name, price_per_reservation')
      .eq('is_active', true)
      .then(({ data }) => {
        if (data) setExtras(data);
      });
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
    setQuote(null); // Reset quote when extras change
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
    try {
      const { data, error } = await supabase.rpc('get_quote', {
        p_category_id: reservation.category_id,
        p_start_date: format(startDate, 'yyyy-MM-dd'),
        p_end_date: format(endDate, 'yyyy-MM-dd'),
        p_insurance_tier: reservation.insurance_tier_snapshot ?? 'premium',
        p_extra_ids: selectedExtraIds,
        p_discount_code: null,
      });

      console.log('Quote completo:', JSON.stringify(data));

      if (error || !data) {
        toast({ title: 'Error calculando precio', description: error?.message ?? 'Error calculando precio', variant: 'destructive' });
        setLoadingQuote(false);
        return;
      }

      const pickupLoc = locations.find(l => l.id === pickupLocationId);
      const dc = pickupLoc?.extra_charge ?? 0;
      const tf = (Number(data.total_amount) || 0) + dc;

      setQuote(data);
      setDeliveryCharge(dc);
      setTotalFinal(tf);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setLoadingQuote(false);
  };

  const handleSave = async () => {
    if (!quote) return;
    setSaving(true);
    try {
      // 1. Update reservation
      const { error } = await supabase
        .from('reservations')
        .update({
          start_date: format(startDate!, 'yyyy-MM-dd'),
          end_date: format(endDate!, 'yyyy-MM-dd'),
          pickup_location_id: pickupLocationId || null,
          return_location_id: returnLocationId || null,
          total_amount: totalFinal,
          delivery_charge: deliveryCharge,
        })
        .eq('id', reservation.id);

      if (error) throw error;

      // 2. Sync extras: delete old, insert new
      await supabase
        .from('reservation_extras')
        .delete()
        .eq('reservation_id', reservation.id);

      if (selectedExtraIds.length > 0) {
        const rows = selectedExtraIds.map(eid => {
          const ext = extras.find(e => e.id === eid);
          return {
            reservation_id: reservation.id,
            extra_id: eid,
            extra_name: ext?.name || '',
            quantity: 1,
            unit_price: ext?.price_per_reservation || 0,
          };
        });
        const { error: extErr } = await supabase
          .from('reservation_extras')
          .insert(rows);
        if (extErr) throw extErr;
      }

      toast({ title: 'Reserva modificada correctamente', description: 'Los cambios se han guardado.' });

      // Re-fetch reservation
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
        CALCULAR NUEVO PRECIO
      </Button>

      {/* Quote preview */}
      {quote && (
        <div className="bg-accent rounded-lg p-4 space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Desglose del nuevo precio</p>
          {quote.subtotal_car != null && (
            <div className="flex justify-between text-sm">
              <span>Alquiler ({newDays} {newDays > 1 ? 'días' : 'día'})</span>
              <span>{Number(quote.subtotal_car).toFixed(2)} €</span>
            </div>
          )}
          {quote.extras_total != null && Number(quote.extras_total) > 0 && (
            <div className="flex justify-between text-sm">
              <span>Extras</span>
              <span>{Number(quote.extras_total).toFixed(2)} €</span>
            </div>
          )}
          {deliveryCharge > 0 && (
            <div className="flex justify-between text-sm">
              <span>Entrega/recogida</span>
              <span>{deliveryCharge.toFixed(2)} €</span>
            </div>
          )}
          {quote.discount_amount != null && Number(quote.discount_amount) > 0 && (
            <div className="flex justify-between text-sm text-green-600">
              <span>Descuento</span>
              <span>-{Number(quote.discount_amount).toFixed(2)} €</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-lg pt-2 border-t border-border">
            <span>TOTAL</span>
            <span className="text-primary">{totalFinal.toFixed(2)} €</span>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3">
        <Button variant="outline" onClick={onCancel} className="flex-1">Cancelar</Button>
        {quote && (
          <Button onClick={handleSave} disabled={saving} className="flex-1 bg-cta text-cta-foreground hover:opacity-90">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            CONFIRMAR CAMBIOS
          </Button>
        )}
      </div>
    </div>
  );
}
