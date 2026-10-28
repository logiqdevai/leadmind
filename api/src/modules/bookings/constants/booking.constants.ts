import { BookingStatus } from '@/generated/prisma';

/** Statuses that occupy the slot and count towards availability. */
export const ACTIVE_BOOKING_STATUSES: BookingStatus[] = [
    BookingStatus.PENDING,
    BookingStatus.CONFIRMED,
    BookingStatus.RESCHEDULED,
];

/** Statuses that get a Google Calendar event. Pending bookings wait for internal confirmation. */
export const CALENDAR_SYNCED_STATUSES: BookingStatus[] = [BookingStatus.CONFIRMED, BookingStatus.RESCHEDULED];

/** Largest window one slot query may scan. */
export const MAX_SLOT_RANGE_DAYS = 62;

/** External (Google) busy time is cached briefly so a visitor paging through dates doesn't hammer the API. */
export const EXTERNAL_BUSY_CACHE_TTL_SECONDS = 60;

export const CALENDAR_SYNC_ATTEMPTS = 5;
export const NOTIFICATION_SEND_ATTEMPTS = 3;

export const BookingJobNames = {
    SEND: 'send',
    REMINDER: 'reminder',
    SYNC: 'sync',
    INVITE_REMINDER: 'invite-reminder',
} as const;

export const BookingErrorCodes = {
    SLOT_UNAVAILABLE: 'slot_unavailable',
    LINK_INACTIVE: 'booking_link_inactive',
    DEADLINE_PASSED: 'deadline_passed',
} as const;

export const BookingRateLimits = {
    view: { bucket: 'public-booking-view', limit: 60, window_seconds: 60 },
    slots: { bucket: 'public-booking-slots', limit: 90, window_seconds: 60 },
    book: { bucket: 'public-booking-book', limit: 10, window_seconds: 600 },
    manage: { bucket: 'public-booking-manage', limit: 20, window_seconds: 600 },
} as const;

export const DEFAULT_BOOKING_DURATIONS = [15, 30, 45, 60, 90, 120];
