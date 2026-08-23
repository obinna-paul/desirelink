import { TopBar } from "@/components/layout/top-bar";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { BottomNav } from "@/components/layout/bottom-nav";
import { RightRail } from "@/components/layout/right-rail";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <TopBar />
      <div className="mx-auto flex w-full max-w-[1600px]">
        <SidebarNav />
        <main className="min-w-0 flex-1 px-4 py-6 pb-24 md:px-6 md:pb-6">
          {children}
        </main>
        <RightRail />
      </div>
      <BottomNav />
    </div>
  );
}
