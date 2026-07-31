import { stripBracketPlaceholders } from './strip-bracket-placeholders.util';

describe('stripBracketPlaceholders', () => {
    it('removes square-bracket fill-in blanks', () => {
        const result = stripBracketPlaceholders(
            'Best,\n[full name]\n[address]\nCall me at [phone]',
        );
        expect(result).not.toContain('[full name]');
        expect(result).not.toContain('[address]');
        expect(result).not.toContain('[phone]');
        expect(result).toContain('Best,');
        expect(result).toContain('Call me at');
    });

    it('preserves curly-brace tokens and HTML', () => {
        const input =
            '<p>Best,<br><strong>{{full_name}}</strong><br>{{email}}</p>';
        expect(stripBracketPlaceholders(input)).toBe(input);
    });

    it('leaves empty string alone', () => {
        expect(stripBracketPlaceholders('')).toBe('');
    });
});
