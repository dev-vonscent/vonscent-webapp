import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import {
  getActiveBrands,
  getActiveConcentrations,
} from "@/features/taxonomy/api";
import { splitSearchQuery } from "@/features/perfume-requests/lib";
import { PerfumeRequestForm } from "@/features/perfume-requests/components/perfume-request-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Үнэртэн санал болгох",
  description: "Манайд байхгүй үнэртнийг санал болгоорой.",
  robots: { index: false, follow: false },
};

/**
 * `/request` — шинэ үнэртний санал (0137, feature flag `perfume_requests`).
 * Хайлт хоосон гарсан үед `?q=`-тэй ирж, хайсан үгээр форм урьдчилан
 * бөглөгдөнө. Санал өгөхөд нэвтэрсэн байх ёстой (клиент, 2026-10-14);
 * илгээхээс өөр зүйл байхгүй — хариу, мэдэгдэл үгүй (клиент, 2026-10-15).
 */
export default async function PerfumeRequestPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  if (!(await isFeatureEnabled("perfume_requests"))) notFound();

  const raw = (await searchParams).q;
  const q = (Array.isArray(raw) ? raw[0] : raw)?.slice(0, 100) ?? "";

  const supabase = await createClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;

  return (
    <div className="mx-auto max-w-2xl px-4 pt-4 pb-10 md:px-8 md:py-16">
      <h1 className="font-serif text-3xl font-semibold tracking-tight md:text-4xl">
        Хүссэн үнэртэн тань алга уу?
      </h1>
      <p className="text-muted-foreground mt-3">
        Манайд ямар үнэртэн нэмэгдээсэй гэж хүсэж байна вэ?
      </p>

      <div className="mt-8">
        {user ? (
          <SignedInForm q={q} />
        ) : (
          <div className="bg-card space-y-4 rounded-xl p-6 text-center">
            <p className="text-muted-foreground text-sm">
              Санал болгохын тулд нэвтэрнэ үү.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild>
                <Link
                  href={`/login?next=${encodeURIComponent(
                    q ? `/request?q=${encodeURIComponent(q)}` : "/request",
                  )}`}
                >
                  Нэвтрэх
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/register">Бүртгүүлэх</Link>
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

async function SignedInForm({ q }: { q: string }) {
  const [brands, concentrations] = await Promise.all([
    getActiveBrands(),
    getActiveConcentrations(),
  ]);
  const brandNames = brands.map((b) => b.name);
  const prefill = splitSearchQuery(q, brandNames);

  return (
    <PerfumeRequestForm
      defaults={prefill}
      brands={brandNames}
      concentrations={concentrations.map((c) => ({
        code: c.code,
        label: c.label,
      }))}
    />
  );
}
