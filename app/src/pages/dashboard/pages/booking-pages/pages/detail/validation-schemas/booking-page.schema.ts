import { z } from "zod";
import {
    BookingAssignmentModes,
    BookingUnavailableSlotsModes,
    BookingLocationTypes,
    BookingQuestionTypes,
} from "@/features/bookings/interfaces/bookings.interfaces";

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const QUESTION_ID = /^[a-z][a-z0-9_]*$/;

const int = (min: number, max = 1_000_000) => z.number().int().min(min).max(max);

/** "" or an absolute http(s) URL. */
const optionalUrl = z
    .string()
    .trim()
    .refine((v) => v === "" || /^https?:\/\/\S+$/i.test(v), "Enter a full URL starting with https://");

export const bookingQuestionSchema = z.object({
    id: z.string().regex(QUESTION_ID, "Use lowercase letters, numbers and underscores"),
    label: z.string().trim().min(1, "Question label is required").max(200),
    type: z.enum([
        BookingQuestionTypes.TEXT,
        BookingQuestionTypes.TEXTAREA,
        BookingQuestionTypes.SELECT,
        BookingQuestionTypes.CHECKBOX,
    ]),
    required: z.boolean(),
    options: z.array(z.string()),
});

export const bookingPageMemberSchema = z.object({
    user_uuid: z.string().min(1),
    priority: int(0, 100),
});

export const bookingPageFormSchema = z
    .object({
        // General
        name: z.string().trim().min(1, "Name is required").max(120),
        slug: z
            .string()
            .trim()
            .min(1, "Slug is required")
            .max(80)
            .regex(SLUG, "Use lowercase letters, numbers and single dashes"),
        title: z.string().max(200),
        description: z.string().max(5000),
        intro_text: z.string().max(5000),
        is_active: z.boolean(),
        is_default: z.boolean(),
        location_type: z.enum([
            BookingLocationTypes.NONE,
            BookingLocationTypes.GOOGLE_MEET,
            BookingLocationTypes.PHONE,
            BookingLocationTypes.IN_PERSON,
            BookingLocationTypes.CUSTOM,
        ]),
        location_value: z.string().max(500),

        // Scheduling
        duration_minutes: int(5, 720),
        duration_options: z.array(int(5, 720)),
        slot_interval_minutes: int(5, 720).nullable(),
        min_notice_minutes: int(0),
        max_advance_days: int(1, 730),
        buffer_before_minutes: int(0, 720),
        buffer_after_minutes: int(0, 720),
        min_gap_minutes: int(0, 1440),
        max_gap_minutes: int(0, 1440).nullable(),
        max_bookings_per_day: int(1, 500).nullable(),
        seats_per_slot: int(1, 500),
        requires_confirmation: z.boolean(),
        unavailable_slots_mode: z.enum([BookingUnavailableSlotsModes.HIDE, BookingUnavailableSlotsModes.SHOW_DISABLED]),
        allow_cancellation: z.boolean(),
        allow_reschedule: z.boolean(),
        cancellation_deadline_minutes: int(0),
        reschedule_deadline_minutes: int(0),
        require_cancellation_reason: z.boolean(),

        // Team
        members: z.array(bookingPageMemberSchema).min(1, "Add at least one team member"),
        assignment_mode: z.enum([BookingAssignmentModes.ROUND_ROBIN, BookingAssignmentModes.LEAST_BUSY]),
        allow_invitee_member_choice: z.boolean(),

        // Notifications
        send_confirmation_email: z.boolean(),
        send_reminder_emails: z.boolean(),
        reminder_offsets_minutes: z.array(int(1, 43_200)),
        send_cancellation_email: z.boolean(),
        send_reschedule_email: z.boolean(),
        notify_assignee: z.boolean(),
        additional_recipients: z.array(z.email("Invalid email address")),
        include_meeting_link: z.boolean(),
        include_calendar_details: z.boolean(),
        create_team_reminder: z.boolean(),
        team_reminder_offset_minutes: int(5, 20160),
        /** "" = default template. */
        confirmation_template_uuid: z.string(),
        reminder_template_uuid: z.string(),
        cancellation_template_uuid: z.string(),
        reschedule_template_uuid: z.string(),
        calendar_event_title: z.string().max(300),
        calendar_event_description: z.string().max(5000),

        // Branding
        brand_name: z.string().max(120),
        logo_url: optionalUrl,
        primary_color: z.string().refine((v) => v === "" || HEX_COLOR.test(v), "Use a hex color like #2563EB"),
        confirmation_message: z.string().max(5000),
        redirect_url: optionalUrl,
        cta_label: z.string().max(60),
        show_team_member: z.boolean(),
        show_timezone: z.boolean(),
        require_phone: z.boolean(),
        questions: z.array(bookingQuestionSchema),
    })
    .superRefine((v, ctx) => {
        const needsLocation =
            v.location_type === BookingLocationTypes.IN_PERSON || v.location_type === BookingLocationTypes.CUSTOM;
        if (needsLocation && !v.location_value.trim()) {
            ctx.addIssue({
                code: "custom",
                path: ["location_value"],
                message:
                    v.location_type === BookingLocationTypes.IN_PERSON
                        ? "Enter the meeting address"
                        : "Describe where the meeting takes place",
            });
        }
        if (v.max_gap_minutes != null && v.max_gap_minutes < v.min_gap_minutes) {
            ctx.addIssue({
                code: "custom",
                path: ["max_gap_minutes"],
                message: "Maximum gap must be at least the minimum gap",
            });
        }
        if (v.send_reminder_emails && v.reminder_offsets_minutes.length === 0) {
            ctx.addIssue({
                code: "custom",
                path: ["reminder_offsets_minutes"],
                message: "Pick at least one reminder time or turn reminders off",
            });
        }
        const seenIds = new Set<string>();
        v.questions.forEach((q, index) => {
            if (seenIds.has(q.id)) {
                ctx.addIssue({
                    code: "custom",
                    path: ["questions", index, "id"],
                    message: "Two questions have the same id; change one label",
                });
            }
            seenIds.add(q.id);
            if (q.type === BookingQuestionTypes.SELECT && q.options.filter((o) => o.trim()).length === 0) {
                ctx.addIssue({
                    code: "custom",
                    path: ["questions", index, "options"],
                    message: "Add at least one option",
                });
            }
        });
        const seenMembers = new Set<string>();
        v.members.forEach((m, index) => {
            if (seenMembers.has(m.user_uuid)) {
                ctx.addIssue({ code: "custom", path: ["members", index, "user_uuid"], message: "Member added twice" });
            }
            seenMembers.add(m.user_uuid);
        });
    });

export type BookingPageFormValues = z.infer<typeof bookingPageFormSchema>;
export type BookingQuestionFormValues = z.infer<typeof bookingQuestionSchema>;
