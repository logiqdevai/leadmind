import { Button } from "@heroui/react";
import { formatDistanceToNow } from "date-fns";
import { MailCheck, MailX } from "lucide-react";
import { useResubscribeContact } from "@/features/contacts/hooks/use-contacts";

export function MarketingPreferenceNotice({
    contactUuid,
    unsubscribedAt,
}: {
    contactUuid: string;
    unsubscribedAt: string | null;
}) {
    const resubscribe = useResubscribeContact();
    const optedOut = Boolean(unsubscribedAt);
    const when = unsubscribedAt ? new Date(unsubscribedAt) : null;

    return (
        <div
            className={
                optedOut
                    ? "mt-2.5 flex items-center gap-3 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2"
                    : "mt-2.5 flex items-center gap-3 rounded-lg border border-border/70 bg-surface-secondary/50 px-3 py-2"
            }
        >
            <span
                className={
                    optedOut
                        ? "flex size-7 shrink-0 items-center justify-center rounded-md bg-warning/15 text-warning"
                        : "flex size-7 shrink-0 items-center justify-center rounded-md bg-accent/15 text-accent"
                }
            >
                {optedOut ? (
                    <MailX className="size-3.5" strokeWidth={2} aria-hidden />
                ) : (
                    <MailCheck className="size-3.5" strokeWidth={2} aria-hidden />
                )}
            </span>
            <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold tracking-tight text-foreground">
                    {optedOut ? "Marketing paused" : "Subscribed"}
                </p>
                <p
                    className="text-[11px] leading-snug text-muted"
                    title={when ? when.toLocaleString() : undefined}
                >
                    {optedOut && when
                        ? `Opted out ${formatDistanceToNow(when, { addSuffix: true })}`
                        : "Can receive campaigns and sequences"}
                </p>
            </div>
            {optedOut ? (
                <Button
                    size="sm"
                    variant="primary"
                    className="h-7 shrink-0 px-2.5 text-xs font-semibold"
                    isDisabled={resubscribe.isPending}
                    onPress={() => resubscribe.mutate(contactUuid)}
                >
                    {resubscribe.isPending ? "Restoring…" : "Resubscribe"}
                </Button>
            ) : null}
        </div>
    );
}
