import PublicLayout from '@/components/layout/PublicLayout';
import OffersSection from '@/components/home/OffersSection';
import BannerZone from '@/components/home/BannerZone';

export default function OffersPage() {
  return (
    <PublicLayout>
      <div className="pt-20">
        <BannerZone position="offers_top" />
        <OffersSection />
      </div>
    </PublicLayout>
  );
}
