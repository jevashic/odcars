import { useEffect, useState, useRef, useCallback } from 'react';
import { Clock } from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import { useLangNavigate } from '@/hooks/useLangNavigate';

const TOTAL_SECONDS = 10 * 60;
const STORAGE_KEY = 'booking_timer_end';

export default function BookingTimer() {
  const { t } = useLang();
  const navigate = useLangNavigate();
  const [remaining, setRemaining] = useState(() => {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      const diff = Math.floor((parseInt(stored, 10) - Date.now()) / 1000);
      return diff > 0 ? diff : 0;
    }
    const end = Date.now() + TOTAL_SECONDS * 1000;
    sessionStorage.setItem(STORAGE_KEY, String(end));
    return TOTAL_SECONDS;
  });
  const [expired, setExpired] = useState(remaining <= 0);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  const handleExpiry = useCallback(() => {
    setRemaining(0);
    setExpired(true);
    sessionStorage.removeItem(STORAGE_KEY);
    setTimeout(() => {
      navigate('/flota');
    }, 3000);
  }, [navigate]);

  useEffect(() => {
    if (expired) return;
    intervalRef.current = setInterval(() => {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (!stored) { handleExpiry(); return; }
      const diff = Math.floor((parseInt(stored, 10) - Date.now()) / 1000);
      if (diff <= 0) {
        clearInterval(intervalRef.current);
        handleExpiry();
      } else {
        setRemaining(diff);
      }
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [expired, handleExpiry]);

  const mins = String(Math.floor(remaining / 60)).padStart(2, '0');
  const secs = String(remaining % 60).padStart(2, '0');

  const handleBack = () => {
    sessionStorage.removeItem(STORAGE_KEY);
    navigate('/flota');
  };

  return (
    <>
      <div className="bg-primary text-primary-foreground py-3 px-4 fixed top-16 left-0 right-0 z-50">
        <div className="container max-w-6xl flex items-center justify-center gap-3">
          <Clock className="h-5 w-5" />
          <span className="font-semibold text-sm md:text-base">
            {t('booking.timer_active')} <span className="font-mono text-lg">{mins}:{secs}</span>
          </span>
        </div>
      </div>

      {expired && (
        <div className="fixed inset-0 z-[9999] bg-black/70 flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl shadow-2xl max-w-md w-full p-8 text-center">
            <Clock className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-foreground mb-3">{t('booking.timer_expired_title')}</h2>
            <p className="text-muted-foreground mb-6">
              {t('booking.timer_expired_message') || 'El tiempo se ha agotado. Por favor inicia el proceso de reserva de nuevo.'}
            </p>
            <p className="text-sm text-muted-foreground mb-4">{t('booking.timer_redirecting') || 'Redirigiendo en 3 segundos...'}</p>
            <button onClick={handleBack} className="w-full bg-cta text-cta-foreground font-bold py-3 rounded-lg hover:opacity-90 transition-opacity">
              {t('booking.timer_back')}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/** Call when reservation is successfully created to stop the timer */
export function markBookingCompleted() {
  sessionStorage.removeItem(STORAGE_KEY);
}
