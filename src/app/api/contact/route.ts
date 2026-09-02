import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, STORE_INBOX, renderEmail } from "@/lib/email";
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
  const { html, text } = renderEmail({
    preheader: `${name} — холбоо барих форм`,
    heading: "Холбоо барих форм",
    paragraphs: [message],
    lines: [
      { label: "Нэр", value: name },
      { label: "Имэйл", value: email },
    ],
  });
  await sendEmail({
    to: STORE_INBOX,
    subject: `Холбоо барих: ${name}`,
    text,
    html,
  });

  return NextResponse.json({ ok: true });
}
