import { Text } from "@react-email/components";

import { EmailLayout, OtpCode, colors, eyebrow, heading, muted, paragraph } from "@/components/emails/layout";

export type OtpEmailVariant = "signup" | "resend" | "password_reset" | "add_email";

const COPY: Record<
  OtpEmailVariant,
  { subject: string; preview: string; eyebrow: string; title: string; intro: string; footer: string }
> = {
  add_email: {
    subject: "Confirm your email",
    preview: "Enter this code to confirm this address on your account",
    eyebrow: "Confirm your email",
    title: "Confirm this address",
    intro: "Use this code to confirm this address on your account:",
    footer: "Didn't request this? Ignore it.",
  },
  signup: {
    subject: "Your code: {code}",
    preview: "Enter it to verify your email and finish setting up your account",
    eyebrow: "Verify your email",
    title: "Confirm it's you",
    intro: "Enter this to verify your email and finish setting up your account:",
    footer: "Didn't try to sign up? Ignore this — no account gets created without the code.",
  },
  resend: {
    subject: "Your new code: {code}",
    preview: "Your last code expired — here's a fresh one",
    eyebrow: "New code",
    title: "Here's your new code",
    intro: "Your last code expired. Use this one:",
    footer: "Didn't request this? Ignore it.",
  },
  password_reset: {
    subject: "Reset your password",
    preview: "Someone asked to reset the password on this account",
    eyebrow: "Reset your password",
    title: "Reset your password",
    intro: "Someone asked to reset the password on this account. If that was you, use this code:",
    footer: "Didn't request this? Your password's untouched — just ignore this.",
  },
};

export function otpEmailSubject(variant: OtpEmailVariant, code: string): string {
  return COPY[variant].subject.replace("{code}", code);
}

export function OtpEmail({ variant, code, ttlMinutes }: { variant: OtpEmailVariant; code: string; ttlMinutes: number }) {
  const copy = COPY[variant];

  return (
    <EmailLayout preview={copy.preview}>
      <Text style={eyebrow}>{copy.eyebrow}</Text>
      <Text style={heading}>{copy.title}</Text>
      <Text style={paragraph}>{copy.intro}</Text>
      <OtpCode code={code} />
      <Text style={muted}>
        This code expires in {ttlMinutes} minutes and works once.
        <br />
        {copy.footer}
      </Text>
      <Text style={{ ...muted, marginTop: 20, color: colors.inkSoft }}>— Udala</Text>
    </EmailLayout>
  );
}
