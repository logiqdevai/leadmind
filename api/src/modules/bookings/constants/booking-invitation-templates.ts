import { BookingInviteUnit } from '@/generated/prisma';

export const INVITE_UNIT_MINUTES: Record<BookingInviteUnit, number> = {
    HOURS: 60,
    DAYS: 24 * 60,
    WEEKS: 7 * 24 * 60,
};

/** Longest wait between two emails of one invitation. */
export const MAX_INVITE_DELAY_MINUTES = 90 * 24 * 60;

export const DEFAULT_INVITE_REMINDER_SETTINGS = {
    reminder_enabled: true,
    reminder_delay_value: 3,
    reminder_delay_unit: BookingInviteUnit.DAYS,
    max_reminders: 1,
};

/**
 * Plain-text templates (blank line = new paragraph). Variables: {{contact.first_name}}, {{contact.full_name}},
 * {{booking.title}}, {{brand.name}}, {{sender.name}}, {{organisation.name}}, {{booking_link}} and
 * {{booking_button}}. The link is appended automatically when a custom message leaves both out.
 */
export const DEFAULT_INVITE_TEXT = {
    invite_subject: 'Pick a time: {{booking.title}}',
    invite_message:
        'Hi {{contact.first_name}},\n\nPlease pick a time that works for you for {{booking.title}}.\n\n{{booking_button}}\n\nSpeak soon,\n{{sender.name}}',
    reminder_subject: 'Reminder: pick a time for {{booking.title}}',
    reminder_message:
        'Hi {{contact.first_name}},\n\nA quick reminder to pick a time for {{booking.title}} - we have not seen a booking from you yet.\n\n{{booking_button}}\n\nSpeak soon,\n{{sender.name}}',
} as const;
