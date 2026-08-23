import * as Sentry from "@sentry/nextjs";

/**
 * Server/edge Sentry init (Next.js instrumentation hook). No-op until
 * NEXT_PUBLIC_SENTRY_DSN is set, mirroring how RESEND_API_KEY gates email.
 */
export async function register() {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
    tracesSampleRate: 0.1,
  });
}

export const onRequestError = Sentry.captureRequestError;
