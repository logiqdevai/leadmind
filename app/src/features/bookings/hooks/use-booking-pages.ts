import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import {
    createBookingLink,
    createBookingPage,
    deleteBookingLink,
    deleteBookingPage,
    getBookingPage,
    getBookingPageSlots,
    listBookingLinks,
    listBookingPages,
    regenerateBookingLink,
    updateBookingLink,
    updateBookingPage,
} from "../services/booking-pages.services";
import type {
    CreateBookingLinkDto,
    CreateBookingPageDto,
    ListBookingLinksQuery,
    SlotsQuery,
    UpdateBookingLinkDto,
    UpdateBookingPageDto,
} from "../interfaces/bookings.interfaces";

export const bookingPageQueryKeys = {
    all: ["booking-pages"] as const,
    list: ["booking-pages", "list"] as const,
    detail: (uuid: string) => ["booking-pages", "detail", uuid] as const,
    slots: (uuid: string, query: SlotsQuery) => ["booking-pages", "slots", uuid, query] as const,
};

export const bookingLinkQueryKeys = {
    all: ["booking-links"] as const,
    list: (query: ListBookingLinksQuery) => ["booking-links", "list", query] as const,
};

const errorToast = (title: string) => (error: Error) =>
    toast({ title, description: error.message, duration: 4000, variant: "error" });

export function useBookingPages() {
    return useQuery({ queryKey: bookingPageQueryKeys.list, queryFn: listBookingPages, staleTime: 60_000 });
}

export function useBookingPage(uuid: string | null | undefined) {
    return useQuery({
        queryKey: bookingPageQueryKeys.detail(uuid ?? ""),
        queryFn: () => getBookingPage(uuid!),
        enabled: !!uuid,
    });
}

/** Internal slot lookup (preview, manual booking, reschedule). */
export function useBookingPageSlots(uuid: string | null | undefined, query: SlotsQuery | null) {
    return useQuery({
        queryKey: bookingPageQueryKeys.slots(uuid ?? "", query ?? { from: "", to: "" }),
        queryFn: () => getBookingPageSlots(uuid!, query!),
        enabled: !!uuid && !!query?.from && !!query?.to,
        placeholderData: keepPreviousData,
        staleTime: 15_000,
    });
}

export function useCreateBookingPage() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (payload: CreateBookingPageDto) => createBookingPage(payload),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: bookingPageQueryKeys.all });
            qc.invalidateQueries({ queryKey: bookingLinkQueryKeys.all });
            toast({ title: "Booking page created", duration: 2000, variant: "success" });
        },
        onError: errorToast("Could not create booking page"),
    });
}

export function useUpdateBookingPage() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ uuid, payload }: { uuid: string; payload: UpdateBookingPageDto }) => updateBookingPage(uuid, payload),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: bookingPageQueryKeys.all });
            toast({ title: "Booking page saved", duration: 1500 });
        },
        onError: errorToast("Could not save booking page"),
    });
}

export function useDeleteBookingPage() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (uuid: string) => deleteBookingPage(uuid),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: bookingPageQueryKeys.all });
            qc.invalidateQueries({ queryKey: bookingLinkQueryKeys.all });
            toast({ title: "Booking page deleted", duration: 1500 });
        },
        onError: errorToast("Could not delete booking page"),
    });
}

export function useBookingLinks(query: ListBookingLinksQuery = {}, options: { enabled?: boolean } = {}) {
    return useQuery({
        queryKey: bookingLinkQueryKeys.list(query),
        queryFn: () => listBookingLinks(query),
        staleTime: 30_000,
        enabled: options.enabled ?? true,
    });
}

export function useCreateBookingLink() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (payload: CreateBookingLinkDto) => createBookingLink(payload),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: bookingLinkQueryKeys.all });
            qc.invalidateQueries({ queryKey: bookingPageQueryKeys.all });
            toast({ title: "Booking link created", duration: 1500 });
        },
        onError: errorToast("Could not create booking link"),
    });
}

export function useUpdateBookingLink() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ uuid, payload }: { uuid: string; payload: UpdateBookingLinkDto }) => updateBookingLink(uuid, payload),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: bookingLinkQueryKeys.all });
            qc.invalidateQueries({ queryKey: bookingPageQueryKeys.all });
            toast({ title: "Booking link updated", duration: 1500 });
        },
        onError: errorToast("Could not update booking link"),
    });
}

export function useRegenerateBookingLink() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (uuid: string) => regenerateBookingLink(uuid),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: bookingLinkQueryKeys.all });
            qc.invalidateQueries({ queryKey: bookingPageQueryKeys.all });
            toast({ title: "New link generated", description: "The old URL no longer accepts bookings.", duration: 2500 });
        },
        onError: errorToast("Could not regenerate link"),
    });
}

export function useDeleteBookingLink() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (uuid: string) => deleteBookingLink(uuid),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: bookingLinkQueryKeys.all });
            qc.invalidateQueries({ queryKey: bookingPageQueryKeys.all });
            toast({ title: "Booking link deleted", duration: 1500 });
        },
        onError: errorToast("Could not delete booking link"),
    });
}
