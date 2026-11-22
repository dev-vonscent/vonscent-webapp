import { cn } from "@/lib/utils";

const STEPS = [
  {
    title: "Холбоос дээр дарна",
    body: "Имэйл эсвэл мессежээр ирсэн «Бэлгээ авах» холбоос дээр дарна. Утсаараа QR уншуулж ч болно.",
  },
  {
    title: "Утасны дугаараараа бүртгүүлнэ",
    body: "Хэдхэн секунд — утасны дугаараа бичээд SMS-ээр баталгаажуулж бүртгэлээ үүсгэнэ.",
  },
  {
    title: "Оноо дансанд орно",
    body: "Картын дүн V point болж дансанд орно (1 оноо = 1₮). Үнэртэн сонгоод төлбөр төлөхдөө «V point ашиглах»-ыг сонгоно.",
  },
] as const;

/**
 * Хүлээн авагчид зориулсан 3 алхам (gift-cards-plan §2.3) — `/gift-cards`,
 * `/gift/[token]`, имэйлд ижил үгээр.
 */
export function GiftCardSteps({ className }: { className?: string }) {
  return (
    <ol className={cn("grid gap-3 sm:grid-cols-3", className)}>
      {STEPS.map((s, i) => (
        <li key={s.title} className="bg-secondary rounded-2xl p-5">
          <span className="bg-background flex size-8 items-center justify-center rounded-full text-sm font-semibold tabular-nums">
            {i + 1}
          </span>
          <p className="mt-3 font-semibold">{s.title}</p>
          <p className="text-muted-foreground mt-1 text-sm">{s.body}</p>
        </li>
      ))}
    </ol>
  );
}

/** Сайтыг анх үзэж буй хүний хамгийн түгээмэл асуултууд. */
export const GIFT_FAQ = [
  {
    q: "V point гэж юу вэ?",
    a: "Vonscent-ийн оноо. 1 оноо = 1₮. Төлбөр төлөхдөө оноогоо ашиглан барааны дүнгээс хасуулна.",
  },
  {
    q: "Нэг дор бүгдийг нь зарцуулах ёстой юу?",
    a: "Үгүй. Үлдсэн оноо дансанд тань хадгалагдаж, дараагийн захиалгад ашиглагдана. Оноо болсны дараа хугацаа дуусахгүй.",
  },
  {
    q: "Хүргэлтийн төлбөрийг оноогоор төлж болох уу?",
    a: "Оноо зөвхөн барааны дүнд ашиглагдана. Хүргэлтийн төлбөрийг QPay-ээр төлнө.",
  },
  {
    q: "Кодыг хэзээ хүртэл ашиглах вэ?",
    a: "Картыг худалдаж авснаас хойш 1 жилийн дотор оноо болгох боломжтой. Хугацаа нь картын хуудсан дээр бичээстэй.",
  },
] as const;

export function GiftCardFaq({ className }: { className?: string }) {
  return (
    <dl className={cn("divide-border divide-y", className)}>
      {GIFT_FAQ.map((f) => (
        <div key={f.q} className="py-4">
          <dt className="font-medium">{f.q}</dt>
          <dd className="text-muted-foreground mt-1 text-sm">{f.a}</dd>
        </div>
      ))}
    </dl>
  );
}
