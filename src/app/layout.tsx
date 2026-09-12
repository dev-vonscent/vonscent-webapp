import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { SITE } from "@/lib/constants";
import { Providers } from "@/components/providers";
import { Toaster } from "@/components/ui/toaster";
import { Analytics } from "@/components/shared/analytics";
import Script from "next/script";
import "./globals.css";

// Single minimalist sans font across the whole site.
const sans = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-sans",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Android: shrink the layout viewport when the keyboard opens, so
  // min-h-svh layouts re-center themselves above it.
  interactiveWidget: "resizes-content",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} — ${SITE.tagline}`,
    template: `%s · ${SITE.name}`,
  },
  description: SITE.description,
  openGraph: {
    type: "website",
    siteName: SITE.name,
    title: SITE.name,
    description: SITE.description,
    url: SITE.url,
  },
};

// Focus method tracking: pointer interaction must never paint a focus ring,
// but text inputs match :focus-visible even on click (per spec), so CSS alone
// can't tell the two apart. Runs before paint to avoid a flash.
const FOCUS_METHOD_SCRIPT = `(function(){var d=document.documentElement;
d.dataset.focus='pointer';
addEventListener('pointerdown',function(){d.dataset.focus='pointer'},true);
addEventListener('keydown',function(e){if(e.key==='Tab'||e.key.indexOf('Arrow')===0||e.key==='Home'||e.key==='End'||e.key==='PageUp'||e.key==='PageDown'){d.dataset.focus='keyboard'}},true);})()`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="mn"
      suppressHydrationWarning
      className={`black ${sans.variable} h-full`}
    >
      <body className="flex min-h-full flex-col antialiased">
        <Script id="focus-method" strategy="beforeInteractive">
          {FOCUS_METHOD_SCRIPT}
        </Script>
        <Providers>{children}</Providers>
        <Toaster />
        <Analytics />
      </body>
    </html>
  );
}
