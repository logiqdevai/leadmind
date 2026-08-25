import type { Contact } from "@/features/contacts/interfaces/contact.interface";

export interface ContactScoreDisplayRow {
    uuid: string;
    name: string;
    instructions?: string;
    score: number | null;
}

export function contactScoreDisplayRows(contact: Contact): ContactScoreDisplayRow[] {
    const rows = contact.contact_scores ?? [];
    const byInstr = new Map(rows.map((r) => [r.scoring_instruction_uuid, r]));
    const seen = new Set<string>();
    const out: ContactScoreDisplayRow[] = [];

    for (const def of contact.filter?.scoring_instructions ?? []) {
        seen.add(def.uuid);
        out.push({
            uuid: def.uuid,
            name: def.name,
            instructions: def.instructions,
            score: byInstr.get(def.uuid)?.score ?? null,
        });
    }

    for (const row of rows) {
        if (seen.has(row.scoring_instruction_uuid)) continue;
        seen.add(row.scoring_instruction_uuid);
        out.push({
            uuid: row.scoring_instruction_uuid,
            name: row.scoring_instruction?.name ?? "Score",
            score: row.score,
        });
    }

    return out;
}
