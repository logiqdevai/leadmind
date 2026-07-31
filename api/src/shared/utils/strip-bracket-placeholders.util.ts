const BRACKET_PLACEHOLDER = /\[[A-Za-z][A-Za-z0-9 _./-]{0,39}\]/g;

export function stripBracketPlaceholders(text: string): string {
    if (!text) return text;
    return text
        .replace(BRACKET_PLACEHOLDER, '')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/[ \t]{2,}/g, ' ')
        .replace(/ ?· ?(?= ·|<\/|\n|$)/g, '')
        .trim();
}
