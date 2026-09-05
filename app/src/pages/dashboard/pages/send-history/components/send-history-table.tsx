import { useState } from "react";
import { Button, Chip } from "@heroui/react";
import { Eye, MessageCircleReply, XCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { MsgStatus } from "@/features/contacts/interfaces/contact.interface";
import { useIntegrations } from "@/features/integrations/hooks/use-integrations";
import type { SendHistoryMessage } from "@/features/outreach/interfaces/send-history.interface";
import { SequenceEnrollmentStatus } from "@/features/sequences/interfaces/sequence.interface";
import { useCancelEnrollment } from "@/features/sequences/hooks/use-sequences";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { MessageThreadModal } from "@/pages/dashboard/pages/contacts/pages/detail/components/message-thread-modal";
import { Routes } from "@/routes/routes";
import {
    formatSendHistoryDate,
    getContactDestination,
    getSendIntegrationLabel,
    getSendSourceLabel,
} from "../utils/send-history.utils";
import { SendHistoryMessageModal } from "./send-history-message-modal";

export const STATUS_COLOR: Record<
    MsgStatus,
    "default" | "accent" | "success" | "warning" | "danger"
> = {
    PENDING: "default",
    QUEUED: "default",
    SENT: "accent",
    FAILED: "danger",
    DELIVERED: "success",
    OPENED: "success",
    CLICKED: "success",
    REPLIED: "success",
    BOUNCED: "danger",
    UNSUBSCRIBED: "warning",
    SKIPPED: "default",
};

export function SendHistoryTable({ rows }: { rows: SendHistoryMessage[] }) {
    const { data: integrations } = useIntegrations();
    const [selected, setSelected] = useState<SendHistoryMessage | null>(null);
    const [threadUuid, setThreadUuid] = useState<string | null>(null);
    const [cancelTarget, setCancelTarget] = useState<SendHistoryMessage | null>(null);
    const cancelEnrollmentMut = useCancelEnrollment();

    if (rows.length === 0) {
        return (
            <div className="rounded-xl border border-dashed border-border bg-surface-secondary/30 p-8 text-center text-sm text-muted">
                No sends match your filters.
            </div>
        );
    }

    return (
        <div className="overflow-x-hidden rounded-xl">
            <SendHistoryMessageModal
                message={selected}
                onOpenChange={(open) => {
                    if (!open) setSelected(null);
                }}
            />
            <MessageThreadModal
                messageUuid={threadUuid}
                isOpen={threadUuid !== null}
                onOpenChange={(open) => {
                    if (!open) setThreadUuid(null);
                }}
            />
            <ConfirmDialog
                isOpen={!!cancelTarget}
                onOpenChange={(open) => !open && setCancelTarget(null)}
                title="Cancel sequence for this contact?"
                description={
                    cancelTarget
                        ? `${cancelTarget.contact.name ?? "This contact"} will not receive any further steps of "${cancelTarget.sequence_enrollment?.sequence.name}".`
                        : undefined
                }
                confirmLabel="Cancel sequence"
                variant="danger"
                isPending={cancelEnrollmentMut.isPending}
                onConfirm={async () => {
                    if (!cancelTarget?.sequence_enrollment) return;
                    await cancelEnrollmentMut.mutateAsync({
                        uuid: cancelTarget.sequence_enrollment.sequence.uuid,
                        enrollmentUuid: cancelTarget.sequence_enrollment.uuid,
                    });
                    setCancelTarget(null);
                }}
            />
            <table className="w-full table-fixed text-sm">
                <thead className="bg-surface-secondary/40 text-muted">
                    <tr>
                        <th className="min-w-0 max-w-0 overflow-hidden px-3 py-2 text-left font-medium">Contact</th>
                        <th className="hidden lg:table-cell px-3 py-2 text-left font-medium">Channel</th>
                        <th className="hidden lg:table-cell px-3 py-2 text-left font-medium">Integration</th>
                        <th className="hidden lg:table-cell px-3 py-2 text-left font-medium">Source</th>
                        <th className="px-3 py-2 text-left font-medium w-28">Status</th>
                        <th className="hidden lg:table-cell px-3 py-2 text-left font-medium">Subject / preview</th>
                        <th className="hidden lg:table-cell px-3 py-2 text-left font-medium">Sent by</th>
                        <th className="hidden lg:table-cell px-3 py-2 text-left font-medium">Date</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row) => (
                        <tr key={row.uuid} className="border-t border-border">
                            <td className="min-w-0 max-w-0 overflow-hidden px-3 py-2 align-top">
                                <Link
                                    to={Routes.dashboard.contacts_detail.replace(
                                        ":uuid",
                                        row.contact.uuid,
                                    )}
                                    className="block truncate font-medium text-foreground hover:text-accent"
                                >
                                    {row.contact.name ?? "Unnamed contact"}
                                </Link>
                                <div className="text-xs text-muted truncate">{getContactDestination(row)}</div>
                            </td>
                            <td className="hidden lg:table-cell px-3 py-2 align-top text-foreground/90">{row.channel}</td>
                            <td className="hidden lg:table-cell px-3 py-2 align-top text-foreground/90">
                                {getSendIntegrationLabel(row, integrations)}
                            </td>
                            <td className="hidden lg:table-cell px-3 py-2 align-top text-xs text-foreground/90 max-w-[10rem]">
                                <div className="truncate">{getSendSourceLabel(row)}</div>
                                {row.sequence_enrollment?.status === SequenceEnrollmentStatus.ACTIVE ? (
                                    <button
                                        type="button"
                                        onClick={() => setCancelTarget(row)}
                                        className="mt-0.5 inline-flex items-center gap-1 text-danger hover:underline"
                                    >
                                        <XCircle className="size-3" />
                                        Cancel sequence
                                    </button>
                                ) : null}
                            </td>
                            <td className="px-3 py-2 align-top">
                                <Chip size="sm" variant="soft" color={STATUS_COLOR[row.status]}>
                                    <Chip.Label>{row.status}</Chip.Label>
                                </Chip>
                            </td>
                            <td className="hidden lg:table-cell px-3 py-2 align-top max-w-xs">
                                <div className="flex items-start gap-1.5">
                                    <div className="min-w-0 flex-1">
                                        {row.channel === "EMAIL" && row.subject ? (
                                            <div className="font-medium text-foreground truncate">
                                                {row.subject}
                                            </div>
                                        ) : null}
                                        <div className="text-xs text-muted line-clamp-2">
                                            {stripHtml(row.content)}
                                        </div>
                                    </div>
                                    {row.channel === "EMAIL" &&
                                    row.status !== MsgStatus.PENDING &&
                                    row.status !== MsgStatus.QUEUED ? (
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="shrink-0 min-w-7 h-7 px-1"
                                            onPress={() => setThreadUuid(row.uuid)}
                                            aria-label={
                                                row.status === MsgStatus.REPLIED
                                                    ? "View conversation"
                                                    : "View activity"
                                            }
                                        >
                                            <MessageCircleReply
                                                className={
                                                    row.status === MsgStatus.REPLIED
                                                        ? "size-3.5 text-success"
                                                        : "size-3.5 text-muted"
                                                }
                                            />
                                        </Button>
                                    ) : null}
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="shrink-0 min-w-7 h-7 px-1"
                                        onPress={() => setSelected(row)}
                                        aria-label="View full message"
                                    >
                                        <Eye className="size-3.5 text-muted" />
                                    </Button>
                                </div>
                            </td>
                            <td className="hidden lg:table-cell px-3 py-2 align-top text-xs text-muted">
                                {row.sent_by?.full_name?.trim() || row.sent_by?.email || "—"}
                            </td>
                            <td className="hidden lg:table-cell px-3 py-2 align-top text-xs text-muted whitespace-nowrap">
                                {formatSendHistoryDate(row.sent_at ?? row.created_at)}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function stripHtml(value: string): string {
    return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}
