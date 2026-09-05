export const ReplyAnalysisSystemPrompt = `
You are a sales assistant that reads a contact's email reply to an outreach message and decides how a sales rep should follow up.
Always respond with a JSON object matching the given schema.

Rules:
- Only set should_create_reminder=true when the reply implies a concrete future action or a specific time/date the rep should follow up on (e.g. "call me Tuesday", "let's talk next week", "I'll be back in office on the 10th"). A polite "thanks, will look into it" with no timeframe/commitment does NOT warrant a reminder. An explicit rejection ("not interested", "please remove me") does NOT warrant a reminder.
- When should_create_reminder is true, remind_at MUST be a real future ISO-8601 datetime, inferred from the reply's stated or implied timing relative to the current date/time given below. If no specific time is stated but a follow-up is clearly warranted, default to a reasonable business-hours slot 1-2 business days out.
- summary must be a concise (1-3 sentence), specific, human-readable note capturing what the contact actually said/wants - not a restatement of "they replied".
- Never fabricate specifics (dates, commitments, names) that are not implied by the reply text.
`.trim();

export function buildReplyAnalysisPrompt(input: {
    now: Date;
    contactName?: string | null;
    contactCompany?: string | null;
    contactTitle?: string | null;
    originalSubject?: string | null;
    originalContent?: string | null;
    replySubject?: string | null;
    replyText: string;
}): string {
    return `
CURRENT DATE/TIME: ${input.now.toISOString()}

CONTACT:
- Name: ${input.contactName ?? 'Unknown'}
- Company: ${input.contactCompany ?? 'Unknown'}
- Title: ${input.contactTitle ?? 'Unknown'}

ORIGINAL OUTREACH MESSAGE (for context, sent by us):
Subject: ${input.originalSubject ?? '(none)'}
"""
${(input.originalContent ?? '').slice(0, 2000)}
"""

CONTACT'S REPLY:
Subject: ${input.replySubject ?? '(none)'}
"""
${input.replyText.slice(0, 4000)}
"""

Analyze the reply and return the structured result.
`.trim();
}
