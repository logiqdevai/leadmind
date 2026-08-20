import type { FC, ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Routes } from "@/routes/routes";
import { DashboardSubnav } from "@/components/providers/dashboard-navbar-provider";
import { cn } from "@/lib/utils";

interface ListDetailToolbarProps {
    title: string;
    meta?: string;
    actions?: ReactNode;
    className?: string;
    backHref?: string;
    backLabel?: string;
}

export const ListDetailToolbar: FC<ListDetailToolbarProps> = ({
    title,
    meta,
    actions,
    className,
    backHref = Routes.dashboard.lists,
    backLabel = "Back to lists",
}) => (
    <DashboardSubnav>
        <div
            className={cn(
                "flex items-center gap-3 px-0.5 py-1.5",
                className,
            )}
        >
            <Link
                to={backHref}
                className={cn(
                    "inline-flex size-9 shrink-0 items-center justify-center rounded-lg",
                    "text-muted hover:text-foreground hover:bg-surface-secondary",
                    "transition-colors duration-200",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                )}
                aria-label={backLabel}
            >
                <ArrowLeft className="size-4" strokeWidth={2} />
            </Link>

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
