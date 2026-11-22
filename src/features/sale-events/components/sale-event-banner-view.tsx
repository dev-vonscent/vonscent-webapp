import * as React from "react";

/**
 * Каталогийн арга хэмжээний төлөвийн зурвасын ТӨРХ — hook, өгөгдөлгүй
 * (`SaleEventBanner`: товлосон / дууссан). Явж буй арга хэмжээ нь сайтын
 * дээд гүйдэг зурваст (`SaleEventTicker`).
 */
export function SaleEventBannerView({
  title,
  children,
  action,
}: {
  /** `<h2>` доторх агуулга. */
  title: React.ReactNode;
  /** Гарчгийн доорх мөрүүд (тайлбар, тоолуур, төлөвийн текст). */
  children?: React.ReactNode;
  /** Баруун дээд товч («Бүх каталог» / «Хаах»). */
  action?: React.ReactNode;
}) {
  return (
    <section
      aria-label="Урамшуулал"
      className="bg-secondary mb-6 flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5"
    >
      <div className="min-w-0 space-y-1">
        <h2 className="font-serif text-lg font-semibold tracking-tight wrap-break-word sm:text-xl">
          {title}
        </h2>
        {children}
      </div>
      {action}
    </section>
  );
}
