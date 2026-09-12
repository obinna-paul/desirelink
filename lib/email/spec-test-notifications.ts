import "server-only";

import { sendEmail } from "@/lib/email/send";
import { SpecTestResultEmail } from "@/components/emails/spec-test-result";
import type { SpecTypeReading } from "@/lib/spec-test";
import { absoluteUrl } from "@/lib/site-config";

export async function sendSpecTestResultEmail(
  email: string,
  reading: SpecTypeReading,
  resultId: string,
): Promise<boolean> {
  return sendEmail({
    to: email,
    subject: `Your spec is ${reading.name}`,
    react: SpecTestResultEmail({
      specName: reading.name,
      tagline: reading.tagline,
      intro: reading.intro,
      resultUrl: absoluteUrl(`/spec-test/result/${resultId}`),
    }),
    category: "leads",
    template: "spec-test-result",
  });
}
