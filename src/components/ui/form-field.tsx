import { cn } from "@/lib/utils";

/**
 * Custom validation UI — browser-ийн default bubble-ийн оронд талбарын доор
 * улаан мессеж харуулна (form бүр `noValidate` байх ёстой).
 *
 * `id` өгвөл мессеж `<id>-error` болж, `fieldErrorProps(id, msg)`-той хамт
 * screen reader-т шууд зарлагдана (WCAG 3.3.1).
 */
export function FieldError({ id, message }: { id?: string; message?: string }) {
  if (!message) return null;
  return (
    <p
      id={id ? `${id}-error` : undefined}
      role="alert"
      className="text-destructive text-xs"
    >
      {message}
    </p>
  );
}

/**
 * Алдаатай input-д залгах props: `aria-invalid` + мессеж рүү заасан
 * `aria-describedby`. Input-ийн `id` нь FieldError-ийн `id`-тэй ижил байна.
 */
export function fieldErrorProps(id: string, message?: string) {
  if (!message) return { id };
  return {
    id,
    "aria-invalid": true as const,
    "aria-describedby": `${id}-error`,
  };
}

/**
 * Алдаатай талбарын хүрээ. Систем хүрээгүй тул `border` биш inset ring —
 * `field-edge`-ийн улаан хувилбар.
 */
export function fieldErrorClass(message?: string) {
  return cn(message && "field-edge-error");
}
