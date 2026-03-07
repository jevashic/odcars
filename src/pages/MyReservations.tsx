import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, AlertCircle, Calendar, MapPin, Shield, CreditCard, X, FileText, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format, differenceInDays, parseISO, addHours } from 'date-fns';
import PublicLayout from '@/components/layout/PublicLayout';
import { useLang } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import { toast } from '@/hooks/use-toast';

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pendiente de confirmación', color: 'bg-yellow-100 text-yellow-800' },
  confirmed: { label: 'Confirmada', color: 'bg-emerald-100 text-emerald-800' },
  active: { label: 'En curso', color: 'bg-blue-100 text-blue-800' },
  completed: { label: 'Completada', color: 'bg-purple-100 text-purple-800' },
  cancelled: { label: 'Cancelada', color: 'bg-red-100 text-red-800' },
};

export default function MyReservations() {
  const { t } = useLang();
  const [params] = useSearchParams();
  const [code, setCode] = useState('');
  const [email, setEmail] = useState('');
  const [reservation, setReservation] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    const ref = params.get('ref');
    const em = params.get('email');
    if (ref) setCode(ref);
    if (em) setEmail(em);
  }, [params]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (attempts >= 5) { setError(t('reservations.too_many')); return; }
    setLoading(true);
    setError('');

    try {
      const { data, error: qErr } = await supabase
        .from('reservations')
        .select(`id, reservation_number, status, start_date, end_date, total_amount, delivery_charge, delivery_details, sale_channel, created_at, base_amount, extras_amount, discount_amount, insurance_tier, payment_method, pickup_time, return_time, notes, customers(first_name, last_name, email, phone), vehicle_categories(name, image_url), vehicles(plate, brand, model), reservation_extras(extra_name, quantity, unit_price, subtotal), pickup_locations:branches!reservations_pickup_branch_id_fkey(name), return_locations:branches!reservations_return_branch_id_fkey(name)`)
        .ilike('reservation_number', code.trim())
        .maybeSingle();

      if (qErr || !data) {
        setAttempts(a => a + 1);
        setError(t('reservations.not_found'));
        setLoading(false);
        return;
      }

      // Verify email client-side
      const emailCliente = (data.customers as any)?.email?.toLowerCase();
      const emailBuscado = email.trim().toLowerCase();
      if (emailCliente !== emailBuscado) {
        setAttempts(a => a + 1);
        setError(t('reservations.not_found'));
        setLoading(false);
        return;
      }

      setReservation(data);
    } catch {
      setAttempts(a => a + 1);
      setError(t('reservations.not_found'));
    }
    setLoading(false);
  };

  const handleCancel = async () => {
    if (!reservation) return;
    setCancelling(true);
    try {
      const { error } = await supabase
        .from('reservations')
        .update({ status: 'cancelled' })
        .eq('id', reservation.id);
      if (error) throw error;
      setReservation({ ...reservation, status: 'cancelled' });
      toast({ title: 'Reserva cancelada', description: 'Tu reserva ha sido cancelada correctamente.' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setCancelling(false);
  };

  const handleDownloadInvoice = async () => {
    try {
      toast({ title: 'Generando factura...', description: 'Espera un momento.' });
      // Use fetch to avoid CORS with x-client-info
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL || 'https://sqmganbjiisitgumsztv.supabase.co'}/functions/v1/issue_invoice`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxbWdhbmJqaWlzaXRndW1zenR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2NjkwOTEsImV4cCI6MjA4NzI0NTA5MX0.NIVT-p-_wa0PKaufK8vPYsgyegDFAiHAuUw60uWQYrQ'}` },
          body: JSON.stringify({ reservation_id: reservation.id }),
        }
      );
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast({ title: 'Factura enviada', description: 'Revisa tu email.' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const canCancel = reservation &&
    ['pending', 'confirmed'].includes(reservation.status) &&
    reservation.start_date &&
    new Date(reservation.start_date) > addHours(new Date(), 48);

  const _canModify = reservation && ['pending', 'confirmed'].includes(reservation.status);

  const days = reservation?.start_date && reservation?.end_date
    ? Math.max(1, differenceInDays(parseISO(reservation.end_date), parseISO(reservation.start_date)))
    : 0;

  const fmtDate = (d: string) => { try { return format(parseISO(d), 'dd/MM/yyyy'); } catch { return d; } };

  const statusInfo = STATUS_MAP[reservation?.status] || { label: reservation?.status, color: 'bg-muted text-muted-foreground' };

  return (
    <PublicLayout>
      <div className="pt-20 section-padding min-h-screen bg-accent">
        <div className="container max-w-2xl">
          <h1 className="section-title">{t('nav.my_reservations')}</h1>
          <div className="section-line mb-8" />

          {!reservation ? (
            <form onSubmit={handleSearch} className="bg-card rounded-2xl shadow-sm p-8 space-y-4">
              <input value={code} onChange={e => setCode(e.target.value)} placeholder={t('reservations.search_placeholder')} required className="w-full px-4 py-3 rounded-lg border border-border focus:border-primary outline-none bg-background" />
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder={t('reservations.email_placeholder')} required className="w-full px-4 py-3 rounded-lg border border-border focus:border-primary outline-none bg-background" />
              {error && <p className="text-destructive text-sm flex items-center gap-1"><AlertCircle className="h-4 w-4" />{error}</p>}
              <button type="submit" disabled={loading} className="w-full bg-cta text-cta-foreground font-bold py-3 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                {t('reservations.search_button')}
              </button>
              {debugInfo && (
                <div className="bg-muted rounded-lg p-4 text-xs font-mono space-y-1 overflow-auto max-h-64 border border-border">
                  <p className="font-bold text-foreground">🔍 Debug info:</p>
                  <p><strong>Nº limpio:</strong> {debugInfo.numeroLimpio}</p>
                  <p><strong>Email limpio:</strong> {debugInfo.emailLimpio}</p>
                  <p><strong>Cliente:</strong> {debugInfo.customer ? `✅ id=${debugInfo.customer.id}, email=${debugInfo.customer.email}` : '❌ No encontrado'}</p>
                  {debugInfo.customerError && <p className="text-destructive"><strong>Error cliente:</strong> {debugInfo.customerError}</p>}
                  <p><strong>Reserva (sin filtro customer):</strong> {debugInfo.reservaDebug ? `✅ id=${debugInfo.reservaDebug.id}, num=${debugInfo.reservaDebug.reservation_number}, customer_id=${debugInfo.reservaDebug.customer_id}, status=${debugInfo.reservaDebug.status}` : '❌ No encontrada'}</p>
                  {debugInfo.reservaDebugError && <p className="text-destructive"><strong>Error reserva:</strong> {debugInfo.reservaDebugError}</p>}
                </div>
              )}
            </form>
          ) : (
            <div className="space-y-6">
              {/* SECTION 1: Details */}
              <div className="bg-card rounded-2xl shadow-sm p-6 md:p-8 space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Nº Reserva</p>
                    <p className="text-xl font-bold text-primary">{reservation.reservation_number}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${statusInfo.color}`}>
                    {statusInfo.label}
                  </span>
                </div>

                {/* Category + image */}
                <div className="flex items-center gap-4">
                  {reservation.vehicle_categories?.image_url && (
                    <img src={reservation.vehicle_categories.image_url} alt="" className="h-20 w-auto object-contain rounded-lg" />
                  )}
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">{t('reservations.vehicle')}</p>
                    <p className="font-bold text-lg">{reservation.vehicle_categories?.name || '—'}</p>
                  </div>
                </div>

                {/* Dates */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-primary shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">{t('reservations.pickup')}</p>
                      <p className="font-semibold">{reservation.start_date ? fmtDate(reservation.start_date) : '—'} {reservation.pickup_time || ''}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-primary shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">{t('reservations.return')}</p>
                      <p className="font-semibold">{reservation.end_date ? fmtDate(reservation.end_date) : '—'} {reservation.return_time || ''}</p>
                    </div>
                  </div>
                </div>

                {/* Locations */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex items-center gap-3">
                    <MapPin className="h-5 w-5 text-primary shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">{t('booking.pickup_location')}</p>
                      <p className="font-semibold">{reservation.pickup_locations?.name || '—'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <MapPin className="h-5 w-5 text-primary shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">{t('booking.return_location')}</p>
                      <p className="font-semibold">{reservation.return_locations?.name || '—'}</p>
                    </div>
                  </div>
                </div>

                {/* Days */}
                {days > 0 && (
                  <p className="text-sm text-muted-foreground">{days} {days > 1 ? t('booking.days') : t('booking.day')}</p>
                )}

                {/* Insurance */}
                <div className="flex items-center gap-3">
                  <Shield className="h-5 w-5 text-emerald-500 shrink-0" />
                  <p className="font-semibold">{reservation.insurance_tier === 'premium' ? 'Seguro Premium incluido' : reservation.insurance_tier || '—'}</p>
                </div>

                {/* Extras */}
                {reservation.reservation_extras && reservation.reservation_extras.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Extras</p>
                    <div className="space-y-1">
                      {reservation.reservation_extras.map((re: any, idx: number) => (
                        <div key={idx} className="flex justify-between text-sm">
                          <span>{re.extra_name || '—'}{re.quantity > 1 ? ` x${re.quantity}` : ''}</span>
                          <span className="font-medium">{re.subtotal != null ? `${Number(re.subtotal).toFixed(2)} €` : ''}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Financial breakdown */}
                <div className="border-t border-border pt-4 space-y-2 text-sm">
                  {reservation.base_amount != null && (
                    <div className="flex justify-between">
                      <span>{t('booking.rental')}</span>
                      <span>{Number(reservation.base_amount).toFixed(2)} €</span>
                    </div>
                  )}
                  {reservation.extras_amount != null && Number(reservation.extras_amount) > 0 && (
                    <div className="flex justify-between">
                      <span>Extras</span>
                      <span>{Number(reservation.extras_amount).toFixed(2)} €</span>
                    </div>
                  )}
                  {reservation.discount_amount != null && Number(reservation.discount_amount) > 0 && (
                    <div className="flex justify-between text-emerald-600">
                      <span>{t('booking.online_discount')}</span>
                      <span>−{Number(reservation.discount_amount).toFixed(2)} €</span>
                    </div>
                  )}
                  {reservation.delivery_charge != null && Number(reservation.delivery_charge) > 0 && (
                    <div className="flex justify-between">
                      <span>{t('booking.delivery_surcharge')}</span>
                      <span>{Number(reservation.delivery_charge).toFixed(2)} €</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-lg pt-2 border-t border-border">
                    <span>{t('booking.total_label')}</span>
                    <span className="text-primary">{reservation.total_amount != null ? `${Number(reservation.total_amount).toFixed(2)} €` : '—'}</span>
                  </div>
                </div>

                {/* Payment method */}
                <div className="flex items-center gap-3">
                  <CreditCard className="h-5 w-5 text-primary shrink-0" />
                  <p className="text-sm">{reservation.payment_method === 'card_online' ? 'Pago online' : 'Pago en oficina'}</p>
                </div>

                {/* Delivery details / notes */}
                {reservation.delivery_details && (
                  <div className="bg-accent rounded-lg p-3 text-sm">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Notas de entrega</p>
                    <p>{typeof reservation.delivery_details === 'string' ? reservation.delivery_details : JSON.stringify(reservation.delivery_details)}</p>
                  </div>
                )}
              </div>

              {/* SECTION 2: Actions */}
              <div className="bg-card rounded-2xl shadow-sm p-6 md:p-8 space-y-4">
                {reservation.status === 'cancelled' && (
                  <div className="bg-red-50 text-red-700 rounded-lg p-4 text-center font-medium">
                    Esta reserva fue cancelada
                  </div>
                )}

                {canCancel && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" className="w-full" disabled={cancelling}>
                        <X className="h-4 w-4 mr-2" /> CANCELAR RESERVA
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                        <AlertDialogDescription>Esta acción no se puede deshacer. Tu reserva será cancelada permanentemente.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Volver</AlertDialogCancel>
                        <AlertDialogAction onClick={handleCancel} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          {cancelling ? 'Cancelando...' : 'Sí, cancelar reserva'}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}

                {reservation.status === 'completed' && (
                  <Button onClick={handleDownloadInvoice} className="w-full">
                    <FileText className="h-4 w-4 mr-2" /> DESCARGAR FACTURA
                  </Button>
                )}

                <button onClick={() => setReservation(null)} className="w-full border-2 border-primary text-primary font-bold py-2.5 rounded-lg hover:bg-primary hover:text-primary-foreground transition-colors">
                  {t('reservations.search_another')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </PublicLayout>
  );
}
