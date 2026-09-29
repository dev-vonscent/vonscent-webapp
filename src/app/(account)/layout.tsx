import { Suspense } from "react";
import { SiteHeader } from "@/components/shared/site-header";
import {
  HeaderSocialLinks,
  MenuSocialLinks,
} from "@/components/shared/social-links";
import { BottomNav } from "@/components/shared/bottom-nav";
import { SkipLink } from "@/components/shared/skip-link";

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <SkipLink />
      <SiteHeader
        social={
          <Suspense fallback={null}>
            <HeaderSocialLinks />
          </Suspense>
        }
        menuSocial={
          <Suspense fallback={null}>
            <MenuSocialLinks />
          </Suspense>
        }
      />
      <main id="main" className="flex-1 pb-24 md:pb-0">
        <div className="mx-auto max-w-3xl px-4 py-10 md:px-8">{children}</div>
      </main>
      <BottomNav />
    </>
  );
}
