import type { AvailabilityStatusType } from "@prisma/client";

export const AVAILABILITY_STATUS_OPTIONS: { value: AvailabilityStatusType; label: string }[] = [
  { value: "available_tonight", label: "Available tonight" },
  { value: "open_to_meeting", label: "Open to meeting" },
  { value: "chatting_only", label: "Chatting only" },
  { value: "couple_looking", label: "Couple looking" },
  { value: "out_tonight", label: "Out tonight" },
];

export const AVAILABILITY_STATUS_LABELS: Record<AvailabilityStatusType, string> = {
  available_tonight: "Available tonight",
  out_tonight: "Out tonight",
  open_to_meeting: "Open to meeting",
  chatting_only: "Chatting only",
  couple_looking: "Couple looking",
};

export const AVAILABILITY_DURATION_OPTIONS: { hours: number; label: string }[] = [
  { hours: 1, label: "1 hour" },
  { hours: 3, label: "3 hours" },
  { hours: 6, label: "6 hours" },
  { hours: 12, label: "12 hours" },
  { hours: 24, label: "24 hours" },
];

export const DEFAULT_AVAILABILITY_DURATION_HOURS = 12;
