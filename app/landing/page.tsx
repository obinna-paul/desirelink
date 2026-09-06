import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { absoluteUrl, DEFAULT_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site-config";
import { publicPageMetadata, serializeJsonLd } from "@/lib/seo";

const PAGE_TITLE = `${SITE_NAME} | African Social and Creator Platform`;

export const metadata: Metadata = {
  ...publicPageMetadata({
    title: PAGE_TITLE,
    description: DEFAULT_DESCRIPTION,
    path: "/landing",
  }),
  title: { absolute: PAGE_TITLE },
};

export default function LandingPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: SITE_NAME,
        url: SITE_URL,
        logo: {
          "@type": "ImageObject",
          url: absoluteUrl("/icon.png"),
        },
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: SITE_URL,
        name: SITE_NAME,
        alternateName: "Udala social platform",
        description: DEFAULT_DESCRIPTION,
        publisher: { "@id": `${SITE_URL}/#organization` },
        inLanguage: "en",
      },
      {
        "@type": "WebPage",
        "@id": `${absoluteUrl("/landing")}#webpage`,
        url: absoluteUrl("/landing"),
        name: PAGE_TITLE,
        description: DEFAULT_DESCRIPTION,
        isPartOf: { "@id": `${SITE_URL}/#website` },
        about: { "@id": `${SITE_URL}/#organization` },
        inLanguage: "en",
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
      <AuthShell
        title="Log in to Udala"
        description="Continue to your private social space, messages, and communities."
        hideLogoIcon
        hideFooter
      >
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </AuthShell>
    </>
  );
}
