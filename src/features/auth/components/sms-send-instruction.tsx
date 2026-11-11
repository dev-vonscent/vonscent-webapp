import { TriangleAlert } from "lucide-react";

/**
 * verify.mn MO-SMS заавар: код (том) + «хаанаас хаашаа» гэсэн нэг өгүүлбэр.
 * Хоёр SIM-тэй утсанд SMS-ийн өгөгдмөл SIM нь өөр дугаар байж, код буруу
 * дугаараас очих нь элбэг — тэр үед баталгаажилт ажиллахгүй тул SIM-ээ
 * шалгахыг нэг мөрөөр сануулна.
 */
export function SmsSendInstruction({
  phone,
  shortcode,
  code,
}: {
  phone: string;
  shortcode: string;
  code: string;
}) {
  const displayPhone = phone.replace(/^(\d{4})(\d{4})$/u, "$1 $2");
  return (
    <div className="space-y-4">
      {code && (
        <p className="font-serif text-4xl font-semibold tracking-[0.3em] tabular-nums">
          {code}
        </p>
      )}

      <p className="text-muted-foreground text-sm/relaxed">
        Дээрх кодыг{" "}
        <strong className="text-foreground font-semibold tabular-nums">
          {displayPhone}
        </strong>{" "}
        дугаараасаа{" "}
        <strong className="text-foreground font-semibold tabular-nums">
          {shortcode}
        </strong>{" "}
        руу илгээнэ үү.
      </p>

      <p className="text-muted-foreground flex items-start justify-center gap-1.5 text-xs">
        <TriangleAlert className="text-warning mt-px size-3.5 shrink-0" />
        <span>2 SIM-тэй бол илгээхдээ SIM-ээ шалгаарай.</span>
      </p>
    </div>
  );
}

/** Дэлгүүрийн холбоо барих сувгууд — админы тохиргооноос (server). */
export interface SmsHelpContact {
  phone?: string;
  messenger?: string;
}

/**
 * Баталгаажилтад гацсан хэрэглэгчийн гарц — нэг жижиг мөр. Бүртгэлийн
 * хуудаснаас гаргахгүй: утас `tel:`-ээр залгана, Messenger шинэ таб/апп-аар.
 */
export function SmsHelp({ contact }: { contact?: SmsHelpContact }) {
  if (!contact?.phone && !contact?.messenger) return null;
  const link =
    "text-foreground font-medium underline decoration-foreground/30 underline-offset-4 hover:decoration-foreground";
  return (
    <p className="text-muted-foreground text-xs">
      Тусламж:{" "}
      {contact.phone && (
        <a
          href={`tel:${contact.phone.replace(/\s+/gu, "")}`}
          className={`${link} tabular-nums`}
        >
          {contact.phone}
        </a>
      )}
      {contact.phone && contact.messenger && " · "}
      {contact.messenger && (
        <a
          href={contact.messenger}
          target="_blank"
          rel="noopener noreferrer"
          className={link}
        >
          Messenger
        </a>
      )}
    </p>
  );
}
