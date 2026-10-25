import type { ElementType, FC } from "react";
import { CalendarCheck2, CalendarDays, CheckCircle2, Clock, UserX, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { BookingStatuses, type BookingStats } from "@/features/bookings/interfaces/bookings.interfaces";

interface StatTileProps {
    label: string;
    value: number | undefined;
    icon: ElementType;
    tone: string;
}

const StatTile: FC<StatTileProps> = ({ label, value, icon: Icon, tone }) => (
    <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-surface px-3 py-2.5">
        <span className={cn("inline-flex size-8 shrink-0 items-center justify-center rounded-lg", tone)}>
            <Icon className="size-4" />
        </span>
        <div className="min-w-0">
            <p className="text-lg font-semibold leading-none tabular-nums text-foreground">{value ?? 0}</p>
            <p className="mt-0.5 truncate text-xs text-muted">{label}</p>
        </div>
    </div>
);

interface CalendarStatsRowProps {
    stats: BookingStats | undefined;
    isLoading: boolean;
}

export const CalendarStatsRow: FC<CalendarStatsRowProps> = ({ stats, isLoading }) => {
    if (isLoading && !stats) {
        return (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-[58px] rounded-xl bg-surface-secondary animate-pulse" />
                ))}
            </div>
        );
    }
    const by = stats?.by_status ?? {};
    return (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
            <StatTile label="Total" value={stats?.total} icon={CalendarDays} tone="bg-surface-secondary text-foreground" />
            <StatTile label="Confirmed" value={(by.CONFIRMED ?? 0) + (by.RESCHEDULED ?? 0)} icon={CalendarCheck2} tone="bg-accent/10 text-accent" />
            <StatTile label="Pending" value={by[BookingStatuses.PENDING]} icon={Clock} tone="bg-warning/10 text-warning" />
            <StatTile label="Cancelled" value={by[BookingStatuses.CANCELLED]} icon={XCircle} tone="bg-danger/10 text-danger" />
            <StatTile label="Completed" value={by[BookingStatuses.COMPLETED]} icon={CheckCircle2} tone="bg-success/10 text-success" />
            <StatTile label="No-show" value={by[BookingStatuses.NO_SHOW]} icon={UserX} tone="bg-surface-secondary text-muted" />
        </div>
    );
};
