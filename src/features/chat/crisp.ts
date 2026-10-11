"use client";

import { env } from "@/lib/env";

/**
 * Crisp чатыг шаардлагатай үед л ачаалах давхарга.
 *
 * Скрипт нь хүнд тул бүх хуудсанд ачаалбал LCP муудна, мөн ихэнх хүн
 * бэлэн асуултаас хариултаа олдог. Тиймээс «Админтай чатлах» дарагдсан
 * мөчид л ачаална. Crisp-ийн өөрийн бөмбөлөг товч хэзээ ч харагдахгүй —
 * чат хаагдахад (`chat:closed`) дахин нуугдана; орох хаалга нь ганцхан
 * манай `ChatWidget`.
 *
 * Үнэгүй багц 100 профайлтай бөгөөд профайл нь имэйлээр үүсдэг тул
 * `user:email`-ийг санаатайгаар дамжуулахгүй — нэр, утас нь зөвхөн
 * ярианы мэдээлэлд харагдана.
 */

type CrispCommand = unknown[];

interface CrispQueue {
  push: (command: CrispCommand) => void;
  get?: (key: string) => unknown;
}

interface CrispIdentity {
  /** Session continuity — өөр төхөөрөмжөөс ч өмнөх яриагаа харна. */
  token?: string;
  name?: string;
  phone?: string;
}

declare global {
  interface Window {
    $crisp?: CrispQueue | CrispCommand[];
    CRISP_WEBSITE_ID?: string;
    CRISP_TOKEN_ID?: string | null;
    CRISP_READY_TRIGGER?: () => void;
  }
}

const LOAD_TIMEOUT_MS = 15_000;

/**
 * Энэ хөтөч дээр Crisp-д нэвтэрсэн хүн байсан эсэх. Гарах үед Crisp
 * ачаалагдаагүй байж болох тул session-ийг тэр мөчид цэвэрлэх боломжгүй —
 * дараа нь зочин чат нээхэд энэ тэмдэглэгээг хараад өмнөх хүний яриаг
 * эхлээд хаана.
 */
const LOGIN_FLAG = "vs-crisp-user";

let loading: Promise<void> | null = null;
let ready = false;
let unread = 0;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

/** `useSyncExternalStore`-д: админы уншаагүй мессежийн тоо. */
export function subscribeUnread(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export function getUnread() {
  return unread;
}

/** Скрипт ачаалагдахаас өмнө ч ажиллана — Crisp дараалсан командуудыг ачаалагдмагц гүйцэтгэнэ. */
function push(...command: CrispCommand) {
  const queue = (window.$crisp ??= []);
  queue.push(command);
}

function syncUnread() {
  const crisp = window.$crisp;
  const count =
    crisp && !Array.isArray(crisp)
      ? Number(crisp.get?.("chat:unread:count"))
      : 0;
  unread = Number.isFinite(count) ? count : 0;
  emit();
}

async function fetchIdentity(): Promise<CrispIdentity | null> {
  try {
    const res = await fetch("/api/chat/crisp-identity", { cache: "no-store" });
    return res.status === 200 ? ((await res.json()) as CrispIdentity) : null;
  } catch {
    return null;
  }
}

function storage<T>(fn: () => T): T | undefined {
  try {
    return fn();
  } catch {
    return undefined;
  }
}

function loadCrisp(): Promise<void> {
  if (loading) return loading;
  const attempt = (async () => {
    // Token нь скриптээс өмнө тавигдах ёстой тул эхлээд хэн болохыг тодруулна.
    const identity = await fetchIdentity();
    window.CRISP_WEBSITE_ID = env.crispWebsiteId;
    window.CRISP_TOKEN_ID = identity?.token ?? null;

    // Ачаалагдмагц өөрийн бөмбөлөгөө гаргахгүй.
    push("safe", true);
    push("do", "chat:hide");

    if (identity) {
      if (identity.name) push("set", "user:nickname", [identity.name]);
      if (identity.phone) push("set", "user:phone", [identity.phone]);
      storage(() => localStorage.setItem(LOGIN_FLAG, "1"));
    } else if (storage(() => localStorage.getItem(LOGIN_FLAG))) {
      push("do", "session:reset");
      storage(() => localStorage.removeItem(LOGIN_FLAG));
    }

    push("on", "chat:closed", () => {
      push("do", "chat:hide");
      syncUnread();
    });
    push("on", "chat:opened", syncUnread);
    push("on", "message:received", syncUnread);

    await new Promise<void>((resolve, reject) => {
      window.CRISP_READY_TRIGGER = () => {
        ready = true;
        syncUnread();
        resolve();
      };
      const script = document.createElement("script");
      script.async = true;
      script.src = "https://client.crisp.chat/l.js";
      // Adblocker эсвэл сүлжээ — дараагийн даралтаар дахин оролдох боломжтой.
      script.onerror = () => reject(new Error("CRISP_BLOCKED"));
      document.head.appendChild(script);
      setTimeout(() => reject(new Error("CRISP_TIMEOUT")), LOAD_TIMEOUT_MS);
    });
  })();
  loading = attempt.catch((e: unknown) => {
    loading = null;
    throw e;
  });
  return loading;
}

/** Crisp аль хэдийн ачаалагдсан эсэх — «Яриагаа үргэлжлүүлэх» шошгонд. */
export function isChatReady() {
  return ready;
}

/**
 * Админтай чатыг нээнэ. Ачаалж чадаагүй бол (adblocker, сүлжээ) `false`
 * буцаана — дуудагч нь Messenger руу шилжүүлнэ.
 */
export async function openAdminChat(): Promise<boolean> {
  try {
    await loadCrisp();
    push("do", "chat:show");
    push("do", "chat:open");
    return true;
  } catch {
    return false;
  }
}
