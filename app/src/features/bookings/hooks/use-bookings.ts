import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import {
    assignBooking,
    cancelBooking,
    createBooking,
    deleteBooking,
    exportBookingsCsv,
    getBooking,
    getBookingCalendar,
    getBookingStats,
    listBookings,
    rescheduleBooking,
    setBookingStatus,
    syncBookingCalendar,
    updateBooking,
} from "../services/bookings.services";
import type {
    AssignBookingDto,
    BookingFilters,
    CancelBookingDto,
    CreateBookingDto,
    ListBookingsQuery,
    RescheduleBookingDto,
    SettableBookingStatus,
    UpdateBookingDto,
} from "../interfaces/bookings.interfaces";

export const bookingQueryKeys = {
    all: ["bookings"] as const,
    list: (query: ListBookingsQuery) => ["bookings", "list", query] as const,
    calendar: (query: BookingFilters) => ["bookings", "calendar", query] as const,
    stats: (query: BookingFilters) => ["bookings", "stats", query] as const,
    detail: (uuid: string) => ["bookings", "detail", uuid] as const,
};

/** Slots and pages depend on bookings too (a new booking removes a slot). */
const invalidateBookingData = (qc: ReturnType<typeof useQueryClient>) => {
    qc.invalidateQueries({ queryKey: bookingQueryKeys.all });
    qc.invalidateQueries({ queryKey: ["booking-pages"] });
};

const errorToast = (title: string) => (error: Error) =>
    toast({ title, description: error.message, duration: 4000, variant: "error" });

export function useBookings(query: ListBookingsQuery = {}, options: { enabled?: boolean } = {}) {
    return useQuery({
        queryKey: bookingQueryKeys.list(query),
        queryFn: () => listBookings(query),
        placeholderData: keepPreviousData,
        staleTime: 30_000,
        enabled: options.enabled ?? true,
    });
}

export function useBookingCalendar(query: BookingFilters) {
    return useQuery({
        queryKey: bookingQueryKeys.calendar(query),
        queryFn: () => getBookingCalendar(query),
        placeholderData: keepPreviousData,
        staleTime: 30_000,
        enabled: !!query.from && !!query.to,
    });
}

export function useBookingStats(query: BookingFilters) {
    return useQuery({
        queryKey: bookingQueryKeys.stats(query),
        queryFn: () => getBookingStats(query),
        staleTime: 60_000,
    });
}

export function useBooking(uuid: string | null | undefined) {
    return useQuery({
        queryKey: bookingQueryKeys.detail(uuid ?? ""),
        queryFn: () => getBooking(uuid!),
        enabled: !!uuid,
        // The calendar sync runs in a worker; keep polling until it settles so the status never sticks on "Syncing".
        refetchInterval: (query) => (query.state.data?.calendar_sync_status === "PENDING" ? 2000 : false),
    });
}

export function useCreateBooking() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (payload: CreateBookingDto) => createBooking(payload),
        onSuccess: () => {
            invalidateBookingData(qc);
            toast({ title: "Booking created", duration: 2000, variant: "success" });
        },
        onError: errorToast("Could not create booking"),
    });
}

export function useUpdateBooking() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ uuid, payload }: { uuid: string; payload: UpdateBookingDto }) => updateBooking(uuid, payload),
        onSuccess: () => {
            invalidateBookingData(qc);
            toast({ title: "Booking updated", duration: 1500 });
        },
        onError: errorToast("Could not update booking"),
    });
}

export function useRescheduleBooking() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ uuid, payload }: { uuid: string; payload: RescheduleBookingDto }) => rescheduleBooking(uuid, payload),
        onSuccess: () => {
            invalidateBookingData(qc);
            toast({ title: "Booking rescheduled", duration: 2000, variant: "success" });
        },
        onError: errorToast("Could not reschedule booking"),
    });
}

export function useCancelBooking() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ uuid, payload }: { uuid: string; payload: CancelBookingDto }) => cancelBooking(uuid, payload),
        onSuccess: () => {
            invalidateBookingData(qc);
            toast({ title: "Booking cancelled", duration: 2000 });
        },
        onError: errorToast("Could not cancel booking"),
    });
}

export function useDeleteBooking() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (uuid: string) => deleteBooking(uuid),
        onSuccess: () => {
            invalidateBookingData(qc);
            toast({ title: "Booking deleted", duration: 2000 });
        },
        onError: errorToast("Could not delete booking"),
    });
}

export function useSetBookingStatus() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ uuid, status }: { uuid: string; status: SettableBookingStatus }) => setBookingStatus(uuid, status),
        onSuccess: () => {
            invalidateBookingData(qc);
            toast({ title: "Booking status updated", duration: 1500 });
        },
        onError: errorToast("Could not update status"),
    });
}

export function useAssignBooking() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ uuid, payload }: { uuid: string; payload: AssignBookingDto }) => assignBooking(uuid, payload),
        onSuccess: () => {
            invalidateBookingData(qc);
            toast({ title: "Booking reassigned", duration: 2000 });
        },
        onError: errorToast("Could not reassign booking"),
    });
}

export function useSyncBookingCalendar() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (uuid: string) => syncBookingCalendar(uuid),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: bookingQueryKeys.all });
            toast({ title: "Calendar sync queued", duration: 1500 });
        },
        onError: errorToast("Could not retry sync"),
    });
}

export function useExportBookings() {
    return useMutation({
        mutationFn: (query: BookingFilters) => exportBookingsCsv(query),
        onSuccess: () => toast({ title: "Export downloaded", duration: 1500 }),
        onError: errorToast("Could not export bookings"),
    });
}
