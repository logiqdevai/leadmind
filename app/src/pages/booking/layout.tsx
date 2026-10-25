import type { FC } from "react";
import { Outlet } from "react-router-dom";
import { AppLogo } from "@/components/layout/app-logo";
import { environments } from "@/config/environments";

/** Public shell for booking pages: no app chrome, page scrolls itself (html/body are overflow hidden). */
const PublicBookingLayout: FC = () => (
    <div className="h-full min-h-0 overflow-y-auto bg-background text-foreground">
        <div className="flex min-h-full flex-col">
            <main className="flex flex-1 justify-center px-4 py-6 sm:py-10">
                <div className="w-full max-w-4xl">
                    <Outlet />
                </div>
            </main>
            <footer className="flex items-center justify-center gap-2 px-4 pb-6 text-xs text-muted">
                <AppLogo className="size-4" />
                <span>Powered by {environments.APP_NAME}</span>
            </footer>
        </div>
    </div>
);

export default PublicBookingLayout;
