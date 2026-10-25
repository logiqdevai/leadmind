import {
    BookingLocationTypes,
    type BookingLocationType,
} from "@/features/bookings/interfaces/bookings.interfaces";
import { BOOKING_LOCATION_LABELS } from "@/features/bookings/constants/booking-labels";

/** One-line location description for visitors, or null when there is nothing to show. */
export function describeLocation(type: BookingLocationType, details?: string | null): string | null {
    if (type === BookingLocationTypes.NONE || type === BookingLocationTypes.CUSTOM) return details || null;
    if (type === BookingLocationTypes.IN_PERSON && details) return `${BOOKING_LOCATION_LABELS[type]}: ${details}`;
    return BOOKING_LOCATION_LABELS[type];
}
