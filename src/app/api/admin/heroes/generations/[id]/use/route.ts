import { NextResponse } from "next/server";
import { z } from "zod";
import { imageUploadFailure } from "@/lib/storage/report";
import { storagePath } from "@/lib/storage/storage";
import { heroAdminGate, processHeroImage } from "@/features/heroes/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const idSchema = z.string().uuid();

/**
 * «Энэ зургийг ашиглах» (plan §8.1 ⑤): PNG мастерыг upload-тай ЯГ ИЖИЛ
 * алхмаар (харьцаа шалгах, 1600/2400/3200 webp, `dark` санал) hero-гийн
 * зураг болгоно. Hero өөрөө хадгалагдахад л нүүрэнд гарна.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const gate = await heroAdminGate();
    if ("response" in gate) return gate.response;
    const id = idSchema.safeParse((await params).id);
    if (!id.success) {
      return NextResponse.json({ error: "Буруу хүсэлт." }, { status: 400 });
    }
    const { data } = await gate.supabase
      .from("hero_image_generations")
      .select("group_id, target, status, result_url")
      .eq("id", id.data)
      .maybeSingle();
    const job = data as {
      group_id: string;
      target: "desktop" | "mobile";
      status: string;
      result_url: string | null;
    } | null;
    if (!job || job.status !== "done" || !job.result_url) {
      return NextResponse.json({ error: "Зураг бэлэн биш байна." }, { status: 404 });
    }
    if (!storagePath(job.result_url)?.startsWith("hero/")) {
      return NextResponse.json({ error: "Зураг танигдсангүй." }, { status: 400 });
    }
    const res = await fetch(job.result_url);
    if (!res.ok) {
      return NextResponse.json({ error: "Мастер зургийг татаж чадсангүй." }, { status: 502 });
    }
    const result = await processHeroImage(
      Buffer.from(await res.arrayBuffer()),
      job.target,
      job.group_id,
    );
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (err) {
    return imageUploadFailure(err);
  }
}
