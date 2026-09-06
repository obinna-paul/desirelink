import type { Metadata, Viewport } from "next";
import { Manrope, Newsreader, Outfit } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import "@livekit/components-styles";
import { cn } from "@/lib/utils";
import { SessionProvider } from "@/components/providers/session-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { PwaInstallPrompt } from "@/components/pwa/pwa-install-prompt";
import { DEFAULT_DESCRIPTION, DEFAULT_OG_IMAGE, SITE_NAME, SITE_URL } from "@/lib/site-config";
import { PRIVATE_ROBOTS } from "@/lib/seo";

const manrope = Manrope({ subsets: ["latin"], weight: ["300", "400", "500", "600", "700", "800"], variable: "--font-sans" });
const newsreader = Newsreader({
  subsets: ["latin"],
  weight: ["500", "600"],
  style: ["normal", "italic"],
  variable: "--font-heading",
});
const outfit = Outfit({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-brand" });
const X_PIXEL_ID = "rf04b";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: SITE_NAME,
  title: {
    default: `${SITE_NAME} | African Social and Creator Platform`,
    template: `%s | ${SITE_NAME}`,
  },
  description: DEFAULT_DESCRIPTION,
  category: "social networking",
  creator: SITE_NAME,
  publisher: SITE_NAME,
  referrer: "strict-origin-when-cross-origin",
  keywords: [
    "African social platform",
    "African creators",
    "live streaming",
    "private messaging",
    "social discovery",
    "services marketplace",
  ],
  robots: PRIVATE_ROBOTS,
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icon.png", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon.png", type: "image/png" }],
  },
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: SITE_NAME,
  },
  openGraph: {
    type: "website",
    locale: "en_NG",
    siteName: SITE_NAME,
    title: `${SITE_NAME} | African Social and Creator Platform`,
    description: DEFAULT_DESCRIPTION,
    url: SITE_URL,
    images: [{ url: DEFAULT_OG_IMAGE, width: 1200, height: 630, alt: "Udala African social platform" }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} | African Social and Creator Platform`,
    description: DEFAULT_DESCRIPTION,
    images: [DEFAULT_OG_IMAGE],
  },
  verification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION }
    : undefined,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn("font-sans", manrope.variable, newsreader.variable, outfit.variable)}
      suppressHydrationWarning
    >
      <head>
        <Script id="udala-pwa-install-capture" strategy="beforeInteractive">
          {`window.__udalaInstallPrompt=null;window.addEventListener('beforeinstallprompt',function(event){event.preventDefault();window.__udalaInstallPrompt=event;window.dispatchEvent(new Event('udala:pwa-install-ready'));});window.addEventListener('appinstalled',function(){window.__udalaInstallPrompt=null;window.dispatchEvent(new Event('udala:pwa-installed'));});`}
        </Script>
        <Script id="x-conversion-tracking" strategy="beforeInteractive">
          {`!function(e,t,n,s,u,a){e.twq||(s=e.twq=function(){s.exe?s.exe.apply(s,arguments):s.queue.push(arguments);},s.version='1.1',s.queue=[],u=t.createElement(n),u.async=!0,u.src='https://static.ads-twitter.com/uwt.js',a=t.getElementsByTagName(n)[0],a.parentNode.insertBefore(u,a))}(window,document,'script');twq('config','${X_PIXEL_ID}');`}
        </Script>
      </head>
      <body className="antialiased">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} storageKey="udala-theme">
          <SessionProvider>
            {children}
            <PwaInstallPrompt />
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
