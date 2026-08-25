import { NextResponse } from "next/server";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

const tokenSchema = z.string().uuid();

/**
 * Имэйл доторх unsubscribe линк — нэвтрэлт шаардахгүй (имэйл клиент дотроос
 * дарагдана), token нь бүртгэл бүрд давтагдашгүй тул хангалттай эрхжүүлэлт.
 * Бүртгэлийг устгалгүй идэвхгүй болгоно: дахин бүртгүүлбэл сэргэнэ.
 */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  const parsed = tokenSchema.safeParse(token);

  const page = (message: string) =>
    new NextResponse(
      `<!doctype html><html lang="mn"><head><meta charset="utf-8">` +
        `<meta name="viewport" content="width=device-width, initial-scale=1">` +
        `<title>vonscent</title></head>` +
        `<body style="font-family:system-ui,sans-serif;background:#0a0a0a;color:#eee;` +
        `display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0">` +
        `<div style="text-align:center;padding:2rem;max-width:26rem">` +
        `<p style="font-size:1.5rem;font-weight:600;margin-bottom:0.75rem">vonscent</p>` +
        `<p style="color:#bbb">${message}</p>` +
        `<p style="margin-top:1.5rem"><a href="/" style="color:#d4af37">Дэлгүүр рүү буцах</a></p>` +
        `</div></body></html>`,
      { headers: { "Content-Type": "text/html; charset=utf-8" } },
    );

  if (!parsed.success) return page("Линк буруу эсвэл хугацаа нь дууссан байна.");
  if (!isSupabaseConfigured) return page("Demo горим — бүртгэл өөрчлөгдөөгүй.");

  const supabase = createAdminClient();
  if (!supabase) return page("Түр алдаа гарлаа. Дараа дахин оролдоно уу.");

  const { data } = await supabase
    .from("newsletter_subscribers")
    .update({ is_active: false })
    .eq("token", parsed.data)
    .select("email")
    .maybeSingle();

  return page(
    data
      ? "Таныг имэйл мэдэгдлээс хаслаа. Дахин бүртгүүлбэл хэзээ ч сэргээж болно."
      : "Линк буруу эсвэл бүртгэл олдсонгүй.",
  );
}
