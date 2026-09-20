import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useContacts } from "@/features/contacts/hooks/use-contacts";
import {
    CONTACT_STATUS_OPTIONS,
    STATUS_BAR_COLOR,
    STATUS_LABEL,
} from "@/features/contacts/constants/contacts.constants";
import type { LeadStatus, ListContactsQuery } from "@/features/contacts/interfaces/contact.interface";
import type { ContactAudienceStats } from "@/features/contact-audience-stats/interfaces/contact-audience-stats.interface";
import type { ContactFilters } from "@/interfaces/contact-filters.interface";
import { contactFiltersToListQuery } from "@/lib/contact-filter-params";
import { TablePagination } from "@/components/ui/table-pagination";
import { TableCellLink } from "@/components/ui/table-row-link";
import { Routes } from "@/routes/routes";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;

function formatPct(count: number, total: number): string {
    if (total <= 0) return "0%";
    const pct = (count / total) * 100;
    return `${pct < 10 && pct > 0 ? pct.toFixed(1) : pct.toFixed(0)}%`;
}

interface AudienceStatusSectionsProps {
    stats: ContactAudienceStats | undefined;
    isLoading: boolean;
    contactFilters: ContactFilters;
    /** Contacts query params that restrict to the analysed audience (list tree, campaign or filter). */
    scopeQuery: Pick<
        ListContactsQuery,
        "contact_list_uuid" | "include_sublists" | "campaign_uuid" | "filter_uuid"
    >;
}

export function AudienceStatusSections({
    stats,
    isLoading,
    contactFilters,
    scopeQuery,
}: AudienceStatusSectionsProps) {
    const [openStatus, setOpenStatus] = useState<LeadStatus | null>(null);
    const byStatus = stats?.pipeline.by_status;
    const total = stats?.pipeline.total_contacts ?? 0;

    // "Reached" = contacts currently at this pipeline stage or any later one.
    const pipelineOrder = CONTACT_STATUS_OPTIONS.filter((o) => o.pipeline).map((o) => o.id);
    const reachedCount = (status: LeadStatus): number | null => {
        const idx = pipelineOrder.indexOf(status);
        if (idx === -1 || !byStatus) return null;
        return pipelineOrder.slice(idx).reduce((sum, s) => sum + (byStatus[s] ?? 0), 0);
    };

    return (
        <section className="overflow-hidden rounded-xl border border-border/60 bg-surface">
            <div className="px-4 sm:px-5 py-4 border-b border-border/50">
                <p className="text-sm font-semibold text-foreground">Contacts by CRM status</p>
                <p className="text-xs text-muted mt-0.5">
                    Share of the audience in each status. “Reached” counts contacts at this stage or further down the pipeline.
                </p>
            </div>

            <div className="divide-y divide-border/50">
                {CONTACT_STATUS_OPTIONS.map(({ id: status }) => {
                    const count = byStatus?.[status] ?? 0;
                    const reached = reachedCount(status);
                    const isOpen = openStatus === status;
                    return (
                        <div key={status}>
                            <button
                                type="button"
                                onClick={() => setOpenStatus(isOpen ? null : status)}
                                disabled={isLoading || count === 0}
                                aria-expanded={isOpen}
                                className="grid w-full grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-4 px-4 sm:px-5 py-3 text-left hover:bg-surface-secondary/50 disabled:cursor-default disabled:hover:bg-transparent"
                            >
                                <div className="flex items-center gap-2 min-w-0">
                                    <span className={cn("size-2 rounded-full shrink-0", STATUS_BAR_COLOR[status])} />
                                    <span className="text-sm font-medium text-foreground truncate">
                                        {STATUS_LABEL[status]}
                                    </span>
                                    {reached !== null && total > 0 ? (
                                        <span className="hidden sm:inline text-xs text-muted">
                                            · Reached {formatPct(reached, total)}
                                        </span>
                                    ) : null}
                                </div>
                                <div className="text-right">
                                    {isLoading ? (
                                        <div className="h-4 w-16 rounded bg-surface-secondary animate-pulse" />
                                    ) : (
                                        <p className="text-sm tabular-nums">
                                            <span className="font-semibold text-foreground">{count.toLocaleString()}</span>
                                            <span className="text-muted ml-2">{formatPct(count, total)}</span>
                                        </p>
                                    )}
                                </div>
                                <ChevronDown
                                    className={cn(
                                        "size-4 shrink-0 text-muted transition-transform",
                                        isOpen && "rotate-180",
                                        count === 0 && "opacity-0",
                                    )}
                                />
                            </button>
                            {isOpen ? (
                                <StatusContactsTable
                                    status={status}
                                    contactFilters={contactFilters}
                                    scopeQuery={scopeQuery}
                                />
                            ) : null}
                        </div>
                    );
                })}
            </div>
        </section>
    );
}

function StatusContactsTable({
    status,
    contactFilters,
    scopeQuery,
}: {
    status: LeadStatus;
    contactFilters: ContactFilters;
    scopeQuery: AudienceStatusSectionsProps["scopeQuery"];
}) {
    const [page, setPage] = useState(1);
    const { data, isLoading, isFetching } = useContacts({
        ...contactFiltersToListQuery(contactFilters, { page, limit: PAGE_SIZE }),
        ...scopeQuery,
        status,
    });
    const contacts = data?.data ?? [];

    return (
        <div className="bg-surface-secondary/30 border-t border-border/50">
            {isLoading ? (
                <div className="px-4 sm:px-5 py-4 space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="h-4 rounded bg-surface-secondary animate-pulse" />
                    ))}
                </div>
            ) : contacts.length === 0 ? (
                <p className="px-4 sm:px-5 py-4 text-sm text-muted">No contacts match the current filters.</p>
            ) : (
                <ul className="divide-y divide-border/40">
                    {contacts.map((contact) => (
                        <li key={contact.uuid}>
                            <TableCellLink
                                to={Routes.dashboard.contacts_detail.replace(":uuid", contact.uuid)}
                                className="grid grid-cols-1 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)] gap-x-4 gap-y-0.5 px-4 sm:px-5 py-2.5"
                            >
                                <span className="text-sm font-medium text-foreground truncate">
                                    {contact.name || contact.company || "Unnamed contact"}
                                </span>
                                <span className="text-xs sm:text-sm text-muted truncate">
                                    {contact.name ? contact.company ?? "—" : "—"}
                                </span>
                                <span className="text-xs sm:text-sm text-muted truncate">
                                    {contact.email ?? contact.phone ?? "—"}
                                </span>
                            </TableCellLink>
                        </li>
                    ))}
                </ul>
            )}
            {data && data.totalPages > 1 ? (
                <div className="px-4 sm:px-5 py-2 border-t border-border/40">
                    <TablePagination
                        page={page}
                        totalPages={data.totalPages}
                        total={data.total}
                        pageSize={PAGE_SIZE}
                        onPageChange={setPage}
                        isFetching={isFetching}
                        label="contacts"
                    />
                </div>
            ) : null}
        </div>
    );
}
