import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import {
    getBookingInviteSettings,
    listBookingInvitations,
    resendBookingInvitation,
    sendBookingInvitation,
    stopBookingInvitation,
    updateBookingInviteSettings,
} from "../services/booking-invitations.services";
import { bookingLinkQueryKeys } from "./use-booking-pages";
import type { SendBookingInvitationDto, UpdateBookingInviteSettingsDto } from "../interfaces/bookings.interfaces";

export const bookingInvitationQueryKeys = {
    all: ["booking-invitations"] as const,
    contact: (contactUuid: string) => ["booking-invitations", "contact", contactUuid] as const,
    settings: ["booking-invitations", "settings"] as const,
};

// Sending adds a "Booking link sent" entry to the contact's timeline.
const CONTACT_TIMELINE_KEY = ["contact-interactions"] as const;

const errorToast = (title: string) => (error: Error) =>
    toast({ title, description: error.message, duration: 4000, variant: "error" });

export function useBookingInvitations(contactUuid: string) {
    return useQuery({
        queryKey: bookingInvitationQueryKeys.contact(contactUuid),
        queryFn: () => listBookingInvitations(contactUuid),
        enabled: !!contactUuid,
        staleTime: 30_000,
    });
}

export function useSendBookingInvitation() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (payload: SendBookingInvitationDto) => sendBookingInvitation(payload),
        onSuccess: (invitation) => {
            qc.invalidateQueries({ queryKey: bookingInvitationQueryKeys.all });
            qc.invalidateQueries({ queryKey: bookingLinkQueryKeys.all });
            qc.invalidateQueries({ queryKey: CONTACT_TIMELINE_KEY });
            toast({
                title: "Booking link sent",
                description: `Emailed to ${invitation.recipient_email}`,
                duration: 2500,
                variant: "success",
            });
        },
        onError: errorToast("Could not send the booking link"),
    });
}

export function useResendBookingInvitation() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (uuid: string) => resendBookingInvitation(uuid),
        onSuccess: (invitation) => {
            qc.invalidateQueries({ queryKey: bookingInvitationQueryKeys.all });
            qc.invalidateQueries({ queryKey: CONTACT_TIMELINE_KEY });
            toast({
                title: "Booking link sent again",
                description: `Emailed to ${invitation.recipient_email}`,
                duration: 2500,
                variant: "success",
            });
        },
        onError: errorToast("Could not resend the booking link"),
    });
}

export function useStopBookingInvitation() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (uuid: string) => stopBookingInvitation(uuid),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: bookingInvitationQueryKeys.all });
            toast({ title: "Reminders stopped", duration: 1500 });
        },
        onError: errorToast("Could not stop the reminders"),
    });
}

export function useBookingInviteSettings() {
    return useQuery({
        queryKey: bookingInvitationQueryKeys.settings,
        queryFn: getBookingInviteSettings,
        staleTime: 60_000,
    });
}

export function useUpdateBookingInviteSettings() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (payload: UpdateBookingInviteSettingsDto) => updateBookingInviteSettings(payload),
        onSuccess: (settings) => {
            qc.setQueryData(bookingInvitationQueryKeys.settings, settings);
            toast({ title: "Invitation settings saved", duration: 1500, variant: "success" });
        },
        onError: errorToast("Could not save the invitation settings"),
    });
}
