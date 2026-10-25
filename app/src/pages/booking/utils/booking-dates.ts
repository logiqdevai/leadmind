import { addDays } from "@/features/bookings/utils/booking-time";

const pad = (n: number) => String(n).padStart(2, "0");

/** First day ("YYYY-MM-01") of the month containing a "YYYY-MM-DD" key. */
export function monthStartOf(date: string): string {
    return `${date.slice(0, 7)}-01`;
}

/** Month arithmetic on "YYYY-MM-01" keys. */
export function addMonths(monthStart: string, months: number): string {
    const [y, m] = monthStart.split("-").map(Number);
    const value = new Date(Date.UTC(y, m - 1 + months, 1));
    return `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-01`;
}

/** Last day of the month that starts at `monthStart`. */
export function monthEndOf(monthStart: string): string {
    return addDays(addMonths(monthStart, 1), -1);
}

/** "November 2026" for a "YYYY-MM-01" key (timezone independent). */
export function formatMonthLabel(monthStart: string): string {
    const [y, m] = monthStart.split("-").map(Number);
    return new Intl.DateTimeFormat(undefined, { timeZone: "UTC", month: "long", year: "numeric" }).format(
        new Date(Date.UTC(y, m - 1, 1)),
    );
}

/** Visitor's browser timezone (any IANA zone), or null when the runtime cannot tell. */
export function resolveBrowserTimezone(): string | null {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
    } catch {
        return null;
    }
}

/** Only http(s) redirects are followed automatically. */
export function isSafeRedirectUrl(url: string | null | undefined): url is string {
    if (!url) return false;
    try {
        const parsed = new URL(url);
        return parsed.protocol === "https:" || parsed.protocol === "http:";
    } catch {
        return false;
    }
}
