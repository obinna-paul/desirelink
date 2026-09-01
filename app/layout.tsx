import type { Metadata, Viewport } from "next";
import { Manrope, Newsreader, Outfit } from "next/font/google";
import "./globals.css";
import "@livekit/components-styles";
import { cn } from "@/lib/utils";
import { SessionProvider } from "@/components/providers/session-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { DEFAULT_DESCRIPTION, DEFAULT_OG_IMAGE, SITE_NAME, SITE_URL } from "@/lib/site-config";

const manrope = Manrope({ subsets: ["latin"], weight: ["300", "400", "500", "600", "700", "800"], variable: "--font-sans" });
const newsreader = Newsreader({
  subsets: ["latin"],
  weight: ["500", "600"],
  style: ["normal", "italic"],
  variable: "--font-heading",
});
const outfit = Outfit({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-brand" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: SITE_NAME,
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  description: DEFAULT_DESCRIPTION,
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: SITE_NAME,
  },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: DEFAULT_DESCRIPTION,
    url: SITE_URL,
    images: [{ url: DEFAULT_OG_IMAGE, width: 1200, height: 630, alt: SITE_NAME }],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: DEFAULT_DESCRIPTION,
    images: [DEFAULT_OG_IMAGE],
  },
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
      <body className="antialiased">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} storageKey="udala-theme">
          <SessionProvider>{children}</SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
