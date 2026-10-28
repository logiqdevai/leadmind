import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import { downloadBlob, readBlobErrorMessage } from "@/lib/download-file";
import { bookingApiErrorMessage } from "../utils/booking-api-error";
import type {
    AssignBookingDto,
    BookingCalendarData,
    BookingDetail,
    BookingFilters,
    BookingStats,
    CancelBookingDto,
    CreateBookingDto,
    ListBookingsQuery,
    PaginatedBookings,
    RescheduleBookingDto,
    SettableBookingStatus,
    UpdateBookingDto,
} from "../interfaces/bookings.interfaces";

export const listBookings = async (query: ListBookingsQuery = {}): Promise<PaginatedBookings> => {
    try {
        const response = await axiosInstance.get(ApiRoutes.bookings.list, { params: query });
        return response.data;
    } catch (error) {
        throw new Error(bookingApiErrorMessage(error, "Failed to load bookings."), { cause: error });
    }
};

export const getBookingCalendar = async (query: BookingFilters): Promise<BookingCalendarData> => {
    try {
        const response = await axiosInstance.get(ApiRoutes.bookings.calendar, { params: query });
        return response.data;
    } catch (error) {
        throw new Error(bookingApiErrorMessage(error, "Failed to load the calendar."), { cause: error });
    }
};

export const getBookingStats = async (query: BookingFilters): Promise<BookingStats> => {
    try {
        const response = await axiosInstance.get(ApiRoutes.bookings.stats, { params: query });
        return response.data;
    } catch (error) {
        throw new Error(bookingApiErrorMessage(error, "Failed to load booking statistics."), { cause: error });
    }
};

export const getBooking = async (uuid: string): Promise<BookingDetail> => {
    try {
        const response = await axiosInstance.get(ApiRoutes.bookings.get(uuid));
        return response.data;
    } catch (error) {
        throw new Error(bookingApiErrorMessage(error, "Failed to load the booking."), { cause: error });
    }
};

export const exportBookingsCsv = async (query: BookingFilters): Promise<void> => {
    try {
        const response = await axiosInstance.get(ApiRoutes.bookings.export, { params: query, responseType: "blob" });
        downloadBlob(response.data, `bookings-${new Date().toISOString().slice(0, 10)}.csv`);
    } catch (error) {
        throw new Error(await readBlobErrorMessage(error, "Failed to export bookings."), { cause: error });
    }
};

/** Errors keep the API body as `cause` so callers can detect "slot just taken" (409). */
const withCause = (error: unknown, fallback: string) =>
    new Error(bookingApiErrorMessage(error, fallback), {
        cause: (error as { response?: { data?: unknown } })?.response?.data,
    });

export const createBooking = async (payload: CreateBookingDto): Promise<BookingDetail> => {
    try {
        const response = await axiosInstance.post(ApiRoutes.bookings.create, payload);
        return response.data;
    } catch (error) {
        throw withCause(error, "Failed to create the booking.");
    }
};

export const updateBooking = async (uuid: string, payload: UpdateBookingDto): Promise<BookingDetail> => {
    try {
        const response = await axiosInstance.patch(ApiRoutes.bookings.update(uuid), payload);
        return response.data;
    } catch (error) {
        throw new Error(bookingApiErrorMessage(error, "Failed to update the booking."), { cause: error });
    }
};

export const rescheduleBooking = async (uuid: string, payload: RescheduleBookingDto): Promise<BookingDetail> => {
    try {
        const response = await axiosInstance.post(ApiRoutes.bookings.reschedule(uuid), payload);
        return response.data;
    } catch (error) {
        throw withCause(error, "Failed to reschedule the booking.");
    }
};

export const cancelBooking = async (uuid: string, payload: CancelBookingDto): Promise<BookingDetail> => {
    try {
        const response = await axiosInstance.post(ApiRoutes.bookings.cancel(uuid), payload);
        return response.data;
    } catch (error) {
        throw new Error(bookingApiErrorMessage(error, "Failed to cancel the booking."), { cause: error });
    }
};

export const deleteBooking = async (uuid: string): Promise<void> => {
    try {
        await axiosInstance.delete(ApiRoutes.bookings.remove(uuid));
    } catch (error) {
        throw new Error(bookingApiErrorMessage(error, "Failed to delete the booking."), { cause: error });
    }
};

export const setBookingStatus = async (uuid: string, status: SettableBookingStatus): Promise<BookingDetail> => {
    try {
        const response = await axiosInstance.post(ApiRoutes.bookings.status(uuid), { status });
        return response.data;
    } catch (error) {
        throw new Error(bookingApiErrorMessage(error, "Failed to update the booking status."), { cause: error });
    }
};

export const assignBooking = async (uuid: string, payload: AssignBookingDto): Promise<BookingDetail> => {
    try {
        const response = await axiosInstance.post(ApiRoutes.bookings.assign(uuid), payload);
        return response.data;
    } catch (error) {
        throw withCause(error, "Failed to reassign the booking.");
    }
};

export const syncBookingCalendar = async (uuid: string): Promise<{ queued: boolean }> => {
    try {
        const response = await axiosInstance.post(ApiRoutes.bookings.sync_calendar(uuid));
        return response.data;
    } catch (error) {
        throw new Error(bookingApiErrorMessage(error, "Failed to retry calendar sync."), { cause: error });
    }
};
