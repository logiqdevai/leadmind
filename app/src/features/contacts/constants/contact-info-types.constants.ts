export const ContactInfoType = {
    EMAIL: "EMAIL",
    PHONE: "PHONE",
    SMS: "SMS",
    WEBSITE: "WEBSITE",
    LINKEDIN: "LINKEDIN",
    FACEBOOK: "FACEBOOK",
    INSTAGRAM: "INSTAGRAM",
    TWITTER: "TWITTER",
    WHATSAPP: "WHATSAPP",
    TELEGRAM: "TELEGRAM",
    YOUTUBE: "YOUTUBE",
    GOOGLE_MAPS: "GOOGLE_MAPS",
    OTHER: "OTHER",
} as const;

export type ContactInfoType = (typeof ContactInfoType)[keyof typeof ContactInfoType];

export const CONTACT_INFO_TYPE_OPTIONS: { value: ContactInfoType; label: string }[] = [
    { value: ContactInfoType.EMAIL, label: "Email" },
    { value: ContactInfoType.PHONE, label: "Phone" },
    { value: ContactInfoType.SMS, label: "SMS" },
    { value: ContactInfoType.WEBSITE, label: "Website" },
    { value: ContactInfoType.LINKEDIN, label: "LinkedIn" },
    { value: ContactInfoType.FACEBOOK, label: "Facebook" },
    { value: ContactInfoType.INSTAGRAM, label: "Instagram" },
    { value: ContactInfoType.TWITTER, label: "X / Twitter" },
    { value: ContactInfoType.WHATSAPP, label: "WhatsApp" },
    { value: ContactInfoType.TELEGRAM, label: "Telegram" },
    { value: ContactInfoType.YOUTUBE, label: "YouTube" },
    { value: ContactInfoType.GOOGLE_MAPS, label: "Google Maps" },
    { value: ContactInfoType.OTHER, label: "Other" },
];

export const CONTACT_INFO_TYPE_LABELS: Record<ContactInfoType, string> = Object.fromEntries(
    CONTACT_INFO_TYPE_OPTIONS.map((o) => [o.value, o.label]),
) as Record<ContactInfoType, string>;
