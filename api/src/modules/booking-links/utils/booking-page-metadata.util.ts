/** Outreach message metadata key holding the booking page picked in the composer for `{{booking_link}}`. */
export const BOOKING_PAGE_METADATA_KEY = 'booking_page_uuid';

export function parseBookingPageMetadata(metadata: unknown): string | null {
    if (!metadata || typeof metadata !== 'object') return null;
    const value = (metadata as Record<string, unknown>)[BOOKING_PAGE_METADATA_KEY];
    return typeof value === 'string' && value ? value : null;
}
