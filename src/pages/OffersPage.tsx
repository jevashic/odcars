import PublicLayout from '@/components/layout/PublicLayout';
import OffersSection from '@/components/home/OffersSection';
import { useLang } from '@/contexts/LanguageContext';

export default function OffersPage() {
  const { t } = useLang();
  return (
    <PublicLayout>
      <div className="pt-20">
        <OffersSection />
      </div>
    </PublicLayout>
  );
}
