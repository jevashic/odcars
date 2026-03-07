import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarIcon, Loader2, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface Props {
  reservation: any;
  onUpdated: (updated: any) => void;
  onCancel: () => void;
}

export default function ModifyReservationForm({ reservation, onUpdated, onCancel }: Props) {
  const [startDate, setStartDate] = useState<Date | undefined>(
    reservation.start_date ? parseISO(reservation.start_date) : undefined
  );
  const [endDate, setEndDate] = useState<Date | undefined>(
    reservation.end_date ? parseISO(reservation.end_date) : undefined
  );
  const [pickupLocationId, setPickupLocationId] = useState(reservation.pickup_location_id || '');
  const [returnLocationId, setReturnLocationId] = useState(reservation.return_location_id || '');
  const [locations, setLocations] = useState<any[]>([]);
  const [quote, setQuote] = useState<any>(null);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load pickup locations
  useEffect(() => {
    supabase
      .from('pickup_locations')
      .select('id, name')
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data }) => {
        if (data) setLocations(data);
      });
  }, []);

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
        p_insurance_tier: reservation.insurance_tier_snapshot || 'basic',
        p_extra_ids: [],
        p_discount_code: null,
      });
      if (error) throw error;
      setQuote(data);
    } catch (err: any) {
      toast({ title: 'Error al calcular precio', description: err.message, variant: 'destructive' });
    }
    setLoadingQuote(false);
  };

  const handleSave = async () => {
    if (!quote) {
      toast({ title: 'Error', description: 'Primero calcula el nuevo precio.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const updatePayload: any = {
        start_date: format(startDate!, 'yyyy-MM-dd'),
        end_date: format(endDate!, 'yyyy-MM-dd'),
        total_amount: quote.total_amount,
      };
      if (pickupLocationId) updatePayload.pickup_location_id = pickupLocationId;
      if (returnLocationId) updatePayload.return_location_id = returnLocationId;
      if (quote.delivery_charge != null) updatePayload.delivery_charge = quote.delivery_charge;

      const { error } = await supabase
        .from('reservations')
        .update(updatePayload)
        .eq('id', reservation.id);

      if (error) throw error;

      toast({ title: 'Reserva modificada', description: 'Los cambios se han guardado correctamente.' });

      // Re-fetch the reservation
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

  const newDays = startDate && endDate
    ? Math.max(1, differenceInDays(endDate, startDate))
    : 0;

  return (
    <div className="bg-card rounded-2xl shadow-sm p-6 md:p-8 space-y-6">
      <div className="flex items-center gap-2">
        <Edit className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-bold">Modificar reserva</h2>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground uppercase tracking-wider">Fecha de recogida</label>
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
                onSelect={setStartDate}
                disabled={(date) => date < new Date()}
                locale={es}
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        </div>
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground uppercase tracking-wider">Fecha de devolución</label>
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
                onSelect={setEndDate}
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

      {/* Locations */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground uppercase tracking-wider">Lugar de recogida</label>
          <Select value={pickupLocationId} onValueChange={setPickupLocationId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Seleccionar lugar" />
            </SelectTrigger>
            <SelectContent>
              {locations.map((loc) => (
                <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground uppercase tracking-wider">Lugar de devolución</label>
          <Select value={returnLocationId} onValueChange={setReturnLocationId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Seleccionar lugar" />
            </SelectTrigger>
            <SelectContent>
              {locations.map((loc) => (
                <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Calculate quote button */}
      <Button onClick={handleGetQuote} disabled={loadingQuote} variant="outline" className="w-full">
        {loadingQuote ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        Calcular nuevo precio
      </Button>

      {/* Quote preview */}
      {quote && (
        <div className="bg-accent rounded-lg p-4 space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Nuevo precio calculado</p>
          {quote.subtotal_car != null && (
            <div className="flex justify-between text-sm">
              <span>Alquiler</span>
              <span>{Number(quote.subtotal_car).toFixed(2)} €</span>
            </div>
          )}
          {quote.tax_amount != null && Number(quote.tax_amount) > 0 && (
            <div className="flex justify-between text-sm">
              <span>IGIC</span>
              <span>{Number(quote.tax_amount).toFixed(2)} €</span>
            </div>
          )}
          {quote.delivery_charge != null && Number(quote.delivery_charge) > 0 && (
            <div className="flex justify-between text-sm">
              <span>Cargo de entrega</span>
              <span>{Number(quote.delivery_charge).toFixed(2)} €</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-lg pt-2 border-t border-border">
            <span>Total</span>
            <span className="text-primary">{Number(quote.total_amount).toFixed(2)} €</span>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3">
        <Button variant="outline" onClick={onCancel} className="flex-1">Cancelar</Button>
        <Button onClick={handleSave} disabled={saving || !quote} className="flex-1 bg-cta text-cta-foreground hover:opacity-90">
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          GUARDAR CAMBIOS
        </Button>
      </div>
    </div>
  );
}
