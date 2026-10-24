import type { Metadata } from "next";
import Link from "next/link";
import { getMyCollections } from "@/features/collections/api";
import { MyCollections } from "@/features/collections/components/my-collections";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { AccountPageHeader } from "@/features/account/components/account-page-header";

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
        The empty state carries its own build link, so the header one only
        shows once a bundle exists — otherwise two identical buttons stack.
      */}
      <AccountPageHeader
        title="Миний багцууд"
        aside={
          collections.length > 0 && (
            <Button asChild size="sm">
              <Link href="/collections/build">Багц үүсгэх</Link>
            </Button>
          )
        }
      />
      {collections.length === 0 ? (
        // Утсан дээр хоосон төлөв дэлгэцийн дунд — толгой, доод цэсийн
        // хоорондох зайд босоогоор голлоно.
        <div className="flex flex-col justify-center max-md:min-h-[calc(100svh-14rem)]">
          <MyCollections collections={collections} />
        </div>
      ) : (
        <MyCollections collections={collections} />
      )}
    </div>
  );
}
