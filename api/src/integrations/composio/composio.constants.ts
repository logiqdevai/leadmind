export const GOOGLE_CALENDAR_TOOLKIT = 'googlecalendar';

/** Name of the auth config created automatically when no COMPOSIO_GOOGLE_CALENDAR_AUTH_CONFIG_ID is set. */
export const MANAGED_AUTH_CONFIG_NAME = 'LeadMind Google Calendar (managed)';

/** Composio connected-account statuses that still allow API calls. */
export const COMPOSIO_ACTIVE_STATUS = 'ACTIVE';

/** Statuses after which the member has to reconnect their Google account. */
export const COMPOSIO_RECONNECT_STATUSES = ['EXPIRED', 'FAILED', 'INACTIVE', 'REVOKED'] as const;

/** Composio is a shared project; namespace user ids so one person's calendars stay per organisation. */
export const composioUserId = (organisation_uuid: string, user_uuid: string) =>
    `leadmind:${organisation_uuid}:${user_uuid}`;
