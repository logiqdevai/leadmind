import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import { bookingApiErrorMessage } from "../utils/booking-api-error";
import type {
    BookingInvitation,
    BookingInviteSettings,
    SendBookingInvitationDto,
    UpdateBookingInviteSettingsDto,
} from "../interfaces/bookings.interfaces";

export const listBookingInvitations = async (contact_uuid: string): Promise<BookingInvitation[]> => {
    try {
        const response = await axiosInstance.get(ApiRoutes.booking_invitations.list, { params: { contact_uuid } });
        return response.data;
    } catch (error) {
        throw new Error(bookingApiErrorMessage(error, "Failed to load sent booking links."), { cause: error });
    }
};

export const sendBookingInvitation = async (payload: SendBookingInvitationDto): Promise<BookingInvitation> => {
    try {
        const response = await axiosInstance.post(ApiRoutes.booking_invitations.send, payload);
        return response.data;
    } catch (error) {
        throw new Error(bookingApiErrorMessage(error, "Failed to send the booking link."), { cause: error });
    }
};

export const stopBookingInvitation = async (uuid: string): Promise<void> => {
    try {
        await axiosInstance.post(ApiRoutes.booking_invitations.stop(uuid));
    } catch (error) {
        throw new Error(bookingApiErrorMessage(error, "Failed to stop the reminders."), { cause: error });
    }
};

export const resendBookingInvitation = async (uuid: string): Promise<BookingInvitation> => {
    try {
        const response = await axiosInstance.post(ApiRoutes.booking_invitations.resend(uuid));
        return response.data;
    } catch (error) {
        throw new Error(bookingApiErrorMessage(error, "Failed to resend the booking link."), { cause: error });
    }
};

export const getBookingInviteSettings =async (): Promise<BookingInviteSettings> => {
    try {
        const response = await axiosInstance.get(ApiRoutes.booking_invitations.settings);
        return response.data;
    } catch (error) {
        throw new Error(bookingApiErrorMessage(error, "Failed to load the invitation settings."), { cause: error });
    }
};

export const updateBookingInviteSettings = async (
    payload: UpdateBookingInviteSettingsDto,
): Promise<BookingInviteSettings> => {
    try {
        const response = await axiosInstance.patch(ApiRoutes.booking_invitations.settings, payload);
        return response.data;
    } catch (error) {
        throw new Error(bookingApiErrorMessage(error, "Failed to save the invitation settings."), { cause: error });
    }
};
