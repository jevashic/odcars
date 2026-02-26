import { useConfig } from '@/contexts/ConfigContext';
import { useLang } from '@/contexts/LanguageContext';
import { ShieldCheck, Check } from 'lucide-react';

export default function InsuranceBadges({ className = '' }: { className?: string }) {
  const { insurance_model } = useConfig();
  const { t } = useLang();

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {insurance_model === 'premium_included' ? (
        <>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-700 px-3 py-1 text-xs font-bold">
            <ShieldCheck className="h-3.5 w-3.5" /> {t('vehicles.insurance_premium')}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-700 px-3 py-1 text-xs font-bold">
            <Check className="h-3.5 w-3.5" /> {t('vehicles.no_deposit')}
          </span>
        </>
      ) : (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-700 px-3 py-1 text-xs font-bold">
          <ShieldCheck className="h-3.5 w-3.5" /> {t('vehicles.insurance_basic')}
        </span>
      )}
    </div>
  );
}
