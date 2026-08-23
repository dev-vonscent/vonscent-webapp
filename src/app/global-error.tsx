"use client";

import * as React from "react";
import * as Sentry from "@sentry/nextjs";

/**
 * Last-resort boundary: replaces the root layout when it crashes, so it must
 * render its own <html>/<body> and cannot rely on app CSS or components.
 */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  React.useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="mn">
      <body
        style={{
          margin: 0,
          minHeight: "100svh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          background: "#0a0a0a",
          color: "#fafafa",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
          padding: "1.5rem",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>
          Ноцтой алдаа гарлаа
        </h1>
        <p style={{ maxWidth: "28rem", color: "#a1a1aa" }}>
          Уучлаарай, сайт түр ажиллахгүй байна. Хуудсаа сэргээгээд дахин
          оролдоно уу.
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{
            padding: "0.6rem 1.4rem",
            borderRadius: "0.375rem",
            border: "1px solid #3f3f46",
            background: "transparent",
            color: "#fafafa",
            cursor: "pointer",
          }}
        >
          Дахин ачаалах
        </button>
      </body>
    </html>
  );
}
