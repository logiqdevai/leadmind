export const CONTACT_INFO_TYPES = [
    'EMAIL',
    'PHONE',
    'SMS',
    'WEBSITE',
    'LINKEDIN',
    'FACEBOOK',
    'INSTAGRAM',
    'TWITTER',
    'WHATSAPP',
    'TELEGRAM',
    'YOUTUBE',
    'GOOGLE_MAPS',
    'OTHER',
] as const;

export type ContactInfoTypeValue = (typeof CONTACT_INFO_TYPES)[number];
