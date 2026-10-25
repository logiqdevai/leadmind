import { randomBytes } from 'crypto';

// No look-alike characters (0/o, 1/l/i) - codes are read aloud and typed from emails.
const CODE_ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz';
export const BOOKING_LINK_CODE_LENGTH = 10;

/** Short URL-safe random identifier (~49 bits of entropy) - never a database id. */
export function generateBookingLinkCode(length = BOOKING_LINK_CODE_LENGTH): string {
    const bytes = randomBytes(length);
    let code = '';
    for (let i = 0; i < length; i++) code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
    return code;
}

/** Secret for the invitee's manage (cancel / reschedule) links. */
export function generateManageToken(): string {
    return randomBytes(24).toString('base64url');
}

const trimSlash = (url: string) => url.replace(/\/+$/, '');

export const BookingPublicUrls = {
    page: (appUrl: string, code: string) => `${trimSlash(appUrl)}/book/${code}`,
    manage: (appUrl: string, token: string) => `${trimSlash(appUrl)}/book/manage/${token}`,
    cancel: (appUrl: string, token: string) => `${trimSlash(appUrl)}/book/manage/${token}?action=cancel`,
    reschedule: (appUrl: string, token: string) => `${trimSlash(appUrl)}/book/manage/${token}?action=reschedule`,
};
