import type { Metadata } from "next";
import Link from "next/link";
import { getMyCollections } from "@/features/collections/api";
import { MyCollections } from "@/features/collections/components/my-collections";
import { createClient } from "@/lib/supabase/server";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Миний багцууд" };

export default async function MyCollectionsPage() {
  const supabase = await createClient();
  const { data: { user } = { user: null } } =
    (await supabase?.auth.getUser()) ?? { data: { user: null } };

  if (!user) {
    return (
      <div className="space-y-4 text-center">
        <h1 className="font-serif text-2xl font-semibold">Миний багцууд</h1>
        <p className="text-muted-foreground">
          Хадгалсан багцаа харахын тулд нэвтэрнэ үү.
        </p>
        <Button asChild>
          <Link href="/login">Нэвтрэх</Link>
        </Button>
      </div>
    );
  }

  const collections = await getMyCollections();

  return (
    <div className="space-y-6">
      {/*
        The build link lives here as well as in the empty state: once a
        customer has saved a bundle the empty state is gone, and with it the
        only way from this page to making another one.
      */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          Өөрийн угсарсан багцууд — сагсанд нэмэх, нэр солих, устгах.
        </p>
        <Button asChild className="shrink-0">
          <Link href="/collections/build">
            Багц угсрах
          </Link>
        </Button>
      </div>
      <MyCollections collections={collections} />
    </div>
  );
}
