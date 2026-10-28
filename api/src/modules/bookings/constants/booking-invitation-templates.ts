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
 * Plain-text defaults (blank line = new paragraph), used when the organisation has neither picked message templates
 * nor written its own text. Variables: {{contact.first_name}}, {{contact.full_name}}, {{booking.title}},
 * {{brand.name}}, {{sender.name}}, {{organisation.name}}, {{signature}}, {{booking_link}} and {{booking_button}}.
 * The link is appended automatically when a custom message leaves both link variables out.
 */
export const DEFAULT_INVITE_TEXT = {
    invite_subject: "Let's find a time: {{booking.title}}",
    invite_message:
        'Hi {{contact.first_name}},\n\nWe would love to find a time to speak. Pick whatever suits you best for {{booking.title}} using the button below, and we will take care of the rest.\n\n{{booking_button}}\n\nIf none of the times work, just reply to this email and we will find another one.\n\n{{signature}}',
    reminder_subject: 'Still keen to talk? Pick a time for {{booking.title}}',
    reminder_message:
        'Hi {{contact.first_name}},\n\nJust a friendly nudge - we have not seen a booking from you yet, and choosing a time only takes a minute.\n\n{{booking_button}}\n\nIf now is not a good moment, just let us know and we will follow up later.\n\n{{signature}}',
} as const;

/** Greek counterpart of DEFAULT_INVITE_TEXT, sent to contacts whose language is Greek. */
export const DEFAULT_INVITE_TEXT_EL = {
    invite_subject: 'Ας βρούμε μια ώρα: {{booking.title}}',
    invite_message:
        'Γεια σας {{contact.first_name}},\n\nΘα χαρούμε πολύ να μιλήσουμε μαζί σας. Επιλέξτε την ώρα που σας βολεύει για το {{booking.title}} από το παρακάτω κουμπί και φροντίζουμε εμείς τα υπόλοιπα.\n\n{{booking_button}}\n\nΑν καμία από τις διαθέσιμες ώρες δεν σας ταιριάζει, απαντήστε σε αυτό το email και θα βρούμε κάποια άλλη.\n\n{{signature}}',
    reminder_subject: 'Θέλετε ακόμα να μιλήσουμε; Επιλέξτε ώρα για το {{booking.title}}',
    reminder_message:
        'Γεια σας {{contact.first_name}},\n\nΜια φιλική υπενθύμιση - δεν έχουμε δει ακόμα κάποια κράτηση από εσάς, και η επιλογή ώρας παίρνει μόνο ένα λεπτό.\n\n{{booking_button}}\n\nΑν δεν βολεύει αυτή τη στιγμή, πείτε μας και θα επικοινωνήσουμε ξανά αργότερα.\n\n{{signature}}',
} as const;

export type DefaultInviteText = { [K in keyof typeof DEFAULT_INVITE_TEXT]: string };

/** Built-in text in the contact's language; English unless a Greek translation exists. */
export function defaultInviteText(language: string | null): DefaultInviteText {
    return language === 'el' ? DEFAULT_INVITE_TEXT_EL : DEFAULT_INVITE_TEXT;
}
