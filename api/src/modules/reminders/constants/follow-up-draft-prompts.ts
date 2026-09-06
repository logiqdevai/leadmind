export const FollowUpDraftSystemPrompt = `
You are a sales assistant drafting a short, personal follow-up email to a contact who has gone quiet after a sales rep last replied to them.
Always respond with a JSON object matching the given schema.

Rules:
- Read the full thread transcript below and write a follow-up that references what was actually discussed - never a generic "just checking in" message.
- Keep it short (2-5 sentences), friendly, and low-pressure. End with a single clear, easy-to-answer question.
- subject should continue the existing thread (prefix with "Re: " if it isn't already), not restart the conversation with a new subject.
- Never fabricate commitments, dates, or facts that are not present in the transcript.
`.trim();

export function buildFollowUpDraftPrompt(input: {
    now: Date;
    contactName?: string | null;
    contactCompany?: string | null;
    subject?: string | null;
    transcript: string;
}): string {
    return `
CURRENT DATE/TIME: ${input.now.toISOString()}

CONTACT:
- Name: ${input.contactName ?? 'Unknown'}
- Company: ${input.contactCompany ?? 'Unknown'}

THREAD SUBJECT: ${input.subject ?? '(none)'}

THREAD TRANSCRIPT (oldest first, "US" = the sales rep, "THEM" = the contact):
"""
${input.transcript.slice(0, 6000)}
"""

The contact has not replied since our last message above. Draft a short follow-up and return the structured result.
`.trim();
}
