import type { FieldErrors } from "react-hook-form";
import type { BookingPage, UpdateBookingPageDto } from "@/features/bookings/interfaces/bookings.interfaces";
import { BookingPageTabIds } from "@/routes/routes";
import type { BookingPageFormValues } from "@/pages/dashboard/pages/booking-pages/pages/detail/validation-schemas/booking-page.schema";

type BookingPageTabId = (typeof BookingPageTabIds)[keyof typeof BookingPageTabIds];

const nullable = (value: string): string | null => (value.trim() ? value.trim() : null);

export function toBookingPageFormValues(page: BookingPage): BookingPageFormValues {
    return {
        name: page.name,
        slug: page.slug,
        title: page.title ?? "",
        description: page.description ?? "",
        intro_text: page.intro_text ?? "",
        expectations: page.expectations ?? [],
        is_active: page.is_active,
        is_default: page.is_default,
        location_type: page.location_type,
        location_value: page.location_value ?? "",

        duration_minutes: page.duration_minutes,
        duration_options: page.duration_options ?? [],
        slot_interval_minutes: page.slot_interval_minutes,
        min_notice_minutes: page.min_notice_minutes,
        max_advance_days: page.max_advance_days,
        buffer_before_minutes: page.buffer_before_minutes,
        buffer_after_minutes: page.buffer_after_minutes,
        min_gap_minutes: page.min_gap_minutes,
        max_gap_minutes: page.max_gap_minutes,
        max_bookings_per_day: page.max_bookings_per_day,
        seats_per_slot: page.seats_per_slot,
        requires_confirmation: page.requires_confirmation,
        auto_log_meeting: page.auto_log_meeting,
        unavailable_slots_mode: page.unavailable_slots_mode,
        allow_cancellation: page.allow_cancellation,
        allow_reschedule: page.allow_reschedule,
        cancellation_deadline_minutes: page.cancellation_deadline_minutes,
        reschedule_deadline_minutes: page.reschedule_deadline_minutes,
        require_cancellation_reason: page.require_cancellation_reason,

        members: [...page.members]
            .sort((a, b) => b.priority - a.priority)
            .map((m) => ({ user_uuid: m.user_uuid, priority: m.priority })),
        assignment_mode: page.assignment_mode,
        allow_invitee_member_choice: page.allow_invitee_member_choice,

        send_confirmation_email: page.send_confirmation_email,
        send_reminder_emails: page.send_reminder_emails,
        reminder_offsets_minutes: page.reminder_offsets_minutes ?? [],
        send_cancellation_email: page.send_cancellation_email,
        send_reschedule_email: page.send_reschedule_email,
        notify_assignee: page.notify_assignee,
        additional_recipients: page.additional_recipients ?? [],
        include_meeting_link: page.include_meeting_link,
        include_calendar_details: page.include_calendar_details,
        create_team_reminder: page.create_team_reminder,
        team_reminder_offset_minutes: page.team_reminder_offset_minutes,
        confirmation_template_uuid: page.confirmation_template_uuid ?? "",
        reminder_template_uuid: page.reminder_template_uuid ?? "",
        cancellation_template_uuid: page.cancellation_template_uuid ?? "",
        reschedule_template_uuid: page.reschedule_template_uuid ?? "",
        calendar_event_title: page.calendar_event_title ?? "",
        calendar_event_description: page.calendar_event_description ?? "",

        brand_name: page.brand_name ?? "",
        logo_url: page.logo_url ?? "",
        primary_color: page.primary_color ?? "",
        confirmation_message: page.confirmation_message ?? "",
        redirect_url: page.redirect_url ?? "",
        cta_label: page.cta_label ?? "",
        show_team_member: page.show_team_member,
        show_timezone: page.show_timezone,
        require_phone: page.require_phone,
        questions: (page.questions ?? []).map((q) => ({
            id: q.id,
            label: q.label,
            type: q.type,
            required: !!q.required,
            options: q.options ?? [],
        })),
    };
}

/** Page fields only (no members/_count/public_url objects); members as {user_uuid, priority}. */
export function toBookingPagePayload(v: BookingPageFormValues): UpdateBookingPageDto {
    const durationOptions = [...new Set([v.duration_minutes, ...v.duration_options])].sort((a, b) => a - b);
    return {
        name: v.name.trim(),
        slug: v.slug.trim(),
        title: nullable(v.title),
        description: nullable(v.description),
        intro_text: nullable(v.intro_text),
        expectations: v.expectations.map((e) => e.trim()).filter(Boolean),
        is_active: v.is_active,
        is_default: v.is_default,
        location_type: v.location_type,
        location_value: nullable(v.location_value),

        duration_minutes: v.duration_minutes,
        duration_options: durationOptions,
        slot_interval_minutes: v.slot_interval_minutes,
        min_notice_minutes: v.min_notice_minutes,
        max_advance_days: v.max_advance_days,
        buffer_before_minutes: v.buffer_before_minutes,
        buffer_after_minutes: v.buffer_after_minutes,
        min_gap_minutes: v.min_gap_minutes,
        max_gap_minutes: v.max_gap_minutes,
        max_bookings_per_day: v.max_bookings_per_day,
        seats_per_slot: v.seats_per_slot,
        requires_confirmation: v.requires_confirmation,
        auto_log_meeting: v.auto_log_meeting,
        unavailable_slots_mode: v.unavailable_slots_mode,
        allow_cancellation: v.allow_cancellation,
        allow_reschedule: v.allow_reschedule,
        cancellation_deadline_minutes: v.cancellation_deadline_minutes,
        reschedule_deadline_minutes: v.reschedule_deadline_minutes,
        require_cancellation_reason: v.require_cancellation_reason,

        members: v.members.map((m) => ({ user_uuid: m.user_uuid, priority: m.priority })),
        assignment_mode: v.assignment_mode,
        allow_invitee_member_choice: v.allow_invitee_member_choice,

        send_confirmation_email: v.send_confirmation_email,
        send_reminder_emails: v.send_reminder_emails,
        reminder_offsets_minutes: [...new Set(v.reminder_offsets_minutes)].sort((a, b) => b - a),
        send_cancellation_email: v.send_cancellation_email,
        send_reschedule_email: v.send_reschedule_email,
        notify_assignee: v.notify_assignee,
        additional_recipients: [...new Set(v.additional_recipients.map((e) => e.trim().toLowerCase()))],
        include_meeting_link: v.include_meeting_link,
        include_calendar_details: v.include_calendar_details,
        create_team_reminder: v.create_team_reminder,
        team_reminder_offset_minutes: v.team_reminder_offset_minutes,
        confirmation_template_uuid: v.confirmation_template_uuid || null,
        reminder_template_uuid: v.reminder_template_uuid || null,
        cancellation_template_uuid: v.cancellation_template_uuid || null,
        reschedule_template_uuid: v.reschedule_template_uuid || null,
        calendar_event_title: nullable(v.calendar_event_title),
        calendar_event_description: nullable(v.calendar_event_description),

        brand_name: nullable(v.brand_name),
        logo_url: nullable(v.logo_url),
        primary_color: v.primary_color ? v.primary_color.toUpperCase() : null,
        confirmation_message: nullable(v.confirmation_message),
        redirect_url: nullable(v.redirect_url),
        cta_label: nullable(v.cta_label),
        show_team_member: v.show_team_member,
        show_timezone: v.show_timezone,
        require_phone: v.require_phone,
        questions: v.questions.map((q) => ({
            id: q.id,
            label: q.label.trim(),
            type: q.type,
            required: q.required,
            ...(q.type === "SELECT" ? { options: q.options.map((o) => o.trim()).filter(Boolean) } : {}),
        })),
    };
}

/** "What is your budget?" -> "what_is_your_budget". */
export function questionIdFromLabel(label: string): string {
    const base = label
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 40)
        .replace(/_+$/g, "");
    if (!base) return "question";
    return /^[a-z]/.test(base) ? base : `q_${base}`;
}

const FIELD_TAB: Partial<Record<keyof BookingPageFormValues, BookingPageTabId>> = {
    name: BookingPageTabIds.GENERAL,
    slug: BookingPageTabIds.GENERAL,
    title: BookingPageTabIds.GENERAL,
    description: BookingPageTabIds.GENERAL,
    intro_text: BookingPageTabIds.GENERAL,
    expectations: BookingPageTabIds.GENERAL,
    location_value: BookingPageTabIds.GENERAL,
    members: BookingPageTabIds.TEAM,
    reminder_offsets_minutes: BookingPageTabIds.NOTIFICATIONS,
    additional_recipients: BookingPageTabIds.NOTIFICATIONS,
    calendar_event_title: BookingPageTabIds.NOTIFICATIONS,
    calendar_event_description: BookingPageTabIds.NOTIFICATIONS,
    brand_name: BookingPageTabIds.BRANDING,
    logo_url: BookingPageTabIds.BRANDING,
    primary_color: BookingPageTabIds.BRANDING,
    confirmation_message: BookingPageTabIds.BRANDING,
    redirect_url: BookingPageTabIds.BRANDING,
    cta_label: BookingPageTabIds.BRANDING,
    questions: BookingPageTabIds.BRANDING,
};

/** Tab holding the first invalid field (scheduling fields are the fallback). */
export function firstErrorTab(errors: FieldErrors<BookingPageFormValues>): BookingPageTabId {
    const first = Object.keys(errors)[0] as keyof BookingPageFormValues | undefined;
    if (!first) return BookingPageTabIds.GENERAL;
    return FIELD_TAB[first] ?? BookingPageTabIds.SCHEDULING;
}

/** First human-readable message in an RHF error tree. */
export function firstErrorMessage(errors: unknown): string | null {
    if (!errors || typeof errors !== "object") return null;
    const record = errors as Record<string, unknown>;
    if (typeof record.message === "string" && record.message) return record.message;
    for (const [key, value] of Object.entries(record)) {
        if (key === "ref") continue;
        const nested = firstErrorMessage(value);
        if (nested) return nested;
    }
    return null;
}
