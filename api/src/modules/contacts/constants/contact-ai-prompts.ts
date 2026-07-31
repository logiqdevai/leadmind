import { Contact, Lead } from '@/generated/prisma';
import { formatContactForAi } from '../utils/contact-ai-profile.utils';

function languageDirective(language?: string, preservePlaceholders = true): string {
    if (!language) return '';
    const placeholderLine = preservePlaceholders
        ? '- Placeholder tokens (e.g. {{first_name}}, {{booking_url}}) MUST stay as-is in English, exactly as written. Do NOT translate them.'
        : '- Do NOT use curly-brace placeholders (e.g. {{first_name}}). Write concrete names and details from the lead profile.';
    return `
OUTPUT LANGUAGE — STRICT:
- Write the entire output (subject if any, and body) in ${language}.
- Use natural ${language} idiom and tone for B2B outreach. Do NOT mix languages.
${placeholderLine}
`.trim();
}

function senderBusinessBlock(sender_business_description?: string): string {
    if (!sender_business_description) return '';
    return `
SENDER / BUSINESS CONTEXT (what the sender's company does and the services they offer — use to ground the message; do not quote verbatim):
"""
${sender_business_description}
"""
`.trim();
}

const EMAIL_FOOTER_PLACEHOLDERS = [
    '{{first_name}}',
    '{{last_name}}',
    '{{full_name}}',
    '{{title}}',
    '{{company_name}}',
    '{{email}}',
    '{{phone}}',
    '{{website}}',
    '{{website_display}}',
    '{{booking_url}}',
    '{{address}}',
    '{{city}}',
    '{{country}}',
    '{{logo_url}}',
    '{{signature}}',
].join(', ');

const SMS_FOOTER_PLACEHOLDERS = [
    '{{first_name}}',
    '{{full_name}}',
    '{{company_name}}',
    '{{booking_url}}',
].join(', ');

function noSenderProfileRules(): string {
    return `
NO SENDER PROFILE — STRICT (MOST IMPORTANT):
- No sender profile is configured for this account.
- Do NOT use sender placeholders ({{full_name}}, {{first_name}}, {{address}}, {{email}}, {{phone}}, {{website}}, {{booking_url}}, {{company_name}}, {{title}}, {{signature}}, etc.).
- Do NOT write fill-in blanks like [full name], [address], [Your Name], [Company], [phone], or similar.
- Sign off politely without a name or contact block (e.g. just "Best," / "Thanks,"). Omit the footer contact details entirely.
- Soft CTAs are fine in plain words; do not invent calendar or website links.
`.trim();
}

function emailSignOffRules(has_sender_profile: boolean): string {
    if (!has_sender_profile) {
        return `
SIGN-OFF / FOOTER RULES — STRICT:
- End with a polite sign-off only (e.g. <p>Best,</p>). No name, title, company, email, phone, address, or links in the footer.
`.trim();
    }
    return `
SIGN-OFF / FOOTER RULES — STRICT:
- The email MUST end with a polite sign-off plus a sender contact block.
- For sender details use ONLY these placeholders, exactly as written, including the double curly braces:
  ${EMAIL_FOOTER_PLACEHOLDERS}
- Placeholders are replaced with the sender's real profile data at send time. Do NOT invent placeholders, do NOT use square brackets like [Your Name], do NOT write any real or made-up personal/contact info.
- A good footer looks like:
  <p>Best,<br><img src="{{logo_url}}" alt="Logo" width="96" style="max-width:96px;width:96px;height:auto;display:inline-block;border:0;outline:none"><br><strong>{{full_name}}</strong><br>{{title}} · {{company_name}}<br>{{email}} · {{phone}}<br><a href="{{website}}">{{website_display}}</a></p>
- It is fine to omit any placeholder that would not naturally appear (e.g. drop {{phone}} or {{logo_url}} for a more text-only feel). Do not pad with placeholders for their own sake.
- Body usage: signing off with {{first_name}} inline is fine, and the CTA may use the {{booking_url}} anchor pattern above. Placeholders are NOT allowed in the subject line.
`.trim();
}

function emailUrlRules(has_sender_profile: boolean): string {
    if (!has_sender_profile) {
        return `
URL / LINK RULES — STRICT:
- Every URL or web destination you mention MUST be wrapped in an <a href="..."> tag. Never write a bare URL.
- Anchor href values must be http/https/mailto URLs. Do not use {{website}} or {{booking_url}}.
- Prefer a soft CTA in words without inventing a booking or website link.
`.trim();
    }
    return `
URL / LINK RULES — STRICT (MOST IMPORTANT):
- Every URL or web destination you mention MUST be wrapped in an <a href="..."> tag. Never write a bare URL or a placeholder-as-text in the body.
- The website link in the footer is MANDATORY when {{website}} is used, and MUST be written EXACTLY like this:
    <a href="{{website}}">{{website_display}}</a>
  - {{website}} is the full URL (with protocol) and goes ONLY inside href.
  - {{website_display}} is the host-only form (no protocol, no trailing slash) and goes ONLY as the visible link text.
  - NEVER write {{website}} as link text. NEVER write {{website_display}} as an href. NEVER use them outside of this exact pair.
- A "book a call" / CTA link MUST be written EXACTLY like this (only the link text can vary):
    <a href="{{booking_url}}">grab a slot on my calendar</a>
  - {{booking_url}} goes ONLY inside href. NEVER as visible link text. NEVER as a bare URL.
- A company logo MUST be written EXACTLY like this when included:
    <img src="{{logo_url}}" alt="Logo" width="96" style="max-width:96px;width:96px;height:auto;display:inline-block;border:0;outline:none">
  - {{logo_url}} goes ONLY inside img src. NEVER as visible text. NEVER invent an image URL. Keep width at 96 (footer-sized).
- The href/src value is a literal placeholder string (e.g. href="{{booking_url}}" or src="{{logo_url}}") — do NOT replace, translate, prefix, suffix, or interpolate it.
`.trim();
}

function smsSignOffRules(has_sender_profile: boolean): string {
    if (!has_sender_profile) {
        return `
SIGN-OFF RULES — STRICT:
- Sign off without a name or company (or skip the sign-off). Do not use sender placeholders or blanks like [full name].
- Soft CTA in words only — no {{booking_url}} and no invented links.
`.trim();
    }
    return `
SIGN-OFF RULES — STRICT:
- If you sign off, use ONLY these placeholders (exactly as written, including the double curly braces):
  ${SMS_FOOTER_PLACEHOLDERS}
- Placeholders are replaced with the sender's profile data at send time. Do NOT invent placeholders, do NOT use square brackets like [Your Name], do NOT write any real or made-up sender info.
- A typical sign-off is "- {{first_name}}" or "- {{first_name}} @ {{company_name}}". Keep it minimal — the 160-char limit includes the rendered placeholder values.
- If you include a CTA to book a call, use the {{booking_url}} placeholder as a bare URL (no anchor / no markdown), e.g. "Book a call: {{booking_url}}".
`.trim();
}

function linkedInSignOffRules(has_sender_profile: boolean): string {
    if (!has_sender_profile) {
        return `
SIGN-OFF RULES — STRICT:
- Sign off without a name or company (or skip the sign-off). Do not use sender placeholders or blanks like [full name].
`.trim();
    }
    return `
SIGN-OFF RULES — STRICT:
- If you sign off, use ONLY these placeholders (exactly as written, including the double curly braces):
  ${SMS_FOOTER_PLACEHOLDERS}
- Do NOT invent placeholders, do NOT use square brackets like [Your Name], do NOT write any real or made-up sender info.
`.trim();
}

export function buildScorePrompt(contact: Contact, lead: Lead, scoring_instructions: string): string {
    return `
You are scoring a sales lead from 1 (poor fit) to 10 (excellent fit) for a user with these targeting criteria:

USER SCORING / TARGETING CRITERIA:
"""
${scoring_instructions}
"""

LEAD PROFILE:
"""
${formatContactForAi(contact, lead)}
"""

Return:
- score: integer 1-10
- reasoning: 1-2 sentences explaining the rating, referencing the targeting criteria
`.trim();
}

export function buildEmailPrompt(
    contact: Contact,
    lead: Lead,
    outreach_instructions: string,
    language?: string,
    sender_business_description?: string,
    has_sender_profile = true,
): string {
    const ctaLine = has_sender_profile
        ? '<HTML body, 80-150 words, formal-but-warm tone, ending with a clear soft CTA (prefer offering a call via the {{booking_url}} placeholder when relevant) followed by a sign-off / footer>'
        : '<HTML body, 80-150 words, formal-but-warm tone, ending with a clear soft CTA in words and a polite sign-off with no sender contact block>';

    return `
You are drafting a cold outreach EMAIL for the lead below.

TARGET CHANNEL: EMAIL — produce a normal email with a subject line and an HTML body. Do not write SMS or LinkedIn DM style.

${has_sender_profile ? '' : noSenderProfileRules()}

${languageDirective(language)}

${senderBusinessBlock(sender_business_description)}

USER OUTREACH INSTRUCTIONS:
"""
${outreach_instructions}
"""

LEAD PROFILE:
"""
${formatContactForAi(contact, lead)}
"""

Output format (no markdown, no commentary, no code fences):
Subject: <subject line, under 80 chars>

${ctaLine}

HTML BODY RULES — STRICT:
- Use ONLY these tags: <p>, <br>, <strong>, <em>, <u>, <ul>, <ol>, <li>, <a href="...">, <h1>, <h2>, <h3>${has_sender_profile ? ', <img src="..." alt="..." width="..."' : ''}.
- Wrap each paragraph in <p>...</p>. Use <br> only for intentional intra-paragraph line breaks.
- Do NOT include inline styles, class, id, data-* attributes, or any on* event handlers.
- Do NOT include <script>, <iframe>, ${has_sender_profile ? '' : '<img>, '}<style>, <html>, <body>, <head>, or <meta>.
- Anchor href values must be either http/https/mailto URLs${has_sender_profile ? ' OR one of the URL placeholders below ({{website}}, {{booking_url}})' : ''}. NEVER use other schemes.
${has_sender_profile ? '- Logo images MUST use {{logo_url}} as src only, footer-sized: <img src="{{logo_url}}" alt="Logo" width="96" style="max-width:96px;width:96px;height:auto;display:inline-block;border:0;outline:none">. Never invent image URLs.\n' : ''}- Do NOT wrap the output in <html>/<body> or in a markdown code block.

${emailUrlRules(has_sender_profile)}

${emailSignOffRules(has_sender_profile)}
`.trim();
}

export function buildSmsPrompt(
    contact: Contact,
    lead: Lead,
    outreach_instructions: string,
    language?: string,
    sender_business_description?: string,
    has_sender_profile = true,
): string {
    return `
Draft a cold outreach SMS for this lead.

TARGET CHANNEL: SMS — single text message only. Hard limit: 160 characters. No subject lines. No LinkedIn fluff.

${has_sender_profile ? '' : noSenderProfileRules()}

${languageDirective(language)}

${senderBusinessBlock(sender_business_description)}

USER OUTREACH INSTRUCTIONS:
"""
${outreach_instructions}
"""

LEAD PROFILE:
"""
${formatContactForAi(contact, lead)}
"""

${smsSignOffRules(has_sender_profile)}

Output: only the SMS body. No subject. No quotes. No commentary.
`.trim();
}

export function buildLinkedInPrompt(
    contact: Contact,
    lead: Lead,
    outreach_instructions: string,
    language?: string,
    sender_business_description?: string,
    has_sender_profile = true,
): string {
    return `
Draft a LinkedIn outreach DM for this lead.

TARGET CHANNEL: LINKEDIN — short connection/conversation DM (not an email, not SMS).

${has_sender_profile ? '' : noSenderProfileRules()}

${languageDirective(language)}

${senderBusinessBlock(sender_business_description)}

USER OUTREACH INSTRUCTIONS:
"""
${outreach_instructions}
"""

LEAD PROFILE:
"""
${formatContactForAi(contact, lead)}
"""

${linkedInSignOffRules(has_sender_profile)}

Output: only the DM body. No commentary.
`.trim();
}

export function buildPhoneCallPrompt(
    contact: Contact,
    lead: Lead,
    outreach_instructions: string,
    language?: string,
    sender_business_description?: string,
    _has_sender_profile = true,
): string {
    return `
Draft a cold outbound CALL SCRIPT for a sales rep calling this lead.

TARGET CHANNEL: PHONE CALL — plain-text talking points the rep reads on a live call. Not an email, not SMS, not LinkedIn.

${languageDirective(language, false)}

${senderBusinessBlock(sender_business_description)}

USER OUTREACH INSTRUCTIONS:
"""
${outreach_instructions}
"""

LEAD PROFILE:
"""
${formatContactForAi(contact, lead)}
"""

SCRIPT RULES — STRICT:
- Structure with short labeled sections: Opening, Value hook, Discovery questions, Objection handling, Close / next step.
- Conversational spoken language — short sentences, easy to read aloud.
- Personalize using the lead's actual name, company, and context from LEAD PROFILE above — not placeholder tokens.
- Do NOT use curly-brace placeholders (e.g. {{first_name}}, {{booking_url}}). Do NOT use square brackets like [Your Name].
- No HTML. No markdown headings with #. No subject line.

Output: only the call script body. No commentary.
`.trim();
}

export const AiScoringSystemPrompt = `
You are a sales-qualification assistant scoring leads against targeting criteria.
`;
