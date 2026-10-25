import type { FC } from "react";
import { Ban, Video } from "lucide-react";
import { cn } from "@/lib/utils";
import { BOOKING_STATUS_BLOCK_CLASSES } from "@/features/bookings/constants/booking-labels";
import type { Booking, BookingBlock } from "@/features/bookings/interfaces/bookings.interfaces";
import { formatTime, formatTimeRange } from "@/features/bookings/utils/booking-time";
import { bookingDisplayName } from "@/components/bookings/utils/booking-display";
import { BLOCKED_HATCH_CLASS, blockLabel } from "../utils/calendar-blocks";

interface BookingEventButtonProps {
    booking: Booking;
    timezone: string;
    onSelect: (uuid: string) => void;
    /** Compact single line (month cells). */
    compact?: boolean;
    showMember?: boolean;
    className?: string;
}

export const BookingEventButton: FC<BookingEventButtonProps> = ({
    booking,
    timezone,
    onSelect,
    compact,
    showMember = true,
    className,
}) => {
    const name = bookingDisplayName(booking);
    const member = booking.assigned_user?.full_name ?? booking.assigned_user?.email ?? null;
    return (
        <button
            type="button"
            onClick={(e) => {
                e.stopPropagation();
                onSelect(booking.uuid);
            }}
            title={`${formatTimeRange(booking.start_at, booking.end_at, timezone)} · ${name}${member ? ` · ${member}` : ""}`}
            className={cn(
                "w-full min-w-0 overflow-hidden rounded-md border text-left transition-[filter] duration-200 hover:brightness-110",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                BOOKING_STATUS_BLOCK_CLASSES[booking.status],
                compact ? "flex items-center gap-1 px-1.5 py-0.5 text-[11px]" : "flex flex-col px-2 py-1 text-xs",
                className,
            )}
        >
            {compact ? (
                <>
                    <span className="shrink-0 tabular-nums opacity-80">{formatTime(booking.start_at, timezone)}</span>
                    <span className="truncate font-medium">{name}</span>
                </>
            ) : (
                <>
                    <span className="flex min-w-0 items-center gap-1">
                        <span className="truncate font-semibold">{name}</span>
                        {booking.meeting_url ? <Video className="size-3 shrink-0 opacity-70" /> : null}
                    </span>
                    <span className="truncate tabular-nums opacity-80">
                        {formatTimeRange(booking.start_at, booking.end_at, timezone)}
                    </span>
                    {showMember && member ? <span className="truncate opacity-70">{member}</span> : null}
                </>
            )}
        </button>
    );
};

interface BlockedEventProps {
    block: BookingBlock;
    timezone: string;
    onSelect: (block: BookingBlock) => void;
    compact?: boolean;
    className?: string;
}

export const BlockedEvent: FC<BlockedEventProps> = ({ block, timezone, onSelect, compact, className }) => (
    <button
        type="button"
        onClick={(e) => {
            e.stopPropagation();
            onSelect(block);
        }}
        title={`${formatTimeRange(block.start_at, block.end_at, timezone)} · ${blockLabel(block)}`}
        className={cn(
            "flex w-full min-w-0 items-start gap-1 overflow-hidden rounded-md border border-dashed border-border text-left text-muted",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
            BLOCKED_HATCH_CLASS,
            compact ? "px-1.5 py-0.5 text-[11px]" : "px-2 py-1 text-xs",
            className,
        )}
    >
        <Ban className="mt-px size-3 shrink-0" />
        <span className="truncate">{blockLabel(block)}</span>
    </button>
);
