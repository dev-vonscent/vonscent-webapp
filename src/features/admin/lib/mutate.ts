"use client";

import { toast } from "@/lib/toast";

/**
 * The single write path for the admin panel.
 *
 * Every admin mutation goes through here so a rejected request can never
 * render as success. This exists as a shared module rather than a per-file
 * helper because the "bare `await fetch(...)` that nobody checks" bug was
 * fixed file-by-file twice and survived both times — `eslint.config.mjs`
 * now bans the raw call inside `src/features/admin/**` so it cannot come back.
 *
 * Returns whether the write actually landed; the caller decides what success
 * looks like (a toast, a refresh, closing a form).
 */
export async function mutate(
  url: string,
  init: RequestInit,
  errorTitle: string,
): Promise<boolean> {
  try {
    const res = await fetch(url, init);
    if (res.ok) return true;
    const body = await res.json().catch(() => null);
    toast.error(
      (body as { error?: string } | null)?.error ??
        `Сервер хариу өгсөнгүй (${res.status}).`,
      errorTitle,
    );
    return false;
  } catch {
    toast.error("Сүлжээнд холбогдож чадсангүй. Дахин оролдоно уу.", errorTitle);
    return false;
  }
}

/** `mutate` for a JSON body — the shape almost every admin write uses. */
export function mutateJson(
  url: string,
  method: "POST" | "PATCH" | "PUT" | "DELETE",
  body: unknown,
  errorTitle: string,
): Promise<boolean> {
  return mutate(
    url,
    {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    errorTitle,
  );
}

/** Persist one row of `settings`. */
export function saveSetting(
  key: string,
  value: unknown,
  errorTitle: string,
): Promise<boolean> {
  return mutateJson("/api/admin/settings", "POST", { key, value }, errorTitle);
}

export type AdminResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; demo?: boolean };

/**
 * For the calls whose *body* the caller needs — uploads that return a URL and
 * dimensions, status polls, anything that isn't just "did it land?". Status
 * check, JSON parsing and network failure are handled here; the caller decides
 * how to surface the error, since these sites render inline messages rather
 * than toasts.
 *
 * `demo: true` is passed through unchanged: the app runs on seed data without
 * Supabase, and callers say so in their own words.
 */
export async function adminFetch<T = unknown>(
  url: string,
  init?: RequestInit,
): Promise<AdminResult<T>> {
  try {
    const res = await fetch(url, init);
    const data = (await res.json().catch(() => null)) as
      | (T & { demo?: boolean; error?: string })
      | null;
    if (data?.demo) {
      return {
        ok: false,
        error: "Demo горим: өөрчлөлт хадгалагдсангүй.",
        demo: true,
      };
    }
    if (!res.ok) {
      return {
        ok: false,
        error: data?.error ?? `Сервер хариу өгсөнгүй (${res.status}).`,
      };
    }
    return { ok: true, data: data as T };
  } catch {
    return {
      ok: false,
      error: "Сүлжээнд холбогдож чадсангүй. Дахин оролдоно уу.",
    };
  }
}
