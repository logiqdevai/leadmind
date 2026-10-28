import { pickTemplateForLanguage, resolveRecipientLanguage } from './booking-template-language.util';

describe('resolveRecipientLanguage', () => {
    it('uses the contact country language first', () => {
        expect(resolveRecipientLanguage({ contact_country: 'GR', invitee_language: 'en' })).toBe('el');
    });

    it('falls back to the language used on the booking page', () => {
        expect(resolveRecipientLanguage({ contact_country: null, invitee_language: 'el-GR' })).toBe('el');
        expect(resolveRecipientLanguage({ contact_country: 'ZZ', invitee_language: 'en' })).toBe('en');
    });

    it('is null when nothing is known', () => {
        expect(resolveRecipientLanguage({})).toBeNull();
        expect(resolveRecipientLanguage({ invitee_language: 'not a code' })).toBeNull();
    });
});

describe('pickTemplateForLanguage', () => {
    const el = { name: 'el', language: 'el' };
    const en = { name: 'en', language: 'en' };
    const de = { name: 'de', language: 'de' };

    it('returns null when the page offers no template', () => {
        expect(pickTemplateForLanguage([], 'el')).toBeNull();
    });

    it('sends the Greek template to a Greek recipient', () => {
        expect(pickTemplateForLanguage([en, el], 'el')).toBe(el);
    });

    it('sends the English template to an English recipient', () => {
        expect(pickTemplateForLanguage([el, en], 'en')).toBe(en);
    });

    it('falls back to English when no template matches the language', () => {
        expect(pickTemplateForLanguage([el, en], 'fr')).toBe(en);
    });

    it('falls back to English when the language is unknown', () => {
        expect(pickTemplateForLanguage([el, en], null)).toBe(en);
    });

    it('falls back to the first template when there is no English one either', () => {
        expect(pickTemplateForLanguage([el, de], 'fr')).toBe(el);
    });
});
