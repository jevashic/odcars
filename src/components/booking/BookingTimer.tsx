import { useEffect, useState, useRef, useCallback } from 'react';
import { Clock } from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import { useLangNavigate } from '@/hooks/useLangNavigate';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/integrations/supabase/client';

const TOTAL_SECONDS = 10 * 60;
const STORAGE_KEY = 'booking_timer_end';
const HOLD_KEY = 'booking_hold_id';

function releaseHold(holdId: string | null) {
  if (!holdId) return;
  try {
    const body = JSON.stringify({ hold_id: holdId });
    // Try sendBeacon first (works during unload), fall back to fetch
    const sent = navigator.sendBeacon?.(
      `${SUPABASE_URL}/functions/v1/release_hold`,
      new Blob([body], { type: 'application/json' })
    );
    if (!sent) {
      fetch(`${SUPABASE_URL}/functions/v1/release_hold`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
        body,
        keepalive: true,
      });
    }
  } catch {
    // best-effort
  }
}

function cleanupSession() {
  const holdId = sessionStorage.getItem(HOLD_KEY);
  releaseHold(holdId);
  sessionStorage.removeItem(HOLD_KEY);
  sessionStorage.removeItem(STORAGE_KEY);
}

export default function BookingTimer() {
  const { t } = useLang();
  const navigate = useLangNavigate();
  const completedRef = useRef(false);
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

  // Handle timer expiry → release hold + redirect after 3s
  const handleExpiry = useCallback(() => {
    setRemaining(0);
    setExpired(true);
    cleanupSession();
    setTimeout(() => {
      navigate('/flota');
    }, 3000);
  }, [navigate]);

  // Main countdown
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

  // Release hold on beforeunload (page close/refresh)
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (!completedRef.current) {
        const holdId = sessionStorage.getItem(HOLD_KEY);
        releaseHold(holdId);
        sessionStorage.removeItem(HOLD_KEY);
        sessionStorage.removeItem(STORAGE_KEY);
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // Component unmount — release if not completed
      if (!completedRef.current) {
        cleanupSession();
      }
    };
  }, []);

  const mins = String(Math.floor(remaining / 60)).padStart(2, '0');
  const secs = String(remaining % 60).padStart(2, '0');

  const handleBack = () => {
    cleanupSession();
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
              El tiempo se ha agotado. Por favor inicia el proceso de reserva de nuevo.
            </p>
            <p className="text-sm text-muted-foreground mb-4">Redirigiendo en 3 segundos...</p>
            <button onClick={handleBack} className="w-full bg-cta text-cta-foreground font-bold py-3 rounded-lg hover:opacity-90 transition-opacity">
              {t('booking.timer_back')}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/** Call this from Summary/Payment when reservation is successfully created to prevent cleanup */
export function markBookingCompleted() {
  sessionStorage.removeItem(STORAGE_KEY);
  sessionStorage.removeItem(HOLD_KEY);
}

/** Store a hold ID so the timer can release it on abandon */
export function setBookingHoldId(holdId: string) {
  sessionStorage.setItem(HOLD_KEY, holdId);
}
