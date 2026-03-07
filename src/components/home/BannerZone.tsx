import { useBanners } from '@/contexts/BannerContext';

export default function BannerZone({ position }: { position: string }) {
  const { banners } = useBanners();
  const zoneBanners = banners.filter((b) => b.position === position);

  if (zoneBanners.length === 0) return null;

  return (
    <section className="px-4 md:px-10 py-4 space-y-4">
      {zoneBanners.map((banner) => {
        const Wrapper = banner.link_url ? 'a' : 'div';
        const linkProps = banner.link_url
          ? { href: banner.link_url, target: banner.link_target ?? '_self', rel: 'noopener noreferrer' }
          : {};
        return (
          <Wrapper key={banner.id} {...linkProps} className="block">
            <img
              src={banner.image_url}
              alt={banner.name || 'Banner'}
              className="w-full max-h-[200px] object-cover rounded-xl"
              loading="lazy"
            />
          </Wrapper>
        );
      })}
    </section>
  );
}
