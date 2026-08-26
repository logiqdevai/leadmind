export enum OrganisationCopyCategory {
    SENDER_PROFILES = 'SENDER_PROFILES',
    TEMPLATES = 'TEMPLATES',
    INTEGRATIONS = 'INTEGRATIONS',
    FILTERS = 'FILTERS',
    CONTACTS = 'CONTACTS',
    LISTS = 'LISTS',
    SEQUENCES = 'SEQUENCES',
    CAMPAIGNS = 'CAMPAIGNS',
    FORMS = 'FORMS',
    REMINDERS = 'REMINDERS',
    USERS = 'USERS',
    GOALS = 'GOALS',
    INTEGRATION_GOALS = 'INTEGRATION_GOALS',
}

// Fixed processing order: later categories may reference records created by
// earlier ones (e.g. sequences reference templates), so this order is always
// followed regardless of the order the caller listed categories in.
export const ORGANISATION_COPY_CATEGORY_ORDER: OrganisationCopyCategory[] = [
    OrganisationCopyCategory.SENDER_PROFILES,
    OrganisationCopyCategory.TEMPLATES,
    OrganisationCopyCategory.INTEGRATIONS,
    OrganisationCopyCategory.FILTERS,
    OrganisationCopyCategory.CONTACTS,
    OrganisationCopyCategory.LISTS,
    OrganisationCopyCategory.SEQUENCES,
    OrganisationCopyCategory.CAMPAIGNS,
    OrganisationCopyCategory.FORMS,
    OrganisationCopyCategory.REMINDERS,
    OrganisationCopyCategory.USERS,
    OrganisationCopyCategory.GOALS,
    OrganisationCopyCategory.INTEGRATION_GOALS,
];
