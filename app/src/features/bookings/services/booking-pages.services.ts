import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import { bookingApiErrorMessage } from "../utils/booking-api-error";
import type {
    BookingLink,
    BookingPage,
    CreateBookingLinkDto,
    CreateBookingPageDto,
    ListBookingLinksQuery,
    SlotsByDate,
    SlotsQuery,
    UpdateBookingLinkDto,
    UpdateBookingPageDto,
} from "../interfaces/bookings.interfaces";

export const listBookingPages = async (): Promise<BookingPage[]> => {
    try {
        const response = await axiosInstance.get(ApiRoutes.booking_pages.list);
        return response.data;
    } catch (error) {
        throw new Error(bookingApiErrorMessage(error, "Failed to load booking pages."), { cause: error });
    }
};

export const getBookingPage = async (uuid: string): Promise<BookingPage> => {
    try {
        const response = await axiosInstance.get(ApiRoutes.booking_pages.get(uuid));
        return response.data;
    } catch (error) {
        throw new Error(bookingApiErrorMessage(error, "Failed to load the booking page."), { cause: error });
    }
};

export const createBookingPage = async (payload: CreateBookingPageDto): Promise<BookingPage> => {
    try {
        const response = await axiosInstance.post(ApiRoutes.booking_pages.create, payload);
        return response.data;
    } catch (error) {
        throw new Error(bookingApiErrorMessage(error, "Failed to create the booking page."), { cause: error });
    }
};

export const updateBookingPage = async (uuid: string, payload: UpdateBookingPageDto): Promise<BookingPage> => {
    try {
        const response = await axiosInstance.patch(ApiRoutes.booking_pages.update(uuid), payload);
        return response.data;
    } catch (error) {
        throw new Error(bookingApiErrorMessage(error, "Failed to save the booking page."), { cause: error });
    }
};

export const deleteBookingPage = async (uuid: string): Promise<void> => {
    try {
        await axiosInstance.delete(ApiRoutes.booking_pages.remove(uuid));
    } catch (error) {
        throw new Error(bookingApiErrorMessage(error, "Failed to delete the booking page."), { cause: error });
    }
};

/** Internal preview: slots include the members free at each time. */
export const getBookingPageSlots = async (uuid: string, query: SlotsQuery): Promise<SlotsByDate> => {
    try {
        const response = await axiosInstance.get(ApiRoutes.booking_pages.slots(uuid), { params: query });
        return response.data;
    } catch (error) {
        throw new Error(bookingApiErrorMessage(error, "Failed to load available times."), { cause: error });
    }
};

export const listBookingLinks = async (query: ListBookingLinksQuery = {}): Promise<BookingLink[]> => {
    try {
        const response = await axiosInstance.get(ApiRoutes.booking_links.list, { params: query });
        return response.data;
    } catch (error) {
        throw new Error(bookingApiErrorMessage(error, "Failed to load booking links."), { cause: error });
    }
};

export const createBookingLink = async (payload: CreateBookingLinkDto): Promise<BookingLink> => {
    try {
        const response = await axiosInstance.post(ApiRoutes.booking_links.create, payload);
        return response.data;
    } catch (error) {
        throw new Error(bookingApiErrorMessage(error, "Failed to create the booking link."), { cause: error });
    }
};

export const updateBookingLink = async (uuid: string, payload: UpdateBookingLinkDto): Promise<BookingLink> => {
    try {
        const response = await axiosInstance.patch(ApiRoutes.booking_links.update(uuid), payload);
        return response.data;
    } catch (error) {
        throw new Error(bookingApiErrorMessage(error, "Failed to update the booking link."), { cause: error });
    }
};

export const regenerateBookingLink = async (uuid: string): Promise<BookingLink> => {
    try {
        const response = await axiosInstance.post(ApiRoutes.booking_links.regenerate(uuid));
        return response.data;
    } catch (error) {
        throw new Error(bookingApiErrorMessage(error, "Failed to regenerate the booking link."), { cause: error });
    }
};

export const deleteBookingLink = async (uuid: string): Promise<void> => {
    try {
        await axiosInstance.delete(ApiRoutes.booking_links.remove(uuid));
    } catch (error) {
        throw new Error(bookingApiErrorMessage(error, "Failed to delete the booking link."), { cause: error });
    }
};
