import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, Globe } from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import logoHorizontal from '@/assets/logo-horizontal.png';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

const NAV_LINKS = [
  { key: 'nav.fleet', to: '/flota' },
  { key: 'nav.offers', to: '/ofertas' },
  { key: 'nav.discover', to: '/conoce-gran-canaria' },
  { key: 'nav.contact', to: '/contacto' },
];

export default function Navbar() {
  const { t, lang, setLang } = useLang();
  const location = useLocation();
  const isHome = location.pathname === '/';
  const [scrolled, setScrolled] = useState(false);
  const [langOpen, setLangOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const isTransparent = isHome && !scrolled;
  const textColor = isTransparent ? 'text-white' : 'text-foreground';
  const bgClass = isTransparent
    ? 'bg-transparent'
    : 'bg-white shadow-[0_2px_20px_rgba(0,0,0,0.06)]';

  const langs: Array<{ code: 'es' | 'en' | 'de'; label: string }> = [
    { code: 'es', label: 'ES' },
    { code: 'en', label: 'EN' },
    { code: 'de', label: 'DE' },
  ];

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 h-16 transition-all duration-300 ${bgClass}`}
    >
      <nav className="container h-full flex items-center justify-between gap-4">
        {/* Logo */}
        <Link to="/" className="shrink-0">
          <img src={logoHorizontal} alt="Ocean Drive Rent a Car" className="h-[46px] md:h-[60px]" />
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-6">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={`text-sm font-medium transition-colors hover:text-cta ${textColor}`}
            >
              {t(l.key)}
            </Link>
          ))}
        </div>

        {/* Right side */}
        <div className="hidden md:flex items-center gap-3">
          {/* Language selector */}
          <div className="relative">
            <button
              onClick={() => setLangOpen(!langOpen)}
              className={`flex items-center gap-1 text-sm font-medium transition-colors hover:text-cta ${textColor}`}
            >
              <Globe className="h-4 w-4" />
              {lang.toUpperCase()}
            </button>
            {langOpen && (
              <div className="absolute top-full right-0 mt-1 bg-white rounded-lg shadow-lg border py-1 min-w-[80px]">
                {langs.map((l) => (
                  <button
                    key={l.code}
                    onClick={() => { setLang(l.code); setLangOpen(false); }}
                    className={`block w-full text-left px-4 py-2 text-sm hover:bg-accent ${lang === l.code ? 'font-bold text-cta' : 'text-foreground'}`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <Link
            to="/mis-reservas"
            className="bg-cta text-cta-foreground font-bold text-sm px-5 py-2.5 rounded-lg hover:opacity-90 transition-opacity"
          >
            {t('nav.my_reservations')}
          </Link>
        </div>

        {/* Mobile hamburger */}
        <Sheet>
          <SheetTrigger asChild>
            <button className={`md:hidden ${textColor}`}>
              <Menu className="h-6 w-6" />
            </button>
          </SheetTrigger>
          <SheetContent side="right" className="w-72 p-6">
            <div className="flex flex-col gap-4 mt-8">
              {NAV_LINKS.map((l) => (
                <Link key={l.to} to={l.to} className="text-base font-medium text-foreground hover:text-cta py-2">
                  {t(l.key)}
                </Link>
              ))}
              <Link to="/mis-reservas" className="bg-cta text-cta-foreground font-bold text-sm px-5 py-2.5 rounded-lg text-center mt-2">
                {t('nav.my_reservations')}
              </Link>
              <div className="flex gap-2 mt-4">
                {langs.map((l) => (
                  <button
                    key={l.code}
                    onClick={() => setLang(l.code)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium ${lang === l.code ? 'bg-cta text-cta-foreground' : 'border text-foreground'}`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </nav>
    </header>
  );
}
