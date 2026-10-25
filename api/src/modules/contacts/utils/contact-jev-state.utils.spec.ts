import { Contact, Lead } from '@/generated/prisma';
import { buildContactJevState, jevScoreToContactScore } from './contact-jev-state.utils';

describe('jevScoreToContactScore', () => {
    it('maps the 0-based Jev score to 1-10', () => {
        expect(jevScoreToContactScore(0)).toBe(1);
        expect(jevScoreToContactScore(9)).toBe(10);
        expect(jevScoreToContactScore(4.4)).toBe(5);
        expect(jevScoreToContactScore(4.5)).toBe(6);
    });

    it('clamps out-of-range values', () => {
        expect(jevScoreToContactScore(-3)).toBe(1);
        expect(jevScoreToContactScore(42)).toBe(10);
    });
});

describe('buildContactJevState', () => {
    const lead = { enrichment_summary: 'Lead summary' } as Lead;

    it('omits empty fields', () => {
        const state = buildContactJevState(
            { name: 'Ada', title: null, company: '  ', enrichment_summary: null } as unknown as Contact,
            lead,
        );
        expect(state).toEqual({ name: 'Ada', website_summary: 'Lead summary' });
    });

    it('prefers the contact enrichment summary over the lead one', () => {
        const state = buildContactJevState(
            { enrichment_summary: ' Contact summary ' } as unknown as Contact,
            lead,
        );
        expect(state.website_summary).toBe('Contact summary');
    });
});
