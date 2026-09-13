import { Text } from "@react-email/components";

import { EmailButton, EmailLayout, eyebrow, heading, muted, paragraph } from "@/components/emails/layout";

/** Delivers a copy of a Spec Test result to the email address the taker typed in on the
 *  result page - transactional (they asked for it directly), no unsubscribe link, same
 *  as the OTP/password-changed emails. Renders both instrument versions: `secondaryLine`
 *  is only ever passed for a v2 result (see lib/email/spec-test-notifications.ts), since
 *  v1 never computed a secondary spec. See lib/spec-test/results.ts for where this content
 *  comes from and docs/spec-test-research.md for the v2 quiz concept. */
export function SpecTestResultEmail({
  specName,
  tagline,
  intro,
  secondaryLine,
  resultUrl,
}: {
  specName: string;
  tagline: string;
  intro: string;
  secondaryLine?: string;
  resultUrl: string;
}) {
  return (
    <EmailLayout preview={`Your spec is ${specName}`}>
      <Text style={eyebrow}>Your spec is</Text>
      <Text style={heading}>{specName}</Text>
      <Text style={paragraph}>{tagline}</Text>
      <Text style={paragraph}>{intro}</Text>
      {secondaryLine && <Text style={muted}>{secondaryLine}</Text>}
      <EmailButton href={resultUrl}>Read your full result</EmailButton>
      <Text style={{ ...muted, marginTop: 24 }}>
        Curious what everyone else&apos;s spec says about them? Meet people who match your energy on Udala.
      </Text>
    </EmailLayout>
  );
}
