import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, STORE_INBOX } from "@/lib/email";
import { contactInputSchema } from "@/lib/validators/contact";

/**
 * Contact form (questions.md №24): the message is stored first so nothing is
 * ever lost, then forwarded to the store inbox when email is configured.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = contactInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID" }, { status: 400 });
  }
  const { name, email, message } = parsed.data;

  const supabase = createAdminClient();
  if (supabase) {
    const { error } = await supabase
      .from("contact_messages")
      .insert({ name, email, message });
    if (error) {
      return NextResponse.json({ error: "SAVE_FAILED" }, { status: 500 });
    }
  }

  // Best-effort forward — the DB row above is the source of truth.
  await sendEmail({
    to: STORE_INBOX,
    subject: `Холбоо барих: ${name}`,
    text: `Нэр: ${name}\nИмэйл: ${email}\n\n${message}`,
  });

  return NextResponse.json({ ok: true });
}
