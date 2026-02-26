import { Link } from 'react-router-dom';
import { useLang } from '@/contexts/LanguageContext';
import { useLangPath } from '@/hooks/useLangNavigate';
import { useConfig } from '@/contexts/ConfigContext';
import { Phone, Mail, MapPin, Facebook, Instagram, Twitter } from 'lucide-react';
import logoSquare from '@/assets/logo-square.png';

export default function Footer() {
  const { t } = useLang();
  const lp = useLangPath();
  const { company_name, company_phone, company_email } = useConfig();

  return (
    <footer className="bg-primary text-primary-foreground">
      <div className="container section-padding pb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Col 1 – Brand */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <img src={logoSquare} alt={company_name} className="h-[80px] w-auto rounded-lg" />
              <span className="font-bold text-lg">{company_name}</span>
            </div>
            <p className="text-sm text-white/70 leading-relaxed">{t('footer.description')}</p>
            <div className="flex gap-3 mt-5">
              {[Facebook, Instagram, Twitter].map((Icon, i) => (
                <a key={i} href="#" className="w-10 h-10 rounded-full border border-white/30 flex items-center justify-center hover:border-cta hover:text-cta transition-colors">
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Col 2 – Navigation */}
          <div>
            <h4 className="font-bold mb-4 text-sm uppercase tracking-wider">{t('footer.navigation')}</h4>
            <ul className="space-y-3 text-sm">
              {[
                { label: t('nav.fleet'), to: '/flota' },
                { label: t('nav.offers'), to: '/ofertas' },
                { label: t('nav.discover'), to: '/conoce-gran-canaria' },
                { label: t('nav.contact'), to: '/contacto' },
              ].map((l) => (
                <li key={l.to}><Link to={lp(l.to)} className="text-white/70 hover:text-cta transition-colors">{l.label}</Link></li>
              ))}
            </ul>
          </div>

          {/* Col 3 – Legal */}
          <div>
            <h4 className="font-bold mb-4 text-sm uppercase tracking-wider">{t('footer.legal')}</h4>
            <ul className="space-y-3 text-sm">
              {[
                { label: t('footer.privacy'), to: '/legal/privacidad' },
                { label: t('footer.cookies'), to: '/legal/cookies' },
                { label: t('footer.terms'), to: '/legal/terminos' },
              ].map((l) => (
                <li key={l.to}><Link to={lp(l.to)} className="text-white/70 hover:text-cta transition-colors">{l.label}</Link></li>
              ))}
            </ul>
          </div>

          {/* Col 4 – Contact */}
          <div>
            <h4 className="font-bold mb-4 text-sm uppercase tracking-wider">{t('footer.contact')}</h4>
            <ul className="space-y-3 text-sm">
              <li className="flex items-center gap-2 text-white/70"><Phone className="h-4 w-4 text-cta" />{company_phone}</li>
              <li className="flex items-center gap-2 text-white/70"><Mail className="h-4 w-4 text-cta" />{company_email}</li>
              <li className="flex items-start gap-2 text-white/70"><MapPin className="h-4 w-4 text-cta mt-0.5" />Gran Canaria, España</li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 mt-10 pt-6 text-center text-xs text-white/50">
          {t('footer.copyright')}
        </div>
      </div>
    </footer>
  );
}
