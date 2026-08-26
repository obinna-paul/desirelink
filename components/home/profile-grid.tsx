import { ProfileCard } from "@/components/home/profile-card";
import type { ProfileCardData } from "@/lib/home-feed";

export function ProfileGrid({
  profiles,
  emptyMessage,
}: {
  profiles: ProfileCardData[];
  emptyMessage: string;
}) {
  if (profiles.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/60 bg-card/60 p-8 text-center text-sm text-muted-foreground md:rounded-xl md:p-10">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:gap-4 2xl:grid-cols-3">
      {profiles.map((profile) => (
        <ProfileCard key={profile.id} profile={profile} />
      ))}
    </div>
  );
}
