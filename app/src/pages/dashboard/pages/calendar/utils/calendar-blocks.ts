import type { BookingBlock } from "@/features/bookings/interfaces/bookings.interfaces";

/** Neutral hatch for unavailable periods. */
export const BLOCKED_HATCH_CLASS =
    "bg-surface-secondary/50 [background-image:repeating-linear-gradient(135deg,var(--border)_0,var(--border)_1px,transparent_1px,transparent_8px)]";

export const blockLabel = (block: BookingBlock): string => {
    const who = block.user_uuid ? (block.user?.full_name ?? block.user?.email ?? "Member") : "Everyone";
    return block.reason ? `${block.reason} · ${who}` : `Blocked · ${who}`;
};
