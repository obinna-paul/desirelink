import { Text } from "@react-email/components";

import { EmailButton, EmailLayout, eyebrow, heading, paragraph } from "@/components/emails/layout";
import { absoluteUrl } from "@/lib/site-config";

type WeeklyDigestProps =
  | {
      variant: "creator";
      likeCount: number;
      commentCount: number;
      newSubscriberCount: number;
      topPostCaption: string | null;
      unsubscribeUrl: string;
    }
  | {
      variant: "explorer";
      newCreatorCount: number;
      unsubscribeUrl: string;
    };

export function WeeklyDigestEmail(props: WeeklyDigestProps) {
  if (props.variant === "creator") {
    return (
      <EmailLayout
        preview={`This week: ${props.likeCount} likes, ${props.newSubscriberCount} new subscribers`}
        unsubscribeUrl={props.unsubscribeUrl}
      >
        <Text style={eyebrow}>Your week</Text>
        <Text style={heading}>Your week on Udala</Text>
        <Text style={paragraph}>
          This week: <strong>{props.likeCount}</strong> likes, <strong>{props.commentCount}</strong> comments,{" "}
          <strong>{props.newSubscriberCount}</strong> new subscribers.
        </Text>
        {props.topPostCaption && (
          <Text style={paragraph}>
            <strong>Top post:</strong> {props.topPostCaption}
          </Text>
        )}
        <EmailButton href={absoluteUrl("/create")}>Post something new</EmailButton>
      </EmailLayout>
    );
  }

  return (
    <EmailLayout preview={`${props.newCreatorCount} new creators joined this week`} unsubscribeUrl={props.unsubscribeUrl}>
      <Text style={eyebrow}>Your week</Text>
      <Text style={heading}>Your week on Udala</Text>
      <Text style={paragraph}>
        <strong>{props.newCreatorCount}</strong> new creators joined this week.
      </Text>
      <EmailButton href={absoluteUrl("/")}>See what&apos;s new</EmailButton>
    </EmailLayout>
  );
}
