import "server-only";

import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email/send";
import { issueOtp } from "@/lib/email/otp";
import { OtpEmail, otpEmailSubject } from "@/components/emails/otp-email";
import { PasswordChangedEmail } from "@/components/emails/password-changed";
import { AccountSuspendedEmail } from "@/components/emails/account-suspended";
import { AccountReinstatedEmail } from "@/components/emails/account-reinstated";
import { WelcomeExplorerEmail } from "@/components/emails/welcome-explorer";
import { WelcomeCreatorEmail } from "@/components/emails/welcome-creator";
import { VerificationApprovedEmail } from "@/components/emails/verification-approved";
import { VerificationDeniedEmail } from "@/components/emails/verification-denied";

const OTP_TTL_MINUTES = Number(process.env.EMAIL_OTP_TTL_MINUTES ?? 10);

function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0] || "there";
}

export async function sendSignupOtpEmail(email: string): Promise<void> {
  const code = await issueOtp(email, "signup");
  await sendEmail({
    to: email,
    subject: otpEmailSubject("signup", code),
    react: OtpEmail({ variant: "signup", code, ttlMinutes: OTP_TTL_MINUTES }),
    category: "auth",
    template: "otp-signup",
  });
}

export async function sendResendOtpEmail(email: string): Promise<void> {
  const code = await issueOtp(email, "signup");
  await sendEmail({
    to: email,
    subject: otpEmailSubject("resend", code),
    react: OtpEmail({ variant: "resend", code, ttlMinutes: OTP_TTL_MINUTES }),
    category: "auth",
    template: "otp-resend",
  });
}

export async function sendPasswordResetOtpEmail(email: string): Promise<void> {
  const code = await issueOtp(email, "password_reset");
  await sendEmail({
    to: email,
    subject: otpEmailSubject("password_reset", code),
    react: OtpEmail({ variant: "password_reset", code, ttlMinutes: OTP_TTL_MINUTES }),
    category: "auth",
    template: "otp-password-reset",
  });
}

export async function sendAddEmailOtp(email: string): Promise<void> {
  const code = await issueOtp(email, "add_email");
  await sendEmail({
    to: email,
    subject: otpEmailSubject("add_email", code),
    react: OtpEmail({ variant: "add_email", code, ttlMinutes: OTP_TTL_MINUTES }),
    category: "auth",
    template: "otp-add-email",
  });
}

export async function sendPasswordChangedEmail(email: string): Promise<void> {
  await sendEmail({
    to: email,
    subject: "Your Udala password was changed",
    react: PasswordChangedEmail({
      device: "the Udala website",
      timestamp: new Date().toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" }),
    }),
    category: "auth",
    template: "password-changed",
  });
}

/** Shared by every email sender that only has a profileId to work with - exported for
 * reuse by lib/email/billing-notifications.ts and friends rather than duplicated per file. */
export async function getAccountByProfileId(profileId: string) {
  return prisma.profile.findUnique({
    where: { id: profileId },
    select: { username: true, user: { select: { email: true } } },
  });
}

export async function sendAccountSuspendedEmail(profileId: string): Promise<void> {
  const account = await getAccountByProfileId(profileId);
  if (!account) return;
  await sendEmail({
    to: account.user.email,
    subject: "Your Udala account has been suspended",
    react: AccountSuspendedEmail(),
    category: "safety",
    template: "account-suspended",
  });
}

export async function sendAccountReinstatedEmail(profileId: string): Promise<void> {
  const account = await getAccountByProfileId(profileId);
  if (!account) return;
  await sendEmail({
    to: account.user.email,
    subject: "Your Udala account is active again",
    react: AccountReinstatedEmail(),
    category: "safety",
    template: "account-reinstated",
  });
}

export async function sendVerificationApprovedEmail(profileId: string): Promise<void> {
  const account = await getAccountByProfileId(profileId);
  if (!account) return;
  await sendEmail({
    to: account.user.email,
    subject: "You're verified on Udala",
    react: VerificationApprovedEmail({ username: account.username }),
    category: "welcome",
    template: "verification-approved",
  });
}

export async function sendVerificationDeniedEmail(profileId: string, reason: string): Promise<void> {
  const account = await getAccountByProfileId(profileId);
  if (!account) return;
  await sendEmail({
    to: account.user.email,
    subject: "About your Udala verification request",
    react: VerificationDeniedEmail({ reason }),
    category: "welcome",
    template: "verification-denied",
  });
}

/** Fires the profile-type-appropriate welcome email right after email verification
 * succeeds - see app/api/auth/verify-email/route.ts. */
export async function sendWelcomeEmail(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true, profile: { select: { profileType: true, city: true } } },
  });
  if (!user?.profile) return;

  const firstName = firstNameOf(user.name);

  if (user.profile.profileType === "CREATOR") {
    await sendEmail({
      to: user.email,
      subject: `You're in, ${firstName} — let's set up your creator profile`,
      react: WelcomeCreatorEmail({ firstName }),
      category: "welcome",
      template: "welcome-creator",
    });
  } else {
    await sendEmail({
      to: user.email,
      subject: `Welcome to Udala, ${firstName}`,
      react: WelcomeExplorerEmail({ firstName, city: user.profile.city || null }),
      category: "welcome",
      template: "welcome-explorer",
    });
  }
}
