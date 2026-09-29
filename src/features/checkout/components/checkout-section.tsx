import * as React from "react";

/**
 * Захиалгын хуудасны дугаарласан алхам. `id` нь форм буруу үед `onInvalid`
 * гүйлгэх бай (`scroll-mt-24` нь толгойн доор нуугдахаас хамгаална).
 *
 * Бэлгийн дээжийн хэсэг ч үүнийг хэрэглэдэг — өмнө нь тэр нь өөрийн гэсэн
 * дугааргүй карттай байсан тул алхмын дарааллаас тасарч, хуудасны хамгийн
 * том блок мөртлөө «аль алхам бэ» гэдэг нь тодорхойгүй байв.
 */
export function CheckoutSection({
  id,
  step,
  title,
  aside,
  children,
}: {
  id?: string;
  step: number;
  title: string;
  /** Гарчгийн баруун талд — жишээ нь «1/2 сонгосон». */
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="bg-card scroll-mt-24 rounded-2xl p-5 sm:p-6">
      <div className="mb-5 flex items-center gap-3">
        <span className="bg-secondary flex size-9 shrink-0 items-center justify-center rounded-full">
          <span className="text-sm font-semibold">{step}</span>
        </span>
        <h2 className="min-w-0 flex-1 text-lg font-semibold">{title}</h2>
        {aside}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}
