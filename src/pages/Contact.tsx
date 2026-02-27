import { Phone, Mail, MapPin } from 'lucide-react';
import PublicLayout from '@/components/layout/PublicLayout';
import { useConfig } from '@/contexts/ConfigContext';
import { useLang } from '@/contexts/LanguageContext';

export default function Contact() {
  const { t } = useLang();
  const { company_name, company_phone, company_email } = useConfig();

  return (
    <PublicLayout>
      <div className="pt-20 section-padding min-h-screen bg-accent">
        <div className="container max-w-2xl">
          <h1 className="section-title">{t('nav.contact')}</h1>
          <div className="section-line" />
          <div className="mt-10 bg-card rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.08)] p-8 space-y-6">
            <h2 className="text-xl font-bold text-foreground">{company_name}</h2>
            <div className="space-y-4 text-muted-foreground">
              <p className="flex items-center gap-3"><Phone className="h-5 w-5 text-cta" /><a href={`tel:${company_phone}`} className="hover:text-cta">{company_phone}</a></p>
              <p className="flex items-center gap-3"><Mail className="h-5 w-5 text-cta" /><a href={`mailto:${company_email}`} className="hover:text-cta">{company_email}</a></p>
              <p className="flex items-center gap-3"><MapPin className="h-5 w-5 text-cta" />{t('contact.location')}</p>
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
