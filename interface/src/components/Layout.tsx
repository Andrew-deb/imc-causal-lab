import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { TopBar } from "@/components/TopBar";
import { SessionContextBar } from "@/components/SessionContextBar";
import { ReactNode } from "react";
import { useLocation } from "react-router-dom";

export function Layout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const isDocs = location.pathname.startsWith("/docs");

  if (isDocs) {
    return <div className="min-h-screen w-full bg-background">{children}</div>;
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <TopBar />
          <SessionContextBar />
          <main className="flex-1 overflow-y-auto">
            <div className="p-4 sm:p-6 max-w-[1600px] mx-auto w-full">{children}</div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
