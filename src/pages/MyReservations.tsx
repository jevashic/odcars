import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/integrations/supabase/client';
import PublicLayout from '@/components/layout/PublicLayout';
import { useLang } from '@/contexts/LanguageContext';

export default function MyReservations() {
  const { t } = useLang();
  const [params] = useSearchParams();
  const [code, setCode] = useState('');
  const [email, setEmail] = useState('');
  const [reservation, setReservation] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);

  // Pre-fill from URL params (after successful booking)
  useEffect(() => {
    const ref = params.get('ref');
    const em = params.get('email');
    if (ref) setCode(ref);
    if (em) setEmail(em);
  }, [params]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (attempts >= 3) { setError(t('reservations.too_many')); return; }
    setLoading(true);
    setError('');
    try {
      const { data, error: qErr } = await supabase
        .from('reservations')
        .select(`*, customers(first_name, last_name, email), vehicle_categories(name, image_url)`)
        .eq('reservation_number', code)
        .single();

      if (qErr || !data) {
        setAttempts(a => a + 1);
        setError(t('reservations.not_found'));
      } else {
        setReservation(data);
      }
    } catch {
      setAttempts(a => a + 1);
      setError(t('reservations.not_found'));
    }
    setLoading(false);
  };

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    confirmed: 'bg-emerald-100 text-emerald-800',
    active: 'bg-secondary/20 text-secondary',
    completed: 'bg-primary/10 text-primary',
    cancelled: 'bg-red-100 text-red-800',
  };

  return (
    <PublicLayout>
      <div className="pt-20 section-padding min-h-screen bg-accent">
        <div className="container max-w-md">
          <h1 className="section-title">{t('nav.my_reservations')}</h1>
          <div className="section-line mb-8" />

          {!reservation ? (
            <form onSubmit={handleSearch} className="bg-card rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.08)] p-8 space-y-4">
              <input value={code} onChange={e => setCode(e.target.value)} placeholder={t('reservations.search_placeholder')} required className="w-full px-4 py-3 rounded-lg border border-border focus:border-primary outline-none" />
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder={t('reservations.email_placeholder')} required className="w-full px-4 py-3 rounded-lg border border-border focus:border-primary outline-none" />
              {error && <p className="text-destructive text-sm flex items-center gap-1"><AlertCircle className="h-4 w-4" />{error}</p>}
              <button type="submit" disabled={loading} className="w-full bg-cta text-cta-foreground font-bold py-3 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2">
                <Search className="h-4 w-4" /> {t('reservations.search_button')}
              </button>
            </form>
          ) : (
            <div className="bg-card rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.08)] p-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-primary">{reservation.reservation_code}</h2>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${statusColors[reservation.status] ?? 'bg-muted text-muted-foreground'}`}>
                  {reservation.status}
                </span>
              </div>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p><strong>{t('reservations.pickup')}</strong> {reservation.pickup_date} {reservation.pickup_time}</p>
                <p><strong>{t('reservations.return')}</strong> {reservation.return_date} {reservation.return_time}</p>
                <p><strong>{t('reservations.vehicle')}</strong> {reservation.category_name}</p>
                <p className="text-2xl font-bold text-primary mt-4">{t('reservations.total')} €{reservation.total_amount}</p>
              </div>
              <button onClick={() => setReservation(null)} className="mt-6 w-full border-2 border-primary text-primary font-bold py-2.5 rounded-lg hover:bg-primary hover:text-primary-foreground transition-colors">
                {t('reservations.search_another')}
              </button>
            </div>
          )}
        </div>
      </div>
    </PublicLayout>
  );
}
