import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import {
    connectGoogleCalendar,
    createBookingBlock,
    createRecurringBlock,
    deleteRecurringBlock,
    listRecurringBlocks,
    updateBookingBlock,
    updateRecurringBlock,
    deleteAvailabilityOverride,
    deleteBookingBlock,
    disconnectCalendar,
    getAvailabilitySchedule,
    listBookingBlocks,
    listCalendarConnections,
    listGoogleCalendars,
    saveAvailabilityOverride,
    saveAvailabilitySchedule,
    updateCalendarConnection,
    verifyCalendarConnection,
} from "../services/availability.services";
import type {
    CreateBookingBlockDto,
    CreateRecurringBlockDto,
    ListBlocksQuery,
    UpdateBookingBlockDto,
    UpdateRecurringBlockDto,
    UpdateCalendarConnectionDto,
    UpsertOverrideDto,
    UpsertScheduleDto,
} from "../interfaces/bookings.interfaces";

export const availabilityQueryKeys = {
    all: ["availability"] as const,
    schedule: (userUuid?: string) => ["availability", "schedule", userUuid ?? "me"] as const,
    blocks: (query: ListBlocksQuery) => ["availability", "blocks", query] as const,
    recurringBlocks: (userUuid?: string) => ["availability", "recurring-blocks", userUuid ?? "me"] as const,
};

export const calendarConnectionQueryKeys = {
    all: ["calendar-connections"] as const,
    list: ["calendar-connections", "list"] as const,
    calendars: (uuid: string) => ["calendar-connections", "calendars", uuid] as const,
};

const errorToast = (title: string) => (error: Error) =>
    toast({ title, description: error.message, duration: 4000, variant: "error" });

/** Availability changes move slots and the calendar's blocked periods. */
const invalidateAvailability = (qc: ReturnType<typeof useQueryClient>) => {
    qc.invalidateQueries({ queryKey: availabilityQueryKeys.all });
    qc.invalidateQueries({ queryKey: ["booking-pages"] });
    qc.invalidateQueries({ queryKey: ["bookings"] });
};

export function useAvailabilitySchedule(userUuid?: string) {
    return useQuery({
        queryKey: availabilityQueryKeys.schedule(userUuid),
        queryFn: () => getAvailabilitySchedule(userUuid),
    });
}

export function useSaveAvailabilitySchedule() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ payload, userUuid }: { payload: UpsertScheduleDto; userUuid?: string }) =>
            saveAvailabilitySchedule(payload, userUuid),
        onSuccess: () => {
            invalidateAvailability(qc);
            toast({ title: "Working hours saved", duration: 1500, variant: "success" });
        },
        onError: errorToast("Could not save working hours"),
    });
}

export function useSaveAvailabilityOverride() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ payload, userUuid }: { payload: UpsertOverrideDto; userUuid?: string }) =>
            saveAvailabilityOverride(payload, userUuid),
        onSuccess: () => {
            invalidateAvailability(qc);
            toast({ title: "Date override saved", duration: 1500 });
        },
        onError: errorToast("Could not save date override"),
    });
}

export function useDeleteAvailabilityOverride() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (uuid: string) => deleteAvailabilityOverride(uuid),
        onSuccess: () => {
            invalidateAvailability(qc);
            toast({ title: "Date override removed", duration: 1500 });
        },
        onError: errorToast("Could not remove date override"),
    });
}

export function useBookingBlocks(query: ListBlocksQuery | null) {
    return useQuery({
        queryKey: availabilityQueryKeys.blocks(query ?? { from: "", to: "" }),
        queryFn: () => listBookingBlocks(query!),
        enabled: !!query?.from && !!query?.to,
    });
}

export function useCreateBookingBlock() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (payload: CreateBookingBlockDto) => createBookingBlock(payload),
        onSuccess: () => {
            invalidateAvailability(qc);
            toast({ title: "Time blocked", duration: 1500 });
        },
        onError: errorToast("Could not block time"),
    });
}

export function useUpdateBookingBlock() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ uuid, payload }: { uuid: string; payload: UpdateBookingBlockDto }) => updateBookingBlock(uuid, payload),
        onSuccess: () => {
            invalidateAvailability(qc);
            toast({ title: "Blocked time updated", duration: 1500 });
        },
        onError: errorToast("Could not update blocked time"),
    });
}

export function useRecurringBlocks(userUuid?: string) {
    return useQuery({
        queryKey: availabilityQueryKeys.recurringBlocks(userUuid),
        queryFn: () => listRecurringBlocks(userUuid),
    });
}

export function useCreateRecurringBlock() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (payload: CreateRecurringBlockDto) => createRecurringBlock(payload),
        onSuccess: () => {
            invalidateAvailability(qc);
            toast({ title: "Recurring time blocked", duration: 1500 });
        },
        onError: errorToast("Could not block time"),
    });
}

export function useUpdateRecurringBlock() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ uuid, payload }: { uuid: string; payload: UpdateRecurringBlockDto }) => updateRecurringBlock(uuid, payload),
        onSuccess: () => {
            invalidateAvailability(qc);
            toast({ title: "Recurring block updated", duration: 1500 });
        },
        onError: errorToast("Could not update recurring block"),
    });
}

export function useDeleteRecurringBlock() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (uuid: string) => deleteRecurringBlock(uuid),
        onSuccess: () => {
            invalidateAvailability(qc);
            toast({ title: "Recurring block removed", duration: 1500 });
        },
        onError: errorToast("Could not remove recurring block"),
    });
}

export function useDeleteBookingBlock() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (uuid: string) => deleteBookingBlock(uuid),
        onSuccess: () => {
            invalidateAvailability(qc);
            toast({ title: "Blocked time removed", duration: 1500 });
        },
        onError: errorToast("Could not remove blocked time"),
    });
}

export function useCalendarConnections() {
    return useQuery({ queryKey: calendarConnectionQueryKeys.list, queryFn: listCalendarConnections, staleTime: 30_000 });
}

export function useGoogleCalendars(uuid: string | null | undefined) {
    return useQuery({
        queryKey: calendarConnectionQueryKeys.calendars(uuid ?? ""),
        queryFn: () => listGoogleCalendars(uuid!),
        enabled: !!uuid,
        staleTime: 5 * 60_000,
    });
}

/** Starts Google OAuth and sends the browser to the consent screen. */
export function useConnectGoogleCalendar() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: connectGoogleCalendar,
        onSuccess: (result) => {
            qc.invalidateQueries({ queryKey: calendarConnectionQueryKeys.all });
            if (result.redirect_url) {
                toast({ title: "Redirecting to Google…", duration: 1500 });
                window.location.assign(result.redirect_url);
            } else {
                toast({ title: "Google did not return a sign-in link", variant: "error", duration: 3000 });
            }
        },
        onError: errorToast("Could not connect Google Calendar"),
    });
}

export function useVerifyCalendarConnection() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ uuid, connectedAccountId }: { uuid: string; connectedAccountId: string }) =>
            verifyCalendarConnection(uuid, connectedAccountId),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: calendarConnectionQueryKeys.all });
            toast({ title: "Google Calendar connected", duration: 2000, variant: "success" });
        },
        onError: errorToast("Could not connect Google Calendar"),
    });
}

export function useUpdateCalendarConnection() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ uuid, payload }: { uuid: string; payload: UpdateCalendarConnectionDto }) =>
            updateCalendarConnection(uuid, payload),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: calendarConnectionQueryKeys.all });
            qc.invalidateQueries({ queryKey: ["booking-pages"] });
            toast({ title: "Calendar settings saved", duration: 1500 });
        },
        onError: errorToast("Could not save calendar settings"),
    });
}

export function useDisconnectCalendar() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (uuid: string) => disconnectCalendar(uuid),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: calendarConnectionQueryKeys.all });
            qc.invalidateQueries({ queryKey: ["booking-pages"] });
            toast({ title: "Google Calendar disconnected", duration: 1500 });
        },
        onError: errorToast("Could not disconnect"),
    });
}
