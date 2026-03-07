import PublicLayout from '@/components/layout/PublicLayout';
import HeroSection from '@/components/home/HeroSection';
import SearchBar from '@/components/home/SearchBar';
import FeaturedVehicles from '@/components/home/FeaturedVehicles';
import Advantages from '@/components/home/Advantages';
import DiscoverGranCanaria from '@/components/home/DiscoverGranCanaria';
import OffersSection from '@/components/home/OffersSection';
import ReviewsSection from '@/components/home/ReviewsSection';
import BannerZone from '@/components/home/BannerZone';
import NewsletterSection from '@/components/home/NewsletterSection';

export default function Index() {
  return (
    <PublicLayout className="!pt-0">
      <HeroSection />
      <SearchBar />
      <BannerZone position="home_top" />
      <FeaturedVehicles />
      <Advantages />
      <BannerZone position="home_middle" />
      <DiscoverGranCanaria />
      <OffersSection />
      <ReviewsSection />
      <BannerZone position="home_bottom" />
      <NewsletterSection />
    </PublicLayout>
  );
}
