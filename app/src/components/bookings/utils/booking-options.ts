import { BOOKING_LOCATION_LABELS } from "@/features/bookings/constants/booking-labels";
import { BookingLocationTypes, type BookingLocationType } from "@/features/bookings/interfaces/bookings.interfaces";

export interface SimpleOption {
    id: string;
    label: string;
}

export const LOCATION_TYPE_OPTIONS: SimpleOption[] = Object.values(BookingLocationTypes).map((id) => ({
    id,
    label: BOOKING_LOCATION_LABELS[id],
}));

/** Placeholder for the free-text location value of each location type ("" = no value needed). */
export const LOCATION_VALUE_PLACEHOLDERS: Record<BookingLocationType, string> = {
    [BookingLocationTypes.NONE]: "",
    [BookingLocationTypes.GOOGLE_MEET]: "",
    [BookingLocationTypes.PHONE]: "Phone number to call (optional)",
    [BookingLocationTypes.IN_PERSON]: "Address",
    [BookingLocationTypes.CUSTOM]: "Meeting link or instructions",
};

