import { Suspense } from "react";
import { SiteHeader } from "@/components/shared/site-header";
import { ContactFab, MenuSocialLinks } from "@/components/shared/social-links";
import { BottomNav } from "@/components/shared/bottom-nav";
import { WelcomeGiftDialog } from "@/features/campaigns/components/welcome-gift-dialog";
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
        menuSocial={
          <Suspense fallback={null}>
            <MenuSocialLinks />
          </Suspense>
        }
      />
      <main id="main" className="flex-1 pb-24 md:pb-0">
        <div className="mx-auto max-w-3xl px-4 pt-4 pb-10 md:px-8 md:pt-10">
          {children}
        </div>
      </main>
      <BottomNav />
      <WelcomeGiftDialog />
      <Suspense fallback={null}>
        <ContactFab />
      </Suspense>
    </>
  );
}
