import "server-only";
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { ImageToolUnavailableError } from "./process-image";

/**
 * Any unexpected throw inside an upload handler, turned into a JSON body the
 * admin panel can actually display. Without this the platform answers a
 * bodyless 500 and the operator only ever sees "Сервер хариу өгсөнгүй (500)",
 * with the real cause visible nowhere but the host's runtime log.
 */
export function imageUploadFailure(err: unknown): NextResponse {
  Sentry.captureException(err);
  if (err instanceof ImageToolUnavailableError) {
    return NextResponse.json(
      {
        error:
          "Зураг боловсруулах орчин (sharp) серверт ачаалагдсангүй — байршуулалтын лог шалгана уу.",
      },
      { status: 500 },
    );
  }
  return NextResponse.json(
    { error: "Зураг байршуулахад серверийн алдаа гарлаа." },
    { status: 500 },
  );
}
