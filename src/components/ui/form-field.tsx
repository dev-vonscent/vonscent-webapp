import { cn } from "@/lib/utils";

/**
 * Custom validation UI — browser-ийн default bubble-ийн оронд талбарын доор
 * улаан мессеж харуулна (form бүр `noValidate` байх ёстой).
 */
export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-destructive text-xs">{message}</p>;
}

/** Алдаатай input-д залгах хүрээний класс + aria-invalid хамт хэрэглэнэ. */
export function fieldErrorClass(message?: string) {
  return cn(message && "border-destructive border-[1.5px]");
}
