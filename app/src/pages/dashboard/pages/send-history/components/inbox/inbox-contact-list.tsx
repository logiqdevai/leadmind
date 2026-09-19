import { Button } from "@heroui/react";
import { formatDistanceToNow } from "date-fns";
import { BellRing } from "lucide-react";
import { cn } from "@/lib/utils";
import { initialsFromName } from "@/lib/profile";
import { OriginIcon } from "@/features/messaging/components/thread-origin";
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
                                        "flex w-full items-start gap-2.5 border-l-2 border-transparent px-3 py-2.5 text-left transition-colors hover:bg-surface-secondary/60",
                                        row.has_unread_reply && "border-accent bg-accent/5",
                                        selectedContactUuid === row.contact.uuid && "bg-accent/10",
                                    )}
                                >
                                    <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-secondary text-xs font-medium text-foreground">
                                        {initialsFromName(row.contact.name)}
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="flex items-center justify-between gap-2">
                                            <span
                                                className={cn(
                                                    "truncate text-sm text-foreground",
                                                    row.has_unread_reply ? "font-bold" : "font-medium",
                                                )}
                                            >
                                                {row.contact.name ?? "Unnamed contact"}
                                            </span>
                                            <span className="flex shrink-0 items-center gap-1.5">
                                                {row.needs_follow_up ? (
                                                    <BellRing
                                                        className="size-3.5 text-warning"
                                                        aria-label="Needs follow-up"
                                                    />
                                                ) : null}
                                                {row.has_unread_reply ? (
                                                    <span
                                                        className="size-2.5 rounded-full bg-accent"
                                                        aria-label="New reply"
                                                    />
                                                ) : row.needs_reply ? (
                                                    <span
                                                        className="size-2 rounded-full border border-accent"
                                                        aria-label="Needs reply"
                                                    />
                                                ) : null}
                                            </span>
                                        </span>
                                        <span
                                            className={cn(
                                                "mt-0.5 flex items-center gap-1.5 text-xs",
                                                row.has_unread_reply ? "font-semibold text-foreground" : "text-muted",
                                            )}
                                        >
                                            <span className="truncate">
                                                {row.contact.email ?? row.contact.phone ?? "—"}
                                            </span>
                                            {row.last_message_at ? (
                                                <span className="shrink-0 whitespace-nowrap">
                                                    · {formatDistanceToNow(new Date(row.last_message_at), { addSuffix: true })}
                                                </span>
                                            ) : null}
                                        </span>
                                        <span className="mt-1.5 flex items-center gap-1">
                                            {row.origins.map((origin) => (
                                                <OriginIcon key={origin} origin={origin} />
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
