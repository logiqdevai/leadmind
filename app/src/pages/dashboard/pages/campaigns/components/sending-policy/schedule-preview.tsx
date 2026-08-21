import { useEffect } from "react";
import { usePreviewSendingPolicy } from "@/features/sending-policy/hooks/use-sending-policies";

function formatDate(iso: string | null): string {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

interface SchedulePreviewProps {
    policyUuid: string;
    contactCount: number;
}

export function SchedulePreview({ policyUuid, contactCount }: SchedulePreviewProps) {
    const preview = usePreviewSendingPolicy();

    useEffect(() => {
        if (!policyUuid || contactCount <= 0) return;
        preview.mutate({ uuid: policyUuid, contact_count: contactCount });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [policyUuid, contactCount]);

    if (contactCount <= 0) return null;
    if (preview.isPending) {
        return <p className="text-xs text-muted">Estimating schedule…</p>;
    }
    if (!preview.data) return null;

    return (
        <div className="rounded-lg border border-border bg-surface-secondary/40 p-3 space-y-1.5">
            <p className="text-xs font-medium text-foreground">Estimated schedule</p>
            {preview.data.entries.map((entry, index) => (
                <p key={index} className="text-xs text-muted">
                    {formatDate(entry.starts_at)}
                    {entry.ends_at ? ` – ${formatDate(entry.ends_at)}` : " onward"}: {entry.limit}/
                    {entry.period_unit.toLowerCase()} (~{entry.estimated_messages} messages)
                </p>
            ))}
            <p className="text-xs text-muted">
                Estimated completion:{" "}
                <span className="font-medium text-foreground">
                    {formatDate(preview.data.estimated_completion_at)}
                </span>
            </p>
            <p className="text-[11px] text-muted italic">
                Estimate only — actual delivery depends on provider limits, pauses, and failures.
            </p>
        </div>
    );
}
