"use client";

import { env } from "@/lib/env";

/**
 * tawk.to-г шаардлагатай үед л ачаалах давхарга.
 *
 * Скрипт нь ~300KB тул бүх хуудсанд ачаалбал LCP муудна, мөн ихэнх хүн
 * бэлэн асуултаас хариултаа олдог. Тиймээс «Админтай чатлах» дарагдсан
 * мөчид л ачаална. tawk-ийн өөрийн бөмбөлөг товч хэзээ ч харагдахгүй —
 * чат хаагдахад (`onChatMinimized`) дахин нуугдана; орох хаалга нь ганцхан
 * манай `ContactFab`.
 */

interface TawkIdentity {
  userId: string;
  hash: string;
  name?: string;
  email?: string;
  phone?: string;
}

interface TawkApi {
  onLoad?: () => void;
  onChatMinimized?: () => void;
  onChatMaximized?: () => void;
  onChatHidden?: () => void;
  onUnreadCountChanged?: (count: number) => void;
  hideWidget?: () => void;
  showWidget?: () => void;
  maximize?: () => void;
  login?: (data: TawkIdentity, cb: (error?: unknown) => void) => void;
  logout?: (cb: (error?: unknown) => void) => void;
}

declare global {
  interface Window {
    Tawk_API?: TawkApi;
    Tawk_LoadStart?: Date;
  }
}

const LOAD_TIMEOUT_MS = 15_000;
const CALL_TIMEOUT_MS = 5_000;

/**
 * Энэ хөтөч дээр tawk-д нэвтэрсэн хүн байсан эсэх. Гарах үед tawk ачаалагдаагүй
 * байж болох тул session-ийг тэр мөчид цэвэрлэх боломжгүй — дараа нь зочин
 * чат нээхэд энэ тэмдэглэгээг хараад өмнөх хүний яриаг эхлээд хаана.
 */
const LOGIN_FLAG = "vs-tawk-user";

let loading: Promise<TawkApi> | null = null;
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

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("TAWK_TIMEOUT")), ms),
    ),
  ]);
}

/**
 * Tawk-ийн цонхны доод ирмэг (`inset: auto 20px 98px auto`) + сайтын хөвөгч
 * толгой (~88px) — намхан дэлгэцэнд цонх толгойг дарахгүй.
 */
const WIDGET_CHROME_PX = 98 + 96;
const WIDGET_MAX_PX = 500;

/**
 * Tawk-ийн чатын цонх (`#max-widget iframe`) өндрөө агуулгаараа тогтоодог —
 * хэдхэн мессежтэй үед 330px болж, яриа жижиг нүхээр харагддаг. Dashboard
 * ч, JS API (`customStyle`) ч өндөр тохируулах боломж өгдөггүй тул iframe-ийн
 * inline style-ийг дарна. Tawk харагдац солих бүрд өндрөө дахин бичдэг тул
 * MutationObserver-ээр барина.
 *
 * Зөвхөн desktop: утсанд tawk өөрөө бүтэн дэлгэцээр нээгддэг.
 */
/** Утсанд tawk бүтэн дэлгэцээр нээгддэг өргөн (desktop засварууд үүнээс дээш). */
const DESKTOP_MIN_PX = 640;

let unlockPage: (() => void) | null = null;

/**
 * Хуудасны гүйлгэлтийг түр түгжинэ. Tawk-ийн iframe өөр домэйн тул доторх
 * `overscroll-behavior`-т хүрч чадахгүй — чатын түүх доод/дээд ирмэгтээ
 * хүрэхэд гүйлгэлт ард байгаа хуудас руу «урсдаг». Scrollbar алга болоход
 * хуудас хажуу тийш үсрэхгүйн тулд өргөнийг нь padding-аар нөхнө.
 */
function lockPage() {
  if (unlockPage) return;
  const html = document.documentElement;
  const gap = window.innerWidth - html.clientWidth;
  const prev = {
    overflow: html.style.overflow,
    padding: html.style.paddingRight,
  };
  html.style.overflow = "hidden";
  if (gap > 0) html.style.paddingRight = `${gap}px`;
  unlockPage = () => {
    html.style.overflow = prev.overflow;
    html.style.paddingRight = prev.padding;
    unlockPage = null;
  };
}

function unlock() {
  unlockPage?.();
}

/** Desktop: хулгана чатын цонх дээр байх хооронд л түгжинэ — гадна нь хуудас гүйнэ. */
function bindHoverLock(frame: HTMLIFrameElement) {
  if (frame.dataset.vsHoverLock) return;
  frame.dataset.vsHoverLock = "1";
  frame.addEventListener("pointerenter", () => {
    if (window.innerWidth >= DESKTOP_MIN_PX) lockPage();
  });
  frame.addEventListener("pointerleave", () => {
    if (window.innerWidth >= DESKTOP_MIN_PX) unlock();
  });
}

function enforceWidgetHeight() {
  const apply = () => {
    const frame =
      document.querySelector<HTMLIFrameElement>("#max-widget iframe");
    if (frame) bindHoverLock(frame);
    if (!frame || window.innerWidth < DESKTOP_MIN_PX) return;
    const target = `${Math.min(WIDGET_MAX_PX, window.innerHeight - WIDGET_CHROME_PX)}px`;
    if (frame.style.height === target) return;
    for (const prop of ["height", "min-height", "max-height"])
      frame.style.setProperty(prop, target, "important");
  };
  // Iframe-ийн style-ийг л хянана: tawk харагдац солих бүрд өндрөө дахин
  // бичдэг. Observer-ийн callback зурагдахаас өмнө (microtask) ажилладаг тул
  // намхан цонх анивчихгүй.
  const styleObserver = new MutationObserver(apply);
  let watched: HTMLIFrameElement | null = null;
  // `#max-widget` нь tawk-ийн контейнерт хожуу нэмэгддэг тул body-ийн шууд
  // хүүхдийг биш, бүх модыг (зөвхөн childList — style биш, хямд) хянаж,
  // iframe гарч ирмэгц барина.
  const watch = () => {
    const frame =
      document.querySelector<HTMLIFrameElement>("#max-widget iframe");
    if (frame && frame !== watched) {
      styleObserver.disconnect();
      styleObserver.observe(frame, {
        attributes: true,
        attributeFilter: ["style"],
      });
      watched = frame;
    }
    apply();
  };
  new MutationObserver(watch).observe(document.body, {
    childList: true,
    subtree: true,
  });
  window.addEventListener("resize", apply);
  watch();
}

function loadTawk(): Promise<TawkApi> {
  if (loading) return loading;
  const attempt = new Promise<TawkApi>((resolve, reject) => {
    const api: TawkApi = (window.Tawk_API = window.Tawk_API || {});
    window.Tawk_LoadStart = new Date();
    api.onLoad = () => {
      api.hideWidget?.();
      ready = true;
      resolve(api);
    };
    // Утсанд чат бүтэн дэлгэцийг эзэлдэг тул нээлттэй байх турш түгжинэ.
    api.onChatMaximized = () => {
      if (window.innerWidth < DESKTOP_MIN_PX) lockPage();
    };
    api.onChatMinimized = () => {
      unlock();
      api.hideWidget?.();
    };
    api.onChatHidden = unlock;
    api.onUnreadCountChanged = (count) => {
      unread = count;
      emit();
    };
    // `onLoad`-оос өмнө асаана: өмнөх яриатай зочинд tawk цонхоо `onLoad`
    // дуудагдахаас өмнө 330px-ээр гаргадаг байсан тул секунд орчим намхан
    // харагдаж байгаад сунадаг байв.
    enforceWidgetHeight();
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://embed.tawk.to/${env.tawkPropertyId}/${env.tawkWidgetId}`;
    script.charset = "UTF-8";
    script.setAttribute("crossorigin", "*");
    // Adblocker эсвэл сүлжээ — дараагийн даралтаар дахин оролдох боломжтой.
    script.onerror = () => reject(new Error("TAWK_BLOCKED"));
    document.head.appendChild(script);
  });
  loading = withTimeout(attempt, LOAD_TIMEOUT_MS).catch((e: unknown) => {
    loading = null;
    throw e;
  });
  return loading;
}

function call(
  fn: ((cb: (error?: unknown) => void) => void) | undefined,
): Promise<void> {
  if (!fn) return Promise.resolve();
  return withTimeout(
    new Promise<void>((resolve) => fn(() => resolve())),
    CALL_TIMEOUT_MS,
  ).catch(() => undefined);
}

async function fetchIdentity(): Promise<TawkIdentity | null> {
  try {
    const res = await fetch("/api/chat/tawk-identity", { cache: "no-store" });
    return res.status === 200 ? ((await res.json()) as TawkIdentity) : null;
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

let identified: Promise<void> | null = null;

/** Нэвтэрсэн бол tawk-д таниулна, зочин бол өмнөх хүний session-ийг хаана. */
function identify(api: TawkApi): Promise<void> {
  identified ??= (async () => {
    const identity = await fetchIdentity();
    if (identity) {
      await call((cb) => api.login?.(identity, cb));
      storage(() => localStorage.setItem(LOGIN_FLAG, "1"));
    } else if (storage(() => localStorage.getItem(LOGIN_FLAG))) {
      await call((cb) => api.logout?.(cb));
      storage(() => localStorage.removeItem(LOGIN_FLAG));
    }
  })();
  return identified;
}

/** tawk аль хэдийн ачаалагдсан эсэх — «Яриагаа үргэлжлүүлэх» шошгонд. */
export function isTawkReady() {
  return ready;
}

/**
 * Админтай чатыг нээнэ. Ачаалж чадаагүй бол (adblocker, сүлжээ) `false`
 * буцаана — дуудагч нь Messenger руу шилжүүлнэ.
 */
export async function openAdminChat(): Promise<boolean> {
  try {
    const api = await loadTawk();
    await identify(api);
    api.showWidget?.();
    api.maximize?.();
    return true;
  } catch {
    return false;
  }
}
