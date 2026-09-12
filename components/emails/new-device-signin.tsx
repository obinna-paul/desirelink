import { Text } from "@react-email/components";

import { Callout, EmailButton, EmailLayout, eyebrow, heading, paragraph } from "@/components/emails/layout";
import { absoluteUrl } from "@/lib/site-config";

export function NewDeviceSignInEmail({ device, timestamp }: { device: string; timestamp: string }) {
  return (
    <EmailLayout preview={`From ${device} — wasn't you? Reset your password`}>
      <Text style={eyebrow}>Security</Text>
      <Text style={heading}>New sign-in to your account</Text>
      <Text style={paragraph}>New sign-in to your account.</Text>
      <Callout>
        <strong>Device</strong> {device}
        <br />
        <strong>When</strong> {timestamp}
      </Callout>
      <Text style={paragraph}>If this was you, there&apos;s nothing to do.</Text>
      <EmailButton href={absoluteUrl("/forgot-password")}>Wasn&apos;t you? Reset your password</EmailButton>
    </EmailLayout>
  );
}
