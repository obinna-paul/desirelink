import { Text } from "@react-email/components";

import { EmailLayout, OtpCode, colors, eyebrow, heading, muted, paragraph } from "@/components/emails/layout";

export type OtpEmailVariant = "signup" | "resend" | "password_reset";

const COPY: Record<OtpEmailVariant, { subject: string; eyebrow: string; title: string; intro: string; footer: string }> = {
  signup: {
    subject: "Your Udala code: {code}",
    eyebrow: "Verify your email",
    title: "Confirm it's you",
    intro: "Welcome to Udala. Enter this code to verify your email and finish setting up your account:",
    footer: "If you didn't try to sign up for Udala, you can ignore this email — no account gets created without it.",
  },
  resend: {
    subject: "Your new Udala code: {code}",
    eyebrow: "New code",
    title: "Here's your new code",
    intro: "Your previous code no longer works. Use this one instead:",
    footer: "If you didn't request this, you can safely ignore this email.",
  },
  password_reset: {
    subject: "Reset your Udala password",
    eyebrow: "Reset your password",
    title: "Reset your password",
    intro: "Someone asked to reset the password on this account. If that was you, use this code:",
    footer: "If you didn't request this, your password is still safe — just ignore this email.",
  },
};

export function otpEmailSubject(variant: OtpEmailVariant, code: string): string {
  return COPY[variant].subject.replace("{code}", code);
}

export function OtpEmail({ variant, code, ttlMinutes }: { variant: OtpEmailVariant; code: string; ttlMinutes: number }) {
  const copy = COPY[variant];

  return (
    <EmailLayout preview={`Your code is ${code} — expires in ${ttlMinutes} minutes.`}>
      <Text style={eyebrow}>{copy.eyebrow}</Text>
      <Text style={heading}>{copy.title}</Text>
      <Text style={paragraph}>{copy.intro}</Text>
      <OtpCode code={code} />
      <Text style={muted}>
        This code expires in {ttlMinutes} minutes and works once.
        <br />
        {copy.footer}
      </Text>
      <Text style={{ ...muted, marginTop: 20, color: colors.inkSoft }}>— The Udala Team</Text>
    </EmailLayout>
  );
}
