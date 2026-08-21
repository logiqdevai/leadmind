const WIDE = "min-[2000px]:table-cell";

export const CONTACT_TABLE_COLUMN_CLASS: Record<string, string> = {
    name: "min-w-0 w-[30%] overflow-hidden",
    company: "min-w-0 hidden lg:table-cell w-[20%] overflow-hidden",
    email: "min-w-0 hidden xl:table-cell overflow-hidden",
    phone: `min-w-0 hidden ${WIDE} whitespace-nowrap overflow-hidden`,
    website: `min-w-0 hidden ${WIDE} overflow-hidden`,
    status: "hidden sm:table-cell w-40 overflow-hidden",
    unsubscribed: "hidden md:table-cell w-32 overflow-hidden",
    score: "hidden xl:table-cell w-16 overflow-hidden",
    filters: `hidden ${WIDE} min-w-0 overflow-hidden`,
    tags: `hidden ${WIDE} min-w-0 overflow-hidden`,
    last_interaction: `hidden ${WIDE} whitespace-nowrap overflow-hidden`,
    source: `hidden ${WIDE} min-w-0 overflow-hidden`,
    drafts: "hidden xl:table-cell w-16 overflow-hidden",
    actions: "w-32",
};

export function contactTableColumnClass(columnId: string): string | undefined {
    return CONTACT_TABLE_COLUMN_CLASS[columnId];
}
