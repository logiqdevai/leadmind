import { useState } from "react";
import { Button, Chip } from "@heroui/react";
import { Eye, RefreshCw } from "lucide-react";
import type { MxToolboxCheck } from "@/features/mxtoolbox/interfaces/mxtoolbox.interface";
import { useRerunMxToolboxCheck } from "@/features/mxtoolbox/hooks/use-mxtoolbox";
import { MXTOOLBOX_STATUS_COLOR, formatMxToolboxDate } from "../utils/mxtoolbox.utils";
import { MxToolboxResultModal } from "./mxtoolbox-result-modal";

export function MxToolboxTable({ rows }: { rows: MxToolboxCheck[] }) {
    const [selectedUuid, setSelectedUuid] = useState<string | null>(null);
    const rerunCheck = useRerunMxToolboxCheck();
    // Look up the selected row by uuid (rather than holding a snapshot) so the modal reflects
    // fresh data - e.g. after an AI audit or rerun invalidates and refetches the list.
    const selected = rows.find((row) => row.uuid === selectedUuid) ?? null;

    if (rows.length === 0) {
        return (
            <div className="rounded-xl border border-dashed border-border bg-surface-secondary/30 p-8 text-center text-sm text-muted">
                No domain health checks yet.
            </div>
        );
    }

    return (
        <div className="overflow-x-auto rounded-xl border border-border">
            <MxToolboxResultModal
                check={selected}
                onOpenChange={(open) => {
                    if (!open) setSelectedUuid(null);
                }}
            />
            <table className="w-full text-sm">
                <thead className="bg-surface-secondary/40 text-muted">
                    <tr>
                        <th className="px-3 py-2 text-left font-medium">Label</th>
                        <th className="px-3 py-2 text-left font-medium">Domain</th>
                        <th className="px-3 py-2 text-left font-medium w-28">Status</th>
                        <th className="px-3 py-2 text-left font-medium w-24">Issues</th>
                        <th className="px-3 py-2 text-left font-medium">Checked</th>
                        <th className="px-3 py-2 text-right font-medium w-40">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row) => (
                        <tr key={row.uuid} className="border-t border-border">
                            <td className="px-3 py-2 align-top">
                                <div className="font-medium text-foreground truncate max-w-[16rem]">
                                    {row.label || "Domain health check"}
                                </div>
                                <div className="text-xs text-muted truncate max-w-[16rem]">
                                    {row.commands.length} check{row.commands.length === 1 ? "" : "s"}
                                </div>
                            </td>
                            <td className="px-3 py-2 align-top font-mono text-foreground/90">
                                {row.domain}
                            </td>
                            <td className="px-3 py-2 align-top">
                                <Chip size="sm" variant="soft" color={MXTOOLBOX_STATUS_COLOR[row.status]}>
                                    <Chip.Label>{row.status}</Chip.Label>
                                </Chip>
                            </td>
                            <td className="px-3 py-2 align-top text-xs text-muted">
                                {row.failed_count > 0 ? (
                                    <span className="text-danger">{row.failed_count} failed</span>
                                ) : row.warning_count > 0 ? (
                                    <span className="text-warning">{row.warning_count} warnings</span>
                                ) : (
                                    "—"
                                )}
                            </td>
                            <td className="px-3 py-2 align-top text-xs text-muted whitespace-nowrap">
                                {formatMxToolboxDate(row.created_at)}
                            </td>
                            <td className="px-3 py-2 align-top">
                                <div className="flex items-center justify-end gap-1.5">
                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        className="h-7 px-2 text-xs"
                                        isPending={
                                            rerunCheck.isPending && rerunCheck.variables === row.uuid
                                        }
                                        onPress={() => rerunCheck.mutate(row.uuid)}
                                    >
                                        <RefreshCw className="size-3.5" />
                                        Re-run
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="shrink-0 min-w-7 h-7 px-1"
                                        onPress={() => setSelectedUuid(row.uuid)}
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
