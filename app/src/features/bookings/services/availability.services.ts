import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import { bookingApiErrorMessage } from "../utils/booking-api-error";
import type {
    AvailabilityOverride,
    AvailabilitySchedule,
    BookingBlock,
    CalendarConnection,
    CalendarConnectionsResponse,
    CreateBookingBlockDto,
    GoogleCalendarItem,
    ListBlocksQuery,
    UpdateCalendarConnectionDto,
    UpsertOverrideDto,
    UpsertScheduleDto,
} from "../interfaces/bookings.interfaces";

/** `userUuid` omitted = the current member. */
const memberParams = (userUuid?: string) => (userUuid ? { params: { user_uuid: userUuid } } : undefined);

export const getAvailabilitySchedule = async (userUuid?: string): Promise<AvailabilitySchedule> => {
    try {
        const response = await axiosInstance.get(ApiRoutes.availability.schedule, memberParams(userUuid));
        return response.data;
    } catch (error) {
        throw new Error(bookingApiErrorMessage(error, "Failed to load working hours."), { cause: error });
    }
};

export const saveAvailabilitySchedule = async (payload: UpsertScheduleDto, userUuid?: string): Promise<AvailabilitySchedule> => {
    try {
        const response = await axiosInstance.put(ApiRoutes.availability.schedule, payload, memberParams(userUuid));
        return response.data;
    } catch (error) {
        throw new Error(bookingApiErrorMessage(error, "Failed to save working hours."), { cause: error });
    }
};

export const saveAvailabilityOverride = async (payload: UpsertOverrideDto, userUuid?: string): Promise<AvailabilityOverride> => {
    try {
        const response = await axiosInstance.put(ApiRoutes.availability.overrides, payload, memberParams(userUuid));
        return response.data;
    } catch (error) {
        throw new Error(bookingApiErrorMessage(error, "Failed to save the date override."), { cause: error });
    }
};

export const deleteAvailabilityOverride = async (uuid: string): Promise<void> => {
    try {
        await axiosInstance.delete(ApiRoutes.availability.override(uuid));
    } catch (error) {
        throw new Error(bookingApiErrorMessage(error, "Failed to remove the date override."), { cause: error });
    }
};

export const listBookingBlocks = async (query: ListBlocksQuery): Promise<BookingBlock[]> => {
    try {
        const response = await axiosInstance.get(ApiRoutes.availability.blocks, { params: query });
        return response.data;
    } catch (error) {
        throw new Error(bookingApiErrorMessage(error, "Failed to load blocked time."), { cause: error });
    }
};

export const createBookingBlock = async (payload: CreateBookingBlockDto): Promise<BookingBlock> => {
    try {
        const response = await axiosInstance.post(ApiRoutes.availability.blocks, payload);
        return response.data;
    } catch (error) {
        throw new Error(bookingApiErrorMessage(error, "Failed to block this time."), { cause: error });
    }
};

export const deleteBookingBlock = async (uuid: string): Promise<void> => {
    try {
        await axiosInstance.delete(ApiRoutes.availability.block(uuid));
    } catch (error) {
        throw new Error(bookingApiErrorMessage(error, "Failed to remove the blocked time."), { cause: error });
    }
};

export const listCalendarConnections = async (): Promise<CalendarConnectionsResponse> => {
    try {
        const response = await axiosInstance.get(ApiRoutes.calendar_connections.list);
        return response.data;
    } catch (error) {
        throw new Error(bookingApiErrorMessage(error, "Failed to load calendar connections."), { cause: error });
    }
};

export const connectGoogleCalendar = async (): Promise<{ connection_uuid: string; redirect_url: string | null }> => {
    try {
        const response = await axiosInstance.post(ApiRoutes.calendar_connections.connect);
        return response.data;
    } catch (error) {
        throw new Error(bookingApiErrorMessage(error, "Could not start connecting Google Calendar."), { cause: error });
    }
};

export const verifyCalendarConnection = async (uuid: string, connectedAccountId: string): Promise<CalendarConnection> => {
    try {
        const response = await axiosInstance.post(ApiRoutes.calendar_connections.verify(uuid), {
            connected_account_id: connectedAccountId,
        });
        return response.data;
    } catch (error) {
        throw new Error(bookingApiErrorMessage(error, "Could not finish connecting Google Calendar."), { cause: error });
    }
};

export const listGoogleCalendars = async (uuid: string): Promise<GoogleCalendarItem[]> => {
    try {
        const response = await axiosInstance.get(ApiRoutes.calendar_connections.calendars(uuid));
        return response.data;
    } catch (error) {
        throw new Error(bookingApiErrorMessage(error, "Failed to load calendars."), { cause: error });
    }
};

export const updateCalendarConnection = async (uuid: string, payload: UpdateCalendarConnectionDto): Promise<CalendarConnection> => {
    try {
        const response = await axiosInstance.patch(ApiRoutes.calendar_connections.update(uuid), payload);
        return response.data;
    } catch (error) {
        throw new Error(bookingApiErrorMessage(error, "Failed to update the calendar connection."), { cause: error });
    }
};

export const disconnectCalendar = async (uuid: string): Promise<CalendarConnection> => {
    try {
        const response = await axiosInstance.delete(ApiRoutes.calendar_connections.disconnect(uuid));
        return response.data;
    } catch (error) {
        throw new Error(bookingApiErrorMessage(error, "Failed to disconnect Google Calendar."), { cause: error });
    }
};
