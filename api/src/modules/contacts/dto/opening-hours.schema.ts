import { WEEKDAYS } from '../utils/opening-hours.utils';

/** OpenAPI schema for a contact's opening hours (also what MCP tools show to agents). */
export const OPENING_HOURS_API_SCHEMA = {
    type: 'object',
    nullable: true,
    description:
        'Opening hours per weekday, 24-hour HH:MM. A weekday with no intervals (or omitted) is closed; use several intervals for split shifts. A close earlier than the open means it closes after midnight; "24:00" is midnight at the end of the day. Send null (or all days empty) to clear the hours.',
    properties: Object.fromEntries(
        WEEKDAYS.map((day) => [
            day,
            {
                type: 'array',
                maxItems: 4,
                items: {
                    type: 'object',
                    required: ['open', 'close'],
                    properties: {
                        open: { type: 'string', example: '09:00' },
                        close: { type: 'string', example: '17:00' },
                    },
                },
            },
        ]),
    ),
    example: {
        monday: [{ open: '09:00', close: '17:00' }],
        tuesday: [
            { open: '09:00', close: '12:00' },
            { open: '14:00', close: '18:00' },
        ],
        sunday: [],
    },
} as const;
