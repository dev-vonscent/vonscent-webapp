import type { Metadata } from "next";
import { Suspense } from "react";
import { PhoneAuthForm } from "@/features/auth/components/phone-auth-form";

export const metadata: Metadata = { title: "Бүртгүүлэх" };

export default function RegisterPage() {
  return (
    <Suspense>
      <PhoneAuthForm mode="register" />
    </Suspense>
  );
}
