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

/**
 * Энэнээс удвал бүтэлгүйд тооцож дуудагч fallback (Messenger / утас) санал
 * болгоно. Crisp дараалсан ~6 round-trip-ээр ачаалагддаг (l.js → client →
 * prelude → settings → хэл → features) — Европын сервер рүү удаан сүлжээнд
 * 8с-ээс амархан давдаг байсан тул эрт fallback гарч хэрэглэгч чатад
 * хүрдэггүй байв. Crisp-ийн loader өөрөө 30с хүлээдэг тул түүнээс бага
 * зэрэг илүү — жинхэнэ гацсан үед л бууж өгнө.
 */
const LOAD_TIMEOUT_MS = 35_000;

/** Сүлжээний түр тасалдалд (`onerror`) дахин оролдох тоо — adblocker бол тэр даруй дахин унана. */
const SCRIPT_RETRIES = 1;

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
let open = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

/** `useSyncExternalStore`-д: `getUnread` ба `isChatOpen` хоёулаа энүүгээр. */
export function subscribeChat(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
/** Админы уншаагүй мессежийн тоо. */
export function getUnread() {
  return unread;
}
/**
 * Crisp-ийн цонх нээлттэй эсэх. Нээлттэй үед Crisp өөрийн ✕ товчийг манай
 * товчны байрлалд гаргадаг тул `ChatWidget` өөрийгөө нууна — давхардахгүй.
 */
export function isChatOpen() {
  return open;
}

function setOpen(value: boolean) {
  open = value;
  syncUnread();
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

/**
 * Сайтын theme → Crisp-ийн өнгө. Crisp зөвхөн бэлэн палитртай (Material);
 * navy байхгүй тул хамгийн ойр нь indigo.
 */
const CRISP_THEMES: Record<string, { color: string; mode: "light" | "dark" }> =
  {
    black: { color: "black", mode: "dark" },
    white: { color: "black", mode: "light" },
    navy: { color: "indigo", mode: "light" },
    pink: { color: "pink", mode: "light" },
  };

let siteTheme: string | undefined;

function applyTheme() {
  const t = siteTheme ? CRISP_THEMES[siteTheme] : undefined;
  if (!t) return;
  push("config", "color:theme", [t.color]);
  push("config", "color:mode", [t.mode]);
}

/**
 * Сайтын theme солигдоход нээлттэй чатын өнгө ч дахин ачаалалгүй солигдоно
 * (`$crisp` config нь runtime-д ажилладаг). Ачаалагдаагүй бол зөвхөн
 * санана — `configure` ачаалахдаа тавина, дараалал дүүргэхгүй.
 */
export function setChatTheme(theme: string | undefined) {
  if (theme === siteTheme) return;
  siteTheme = theme;
  if (configured) applyTheme();
}

let configured = false;
let script: HTMLScriptElement | null = null;
let scriptReady: Promise<void> | null = null;

/** Identity, тохиргоо, event-үүдийг нэг л удаа — дахин оролдоход давхардахгүй. */
async function configure() {
  if (configured) return;
  // Token нь скриптээс өмнө тавигдах ёстой тул эхлээд хэн болохыг тодруулна.
  const identity = await fetchIdentity();
  if (configured) return;
  configured = true;
  window.CRISP_WEBSITE_ID = env.crispWebsiteId;
  window.CRISP_TOKEN_ID = identity?.token ?? null;

  // Ачаалагдмагц өөрийн бөмбөлөгөө гаргахгүй.
  push("safe", true);
  push("do", "chat:hide");
  applyTheme();

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
    setOpen(false);
  });
  push("on", "chat:opened", () => setOpen(true));
  push("on", "message:received", syncUnread);
}

/**
 * Скриптийг нэг л удаа нэмнэ. Удаан ачаалагдаж байсан ч дараагийн даралт
 * шинээр нэмэлгүй тэр л ачаалалтыг хүлээнэ; зөвхөн сүлжээ/adblocker хаасан
 * (`onerror`) үед дахин нэмнэ.
 */
function injectScript(): Promise<void> {
  if (scriptReady) return scriptReady;
  scriptReady = new Promise<void>((resolve, reject) => {
    window.CRISP_READY_TRIGGER = () => {
      ready = true;
      syncUnread();
      resolve();
    };
    script = document.createElement("script");
    script.async = true;
    script.src = "https://client.crisp.chat/l.js";
    script.onerror = () => {
      script?.remove();
      script = null;
      scriptReady = null;
      reject(new Error("CRISP_BLOCKED"));
    };
    document.head.appendChild(script);
  });
  return scriptReady;
}

async function injectWithRetry() {
  for (let attempt = 0; ; attempt++) {
    try {
      return await injectScript();
    } catch (error) {
      if (attempt >= SCRIPT_RETRIES) throw error;
    }
  }
}

/** Timeout-гүй, хуваалцсан ачаалалт — бүтэлгүйтвэл дараагийн дуудлага шинээр эхэлнэ. */
function loadCrisp(): Promise<void> {
  if (ready) return Promise.resolve();
  loading ??= (async () => {
    await configure();
    await injectWithRetry();
  })().catch((error: unknown) => {
    loading = null;
    throw error;
  });
  return loading;
}

/**
 * Хэрэглэгч чатын товч руу чиглэх мөчид (hover, focus, хуруу хүрэх) Crisp-г
 * урьдчилан ачаалж эхэлнэ — дарах үед ихэнхдээ бэлэн болсон байна. Crisp
 * нуугдмал ачаалагдана, юу ч харагдахгүй.
 */
export function preloadChat() {
  if (!env.crispWebsiteId) return;
  loadCrisp().catch(() => undefined);
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
    // Identity-ийн fetch ч хугацаанд багтана — сервер гацсан ч хэрэглэгч
    // хязгааргүй хүлээхгүй. Timeout түрүүлсэн ч ачаалалт үргэлжилнэ —
    // дараагийн даралт тэр л ачаалалтыг хүлээнэ.
    let timer: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([
      loadCrisp(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("CRISP_TIMEOUT")),
          LOAD_TIMEOUT_MS,
        );
      }),
    ]).finally(() => clearTimeout(timer));
    push("do", "chat:show");
    push("do", "chat:open");
    // Crisp өмнөх session-оос (refresh) нээлттэй төлвөө сэргээсэн бол
    // `chat:opened` дахин ирдэггүй — манай товч нуугдахгүй давхцдаг байв.
    setOpen(true);
    return true;
  } catch {
    return false;
  }
}
