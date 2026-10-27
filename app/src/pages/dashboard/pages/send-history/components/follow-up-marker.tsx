import { Button, Chip } from "@heroui/react";
import { formatDistanceToNowStrict } from "date-fns";
import { ArrowDownWideNarrow, ArrowUpNarrowWide, BellRing, MessageCircleReply } from "lucide-react";

/** One-click filter for conversations where we sent last and the contact hasn't answered. Shared by the table and inbox views. */
export function FollowUpFilterToggle({
    isActive,
    onToggle,
}: {
    isActive: boolean;
    onToggle: () => void;
}) {
    return (
        <Button
            size="sm"
            variant={isActive ? "primary" : "secondary"}
            className="h-8 shrink-0 whitespace-nowrap px-2.5 text-[12px]"
            onPress={onToggle}
            aria-pressed={isActive}
        >
            <BellRing className="size-3.5" />
            Needs follow-up
        </Button>
    );
}

export type SendHistorySortDir = "asc" | "desc" | "";

const SORT_LABELS: Record<SendHistorySortDir, string> = {
    "": "Newest first",
    desc: "Newest first",
    asc: "Oldest first",
};

/** Toggles newest first (default) <-> oldest first. */
export function SortDirToggle({
    value,
    onChange,
}: {
    value: SendHistorySortDir;
    onChange: (value: SendHistorySortDir) => void;
}) {
    const next: SendHistorySortDir = value === "asc" ? "" : "asc";
    const Icon = value === "asc" ? ArrowUpNarrowWide : ArrowDownWideNarrow;
    return (
        <Button
            size="sm"
            variant="secondary"
            className="h-8 shrink-0 whitespace-nowrap px-2.5 text-[12px]"
            onPress={() => onChange(next)}
            aria-label={`${SORT_LABELS[value]}. Click to change sort order`}
        >
            <Icon className="size-3.5" />
            {SORT_LABELS[value]}
        </Button>
    );
}

/** One-click filter for emails a contact replied to that we haven't answered yet. */
export function NeedsReplyFilterToggle({
    isActive,
    onToggle,
}: {
    isActive: boolean;
    onToggle: () => void;
}) {
    return (
        <Button
            size="sm"
            variant={isActive ? "primary" : "secondary"}
            className="h-8 shrink-0 whitespace-nowrap px-2.5 text-[12px]"
            onPress={onToggle}
            aria-pressed={isActive}
        >
            <MessageCircleReply className="size-3.5" />
            Needs reply
        </Button>
    );
}

function quietFor(since: string | null): string | null {
    return since ? formatDistanceToNowStrict(new Date(since)) : null;
}

/** Marks a conversation as waiting on the contact past the follow-up window, or flagged for follow-up by hand. */
export function FollowUpBadge({ since, manual = false }: { since: string | null; manual?: boolean }) {
    const title = manual
        ? "Flagged for follow-up"
        : since
          ? `No reply since ${new Date(since).toLocaleString()}`
          : "No reply yet";
    return (
        <span className="inline-flex" title={title}>
            <Chip size="sm" variant="soft" color="warning">
                <BellRing className="size-3" />
                <Chip.Label>Follow up</Chip.Label>
            </Chip>
        </span>
    );
}

/** "4 days" - how long the contact has been quiet, for pairing with the badge. */
export function FollowUpQuietFor({ since }: { since: string | null }) {
    const quiet = quietFor(since);
    return quiet ? <span className="text-[11px] text-muted">No reply · {quiet}</span> : null;
}

/** Marks the email a contact replied to: "New reply" while unread, "Reply needed" once opened but not yet answered. */
export function ReplyBadge({
    isUnread,
    needsFollowUp,
    onToggleFollowUp,
}: {
    isUnread: boolean;
    needsFollowUp?: boolean;
    /** When given, clicking the badge toggles the thread's follow-up flag. */
    onToggleFollowUp?: () => void;
}) {
    const chip = (
        <Chip size="sm" variant="soft" color="accent">
            <MessageCircleReply className="size-3" />
            <Chip.Label className={isUnread ? "font-semibold" : undefined}>
                {isUnread ? "New reply" : "Reply needed"}
            </Chip.Label>
        </Chip>
    );
    if (!onToggleFollowUp) return chip;
    return (
        <span
            role="button"
            tabIndex={0}
            title={needsFollowUp ? "Click to unmark follow-up" : "Click to mark for follow-up"}
            onClick={(e) => {
                e.stopPropagation();
                onToggleFollowUp();
            }}
            onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    onToggleFollowUp();
                }
            }}
            className="inline-flex cursor-pointer"
        >
            {chip}
        </span>
    );
}
