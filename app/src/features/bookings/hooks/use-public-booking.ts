import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import {
    cancelManagedBooking,
    createPublicBooking,
    getManagedBooking,
    getManagedBookingSlots,
    getPublicBookingPage,
    getPublicBookingSlots,
    rescheduleManagedBooking,
} from "../services/public-booking.services";
import { BookingStatuses, type PublicCreateBookingDto, type SlotsQuery } from "../interfaces/bookings.interfaces";
import { isSlotUnavailableError } from "../utils/booking-api-error";

type PublicSlotsQuery = Omit<SlotsQuery, "exclude_booking_uuid">;

export const publicBookingQueryKeys = {
    all: ["public-booking"] as const,
    page: (code: string) => ["public-booking", "page", code] as const,
    slots: (code: string, query: PublicSlotsQuery) => ["public-booking", "slots", code, query] as const,
    manage: (token: string) => ["public-booking", "manage", token] as const,
    manageSlots: (token: string, query: PublicSlotsQuery) => ["public-booking", "manage-slots", token, query] as const,
};

export function usePublicBookingPage(code: string | undefined) {
    return useQuery({
        queryKey: publicBookingQueryKeys.page(code ?? ""),
        queryFn: () => getPublicBookingPage(code!),
        enabled: !!code,
        retry: false,
    });
}

export function usePublicBookingSlots(code: string | undefined, query: PublicSlotsQuery | null) {
    return useQuery({
        queryKey: publicBookingQueryKeys.slots(code ?? "", query ?? { from: "", to: "" }),
        queryFn: () => getPublicBookingSlots(code!, query!),
        enabled: !!code && !!query,
        placeholderData: keepPreviousData,
        staleTime: 15_000,
        retry: false,
    });
}

export function useCreatePublicBooking(code: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (payload: PublicCreateBookingDto) => createPublicBooking(code, payload),
        onSuccess: (result) => {
            qc.invalidateQueries({ queryKey: publicBookingQueryKeys.all });
            const pending = result.booking.status === BookingStatuses.PENDING;
            toast({ title: pending ? "Request received" : "You're booked", duration: 2000, variant: "success" });
        },
        onError: (error: Error) => {
            // A taken slot means fresh availability is needed; the page explains that case inline.
            qc.invalidateQueries({ queryKey: publicBookingQueryKeys.all });
            if (isSlotUnavailableError(error)) return;
            toast({ title: "Booking not completed", description: error.message, duration: 4000, variant: "error" });
        },
    });
}

export function useManagedBooking(token: string | undefined) {
    return useQuery({
        queryKey: publicBookingQueryKeys.manage(token ?? ""),
        queryFn: () => getManagedBooking(token!),
        enabled: !!token,
        retry: false,
    });
}

export function useManagedBookingSlots(token: string | undefined, query: PublicSlotsQuery | null) {
    return useQuery({
        queryKey: publicBookingQueryKeys.manageSlots(token ?? "", query ?? { from: "", to: "" }),
        queryFn: () => getManagedBookingSlots(token!, query!),
        enabled: !!token && !!query,
        placeholderData: keepPreviousData,
        staleTime: 15_000,
        retry: false,
    });
}

export function useCancelManagedBooking(token: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (reason?: string) => cancelManagedBooking(token, reason),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: publicBookingQueryKeys.all });
            toast({ title: "Your booking was cancelled", duration: 2000 });
        },
        onError: (error: Error) =>
            toast({ title: "Could not cancel", description: error.message, duration: 4000, variant: "error" }),
    });
}

export function useRescheduleManagedBooking(token: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (payload: { start_at: string; timezone?: string }) => rescheduleManagedBooking(token, payload),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: publicBookingQueryKeys.all });
            toast({ title: "Your booking was moved", duration: 2000, variant: "success" });
        },
        onError: (error: Error) => {
            qc.invalidateQueries({ queryKey: publicBookingQueryKeys.all });
            if (isSlotUnavailableError(error)) return;
            toast({ title: "Could not reschedule", description: error.message, duration: 4000, variant: "error" });
        },
    });
}
