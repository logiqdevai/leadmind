import { ContactSortField } from '@/modules/contacts/constants/contact-sort-fields.constants';

export const ContactListMemberSortField = {
    ...ContactSortField,
    ADDED_AT: 'added_at',
    LIST_STATUS: 'list_status',
    CALLED: 'called',
    REMINDER: 'reminder',
} as const;

export type ContactListMemberSortField =
    (typeof ContactListMemberSortField)[keyof typeof ContactListMemberSortField];

export const CONTACT_LIST_MEMBER_SORT_FIELD_KEYS = Object.values(ContactListMemberSortField);
