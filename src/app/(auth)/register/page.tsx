import type { Metadata } from "next";
import { Suspense } from "react";
import { PhoneAuthForm } from "@/features/auth/components/phone-auth-form";
import { getSocialSettings } from "@/features/content/api";
import { messengerHref } from "@/components/shared/social-links";

export const metadata: Metadata = { title: "Бүртгүүлэх" };

export default async function RegisterPage() {
  const social = await getSocialSettings();
  const helpContact = {
    phone: social.phone || undefined,
    messenger: social.facebook ? messengerHref(social.facebook) : undefined,
  };
  return (
    <Suspense>
      <PhoneAuthForm mode="register" helpContact={helpContact} />
    </Suspense>
  );
}
