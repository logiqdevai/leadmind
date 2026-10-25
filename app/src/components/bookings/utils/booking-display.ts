import { Routes } from "@/routes/routes";
import {
    ACTIVE_BOOKING_STATUSES,
    type Booking,
} from "@/features/bookings/interfaces/bookings.interfaces";

const pad = (n: number) => String(n).padStart(2, "0");

/** Minutes since local midnight (0..1439) of an instant as seen in `timeZone`. */
export function minutesOfDayInZone(instant: string | Date, timeZone: string): number {
    const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone,
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
    }).formatToParts(new Date(instant));
    const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
    const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
    return (hour % 24) * 60 + minute;
}

/** Wall-clock "HH:MM" (24h) of an instant in `timeZone`. */
export function timeKeyInZone(instant: string | Date, timeZone: string): string {
    const minutes = minutesOfDayInZone(instant, timeZone);
    return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

export function bookingDisplayName(booking: Pick<Booking, "invitee_name" | "contact">): string {
    return booking.contact?.name || booking.invitee_name || booking.contact?.email || "Invitee";
}

export function contactDetailHref(contactUuid: string): string {
    return Routes.dashboard.contacts_detail.replace(":uuid", contactUuid);
}

export function isBookingActive(booking: Pick<Booking, "status">): boolean {
    return ACTIVE_BOOKING_STATUSES.includes(booking.status);
}

export function hasBookingStarted(booking: Pick<Booking, "start_at">, now: Date = new Date()): boolean {
    return new Date(booking.start_at).getTime() <= now.getTime();
}
