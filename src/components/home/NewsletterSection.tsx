import { useState } from 'react';
import { Mail } from 'lucide-react';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/integrations/supabase/client';
import { useLang } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';

export default function NewsletterSection() {
  const { t, lang } = useLang();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [privacy, setPrivacy] = useState(false);
  const [newsletter, setNewsletter] = useState(false);
  const [offers, setOffers] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !privacy) return;
    setLoading(true);
    try {
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/newsletter_subscribe`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            email,
            lang: lang ?? 'es',
            accepts_promotions: false,
          }),
        }
      );
      const data = await response.json();
      if (data.success) {
        toast({ title: '¡Gracias! Te has suscrito correctamente.' });
        setEmail('');
        setPrivacy(false);
        setNewsletter(false);
        setOffers(false);
      } else {
        toast({ title: 'Ha ocurrido un error. Inténtalo de nuevo.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Ha ocurrido un error. Inténtalo de nuevo.', variant: 'destructive' });
    }
    setLoading(false);
  };

  return (
    <section className="section-padding bg-card">
      <div className="container max-w-xl text-center">
        <div className="w-14 h-14 rounded-full bg-cta flex items-center justify-center mx-auto mb-4">
          <Mail className="h-6 w-6 text-cta-foreground" />
        </div>
        <h2 className="section-title">{t('newsletter.title')}</h2>
        <p className="section-subtitle mt-2 mb-8">{t('newsletter.subtitle')}</p>

        <form onSubmit={handleSubmit} className="bg-accent rounded-2xl p-8 text-left space-y-4">
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder={t('newsletter.email')}
            required
            className="w-full px-4 py-3 rounded-lg border border-border bg-card text-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none"
          />
          <label className="flex items-start gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={privacy} onChange={e => setPrivacy(e.target.checked)} className="mt-0.5 accent-cta" required />
            <span>{t('newsletter.privacy')} <a href="/legal/privacidad" className="text-cta underline">*</a></span>
          </label>
          <label className="flex items-start gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={newsletter} onChange={e => setNewsletter(e.target.checked)} className="mt-0.5 accent-cta" />
            <span>{t('newsletter.newsletter')}</span>
          </label>
          <label className="flex items-start gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={offers} onChange={e => setOffers(e.target.checked)} className="mt-0.5 accent-cta" />
            <span>{t('newsletter.offers')}</span>
          </label>
          <button
            type="submit"
            disabled={loading || !privacy}
            className="w-full bg-cta text-cta-foreground font-bold py-3.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {t('newsletter.button')}
          </button>
        </form>
      </div>
    </section>
  );
}
