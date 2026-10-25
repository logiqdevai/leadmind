import { Contact, Lead } from '@/generated/prisma';
import { JEV_CONTACT_SCORE_LEVELS } from '../constants/contact-score-levels';

/** Same profile fields as formatContactForAi, as a Jev state object; empty fields are omitted. */
export function buildContactJevState(contact: Contact, lead: Lead): Record<string, string> {
    const enrichment_summary =
        contact.enrichment_summary?.trim() || lead.enrichment_summary?.trim() || '';

    const profile: Record<string, string | null | undefined> = {
        name: contact.name,
        title: contact.title,
        company: contact.company,
        industry: contact.industry,
        location: contact.location,
        website: contact.website,
        google_maps_url: contact.google_maps_url,
        email: contact.email,
        phone: contact.phone,
        linkedin_url: contact.linkedin_url,
        description: contact.description,
        website_summary: enrichment_summary,
    };

    return Object.fromEntries(
        Object.entries(profile).filter(
            (entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].trim() !== '',
        ),
    );
}

/** Jev's probability-weighted score is 0-based; stored ContactScore is an integer 1-10. */
export function jevScoreToContactScore(raw: number): number {
    const max = JEV_CONTACT_SCORE_LEVELS.length;
    return Math.min(max, Math.max(1, Math.round(raw) + 1));
}
