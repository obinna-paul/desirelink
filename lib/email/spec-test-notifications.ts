import "server-only";

import { sendEmail } from "@/lib/email/send";
import { SpecTestResultEmail } from "@/components/emails/spec-test-result";
import type { SpecTestReading } from "@/lib/spec-test";
import { absoluteUrl } from "@/lib/site-config";

/** Branches on the reading's version so the route calling this never has to know which
 *  instrument produced the result - a v1 reading sends its original name/tagline/intro; a
 *  v2 reading adds the secondary-spec line (report §7's "secondary influence" module) that
 *  v1 never computed. */
export async function sendSpecTestResultEmail(email: string, reading: SpecTestReading, resultId: string): Promise<boolean> {
  const resultUrl = absoluteUrl(`/spec-test/result/${resultId}`);

  if (reading.version === "v1") {
    return sendEmail({
      to: email,
      subject: `Your spec is ${reading.reading.name}`,
      react: SpecTestResultEmail({
        specName: reading.reading.name,
        tagline: reading.reading.tagline,
        intro: reading.reading.intro,
        resultUrl,
      }),
      category: "leads",
      template: "spec-test-result",
    });
  }

  return sendEmail({
    to: email,
    subject: `Your spec is ${reading.copy.headline.name}`,
    react: SpecTestResultEmail({
      specName: reading.copy.headline.name,
      tagline: reading.copy.headline.tagline,
      intro: reading.copy.corePull,
      secondaryLine: reading.copy.secondaryInfluence,
      resultUrl,
    }),
    category: "leads",
    template: "spec-test-result",
  });
}
