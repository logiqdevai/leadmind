import { Button } from "@heroui/react";
import { Pencil, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { OutreachSequence } from "@/features/sequences/interfaces/sequence.interface";
import { Routes } from "@/routes/routes";
import { SequenceStatusBadge } from "./sequence-status-badge";

function formatSequenceDate(iso: string): string {
    return new Date(iso).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}

interface SequencesTableProps {
    sequences: OutreachSequence[];
    onDelete: (sequence: OutreachSequence) => void;
}

export function SequencesTable({ sequences, onDelete }: SequencesTableProps) {
    const navigate = useNavigate();

    if (sequences.length === 0) {
        return (
            <div className="rounded-xl border border-dashed border-border bg-surface-secondary/30 p-10 text-center text-sm text-muted">
                No sequences yet. Create one to start a multi-step Email/SMS drip.
            </div>
        );
    }

    return (
        <div className="overflow-x-hidden rounded-xl">
            <table className="w-full table-fixed text-sm">
                <thead className="bg-surface-secondary/40 text-muted">
                    <tr>
                        <th className="px-4 py-3 text-left font-medium">Name</th>
                        <th className="px-4 py-3 text-left font-medium w-28">Status</th>
                        <th className="hidden lg:table-cell px-4 py-3 text-left font-medium w-24">Steps</th>
                        <th className="hidden lg:table-cell px-4 py-3 text-left font-medium">Updated</th>
                        <th className="px-4 py-3 text-right font-medium w-20 lg:w-28">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {sequences.map((sequence) => (
                        <tr
                            key={sequence.uuid}
                            className="border-t border-border hover:bg-surface-secondary/30 cursor-pointer"
                            onClick={() => navigate(Routes.dashboard.sequences_edit.replace(":uuid", sequence.uuid))}
                        >
                            <td className="px-4 py-3 align-top">
                                <div className="font-medium text-foreground">{sequence.name}</div>
                                {sequence.description ? (
                                    <div className="text-xs text-muted line-clamp-1">{sequence.description}</div>
                                ) : null}
                            </td>
                            <td className="px-4 py-3 align-top">
                                <SequenceStatusBadge status={sequence.status} />
                            </td>
                            <td className="hidden lg:table-cell px-4 py-3 align-top text-muted">
                                {sequence.steps.length}
                            </td>
                            <td className="hidden lg:table-cell px-4 py-3 align-top text-muted whitespace-nowrap">
                                {formatSequenceDate(sequence.updated_at)}
                            </td>
                            <td className="px-4 py-3 align-top" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center justify-end gap-1">
                                    <Button
                                        size="sm"
                                        variant="tertiary"
                                        onPress={() =>
                                            navigate(Routes.dashboard.sequences_edit.replace(":uuid", sequence.uuid))
                                        }
                                        aria-label="Edit sequence"
                                    >
                                        <Pencil className="size-4" />
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="tertiary"
                                        onPress={() => onDelete(sequence)}
                                        aria-label="Delete sequence"
                                    >
                                        <Trash2 className="size-4 text-danger" />
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
