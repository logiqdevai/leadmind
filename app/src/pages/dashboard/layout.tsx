import { useCallback, useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "@/components/layout/sidebar";
import DashboardNavbar from "@/components/layout/dashboard-navbar";
import SidebarContent from "@/components/layout/sidebar-content";
import UserMenuPopover from "@/components/layout/user-menu-popover";
import { MobileNavDrawer } from "@/components/layout/mobile-nav-drawer";
import { WebsocketProvider } from "@/components/providers/websocket-provider";
import {
  DashboardNavbarProvider,
  useDashboardNavbarSlots,
} from "@/components/providers/dashboard-navbar-provider";
import { useReminderNotifications } from "@/features/reminders/hooks/use-reminder-notifications";
import { GoalCelebrationsHost } from "@/pages/dashboard/components/goal-celebrations-host";

function DashboardShell() {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const { setSubnavEl } = useDashboardNavbarSlots();
  useReminderNotifications();
  const closeMobileNav = useCallback(() => setIsMobileNavOpen(false), []);

  return (
    <div className="flex h-full min-h-0 overflow-hidden bg-background">
      <Sidebar />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden mr-3">
        <DashboardNavbar onMenuClick={() => setIsMobileNavOpen(true)} />
        <div ref={setSubnavEl} className="mx-3 mt-2 shrink-0 empty:hidden" />
        <main className="min-h-0 flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>

      <GoalCelebrationsHost />
      <MobileNavDrawer isOpen={isMobileNavOpen} onClose={closeMobileNav}>
        <SidebarContent collapsed={false} onNavigate={closeMobileNav} />
        <div className="mt-4 pt-2 border-t border-border">
          <UserMenuPopover collapsed={false} placement="top" />
        </div>
      </MobileNavDrawer>
    </div>
  );
}

function DashboardLayoutInner() {
  return (
    <DashboardNavbarProvider>
      <DashboardShell />
    </DashboardNavbarProvider>
  );
}

export default function DashboardLayout() {
  return (
    <WebsocketProvider>
      <DashboardLayoutInner />
    </WebsocketProvider>
  );
}
