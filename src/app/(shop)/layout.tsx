import { Suspense } from "react";
import { SiteHeader } from "@/components/shared/site-header";
import { ContactFab, MenuSocialLinks } from "@/components/shared/social-links";
import { BottomNav } from "@/components/shared/bottom-nav";
import { WishlistSync } from "@/features/wishlist/sync";
import { ScrollReset } from "@/components/shared/scroll-reset";
import { SkipLink } from "@/components/shared/skip-link";

/**
 * The footer arrives through a parallel route slot rather than being rendered
 * here, because it belongs to the home page alone.
 *
 * A slot rather than a `usePathname()` check: `@footer/page.tsx` matches only
 * `/`, and every other route falls to `@footer/default.tsx`, which renders
 * nothing. So the footer is not merely hidden off the home page — it is never
 * rendered. (The contact button does read `getSocialSettings()` on every
 * route, but through the request-cached settings fetch most pages already
 * make, streamed in a `Suspense` slot so it never holds the page back.)
 *
 * It also stays a *sibling* of `<main>`. Moving it into the page would have
 * nested it inside `<main>`, where `<footer>` loses its `contentinfo` landmark
 * and screen-reader users lose the jump target.
 */
export default function ShopLayout({
  children,
  footer,
}: {
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <>
      <ScrollReset />
      {/* Хамгийн эхний фокус авах элемент байх ёстой тул толгойн ӨМНӨ. */}
      <SkipLink />
      <SiteHeader
        menuSocial={
          <Suspense fallback={null}>
            <MenuSocialLinks />
          </Suspense>
        }
      />
      {/* Утсан дээрх `pb-24` нь доод навигацад контент дарагдахгүй байх зай.
          Footer-той (нүүр) хуудсанд тэр зай footer-ийн доор очно — эс бөгөөс
          сүүлийн хэсэг ба footer-ийн хооронд 96px хоосон зай үүсдэг. Footer нь
          animation-ы wrapper дотор ирдэг тул `~*_footer` (шууд sibling биш). */}
      <main
        id="main"
        className="flex-1 pb-24 has-[~footer,~*_footer]:pb-0 md:pb-0"
      >
        {children}
      </main>
      {footer}
      <BottomNav />
      <Suspense fallback={null}>
        <ContactFab />
      </Suspense>
      <WishlistSync />
    </>
  );
}
