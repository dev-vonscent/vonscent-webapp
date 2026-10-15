/**
 * verify.mn SMS-гүйгээр туршилтын бүртгэл үүсгэх — ЗӨВХӨН dev сан.
 *
 *   pnpm db:dev-signup-dev 99001122 1234 "Тест хэрэглэгч"
 *   pnpm db:dev-signup-dev --delete 99001122     # туршилтын дараа устгах
 *
 * `/api/auth/phone/register`-ийн хийдэг зүйлийг давтана: synthetic имэйлтэй
 * Supabase хэрэглэгч, профайлд баталгаажсан утас, дараа нь бүртгэлийн купон
 * (`grant_signup_coupons`, 0135 — туг ба кампанит ажлыг RPC өөрөө шалгана).
 * Дараа нь сайтын энгийн «Нэвтрэх» хуудсаар дугаар + нууц кодоор орно —
 * нэвтрэлт verify.mn шаарддаггүй.
 *
 * Устгах нь: тухайн дугаарын кампанит олголтын бүртгэл (`campaign_grants`) →
 * Supabase хэрэглэгч (профайл, купон, хаяг г.м. cascade-аар хамт). Олголтын
 * бүртгэлийг эхэлж устгана — эс бөгөөс утас нь үлдэж, тэр дугаар дахин купон
 * авч чадахгүй, кампанит ажлыг ч устгаж болохгүй (FK restrict). Staff
 * бүртгэлийг устгахгүй.
 *
 * Prod сан руу ажиллахгүй: `DEV_PROJECT_REFS`-д байхгүй төсөл рүү холбогдохоос
 * татгалзана (`reset-test-data.ts`-ийн адил зөвшөөрлийн жагсаалт).
 */
import { createHmac } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { phoneEmail } from "../src/lib/auth/phone-email";

const args = process.argv.slice(2);
const remove = args[0] === "--delete";
const [phone, passcode, fullName = "Тест хэрэглэгч"] = remove
  ? [args[1]]
  : args;
if (
  !/^\d{8}$/u.test(phone ?? "") ||
  (!remove && !/^\d{4}$/u.test(passcode ?? ""))
) {
  console.error(
    'Хэрэглээ: pnpm db:dev-signup-dev <8 оронтой утас> <4 оронтой код> ["Нэр"]\n' +
      "          pnpm db:dev-signup-dev --delete <8 оронтой утас>",
  );
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const pepper = process.env.AUTH_PASSCODE_PEPPER;
if (!url || !key || !pepper) {
  console.error(
    "✖ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / AUTH_PASSCODE_PEPPER алга (.env.dev).",
  );
  process.exit(1);
}

/** Зөвхөн dev төсөл. Prod-ыг ЭНД БҮҮ НЭМ. */
const DEV_PROJECT_REFS = ["zxvbgsnhldntcuswdpqm"];
if (!DEV_PROJECT_REFS.some((ref) => url.includes(ref))) {
  console.error("✖ Энэ скрипт зөвхөн dev сан дээр ажиллана.");
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });

async function deleteTestUser() {
  const { data } = await sb
    .from("profiles")
    .select("id, role")
    .eq("phone", phone)
    .maybeSingle();
  const profile = data as { id: string; role: string } | null;
  if (profile && profile.role !== "customer") {
    console.error(`✖ ${phone} бол ${profile.role} — устгахгүй.`);
    process.exit(1);
  }

  // Утсаар нь — хэрэглэгч өмнө нь устсан ч олголтын мөр үлдсэн байж болно.
  const grants = await sb
    .from("campaign_grants")
    .delete()
    .or(`phone.eq.${phone}${profile ? `,user_id.eq.${profile.id}` : ""}`)
    .select("id");
  if (grants.error) {
    console.error("✖ campaign_grants:", grants.error.message);
    process.exit(1);
  }
  console.log(`✓ Олголтын бүртгэл устлаа: ${grants.data.length}`);

  if (!profile) {
    console.log(`• ${phone} дугаартай бүртгэл алга.`);
    return;
  }
  const { error } = await sb.auth.admin.deleteUser(profile.id);
  if (error) {
    console.error("✖ Хэрэглэгч устсангүй:", error.message);
    process.exit(1);
  }
  console.log(
    `✓ ${phone} устлаа (профайл, купон, хаяг хамт). Захиалга байсан бол зочны захиалга болж үлдэнэ.`,
  );
}

async function main() {
  if (remove) return deleteTestUser();
  const { data: existing } = await sb
    .from("profiles")
    .select("id")
    .eq("phone", phone)
    .maybeSingle();
  if (existing) {
    console.error(`✖ ${phone} аль хэдийн бүртгэлтэй.`);
    process.exit(1);
  }

  // `derivePassword` (src/lib/auth/phone.ts)-тэй ижил: server-only модулийг
  // скриптээс импортлох боломжгүй тул HMAC-ийг энд давтав.
  const password = createHmac("sha256", pepper!).update(passcode).digest("hex");
  const { data: created, error } = await sb.auth.admin.createUser({
    email: phoneEmail(phone),
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error || !created.user) {
    console.error("✖ Хэрэглэгч үүссэнгүй:", error?.message);
    process.exit(1);
  }
  const userId = created.user.id;

  await sb
    .from("profiles")
    .update({ phone, phone_verified: true })
    .eq("id", userId);

  const { data: gift, error: grantError } = await sb.rpc(
    "grant_signup_coupons",
    { p_user: userId, p_phone: phone },
  );
  if (grantError) console.error("✖ grant_signup_coupons:", grantError.message);

  console.log(`✓ Бүртгэл үүслээ: ${phone} / ${passcode} (${userId})`);
  console.log(
    gift
      ? `✓ Купон олгосон: ${JSON.stringify(gift)}`
      : "• Купон олгоогүй — туг унтраалттай, эсвэл идэвхтэй/хугацаандаа байгаа кампанит ажил алга.",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
