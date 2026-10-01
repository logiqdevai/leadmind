export const ContactSortField = {
    NAME: 'name',
    COMPANY: 'company',
    EMAIL: 'email',
    PHONE: 'phone',
    WEBSITE: 'website',
    STATUS: 'status',
    LAST_INTERACTION_AT: 'last_interaction_at',
    CREATED_AT: 'created_at',
} as const;

export type ContactSortField = (typeof ContactSortField)[keyof typeof ContactSortField];

export const CONTACT_SORT_FIELD_KEYS = Object.values(ContactSortField);

export const SortOrder = {
    ASC: 'asc',
    DESC: 'desc',
} as const;

export type SortOrder = (typeof SortOrder)[keyof typeof SortOrder];

export const SORT_ORDER_KEYS = Object.values(SortOrder);
