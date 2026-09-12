import { Text } from "@react-email/components";

import { EmailButton, EmailLayout, eyebrow, heading, muted, paragraph } from "@/components/emails/layout";

/** Delivers a copy of a Spec Test result to the email address the taker typed in on the
 *  result page - transactional (they asked for it directly), no unsubscribe link, same
 *  as the OTP/password-changed emails. See lib/spec-test.ts for where specName/tagline/
 *  intro come from and docs/spec-test-quiz.md for the full quiz concept. */
export function SpecTestResultEmail({
  specName,
  tagline,
  intro,
  resultUrl,
}: {
  specName: string;
  tagline: string;
  intro: string;
  resultUrl: string;
}) {
  return (
    <EmailLayout preview={`Your spec is ${specName}`}>
      <Text style={eyebrow}>Your spec is</Text>
      <Text style={heading}>{specName}</Text>
      <Text style={paragraph}>{tagline}</Text>
      <Text style={paragraph}>{intro}</Text>
      <EmailButton href={resultUrl}>Read your full result</EmailButton>
      <Text style={{ ...muted, marginTop: 24 }}>
        Curious what everyone else&apos;s spec says about them? Meet people who match your energy on Udala.
      </Text>
    </EmailLayout>
  );
}
