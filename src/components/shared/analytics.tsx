import Script from "next/script";
import { GoogleAnalytics } from "@next/third-parties/google";
import { env } from "@/lib/env";

/**
 * GA4 + Meta Pixel (requirement.md техникийн шаардлага). Renders nothing until
 * the respective env ids are present, so dev/preview stay clean.
 *
 * GA4 loads through @next/third-parties, which schedules the gtag script
 * off the critical path and still exposes window.gtag for lib/analytics.ts.
 */
export function Analytics() {
  return (
    <>
      {env.gaId && <GoogleAnalytics gaId={env.gaId} />}

      {env.metaPixelId && (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window,document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${env.metaPixelId}');
            fbq('track', 'PageView');
          `}
        </Script>
      )}
    </>
  );
}
