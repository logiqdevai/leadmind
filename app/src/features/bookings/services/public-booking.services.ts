import axios from "axios";
import { ApiRoutes } from "@/config/api/routes";
import { environments } from "@/config/environments";
import { bookingApiErrorMessage } from "../utils/booking-api-error";
import type {
    PublicBookingPage,
    PublicBookingResult,
    PublicCreateBookingDto,
    PublicManagedBooking,
    PublicPageRef,
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

const pageRoutes = (ref: PublicPageRef) =>
    "code" in ref
        ? {
              page: ApiRoutes.public_bookings.page(ref.code),
              slots: ApiRoutes.public_bookings.slots(ref.code),
              book: ApiRoutes.public_bookings.book(ref.code),
          }
        : {
              page: ApiRoutes.public_bookings.slug_page(ref.organisation, ref.slug),
              slots: ApiRoutes.public_bookings.slug_slots(ref.organisation, ref.slug),
              book: ApiRoutes.public_bookings.slug_book(ref.organisation, ref.slug),
          };

export const getPublicBookingPage = async (ref: PublicPageRef): Promise<PublicBookingPage> => {
    try {
        const response = await axios.get(publicUrl(pageRoutes(ref).page));
        return response.data;
    } catch (error) {
        throw withCause(error, "This booking link is not available.");
    }
};

export const getPublicBookingSlots = async (
    ref: PublicPageRef,
    query: Omit<SlotsQuery, "exclude_booking_uuid">,
): Promise<SlotsByDate> => {
    try {
        const response = await axios.get(publicUrl(pageRoutes(ref).slots), { params: query });
        return response.data;
    } catch (error) {
        throw withCause(error, "Could not load available times.");
    }
};

export const createPublicBooking = async (ref: PublicPageRef, payload: PublicCreateBookingDto): Promise<PublicBookingResult> => {
    try {
        const response = await axios.post(publicUrl(pageRoutes(ref).book), payload);
        return response.data;
    } catch (error) {
        throw withCause(error, "Could not complete the booking.");
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
