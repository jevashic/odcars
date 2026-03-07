import { useBanners } from '@/contexts/BannerContext';

export default function BannerZone({ position }: { position: string }) {
  const { banners } = useBanners();
  const zoneBanners = banners.filter((b) => b.position === position);

  if (zoneBanners.length === 0) return null;

  return (
    <section className="px-4 md:px-10 py-4">
      <div className={`grid gap-4 ${zoneBanners.length >= 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
        {zoneBanners.map((banner) => {
          const Wrapper = banner.link_url ? 'a' : 'div';
          const linkProps = banner.link_url
            ? { href: banner.link_url, target: banner.link_target ?? '_self', rel: 'noopener noreferrer' }
            : {};
          return (
            <Wrapper key={banner.id} {...linkProps} className="block overflow-hidden rounded-xl">
              <img
                src={banner.image_url}
                alt={banner.name || 'Banner'}
                className="w-full object-cover rounded-xl aspect-[16/5]"
                loading="lazy"
              />
            </Wrapper>
          );
        })}
      </div>
    </section>
  );
}
