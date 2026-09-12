import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { SIGN_OUT_TIMEOUT_MS } from "@/lib/constants";

/**
 * Гарах — сервер тал дээр, хариу нь **үргэлж** нүүр рүү чиглүүлнэ.
 *
 * Өмнө нь гарах нь клиент дээр `await supabase.auth.signOut()` байсан:
 * Supabase руу хийх дуудлага саатвал `await` тэндээ зогсож, товч хариугүй
 * болж, хэрэглэгч гарсан эсэхээ мэдэхгүй хуудсан дээрээ үлддэг байв.
 *
 * Энд гурван зүйл өөр:
 *
 *   1. Сүлжээний дуудлагыг **хугацаатай уралдуулна** — сессийг сервер тал
 *      дээр хүчингүй болгох нь чухал ч, хариу ирэхийг мөнхөд хүлээхгүй.
 *   2. Дуудлага амжсан ч амжаагүй ч **cookie-г заавал устгана**. Энэ бол
 *      «гарсан» гэдгийн бодит утга: cookie байхгүй бол middleware-ийн
 *      `getClaims()` хэнийг ч олохгүй.
 *   3. Хариу нь 303 redirect тул форм илгээх нь браузарын жирийн шилжилт
 *      болно — JS гацах орон зай үлдэхгүй.
 */
export async function POST(req: Request) {
  // Гарах үйлдлийг гаднаас (өөр сайтын форм) өдөөх боломжгүй байх ёстой.
  // Хортой биш ч хэрэглэгчийг дураараа гаргах нь дарамт.
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const supabase = await createClient();
  if (supabase) {
    await Promise.race([
      supabase.auth.signOut().catch(() => undefined),
      new Promise((resolve) => setTimeout(resolve, SIGN_OUT_TIMEOUT_MS)),
    ]);
  }

  // `signOut()` нь өөрөө cookie-г арилгадаг — гэхдээ зөвхөн сүлжээний
  // дуудлага нь буцаж ирсэн тохиолдолд. Дээрх уралдаан цагаараа дуусвал
  // cookie хэвээр үлдэх тул энд гараар устгана. Нэр нь project ref-ээс
  // хамаардаг (`sb-<ref>-auth-token`, урт токен хэд хуваагдсан бол
  // `…-auth-token.0`) тул нэрээр нь биш загвараар нь шүүнэ.
  const response = NextResponse.redirect(new URL("/", req.url), {
    status: 303,
  });
  const store = await cookies();
  for (const { name } of store.getAll()) {
    if (!name.startsWith("sb-") || !name.includes("auth-token")) continue;
    store.delete(name);
    // Хариун дээр нь ДАВХАР хүчингүй болгоно. Энэ хүсэлт `/api/...` рүү
    // явдаг тул middleware мөн ажиллаж, токен нь дуусах дөхсөн байвал шинэ
    // cookie бичих боломжтой. Middleware-ийн толгойнууд эцсийн хариунд
    // нийлдэг учраас «сэргээсэн» cookie «устгасан»-ыг дарж магадгүй —
    // энд нь тодорхой хугацаа нь дууссан утга бичээд тэр эргэлзээг хаана.
    response.cookies.set(name, "", { path: "/", maxAge: 0 });
  }

  return response;
}
