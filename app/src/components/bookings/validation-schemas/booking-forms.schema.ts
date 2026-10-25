import { z } from "zod";
import { BookingLocationTypes } from "@/features/bookings/interfaces/bookings.interfaces";

const locationTypeSchema = z.enum([
    BookingLocationTypes.NONE,
    BookingLocationTypes.GOOGLE_MEET,
    BookingLocationTypes.PHONE,
    BookingLocationTypes.IN_PERSON,
    BookingLocationTypes.CUSTOM,
]);

const optionalEmail = z
    .string()
    .trim()
    .max(320)
    .refine((v) => v === "" || z.email().safeParse(v).success, "Enter a valid email address");

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const TIME_KEY = /^\d{2}:\d{2}$/;

// --- Create booking ---------------------------------------------------------

export const CreateBookingInviteeModes = { CONTACT: "contact", VISITOR: "visitor" } as const;
export const CreateBookingTimeModes = { SLOT: "slot", CUSTOM: "custom" } as const;

export const createBookingFormSchema = z
    .object({
        invitee_mode: z.enum([CreateBookingInviteeModes.CONTACT, CreateBookingInviteeModes.VISITOR]),
        contact_uuid: z.string(),
        invitee_name: z.string().trim().max(200),
        invitee_email: optionalEmail,
        invitee_phone: z.string().trim().max(50),
        booking_page_uuid: z.string(),
        time_mode: z.enum([CreateBookingTimeModes.SLOT, CreateBookingTimeModes.CUSTOM]),
        slot_start: z.string(),
        slot_user_uuid: z.string(),
        date: z.string(),
        time: z.string(),
        duration_minutes: z.number().int().min(5, "At least 5 minutes").max(720, "At most 12 hours"),
        assigned_user_uuid: z.string(),
        ignore_availability: z.boolean(),
        location_type: locationTypeSchema,
        location_value: z.string().trim().max(500),
        internal_notes: z.string().trim().max(5000),
        notify: z.boolean(),
    })
    .superRefine((v, ctx) => {
        if (v.invitee_mode === CreateBookingInviteeModes.CONTACT && !v.contact_uuid) {
            ctx.addIssue({ code: "custom", path: ["contact_uuid"], message: "Pick a contact" });
        }
        if (v.invitee_mode === CreateBookingInviteeModes.VISITOR) {
            if (!v.invitee_name) ctx.addIssue({ code: "custom", path: ["invitee_name"], message: "Name is required" });
            if (!v.invitee_email && !v.invitee_phone) {
                ctx.addIssue({ code: "custom", path: ["invitee_email"], message: "Add an email or a phone number" });
            }
        }
        const usesSlots = !!v.booking_page_uuid && v.time_mode === CreateBookingTimeModes.SLOT;
        if (usesSlots && !v.slot_start) {
            ctx.addIssue({ code: "custom", path: ["slot_start"], message: "Pick an available time" });
        }
        if (!usesSlots) {
            if (!DATE_KEY.test(v.date)) ctx.addIssue({ code: "custom", path: ["date"], message: "Pick a date" });
            if (!TIME_KEY.test(v.time)) ctx.addIssue({ code: "custom", path: ["time"], message: "Pick a time" });
        }
    });

export type CreateBookingFormValues = z.infer<typeof createBookingFormSchema>;

// --- Edit booking details ---------------------------------------------------

export const editBookingFormSchema = z.object({
    invitee_name: z.string().trim().min(1, "Name is required").max(200),
    invitee_email: optionalEmail,
    invitee_phone: z.string().trim().max(50),
    invitee_notes: z.string().trim().max(5000),
    location_type: locationTypeSchema,
    location_value: z.string().trim().max(500),
});

export type EditBookingFormValues = z.infer<typeof editBookingFormSchema>;

// --- Cancel booking ---------------------------------------------------------

export const cancelBookingFormSchema = z.object({
    reason: z.string().trim().max(1000),
    notify: z.boolean(),
});

export type CancelBookingFormValues = z.infer<typeof cancelBookingFormSchema>;

// --- Block time -------------------------------------------------------------

export const BLOCK_ORGANISATION_WIDE = "__organisation__";

export const blockTimeFormSchema = z
    .object({
        start_date: z.string().regex(DATE_KEY, "Pick a start date"),
        start_time: z.string().regex(TIME_KEY, "Pick a start time"),
        end_date: z.string().regex(DATE_KEY, "Pick an end date"),
        end_time: z.string().regex(TIME_KEY, "Pick an end time"),
        reason: z.string().trim().max(500),
        /** Member uuid, or BLOCK_ORGANISATION_WIDE. */
        target: z.string().min(1, "Pick who is unavailable"),
    })
    .refine((v) => `${v.end_date}T${v.end_time}` > `${v.start_date}T${v.start_time}`, {
        path: ["end_time"],
        message: "End must be after start",
    });

export type BlockTimeFormValues = z.infer<typeof blockTimeFormSchema>;
