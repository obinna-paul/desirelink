import { TopBar } from "@/components/layout/top-bar";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { BottomNav } from "@/components/layout/bottom-nav";
import { RightRail } from "@/components/layout/right-rail";
import { PresencePing } from "@/components/layout/presence-ping";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white dark:bg-background md:bg-background">
      <PresencePing />
      <TopBar />
      <div className="mx-auto flex w-full max-w-[1600px]">
        <SidebarNav />
        <main className="mx-auto min-w-0 flex-1 px-3 py-4 pb-[calc(5rem+env(safe-area-inset-bottom))] md:mx-0 md:px-7 md:pb-7 md:pt-4">
          {children}
        </main>
        <RightRail />
      </div>
      <BottomNav />
    </div>
  );
}
