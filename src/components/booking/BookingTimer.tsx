import { useEffect, useState, useRef } from 'react';
import { Clock } from 'lucide-react';
import { useLangNavigate } from '@/hooks/useLangNavigate';

const TOTAL_SECONDS = 10 * 60;
const STORAGE_KEY = 'booking_timer_end';

export default function BookingTimer() {
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

  useEffect(() => {
    if (expired) return;
    intervalRef.current = setInterval(() => {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (!stored) { setExpired(true); return; }
      const diff = Math.floor((parseInt(stored, 10) - Date.now()) / 1000);
      if (diff <= 0) {
        setRemaining(0);
        setExpired(true);
        clearInterval(intervalRef.current);
      } else {
        setRemaining(diff);
      }
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [expired]);

  const mins = String(Math.floor(remaining / 60)).padStart(2, '0');
  const secs = String(remaining % 60).padStart(2, '0');

  const handleBack = () => {
    sessionStorage.removeItem(STORAGE_KEY);
    navigate('/reservar');
  };

  return (
    <>
      {/* Timer banner */}
      <div className="bg-primary text-primary-foreground py-3 px-4">
        <div className="container max-w-6xl flex items-center justify-center gap-3">
          <Clock className="h-5 w-5" />
          <span className="font-semibold text-sm md:text-base">
            Tu reserva está reservada por: <span className="font-mono text-lg">{mins}:{secs}</span>
          </span>
        </div>
      </div>

      {/* Expired modal */}
      {expired && (
        <div className="fixed inset-0 z-[9999] bg-black/70 flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl shadow-2xl max-w-md w-full p-8 text-center">
            <Clock className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-foreground mb-3">Tu tiempo ha expirado</h2>
            <p className="text-muted-foreground mb-6">
              El vehículo ha sido liberado. Vuelve a buscar para comprobar disponibilidad.
            </p>
            <button
              onClick={handleBack}
              className="w-full bg-cta text-cta-foreground font-bold py-3 rounded-lg hover:opacity-90 transition-opacity"
            >
              Volver al buscador
            </button>
          </div>
        </div>
      )}
    </>
  );
}
