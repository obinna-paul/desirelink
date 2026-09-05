import type { CSSProperties, ReactNode } from "react";
import { Body, Column, Container, Head, Html, Img, Link, Preview, Row, Section, Text } from "@react-email/components";

import { absoluteUrl } from "@/lib/site-config";

/**
 * The real Udala brand palette and type stack, pulled directly from the live app
 * (components/auth/auth-logo.tsx, app/signup/page.tsx, app/layout.tsx) rather than
 * invented for email - these should look like they came from the same place as the
 * product itself.
 */
export const colors = {
  ink: "#211720",
  inkSoft: "#6f626b",
  bg: "#f7f1f4",
  surface: "#ffffff",
  border: "#e2d5dc",
  accent: "#8f285d",
  accentStrong: "#e91e8f",
  ctaBg: "#050505",
  infoBg: "#fff4f8",
  infoBorder: "#e0bfd0",
} as const;

export const fonts = {
  heading: "'Newsreader', Georgia, 'Times New Roman', serif",
  body: "'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
  brand: "'Outfit', -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif",
  mono: "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace",
} as const;

export const heading: CSSProperties = {
  fontFamily: fonts.heading,
  fontWeight: 600,
  fontSize: 24,
  lineHeight: "32px",
  color: colors.ink,
  margin: "0 0 16px",
};

export const paragraph: CSSProperties = {
  fontFamily: fonts.body,
  fontSize: 15,
  lineHeight: "24px",
  color: colors.ink,
  margin: "0 0 16px",
};

export const muted: CSSProperties = {
  fontFamily: fonts.body,
  fontSize: 13,
  lineHeight: "20px",
  color: colors.inkSoft,
  margin: "0 0 12px",
};

export const eyebrow: CSSProperties = {
  fontFamily: fonts.body,
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: colors.accent,
  margin: "0 0 10px",
};

export function EmailButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      style={{
        display: "inline-block",
        backgroundColor: colors.ctaBg,
        color: "#ffffff",
        fontFamily: fonts.body,
        fontWeight: 600,
        fontSize: 14,
        textDecoration: "none",
        padding: "12px 26px",
        borderRadius: 999,
      }}
    >
      {children}
    </Link>
  );
}

export function OtpCode({ code }: { code: string }) {
  return (
    <Text
      style={{
        fontFamily: fonts.mono,
        fontSize: 34,
        fontWeight: 700,
        letterSpacing: "0.3em",
        color: colors.accentStrong,
        backgroundColor: colors.infoBg,
        border: `1px solid ${colors.infoBorder}`,
        borderRadius: 12,
        textAlign: "center",
        padding: "16px 12px",
        margin: "6px 0 22px",
      }}
    >
      {code}
    </Text>
  );
}

export function Callout({ children }: { children: ReactNode }) {
  return (
    <Section
      style={{
        backgroundColor: colors.infoBg,
        border: `1px solid ${colors.infoBorder}`,
        borderRadius: 14,
        padding: "14px 18px",
        margin: "4px 0 20px",
      }}
    >
      <Text style={{ fontFamily: fonts.body, fontSize: 13, lineHeight: "20px", color: colors.ink, margin: 0 }}>
        {children}
      </Text>
    </Section>
  );
}

/**
 * The shared shell for every Udala email - logo header, a white card for the message
 * itself, and a minimal footer. Kept deliberately plain (no unsubscribe link, no
 * marketing footer) because every Phase 1 email is transactional; that changes once
 * Phase 5's digest/re-engagement emails need an opt-out.
 */
export function EmailLayout({ preview, children }: { preview: string; children: ReactNode }) {
  return (
    <Html>
      <Head>
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- this is an email
            template rendered by @react-email/render, never a Next.js page, so the
            per-page-font-loading concern that rule guards against doesn't apply here. */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Newsreader:ital,wght@0,500;0,600;1,500&family=Manrope:wght@400;500;600;700&family=Outfit:wght@600;700&display=swap"
        />
        <meta name="color-scheme" content="light" />
        <meta name="supported-color-schemes" content="light" />
      </Head>
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: colors.bg, margin: 0, padding: "32px 16px", fontFamily: fonts.body }}>
        <Container style={{ maxWidth: 480, margin: "0 auto" }}>
          <Section style={{ textAlign: "center", marginBottom: 28 }}>
            <Row style={{ width: "auto", margin: "0 auto" }}>
              <Column style={{ paddingRight: 8 }}>
                <Img
                  src={absoluteUrl("/udala-logo-light.png")}
                  width="32"
                  height="32"
                  alt="Udala"
                  style={{ borderRadius: 8, backgroundColor: "#f8edf3", display: "block" }}
                />
              </Column>
              <Column>
                <Text
                  style={{
                    fontFamily: fonts.brand,
                    fontWeight: 700,
                    fontSize: 20,
                    color: colors.ink,
                    margin: 0,
                    letterSpacing: "-0.01em",
                  }}
                >
                  udala
                </Text>
              </Column>
            </Row>
          </Section>

          <Section
            style={{
              backgroundColor: colors.surface,
              border: `1px solid ${colors.border}`,
              borderRadius: 20,
              padding: "36px 32px",
            }}
          >
            {children}
          </Section>

          <Section style={{ textAlign: "center", marginTop: 24, padding: "0 16px" }}>
            <Text style={{ fontFamily: fonts.body, fontSize: 12, lineHeight: "20px", color: colors.inkSoft, margin: 0 }}>
              Udala · Lagos, Nigeria
              <br />
              Need help? Reply to this email or write to{" "}
              <Link href="mailto:help@udala.pro" style={{ color: colors.accent }}>
                help@udala.pro
              </Link>
              .
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
