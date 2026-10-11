"use client";

import { motion } from "motion/react";

/** Lucide-ийн `MessageCircle`-тай яг ижил бөмбөлөг — бусад газрын icon-той нийцтэй. */
const BUBBLE = "M7.9 20A9 9 0 1 0 4 16.1L2 22Z";
const DOTS = [8, 12, 16];
/** Цэг бүрийн асах/унтрах хагас мөчлөг (LottieFiles-ийн 8 frame @30fps). */
const BLINK = 0.27;

/**
 * Хөдөлгөөнт чатын icon — LottieFiles-ийн «Chat Icon» анимейшнийг
 * (https://lottiefiles.com/free-animation/chat-icon-srZfcTSWSR) motion-оор:
 *
 * 1. Icon сүүлийн булангаасаа 0 → 110% → 100% поп хийж гарна.
 * 2. Бөмбөлгийн хүрээ өөрөө зурагдана (trim path → `pathLength`).
 * 3. Гурван цэг зүүнээс баруун тийш ээлжлэн анивчина — «бичиж байна…».
 * 4. 20%-ийн сүүдэр хуулбар баруун доош бага зэрэг шилжинэ (гүн).
 *
 * Эх анимейшнд бөмбөлөг буцаж арилдаг — товчны icon үе үе алга болбол юуны
 * товч болох нь танигдахгүй тул нэг удаа зурагдаад үлдэнэ, зөвхөн цэгүүд
 * давтана. Өнгө `currentColor` — theme бүрт.
 *
 * `MotionConfig reducedMotion="user"` дотор хэрэглэнэ.
 */
export function TypingChatIcon({ className }: { className?: string }) {
  return (
    <motion.svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
      style={{ originX: 0.1, originY: 0.9 }}
      initial={{ scale: 0 }}
      animate={{ scale: [0, 1.1, 1] }}
      transition={{ duration: 0.25, times: [0, 0.65, 1], ease: "easeOut" }}
    >
      {/* Сүүдэр хуулбар */}
      <g opacity={0.2} transform="translate(0.6 0.6)">
        <path d={BUBBLE} />
        {DOTS.map((cx) => (
          <circle
            key={cx}
            cx={cx}
            cy={12}
            r={1}
            fill="currentColor"
            stroke="none"
          />
        ))}
      </g>

      <motion.path
        d={BUBBLE}
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.9, delay: 0.13, ease: "easeInOut" }}
      />
      {DOTS.map((cx, i) => (
        <motion.circle
          key={cx}
          cx={cx}
          cy={12}
          r={1}
          fill="currentColor"
          stroke="none"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0] }}
          transition={{
            duration: BLINK * 2,
            repeat: Infinity,
            ease: "linear",
            delay: 0.2 + i * BLINK,
          }}
        />
      ))}
    </motion.svg>
  );
}
