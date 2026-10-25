import type { FC } from "react";
import { Chip } from "@heroui/react";
import { CalendarCheck, Clock, ExternalLink, MapPin } from "lucide-react";
import { CopyButton } from "@/components/ui/copy-button";
import { BOOKING_LOCATION_LABELS } from "@/features/bookings/constants/booking-labels";
import type { BookingPage } from "@/features/bookings/interfaces/bookings.interfaces";
import { formatDuration } from "@/features/bookings/utils/booking-time";
import { DashboardAvatar } from "@/pages/dashboard/components/dashboard-shared";

const MAX_AVATARS = 4;

interface BookingPageCardProps {
    page: BookingPage;
    onOpen: () => void;
}

export const BookingPageCard: FC<BookingPageCardProps> = ({ page, onOpen }) => {
    const durations = [...new Set([page.duration_minutes, ...(page.duration_options ?? [])])].sort((a, b) => a - b);
    const memberNames = page.members.map((m) => m.user.full_name?.trim() || m.user.email);
    const bookingCount = page._count?.bookings ?? 0;

    return (
        <article
            role="button"
            tabIndex={0}
            onClick={onOpen}
            onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onOpen();
                }
            }}
            className="flex cursor-pointer flex-col gap-4 rounded-2xl border border-border/80 bg-surface p-4 text-left transition-colors duration-200 hover:border-accent/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
            <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                    <CalendarCheck className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                        <h3 className="truncate text-sm font-semibold text-foreground">{page.name}</h3>
                        <Chip size="sm" variant="soft" color={page.is_active ? "success" : "default"}>
                            <Chip.Label>{page.is_active ? "Active" : "Inactive"}</Chip.Label>
                        </Chip>
                        {page.is_default ? (
                            <Chip size="sm" variant="soft" color="accent">
                                <Chip.Label>Default</Chip.Label>
                            </Chip>
                        ) : null}
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                        <span className="inline-flex items-center gap-1">
                            <Clock className="size-3.5" />
                            {durations.map(formatDuration).join(" / ")}
                        </span>
                        <span className="inline-flex items-center gap-1">
                            <MapPin className="size-3.5" />
                            {BOOKING_LOCATION_LABELS[page.location_type]}
                        </span>
                    </div>
                </div>
            </div>

            <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                    <div className="flex -space-x-2">
                        {memberNames.slice(0, MAX_AVATARS).map((name, i) => (
                            <span key={`${name}-${i}`} className="rounded-full ring-2 ring-surface" title={name}>
                                <DashboardAvatar name={name} />
                            </span>
                        ))}
                    </div>
                    <span className="truncate text-xs text-muted">
                        {memberNames.length === 0
                            ? "No team members"
                            : memberNames.length <= 2
                              ? memberNames.join(", ")
                              : `${memberNames.slice(0, 2).join(", ")} +${memberNames.length - 2}`}
                    </span>
                </div>
                <span className="shrink-0 text-xs text-muted tabular-nums">
                    {bookingCount} booking{bookingCount === 1 ? "" : "s"}
                </span>
            </div>

            {page.public_url ? (
                <div
                    className="flex items-center gap-1 rounded-lg bg-surface-secondary/40 px-2 py-1"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                    role="presentation"
                >
                    <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted" title={page.public_url}>
                        {page.public_url}
                    </span>
                    <CopyButton value={page.public_url} label="booking link" />
                    <a
                        href={page.public_url}
                        target="_blank"
                        rel="noreferrer"
                        aria-label="Open public page"
                        className="inline-flex size-7 items-center justify-center rounded-md text-muted hover:text-foreground"
                    >
                        <ExternalLink className="size-3.5" />
                    </a>
                </div>
            ) : null}
        </article>
    );
};
