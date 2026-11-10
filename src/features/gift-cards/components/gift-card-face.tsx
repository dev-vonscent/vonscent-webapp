import Image from "next/image";
import { cn } from "@/lib/utils";
import { formatGiftAmount } from "../lib";
import type { GiftCardDesign, GiftCardFaceText } from "../types";

/**
 * Бэлгийн картын нүүр (gift-cards-plan §9.1, canvas «00 · Safe zone»).
 *
 * 1200×756 (≈ банкны карт) харьцаатай, хэмжээ нь контейнерийн өргөнөөс
 * (`cqw`) — preview, жагсаалт, хүлээн авагчийн хуудас бүгд нэг бүрэлдэхүүн.
 * Байрлал нь canvas-ийн px-ийг 1200-д хуваасан нь: `u(64)` = 64px @1200.
 *
 * Дэвсгэр зураг (дизайнерын, текстгүй) байвал бүтэн дүүргэнэ; байхгүй бол
 * загварын цул өнгө. Өнгө нь загварын өгөгдөл (DB) тул inline style — сайтын
 * theme token биш, картын «зураг»-ийн нэг хэсэг.
 *
 * Код энд ХЭЗЭЭ Ч гарахгүй: карт хуваалцагдана, код нь нууц (§5.3).
 */
export function GiftCardFace({
  design,
  text,
  className,
  priority = false,
}: {
  design: GiftCardDesign;
  text: GiftCardFaceText;
  className?: string;
  priority?: boolean;
}) {
  const u = (px: number) => `${(px / 12).toFixed(3)}cqw`;
  const recipient = text.recipientName.trim();
  const message = text.message.trim() || design.defaultMessage || "";
  const from = text.fromName.trim();

  return (
    <div
      className={cn(
        "@container relative aspect-1200/756 w-full overflow-hidden rounded-2xl shadow-sm select-none",
        className,
      )}
      style={{ backgroundColor: design.bgColor, color: design.textColor }}
      role="img"
      aria-label={`Vonscent бэлгийн карт, ${formatGiftAmount(text.amount)}${recipient ? `, ${recipient}-д` : ""}`}
    >
      {design.imageUrl ? (
        <Image
          src={design.imageUrl}
          alt=""
          fill
          sizes="(min-width: 768px) 600px, 100vw"
          priority={priority}
          className="object-cover"
        />
      ) : (
        // Зураггүй загварт: чимэглэлийн бүсэд нимгэн хоёр тойрог (canvas
        // «Үндсэн»-ий хэлбэр), gradient-гүй.
        <svg
          aria-hidden="true"
          viewBox="0 0 380 440"
          fill="none"
          className="absolute"
          style={{ left: u(760), top: u(180), width: u(380) }}
        >
          <circle
            cx="190"
            cy="250"
            r="160"
            stroke={design.accentColor ?? design.mutedColor}
            strokeWidth="1.5"
          />
          <circle
            cx="190"
            cy="250"
            r="184"
            stroke={design.mutedColor}
            strokeOpacity="0.35"
            strokeWidth="1"
          />
        </svg>
      )}

      <div aria-hidden="true" className="absolute inset-0">
        <span
          className="brand-mark absolute block aspect-233/240"
          style={{ left: u(64), top: u(48), height: u(88) }}
        />

        <div
          className="absolute text-right"
          style={{ right: u(64), top: u(48) }}
        >
          <div
            className="leading-none font-bold tabular-nums"
            style={{ fontSize: u(60) }}
          >
            {formatGiftAmount(text.amount)}
          </div>
          <div
            className="font-semibold tabular-nums"
            style={{
              marginTop: u(12),
              fontSize: u(24),
              color: design.mutedColor,
            }}
          >
            = {text.amount.toLocaleString("en-US")} V point
          </div>
        </div>

        <div className="absolute" style={{ left: u(64), top: u(216), width: u(640) }}>
          <div
            className="line-clamp-2 font-semibold tracking-tight"
            style={{ fontSize: u(60), lineHeight: 1.05 }}
          >
            {design.heading}
          </div>
          {recipient && (
            <div
              className="truncate font-bold"
              style={{ marginTop: u(32), fontSize: u(32) }}
            >
              {recipient} танд,
            </div>
          )}
          {message && (
            <div
              className="line-clamp-3 wrap-break-word"
              style={{
                marginTop: u(12),
                maxWidth: u(600),
                fontSize: u(26),
                lineHeight: 1.45,
                color: design.mutedColor,
              }}
            >
              {message}
            </div>
          )}
          {from && (
            <div
              className="truncate"
              style={{ marginTop: u(24), fontSize: u(26), color: design.mutedColor }}
            >
              Илгээгч:{" "}
              <span className="font-bold" style={{ color: design.textColor }}>
                {from}
              </span>
            </div>
          )}
        </div>

        <div
          className="absolute font-medium"
          style={{ left: u(64), bottom: u(48), fontSize: u(22), color: design.mutedColor }}
        >
          vonscent.mn
        </div>
      </div>
    </div>
  );
}
