import { Button } from "@heroui/react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { initialsFromName } from "@/lib/profile";
import { ORIGIN_LABEL, ORIGIN_PILL_CLASS } from "@/features/messaging/components/thread-conversation";
import type { InboxContactSummary } from "@/features/outreach/interfaces/send-history.interface";

interface InboxContactListProps {
    rows: InboxContactSummary[];
    total: number;
    totalPages: number;
    page: number;
    isLoading: boolean;
    isFetching: boolean;
    selectedContactUuid: string | null;
    onSelectContact: (uuid: string) => void;
    onPrevPage: () => void;
    onNextPage: () => void;
}

export function InboxContactList({
    rows,
    total,
    totalPages,
    page,
    isLoading,
    isFetching,
    selectedContactUuid,
    onSelectContact,
    onPrevPage,
    onNextPage,
}: InboxContactListProps) {
    return (
        <div className="flex h-full flex-col">
            <div className="flex-1 overflow-y-auto">
                {isLoading ? (
                    <ContactListSkeleton />
                ) : rows.length === 0 ? (
                    <p className="p-4 text-center text-sm text-muted">No contacts match your filters.</p>
                ) : (
                    <ul className="divide-y divide-border">
                        {rows.map((row) => (
                            <li key={row.contact.uuid}>
                                <button
                                    type="button"
                                    onClick={() => onSelectContact(row.contact.uuid)}
                                    className={cn(
                                        "flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-surface-secondary/60",
                                        selectedContactUuid === row.contact.uuid && "bg-accent/10",
                                    )}
                                >
                                    <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-secondary text-xs font-medium text-foreground">
                                        {initialsFromName(row.contact.name)}
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="flex items-center justify-between gap-2">
                                            <span className="truncate text-sm font-medium text-foreground">
                                                {row.contact.name ?? "Unnamed contact"}
                                            </span>
                                            {row.needs_reply ? (
                                                <span
                                                    className="size-2 shrink-0 rounded-full bg-accent"
                                                    aria-label="Needs reply"
                                                />
                                            ) : null}
                                        </span>
                                        <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                                            <span className="truncate">
                                                {row.contact.email ?? row.contact.phone ?? "—"}
                                            </span>
                                            {row.last_message_at ? (
                                                <span className="shrink-0 whitespace-nowrap">
                                                    · {formatDistanceToNow(new Date(row.last_message_at), { addSuffix: true })}
                                                </span>
                                            ) : null}
                                        </span>
                                        <span className="mt-1 flex flex-wrap gap-1">
                                            {row.origins.map((origin) => (
                                                <span
                                                    key={origin}
                                                    className={cn(
                                                        "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                                                        ORIGIN_PILL_CLASS[origin],
                                                    )}
                                                >
                                                    {ORIGIN_LABEL[origin]}
                                                </span>
                                            ))}
                                        </span>
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2 text-[12px] text-muted">
                <span>
                    {total.toLocaleString()} contact{total === 1 ? "" : "s"}
                    {isFetching ? " · Updating…" : ""}
                </span>
                <div className="flex items-center gap-1">
                    <Button
                        size="sm"
                        variant="secondary"
                        className="h-6 px-2 text-[11px]"
                        isDisabled={page <= 1}
                        onPress={onPrevPage}
                    >
                        Prev
                    </Button>
                    <Button
                        size="sm"
                        variant="secondary"
                        className="h-6 px-2 text-[11px]"
                        isDisabled={page >= totalPages}
                        onPress={onNextPage}
                    >
                        Next
                    </Button>
                </div>
            </div>
        </div>
    );
}

function ContactListSkeleton() {
    return (
        <div className="flex flex-col gap-2 p-3">
            {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-12 rounded-lg bg-surface-secondary animate-pulse" />
            ))}
        </div>
    );
}
