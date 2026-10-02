import { Button } from "@heroui/react";
import { formatDistanceToNow } from "date-fns";
import { MailWarning } from "lucide-react";
import { useClearContactBounce } from "@/features/contacts/hooks/use-contacts";

export function BounceNotice({
    contactUuid,
    bouncedAt,
    bounceReason,
}: {
    contactUuid: string;
    bouncedAt: string | null;
    bounceReason: string | null;
}) {
    const clearBounce = useClearContactBounce();

    if (!bouncedAt) {
        return null;
    }

    const when = new Date(bouncedAt);

    return (
        <div className="mt-2.5 flex items-center gap-3 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-danger/15 text-danger">
                <MailWarning className="size-3.5" strokeWidth={2} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold tracking-tight text-foreground">
                    Email bounced — sends paused
                </p>
                <p
                    className="text-[11px] leading-snug text-muted"
                    title={when.toLocaleString()}
                >
                    {bounceReason
                        ? `${bounceReason} · ${formatDistanceToNow(when, { addSuffix: true })}`
                        : `Bounced ${formatDistanceToNow(when, { addSuffix: true })}`}
                </p>
            </div>
            <Button
                size="sm"
                variant="primary"
                className="h-7 shrink-0 px-2.5 text-xs font-semibold"
                isDisabled={clearBounce.isPending}
                onPress={() => clearBounce.mutate(contactUuid)}
            >
                {clearBounce.isPending ? "Clearing…" : "Resume sending"}
            </Button>
        </div>
    );
}
