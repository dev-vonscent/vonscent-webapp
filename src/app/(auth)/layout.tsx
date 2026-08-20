import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/shared/logo";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center px-4 py-12">
      <Link
        href="/"
        className="text-muted-foreground hover:text-foreground absolute top-4 left-4 flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm transition-colors sm:top-6 sm:left-6"
      >
        <ArrowLeft className="size-4" /> Дэлгүүр рүү буцах
      </Link>
      <Link href="/" className="mb-8">
        <Logo className="text-2xl" />
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
