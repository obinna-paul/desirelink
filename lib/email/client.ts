import "server-only";

import { Resend } from "resend";

/**
 * Null when RESEND_API_KEY isn't set (local dev, CI) so sendEmail can log-and-skip
 * instead of throwing - nothing that sends an email should ever require Resend to be
 * configured just to run the rest of the app locally.
 */
export const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export const EMAIL_SENDERS = {
  hey: { name: "Udala", address: "hey@udala.pro" },
  help: { name: "Udala Support", address: "help@udala.pro" },
  paul: { name: "Paul at Udala", address: "paul@udala.pro" },
} as const;

export type EmailSenderKey = keyof typeof EMAIL_SENDERS;
