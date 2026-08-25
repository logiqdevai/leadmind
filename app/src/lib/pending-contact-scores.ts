import type { Contact } from "@/features/contacts/interfaces/contact.interface";

const pending = new Map<string, { uuids: string[]; until: number }>();
const PENDING_MS = 3 * 60_000;

export function markContactsPendingScore(contactUuids: string[], instructionUuids: string[]) {
    const until = Date.now() + PENDING_MS;
    for (const id of contactUuids) {
        pending.set(id, { uuids: instructionUuids, until });
    }
}

export function contactAwaitingScore(c: Contact): boolean {
    const row = pending.get(c.uuid);
    if (row) {
        if (Date.now() >= row.until) {
            pending.delete(c.uuid);
        } else {
            const scored = new Set((c.contact_scores ?? []).map((s) => s.scoring_instruction_uuid));
            if (row.uuids.every((id) => scored.has(id))) {
                pending.delete(c.uuid);
            } else {
                return true;
            }
        }
    }
    const defs = c.filter?.scoring_instructions ?? [];
    if (defs.length === 0) return false;
    const scored = new Set((c.contact_scores ?? []).map((s) => s.scoring_instruction_uuid));
    return defs.some((d) => !scored.has(d.uuid));
}
