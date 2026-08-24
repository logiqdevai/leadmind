import { useState } from "react";
import { Button, Chip } from "@heroui/react";
import { Eye, RefreshCw } from "lucide-react";
import type { MailTesterTest } from "@/features/mail-tester/interfaces/mail-tester.interface";
import { useRefreshMailTesterTest } from "@/features/mail-tester/hooks/use-mail-tester";
import {
    MAIL_TESTER_STATUS_COLOR,
    formatMailTesterDate,
    scoreColor,
} from "../utils/mail-tester.utils";
import { MailTesterResultModal } from "./mail-tester-result-modal";

export function MailTesterTable({ rows }: { rows: MailTesterTest[] }) {
    const [selected, setSelected] = useState<MailTesterTest | null>(null);
    const refreshTest = useRefreshMailTesterTest();

    if (rows.length === 0) {
        return (
            <div className="rounded-xl border border-dashed border-border bg-surface-secondary/30 p-8 text-center text-sm text-muted">
                No deliverability tests yet.
            </div>
        );
    }

    return (
        <div className="overflow-x-auto rounded-xl border border-border">
            <MailTesterResultModal
                test={selected}
                onOpenChange={(open) => {
                    if (!open) setSelected(null);
                }}
            />
            <table className="w-full text-sm">
                <thead className="bg-surface-secondary/40 text-muted">
                    <tr>
                        <th className="px-3 py-2 text-left font-medium">Label</th>
                        <th className="px-3 py-2 text-left font-medium">From</th>
                        <th className="px-3 py-2 text-left font-medium w-24">Score</th>
                        <th className="px-3 py-2 text-left font-medium w-28">Status</th>
                        <th className="px-3 py-2 text-left font-medium">Sent</th>
                        <th className="px-3 py-2 text-right font-medium w-40">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row) => (
                        <tr key={row.uuid} className="border-t border-border">
                            <td className="px-3 py-2 align-top">
                                <div className="font-medium text-foreground truncate max-w-[16rem]">
                                    {row.label || "Deliverability test"}
                                </div>
                                <div className="text-xs text-muted font-mono truncate max-w-[16rem]">
                                    {row.test_address}
                                </div>
                            </td>
                            <td className="px-3 py-2 align-top text-foreground/90">
                                {row.from_provider} · {row.from_account}
                            </td>
                            <td className="px-3 py-2 align-top">
                                {row.score != null ? (
                                    <Chip size="sm" variant="soft" color={scoreColor(row.score)}>
                                        <Chip.Label>{row.score}/10</Chip.Label>
                                    </Chip>
                                ) : (
                                    <span className="text-xs text-muted">—</span>
                                )}
                            </td>
                            <td className="px-3 py-2 align-top">
                                <Chip size="sm" variant="soft" color={MAIL_TESTER_STATUS_COLOR[row.status]}>
                                    <Chip.Label>{row.status}</Chip.Label>
                                </Chip>
                            </td>
                            <td className="px-3 py-2 align-top text-xs text-muted whitespace-nowrap">
                                {formatMailTesterDate(row.created_at)}
                            </td>
                            <td className="px-3 py-2 align-top">
                                <div className="flex items-center justify-end gap-1.5">
                                    {row.status !== "COMPLETED" ? (
                                        <Button
                                            size="sm"
                                            variant="secondary"
                                            className="h-7 px-2 text-xs"
                                            isPending={
                                                refreshTest.isPending &&
                                                refreshTest.variables === row.uuid
                                            }
                                            onPress={() => refreshTest.mutate(row.uuid)}
                                        >
                                            <RefreshCw className="size-3.5" />
                                            Check results
                                        </Button>
                                    ) : null}
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="shrink-0 min-w-7 h-7 px-1"
                                        onPress={() => setSelected(row)}
                                        aria-label="View result"
                                    >
                                        <Eye className="size-3.5 text-muted" />
                                    </Button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
