import { CallNoteStatus } from '@/generated/prisma';
import { CALL_NOTE_STATUS_LABELS, detectCallNoteStatus } from './call-note-status.utils';

describe('detectCallNoteStatus', () => {
    it('recognises every preset label exactly as the Quick note dropdown wrote it', () => {
        for (const [status, label] of Object.entries(CALL_NOTE_STATUS_LABELS)) {
            expect(detectCallNoteStatus(label)).toBe(status);
        }
    });

    it('is case, punctuation and curly-apostrophe insensitive', () => {
        expect(detectCallNoteStatus('NOT INTERESTED.')).toBe(CallNoteStatus.NOT_INTERESTED);
        expect(detectCallNoteStatus('Don’t call me again')).toBe(CallNoteStatus.DO_NOT_CALL);
    });

    it('uses the last preset line when several were appended', () => {
        expect(detectCallNoteStatus('Call later\nNot interested')).toBe(CallNoteStatus.NOT_INTERESTED);
        expect(detectCallNoteStatus('Not interested\nCall later')).toBe(CallNoteStatus.CALL_LATER);
    });

    it('finds a preset line inside longer notes', () => {
        expect(detectCallNoteStatus('Spoke for 5 min about pricing\nAsked to send more info')).toBe(
            CallNoteStatus.SEND_INFO,
        );
    });

    it.each([
        ['She said to call back tomorrow after 3', CallNoteStatus.CALL_LATER],
        ['wrong number, this is a pharmacy', CallNoteStatus.WRONG_NUMBER],
        ["They're not interested right now", CallNoteStatus.NOT_INTERESTED],
        ['Please stop calling us', CallNoteStatus.DO_NOT_CALL],
        ['Booked a demo for Friday', CallNoteStatus.MEETING_BOOKED],
        ['Already using a competitor', CallNoteStatus.USING_COMPETITOR],
        ['Budget not approved this year', CallNoteStatus.NO_BUDGET],
        ['Receptionist answered, owner is away', CallNoteStatus.GATEKEEPER],
        ['Interested, wants a quote', CallNoteStatus.INTERESTED],
        ['Out of office until Monday', CallNoteStatus.NOT_AVAILABLE],
    ])('maps "%s"', (text, status) => {
        expect(detectCallNoteStatus(text)).toBe(status);
    });

    it('does not read "not interested" as interested', () => {
        expect(detectCallNoteStatus('Not interested at all')).toBe(CallNoteStatus.NOT_INTERESTED);
    });

    it('returns null when the notes do not clearly say', () => {
        expect(detectCallNoteStatus('Talked about the weather')).toBeNull();
        expect(detectCallNoteStatus('   ')).toBeNull();
        expect(detectCallNoteStatus(null)).toBeNull();
    });
});
