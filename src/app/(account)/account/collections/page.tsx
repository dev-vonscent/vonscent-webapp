import type { Metadata } from "next";
import Link from "next/link";
import {
  getMyCollections,
  getGiftCandidates,
  getCollectionSettings,
} from "@/features/collections/api";
import { MyCollections } from "@/features/collections/components/my-collections";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Миний багцууд" };

export default async function MyCollectionsPage() {
  const supabase = await createClient();
  const {
    data: { user } = { user: null },
  } = (await supabase?.auth.getUser()) ?? { data: { user: null } };

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

  const [collections, settings] = await Promise.all([
    getMyCollections(),
    getCollectionSettings(),
  ]);
  const giftCandidates = settings.giftEnabled
    ? await getGiftCandidates([], settings.giftMl)
    : [];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-muted-foreground mt-1 text-sm">
          Өөрийн угсарсан багцууд — сагсанд нэмэх, нэр солих, устгах.
        </p>
      </div>
      <MyCollections
        collections={collections}
        giftCandidates={giftCandidates}
        giftEnabled={settings.giftEnabled}
        giftMl={settings.giftMl}
      />
    </div>
  );
}
