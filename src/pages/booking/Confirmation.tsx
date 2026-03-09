import { Link, useLocation } from 'react-router-dom';
import { CheckCircle, MapPin, Calendar, Shield, CreditCard, Package } from 'lucide-react';
import { format } from 'date-fns';
import PublicLayout from '@/components/layout/PublicLayout';
import { useLang } from '@/contexts/LanguageContext';
import { useLangPath } from '@/hooks/useLangNavigate';
import { Badge } from '@/components/ui/badge';

export default function Confirmation() {
  const { t } = useLang();
  const lp = useLangPath();
  const location = useLocation();
  const state = location.state as any;

  const reservation = state?.reservation || {};
  const customer = state?.customer || {};
  const refNumber = reservation.reservation_number || 'OD-XXXX-XXXX';

  const formatDate = (d: string) => {
    try { return format(new Date(d), 'dd/MM/yyyy'); } catch { return d; }
  };

  return (
    <PublicLayout>
      <div className="pt-20 section-padding min-h-screen bg-accent">
        <div className="container max-w-2xl py-12">
          {/* Success header */}
          <div className="text-center mb-8">
            <CheckCircle className="h-20 w-20 text-emerald-500 mx-auto mb-6 animate-in zoom-in duration-500" />
            <h1 className="text-3xl font-black text-primary mb-2">{t('booking.confirmed_title')}</h1>
            <p className="text-2xl font-extrabold text-cta mb-2">{refNumber}</p>
            <p className="text-muted-foreground">{t('booking.confirmed_email')}</p>
          </div>

          {/* Reservation details card */}
          <div className="bg-card rounded-2xl shadow-sm p-6 md:p-8 space-y-6">
            {/* Customer */}
            {customer.first_name && (
              <div>
                <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-wider mb-2">{t('booking.billing_title')}</h3>
                <p className="font-semibold text-foreground">{customer.first_name} {customer.last_name}</p>
                <p className="text-sm text-muted-foreground">{customer.email}</p>
                {customer.phone && <p className="text-sm text-muted-foreground">{customer.phone}</p>}
              </div>
            )}

            {/* Vehicle category */}
            {reservation.category_name && (
              <div className="flex items-center gap-3">
                <Package className="h-5 w-5 text-primary shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">{t('reservations.vehicle')}</p>
                  <p className="font-semibold">{reservation.category_name}</p>
                </div>
              </div>
            )}

            {/* Dates */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {reservation.start_date && (
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-primary shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">{t('reservations.pickup')}</p>
                    <p className="font-semibold">{formatDate(reservation.start_date)} {reservation.start_time || ''}</p>
                  </div>
                </div>
              )}
              {reservation.end_date && (
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-primary shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">{t('reservations.return')}</p>
                    <p className="font-semibold">{formatDate(reservation.end_date)} {reservation.end_time || ''}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Locations */}
            {(reservation.pickup_location || reservation.return_location) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {reservation.pickup_location && (
                  <div className="flex items-center gap-3">
                    <MapPin className="h-5 w-5 text-primary shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">{t('booking.pickup_location')}</p>
                      <p className="font-semibold">{reservation.pickup_location}</p>
                    </div>
                  </div>
                )}
                {reservation.return_location && (
                  <div className="flex items-center gap-3">
                    <MapPin className="h-5 w-5 text-primary shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">{t('booking.return_location')}</p>
                      <p className="font-semibold">{reservation.return_location}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Insurance */}
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-emerald-500 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">{t('booking.insurance')}</p>
                <p className="font-semibold">{reservation.insurance_tier === 'premium' ? 'Premium' : reservation.insurance_tier || 'Premium'}</p>
              </div>
            </div>

            {/* Extras */}
            {reservation.extras && reservation.extras.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Extras</p>
                <div className="flex flex-wrap gap-2">
                  {reservation.extras.map((ex: string, i: number) => (
                    <Badge key={i} variant="secondary">{ex}</Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Payment */}
            <div className="flex items-center gap-3">
              <CreditCard className="h-5 w-5 text-primary shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">{t('booking.payment_method')}</p>
                <p className="font-semibold">
                  {reservation.payment_method === 'card_online' ? t('booking.online_payment') : t('booking.office_payment')}
                </p>
              </div>
            </div>

            {/* Total */}
            {reservation.total_amount != null && (
              <div className="border-t border-border pt-4 flex justify-between items-center">
                <span className="font-bold text-lg">{t('booking.total_label')}</span>
                <span className="text-2xl font-extrabold text-primary">{Number(reservation.total_amount).toFixed(2)} €</span>
              </div>
            )}

            {/* Pending payment notice for office payment */}
            {!reservation.pay_signal && (
              <div className="bg-orange-50 border border-orange-300 text-orange-700 rounded-lg px-4 py-3 text-center font-bold text-sm tracking-wide">
                PENDIENTE DE PAGO · Abona el importe al recoger el vehículo
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3 mt-8">
            <Link to={lp('/mis-reservas')} className="text-center border-2 border-primary text-primary font-bold py-3 rounded-lg hover:bg-primary hover:text-primary-foreground transition-colors">
              {t('booking.view_reservation')}
            </Link>
            <Link to={lp('/')} className="text-center bg-cta text-cta-foreground font-bold py-3 rounded-lg hover:opacity-90 transition-opacity">
              {t('back_home')}
            </Link>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
