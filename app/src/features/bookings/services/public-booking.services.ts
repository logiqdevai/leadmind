import axios from "axios";
import { ApiRoutes } from "@/config/api/routes";
import { environments } from "@/config/environments";
import { bookingApiErrorMessage } from "../utils/booking-api-error";
import type {
    PublicBookingPage,
    PublicBookingResult,
    PublicCreateBookingDto,
    PublicManagedBooking,
    SlotsByDate,
    SlotsQuery,
} from "../interfaces/bookings.interfaces";

// Public pages are used by visitors without an account: plain axios, so no auth header or
// logout-on-401 interceptor is involved (same approach as the unsubscribe page).
const publicUrl = (path: string) => `${environments.API_URL.replace(/\/$/, "")}${path}`;

const withCause = (error: unknown, fallback: string) =>
    new Error(bookingApiErrorMessage(error, fallback), {
        cause: (error as { response?: { data?: unknown } })?.response?.data,
    });

export const getPublicBookingPage = async (code: string): Promise<PublicBookingPage> => {
    try {
        const response = await axios.get(publicUrl(ApiRoutes.public_bookings.page(code)));
        return response.data;
    } catch (error) {
        throw withCause(error, "This booking link is not available.");
    }
};

export const getPublicBookingSlots = async (
    code: string,
    query: Omit<SlotsQuery, "exclude_booking_uuid">,
): Promise<SlotsByDate> => {
    try {
        const response = await axios.get(publicUrl(ApiRoutes.public_bookings.slots(code)), { params: query });
        return response.data;
    } catch (error) {
        throw withCause(error, "Could not load available times.");
    }
};

export const createPublicBooking = async (code: string, payload: PublicCreateBookingDto): Promise<PublicBookingResult> => {
    try {
        const response = await axios.post(publicUrl(ApiRoutes.public_bookings.book(code)), payload);
        return response.data;
    } catch (error) {
        throw withCause(error, "Could not complete your booking. Please try again.");
    }
};

export const getManagedBooking = async (token: string): Promise<PublicManagedBooking> => {
    try {
        const response = await axios.get(publicUrl(ApiRoutes.public_bookings.manage(token)));
        return response.data;
    } catch (error) {
        throw withCause(error, "This booking could not be found.");
    }
};

export const getManagedBookingSlots = async (
    token: string,
    query: Pick<SlotsQuery, "from" | "to" | "timezone">,
): Promise<SlotsByDate> => {
    try {
        const response = await axios.get(publicUrl(ApiRoutes.public_bookings.manage_slots(token)), { params: query });
        return response.data;
    } catch (error) {
        throw withCause(error, "Could not load available times.");
    }
};

export const cancelManagedBooking = async (token: string, reason?: string): Promise<PublicManagedBooking> => {
    try {
        const response = await axios.post(publicUrl(ApiRoutes.public_bookings.cancel(token)), { reason });
        return response.data;
    } catch (error) {
        throw withCause(error, "Could not cancel this booking.");
    }
};

export const rescheduleManagedBooking = async (
    token: string,
    payload: { start_at: string; timezone?: string },
): Promise<PublicManagedBooking> => {
    try {
        const response = await axios.post(publicUrl(ApiRoutes.public_bookings.reschedule(token)), payload);
        return response.data;
    } catch (error) {
        throw withCause(error, "Could not reschedule this booking.");
    }
};
