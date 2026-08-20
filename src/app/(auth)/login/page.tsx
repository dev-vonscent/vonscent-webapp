import type { Metadata } from "next";
import { Suspense } from "react";
import { PhoneAuthForm } from "@/features/auth/components/phone-auth-form";

export const metadata: Metadata = { title: "Нэвтрэх" };

export default function LoginPage() {
  return (
    <Suspense>
      <PhoneAuthForm mode="login" />
    </Suspense>
  );
}
