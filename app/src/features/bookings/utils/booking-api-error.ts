import axios from "axios";

/** Human-readable message from a Nest error body (string or validation message list). */
export function bookingApiErrorMessage(error: unknown, fallback: string): string {
    if (!axios.isAxiosError(error)) return fallback;
    const data = error.response?.data as { message?: string | string[] } | undefined;
    if (!data?.message) return fallback;
    return Array.isArray(data.message) ? data.message.join(", ") : data.message;
}

/** The API answers 409 with code "slot_unavailable" when someone else just took the slot. */
export function isSlotUnavailableError(error: unknown): boolean {
    return error instanceof Error && (error.cause as { code?: string } | undefined)?.code === "slot_unavailable";
}
