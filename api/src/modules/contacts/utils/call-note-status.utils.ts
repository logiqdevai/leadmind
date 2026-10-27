import { CallNoteStatus } from '@/generated/prisma';

/** The text each status puts in the call's notes (what the Quick note dropdown fills in). */
export const CALL_NOTE_STATUS_LABELS: Record<CallNoteStatus, string> = {
    [CallNoteStatus.NOT_AVAILABLE]: 'Not available',
    [CallNoteStatus.NOT_INTERESTED]: 'Not interested',
    [CallNoteStatus.CALL_LATER]: 'Call later',
    [CallNoteStatus.SEND_INFO]: 'Asked to send more info',
    [CallNoteStatus.WRONG_NUMBER]: 'Wrong number',
    [CallNoteStatus.DO_NOT_CALL]: "Don't call me again",
    [CallNoteStatus.INTERESTED]: 'Interested',
    [CallNoteStatus.MEETING_BOOKED]: 'Meeting booked',
    [CallNoteStatus.ALREADY_CUSTOMER]: 'Already a customer',
    [CallNoteStatus.USING_COMPETITOR]: 'Uses a competitor',
    [CallNoteStatus.NO_BUDGET]: 'No budget',
    [CallNoteStatus.NOT_DECISION_MAKER]: 'Not the decision maker',
    [CallNoteStatus.GATEKEEPER]: 'Spoke to gatekeeper',
};

const normalise = (text: string): string =>
    text
        .toLowerCase()
        .replace(/[‘’]/g, "'")
        .replace(/[.!?;:,\s]+$/g, '')
        .trim();

/** Notes written before statuses existed were the preset label, so an exact line match is the strongest signal. */
const LABEL_LOOKUP = new Map<string, CallNoteStatus>(
    (Object.entries(CALL_NOTE_STATUS_LABELS) as [CallNoteStatus, string][]).map(([status, label]) => [
        normalise(label),
        status,
    ]),
);

/** Free-text fallbacks, checked in order, so the more specific outcome wins ("not interested" before "interested"). */
const KEYWORD_RULES: { status: CallNoteStatus; pattern: RegExp }[] = [
    {
        status: CallNoteStatus.DO_NOT_CALL,
        pattern: /do(?:n't| not)\s+call\b.*\b(?:again|anymore|any more)|stop calling|remove (?:me|us|them|him|her)? ?from (?:the |your |our )?(?:list|calling)|do not contact|dnc\b/,
    },
    { status: CallNoteStatus.WRONG_NUMBER, pattern: /wrong number|incorrect number|number (?:is )?(?:wrong|incorrect|not in use|disconnected)|not (?:his|her|their|the right) number/ },
    { status: CallNoteStatus.NOT_INTERESTED, pattern: /not interested|no interest|isn't interested|aren't interested|declined|not looking/ },
    { status: CallNoteStatus.MEETING_BOOKED, pattern: /(?:booked|scheduled|set up|arranged|agreed to)\s+(?:a |the |an )?(?:meeting|demo|appointment)|meeting (?:booked|scheduled|confirmed)|demo (?:booked|scheduled)/ },
    { status: CallNoteStatus.ALREADY_CUSTOMER, pattern: /already (?:a |our )?customer|existing (?:customer|client)|already (?:uses|using|has) (?:us|our)/ },
    { status: CallNoteStatus.USING_COMPETITOR, pattern: /competitor|already (?:uses|using|has|works with|working with)\b|happy with (?:their )?current/ },
    { status: CallNoteStatus.NO_BUDGET, pattern: /no budget|budget (?:not approved|issue|constraint|freeze)|can't afford|cannot afford|too expensive/ },
    { status: CallNoteStatus.NOT_DECISION_MAKER, pattern: /not the (?:decision ?maker|owner)|not (?:a |the )?decision[- ]maker|(?:owner|manager|boss) (?:is )?(?:not|isn't)|speak to (?:the )?(?:owner|manager|boss)/ },
    { status: CallNoteStatus.GATEKEEPER, pattern: /gatekeeper|receptionist|secretary|assistant (?:answered|picked)/ },
    { status: CallNoteStatus.SEND_INFO, pattern: /send (?:me |us |them )?(?:more )?(?:info|information|details|an email|email|a proposal|brochure|pricing)|asked (?:me )?to send|email (?:me|us) (?:the )?(?:info|details)/ },
    { status: CallNoteStatus.CALL_LATER, pattern: /call (?:me |him |her |them |us )?(?:back )?(?:later|tomorrow|next)|call ?back|ring (?:me )?back|try again later|follow up (?:next|later|in)/ },
    { status: CallNoteStatus.NOT_AVAILABLE, pattern: /not available|unavailable|not in (?:the )?office|out of office|busy right now|in a meeting|not there/ },
    { status: CallNoteStatus.INTERESTED, pattern: /\binterested\b|sounds good|wants to know more|open to/ },
];

/**
 * Works out which call status a logged call's notes correspond to, or null when the text doesn't
 * clearly say. Lines that are exactly a preset label win (the last one, since a newer pick is
 * appended below older ones); otherwise the first keyword rule that matches the whole text applies.
 */
export function detectCallNoteStatus(text: string | null | undefined): CallNoteStatus | null {
    if (!text?.trim()) return null;

    const lines = text.split(/\r?\n/);
    for (let i = lines.length - 1; i >= 0; i--) {
        const status = LABEL_LOOKUP.get(normalise(lines[i]));
        if (status) return status;
    }

    const haystack = text.toLowerCase().replace(/[‘’]/g, "'");
    return KEYWORD_RULES.find((rule) => rule.pattern.test(haystack))?.status ?? null;
}
