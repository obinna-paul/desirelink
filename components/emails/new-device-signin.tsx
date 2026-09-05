import { Text } from "@react-email/components";

import { Callout, EmailButton, EmailLayout, eyebrow, heading, paragraph } from "@/components/emails/layout";
import { absoluteUrl } from "@/lib/site-config";

export function NewDeviceSignInEmail({ device, timestamp }: { device: string; timestamp: string }) {
  return (
    <EmailLayout preview={`New sign-in from ${device}`}>
      <Text style={eyebrow}>Security</Text>
      <Text style={heading}>New sign-in to your account</Text>
      <Text style={paragraph}>We noticed a new sign-in to your Udala account:</Text>
      <Callout>
        <strong>Device</strong> {device}
        <br />
        <strong>When</strong> {timestamp}
      </Callout>
      <Text style={paragraph}>If this was you, there&apos;s nothing to do.</Text>
      <EmailButton href={absoluteUrl("/forgot-password")}>If this wasn&apos;t you, reset your password</EmailButton>
    </EmailLayout>
  );
}
