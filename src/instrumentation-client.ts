import * as Sentry from "@sentry/nextjs";

/**
 * Browser Sentry init. No-op until NEXT_PUBLIC_SENTRY_DSN is set.
 */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  tracesSampleRate: 0.1,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
