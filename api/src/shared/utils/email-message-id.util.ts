import { randomUUID } from 'crypto';

/**
 * Generates an RFC 5322 Message-ID local value (no angle brackets - added at header-build
 * time). The domain doesn't need to match the actual From address - only global uniqueness
 * matters - so a fixed app domain avoids every call site having to resolve sender credentials
 * just to build an opaque id.
 */
export function generateMessageId(): string {
    return `${randomUUID()}@leadmind.app`;
}

/**
 * Builds the accumulating References chain for a reply: the parent's own chain plus the
 * parent's Message-ID, so a multi-hop reply carries its full ancestor list (not just the
 * immediate parent) - what strict mail clients use to group a thread.
 */
export function buildReferencesChain(
    parent: { references?: string | null; message_id?: string | null } | null | undefined,
): string | null {
    if (!parent) return null;
    const chain = [parent.references, parent.message_id].filter((value): value is string => !!value?.trim());
    return chain.length ? chain.join(' ') : null;
}

/** Wraps a bare Message-ID in angle brackets if it isn't already, for use in email headers. */
export function bracketMessageId(id: string): string {
    const trimmed = id.trim();
    return trimmed.startsWith('<') ? trimmed : `<${trimmed}>`;
}
