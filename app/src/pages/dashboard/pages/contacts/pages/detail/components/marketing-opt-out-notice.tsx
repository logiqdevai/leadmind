import { Button } from "@heroui/react";
import { formatDistanceToNow } from "date-fns";
import { MailX } from "lucide-react";
import { useResubscribeContact } from "@/features/contacts/hooks/use-contacts";

export function MarketingPreferenceNotice({
    contactUuid,
    unsubscribedAt,
}: {
    contactUuid: string;
    unsubscribedAt: string | null;
}) {
    const resubscribe = useResubscribeContact();

    if (!unsubscribedAt) {
        return null;
    }

    const when = new Date(unsubscribedAt);

    return (
        <div className="mt-2.5 flex items-center gap-3 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-warning/15 text-warning">
                <MailX className="size-3.5" strokeWidth={2} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold tracking-tight text-foreground">
                    Marketing paused
                </p>
                <p
                    className="text-[11px] leading-snug text-muted"
                    title={when.toLocaleString()}
                >
                    {`Opted out ${formatDistanceToNow(when, { addSuffix: true })}`}
                </p>
            </div>
            <Button
                size="sm"
                variant="primary"
                className="h-7 shrink-0 px-2.5 text-xs font-semibold"
                isDisabled={resubscribe.isPending}
                onPress={() => resubscribe.mutate(contactUuid)}
            >
                {resubscribe.isPending ? "Restoring…" : "Resubscribe"}
            </Button>
        </div>
    );
}
