import type { Metadata } from "next";
import { Suspense } from "react";
import { PhoneAuthForm } from "@/features/auth/components/phone-auth-form";

export const metadata: Metadata = { title: "Passcode сэргээх" };

export default function ForgotPasswordPage() {
  return (
    <Suspense>
      <PhoneAuthForm mode="forgot" />
    </Suspense>
  );
}
