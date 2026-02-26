import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLang } from '@/contexts/LanguageContext';

interface HeroData {
  title_line1: string;
  title_line2: string;
  subtitle: string;
  cta_text: string;
  media_url: string;
  media_type: string;
  overlay_opacity: number;
}

export default function HeroSection() {
  const { t, lang } = useLang();
  const [hero, setHero] = useState<HeroData | null>(null);

  useEffect(() => {
    supabase
      .from('hero_config')
      .select('*')
      .eq('lang', lang)
      .single()
      .then(({ data }) => {
        if (data) setHero(data as any);
      });
  }, [lang]);

  const h = hero ?? {
    title_line1: t('hero.title1'),
    title_line2: t('hero.title2'),
    subtitle: t('hero.subtitle'),
    cta_text: t('hero.cta'),
    media_url: 'https://images.unsplash.com/photo-1500375592092-40eb2168fd21?w=1920&q=80',
    media_type: 'image',
    overlay_opacity: 0.45,
  };

  const scrollToSearch = () => {
    document.getElementById('search-bar')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="relative h-screen w-full overflow-hidden">
      {h.media_type === 'video' ? (
        <video
          autoPlay muted loop playsInline
          className="absolute inset-0 w-full h-full object-cover"
          src={h.media_url}
        />
      ) : (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${h.media_url})` }}
        />
      )}

      <div className="absolute inset-0" style={{ backgroundColor: `rgba(0,0,0,${h.overlay_opacity})` }} />

      <div className="relative z-10 h-full flex items-center">
        <div className="container px-6 md:px-20">
          <h1 className="text-[40px] md:text-[72px] font-black text-white leading-[1.1] max-w-3xl">
            {h.title_line1}
            <br />
            {h.title_line2}
          </h1>
          <p className="mt-4 text-lg md:text-xl text-white/80 max-w-xl">{h.subtitle}</p>
          <button
            onClick={scrollToSearch}
            className="mt-8 bg-cta text-cta-foreground font-bold text-lg px-8 py-4 rounded-[10px] hover:opacity-90 transition-opacity"
          >
            {h.cta_text}
          </button>
        </div>
      </div>

      <button
        onClick={scrollToSearch}
        className="absolute bottom-10 left-1/2 -translate-x-1/2 z-10 text-white animate-bounce-down"
      >
        <ChevronDown className="h-8 w-8" />
      </button>
    </section>
  );
}
