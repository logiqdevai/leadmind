import type { FC, ReactNode } from "react";
import { DashboardSubnav } from "@/components/providers/dashboard-navbar-provider";
import { cn } from "@/lib/utils";

interface ContactsToolbarProps {
    title?: string;
    meta?: string;
    actions?: ReactNode;
    className?: string;
}

export const ContactsToolbar: FC<ContactsToolbarProps> = ({
    title = "Contacts",
    meta,
    actions,
    className,
}) => (
    <DashboardSubnav>
        <div
            className={cn(
                "flex items-center gap-3 px-0.5 py-1.5",
                className,
            )}
        >
            <div className="min-w-0 flex-1">
                <h1 className="text-lg font-semibold tracking-tight text-foreground truncate leading-snug">
                    {title}
                </h1>
                {meta ? (
                    <p className="text-sm text-muted truncate mt-0.5 leading-none">{meta}</p>
                ) : null}
            </div>

            {actions ? <div className="shrink-0 flex items-center gap-2">{actions}</div> : null}
        </div>
    </DashboardSubnav>
);
