import {
    BookingLocationTypes,
    type BookingLocationType,
} from "@/features/bookings/interfaces/bookings.interfaces";
import i18n from "@/lib/i18n";

/** One-line location description for visitors, or null when there is nothing to show. */
export function describeLocation(type: BookingLocationType, details?: string | null): string | null {
    if (type === BookingLocationTypes.NONE || type === BookingLocationTypes.CUSTOM) return details || null;
    if (type === BookingLocationTypes.IN_PERSON && details) return i18n.t("booking.location.inPersonWithDetails", { details });
    return i18n.t(`booking.location.${type}`);
}
