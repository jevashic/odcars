import PublicLayout from '@/components/layout/PublicLayout';
import OffersSection from '@/components/home/OffersSection';
import BannerZone from '@/components/home/BannerZone';
import { useLang } from '@/contexts/LanguageContext';

export default function OffersPage() {
  const { t } = useLang();
  return (
    <PublicLayout>
      <div className="pt-20">
        <BannerZone position="offers_top" />
        <OffersSection />
      </div>
    </PublicLayout>
  );
}
