import { Fragment, useState } from "react";
import { AlertDialog, Button } from "@heroui/react";
import { AlertTriangle, Undo2 } from "lucide-react";
import { ActionButtonWithPending } from "@/components/ui/action-button-with-pending";
import { useUndoActivityLog } from "@/features/activity-logs/hooks/use-activity-logs";
import type { ActivityLog } from "@/features/activity-logs/interfaces/activity-log.interface";
import {
    formatActivityActor,
    formatActivityDescription,
    formatActivityEntityType,
    formatChangeValue,
    formatFieldName,
} from "../utils/activity-log.utils";

function ActivityWhenCell({ iso }: { iso: string }) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
        return <span>—</span>;
    }
    return (
        <>
            <div>
                {date.toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                })}
            </div>
            <div className="text-muted/80">
                {date.toLocaleTimeString(undefined, {
                    hour: "2-digit",
                    minute: "2-digit",
                })}
            </div>
        </>
    );
}

export function ActivityLogTable({ rows }: { rows: ActivityLog[] }) {
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const [undoing, setUndoing] = useState<ActivityLog | null>(null);
    const undo = useUndoActivityLog();

    if (rows.length === 0) {
        return (
            <div className="rounded-xl border border-dashed border-border bg-surface-secondary/30 p-8 text-center text-sm text-muted">
                No activity matches your filters.
            </div>
        );
    }

    const toggleExpanded = (uuid: string) => {
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(uuid)) next.delete(uuid);
            else next.add(uuid);
            return next;
        });
    };

    return (
        <div className="w-full max-w-full overflow-x-auto rounded-xl">
            <table className="w-full min-w-[44rem] border-collapse text-sm">
                <thead className="bg-surface-secondary/40 text-muted">
                    <tr>
                        <th className="w-[7.5rem] px-3 py-2 text-left font-medium">When</th>
                        <th className="min-w-[10rem] px-3 py-2 text-left font-medium">User</th>
                        <th className="min-w-[12rem] px-3 py-2 text-left font-medium">Action</th>
                        <th className="hidden min-w-[8rem] md:table-cell px-3 py-2 text-left font-medium">
                            Entity
                        </th>
                        <th className="w-[7rem] px-3 py-2 text-left font-medium">Details</th>
                        <th className="w-[6rem] px-3 py-2 text-left font-medium" />
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row) => {
                        const changeEntries = Object.entries(row.changes ?? {});
                        const isExpanded = expanded.has(row.uuid);

                        return (
                            <Fragment key={row.uuid}>
                                <tr className="border-t border-border">
                                    <td className="px-3 py-2 align-top text-xs text-muted">
                                        <ActivityWhenCell iso={row.created_at} />
                                    </td>
                                    <td className="max-w-[14rem] px-3 py-2 align-top">
                                        <div className="truncate font-medium text-foreground">
                                            {formatActivityActor(row.actor)}
                                        </div>
                                        {row.actor?.email ? (
                                            <div className="truncate text-xs text-muted">
                                                {row.actor.email}
                                            </div>
                                        ) : null}
                                    </td>
                                    <td className="max-w-[18rem] px-3 py-2 align-top text-foreground/90">
                                        <div className="truncate">
                                            {formatActivityDescription(row)}
                                        </div>
                                    </td>
                                    <td className="hidden max-w-[12rem] md:table-cell px-3 py-2 align-top text-foreground/90">
                                        <div className="truncate">
                                            {formatActivityEntityType(row.entity_type)}
                                        </div>
                                        {row.entity_uuid ? (
                                            <div className="truncate text-xs text-muted font-mono">
                                                {row.entity_uuid}
                                            </div>
                                        ) : null}
                                    </td>
                                    <td className="px-3 py-2 align-top text-xs whitespace-nowrap">
                                        {changeEntries.length > 0 ? (
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-6 px-2 text-[12px]"
                                                onPress={() => toggleExpanded(row.uuid)}
                                            >
                                                {isExpanded ? "Hide" : "View"}{" "}
                                                {changeEntries.length} change
                                                {changeEntries.length === 1 ? "" : "s"}
                                            </Button>
                                        ) : (
                                            <span className="text-muted">{row.action}</span>
                                        )}
                                    </td>
                                    <td className="px-3 py-2 align-top text-xs whitespace-nowrap">
                                        {row.undone_at ? (
                                            <span className="text-muted">Undone</span>
                                        ) : row.undoable ? (
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-6 px-2 text-[12px]"
                                                onPress={() => setUndoing(row)}
                                            >
                                                <Undo2 className="size-3" />
                                                Undo
                                            </Button>
                                        ) : null}
                                    </td>
                                </tr>
                                {isExpanded && changeEntries.length > 0 ? (
                                    <tr className="border-t border-border bg-surface-secondary/20">
                                        <td colSpan={6} className="px-3 py-2">
                                            <table className="w-full text-xs">
                                                <thead className="text-muted">
                                                    <tr>
                                                        <th className="px-2 py-1 text-left font-medium">
                                                            Field
                                                        </th>
                                                        <th className="px-2 py-1 text-left font-medium">
                                                            From
                                                        </th>
                                                        <th className="px-2 py-1 text-left font-medium">
                                                            To
                                                        </th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {changeEntries.map(([field, change]) => (
                                                        <tr
                                                            key={field}
                                                            className="border-t border-border/60"
                                                        >
                                                            <td className="px-2 py-1 align-top font-medium text-foreground/90 whitespace-nowrap">
                                                                {formatFieldName(field)}
                                                            </td>
                                                            <td className="px-2 py-1 align-top text-muted">
                                                                <pre className="whitespace-pre-wrap break-words font-sans">
                                                                    {formatChangeValue(change.from)}
                                                                </pre>
                                                            </td>
                                                            <td className="px-2 py-1 align-top text-foreground/90">
                                                                <pre className="whitespace-pre-wrap break-words font-sans">
                                                                    {formatChangeValue(change.to)}
                                                                </pre>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </td>
                                    </tr>
                                ) : null}
                            </Fragment>
                        );
                    })}
                </tbody>
            </table>

            <AlertDialog.Backdrop
                isOpen={!!undoing}
                onOpenChange={(open) => {
                    if (!open) setUndoing(null);
                }}
            >
                <AlertDialog.Container>
                    <AlertDialog.Dialog className="sm:max-w-md">
                        <AlertDialog.Header>
                            <AlertDialog.Icon status="warning">
                                <AlertTriangle className="size-5" />
                            </AlertDialog.Icon>
                            <AlertDialog.Heading>Undo this action?</AlertDialog.Heading>
                        </AlertDialog.Header>
                        <AlertDialog.Body>
                            <p className="text-sm text-muted">
                                <span className="font-medium text-foreground">
                                    {undoing ? formatActivityDescription(undoing) : ""}
                                </span>{" "}
                                will be reverted. Related records removed together with a deleted
                                item (such as its notes) are not brought back.
                            </p>
                        </AlertDialog.Body>
                        <AlertDialog.Footer>
                            <Button slot="close" variant="secondary" isDisabled={undo.isPending}>
                                Cancel
                            </Button>
                            <ActionButtonWithPending
                                variant="primary"
                                isDisabled={undo.isPending}
                                isPending={undo.isPending}
                                onPress={() => {
                                    if (!undoing) return;
                                    undo.mutate(undoing.uuid, {
                                        onSettled: () => setUndoing(null),
                                    });
                                }}
                            >
                                Undo
                            </ActionButtonWithPending>
                        </AlertDialog.Footer>
                    </AlertDialog.Dialog>
                </AlertDialog.Container>
            </AlertDialog.Backdrop>
        </div>
    );
}
