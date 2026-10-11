/**
 * Hero 3D-ийн DPR-ийг удаан GPU дээр бууруулах шийдвэр (#6).
 *
 * drei `PerformanceMonitor` FPS-ийг тогтмол хугацааны цонхонд frame тоолж
 * хэмждэг — `frameloop="demand"` үед хөдөлгөөнгүй завсар «бага FPS» болж,
 * хүчтэй төхөөрөмж дээр ч DPR-ийг дэмий бууруулна. Энд зөвхөн ДАРААЛСАН
 * frame-ийн (өмнөх frame нь дараагийнхаа хүссэн — r3f `internal.frames > 0`)
 * хоорондын хугацааг авна: idle завсрын дараах frame тооцогдохгүй. `dt`-ийн
 * босгоор ялгавал маш удаан төхөөрөмжийн frame бүр «завсар» болж хэзээ ч
 * буурахгүй байв (SwiftShader-ээр шалгасан).
 *
 * Зөвхөн доош (2 → 1.5 → 1), хэзээ ч дээш биш — анивчих (flip-flop) эрсдэлгүй.
 */

/** Үүнээс урт дараалсан frame (tab нуугдсан г.м.) — хэмжилтэд орохгүй. */
export const MAX_FRAME_MS = 500;
/** Нэг шийдвэрт хэрэгтэй дараалсан frame-ийн тоо (~1с анимаци). */
export const SAMPLE_COUNT = 60;
/** Медиан нь үүнээс удаан бол бууруулна: ~45fps. */
export const SLOW_FRAME_MS = 1000 / 45;
/** DPR-ийн шатууд — 1.5 нь чанар/хурдны тэнцвэрийн цэг. */
export const DPR_STEPS = [2, 1.5, 1] as const;

/**
 * Цуглуулсан frame-ийн хугацаанаас (мс) дараагийн DPR-ийг шийднэ; хангалттай
 * дээж байхгүй эсвэл хурдан бол `current`-ийг буцаана.
 */
export function nextDpr(frameMs: readonly number[], current: number): number {
  if (frameMs.length < SAMPLE_COUNT) return current;
  // Медиан — нэг удаагийн гацалт (shader compile, GC) шийдвэрийг хөдөлгөхгүй.
  const sorted = [...frameMs].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  if (median <= SLOW_FRAME_MS) return current;
  const lower = DPR_STEPS.find((s) => s < current - 0.01);
  return lower ?? current;
}
