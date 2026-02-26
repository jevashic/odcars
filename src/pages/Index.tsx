import PublicLayout from '@/components/layout/PublicLayout';
import HeroSection from '@/components/home/HeroSection';
import SearchBar from '@/components/home/SearchBar';
import FeaturedVehicles from '@/components/home/FeaturedVehicles';
import Advantages from '@/components/home/Advantages';
import DiscoverGranCanaria from '@/components/home/DiscoverGranCanaria';
import OffersSection from '@/components/home/OffersSection';
import ReviewsSection from '@/components/home/ReviewsSection';
import BannerSection from '@/components/home/BannerSection';
import NewsletterSection from '@/components/home/NewsletterSection';

export default function Index() {
  return (
    <PublicLayout className="!pt-0">
      <HeroSection />
      <SearchBar />
      <FeaturedVehicles />
      <Advantages />
      <DiscoverGranCanaria />
      <OffersSection />
      <ReviewsSection />
      <BannerSection position="home_bottom" />
      <NewsletterSection />
    </PublicLayout>
  );
}
