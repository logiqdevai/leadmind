import { Fragment, useState } from "react";
import { Button } from "@heroui/react";
import type { ActivityLog } from "@/features/activity-logs/interfaces/activity-log.interface";
import {
    formatActivityActor,
    formatActivityDate,
    formatActivityDescription,
    formatActivityEntityType,
    formatChangeValue,
    formatFieldName,
} from "../utils/activity-log.utils";

export function ActivityLogTable({ rows }: { rows: ActivityLog[] }) {
    const [expanded, setExpanded] = useState<Set<string>>(new Set());

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
        <div className="overflow-x-hidden rounded-xl">
            <table className="w-full table-fixed text-sm">
                <thead className="bg-surface-secondary/40 text-muted">
                    <tr>
                        <th className="w-28 px-3 py-2 text-left font-medium">When</th>
                        <th className="min-w-0 max-w-0 overflow-hidden px-3 py-2 text-left font-medium">User</th>
                        <th className="hidden lg:table-cell px-3 py-2 text-left font-medium">Action</th>
                        <th className="hidden lg:table-cell px-3 py-2 text-left font-medium">Entity</th>
                        <th className="px-3 py-2 text-left font-medium w-24">Details</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row) => {
                        const changeEntries = Object.entries(row.changes ?? {});
                        const isExpanded = expanded.has(row.uuid);

                        return (
                            <Fragment key={row.uuid}>
                                <tr className="border-t border-border">
                                    <td className="px-3 py-2 align-top text-xs text-muted whitespace-nowrap">
                                        {formatActivityDate(row.created_at)}
                                    </td>
                                    <td className="min-w-0 max-w-0 overflow-hidden px-3 py-2 align-top">
                                        <div className="truncate font-medium text-foreground">
                                            {formatActivityActor(row.actor)}
                                        </div>
                                        {row.actor?.email ? (
                                            <div className="truncate text-xs text-muted">
                                                {row.actor.email}
                                            </div>
                                        ) : null}
                                    </td>
                                    <td className="hidden lg:table-cell px-3 py-2 align-top text-foreground/90">
                                        {formatActivityDescription(row)}
                                    </td>
                                    <td className="hidden lg:table-cell px-3 py-2 align-top text-foreground/90">
                                        <div>{formatActivityEntityType(row.entity_type)}</div>
                                        {row.entity_uuid ? (
                                            <div className="text-xs text-muted font-mono truncate max-w-[10rem]">
                                                {row.entity_uuid}
                                            </div>
                                        ) : null}
                                    </td>
                                    <td className="px-3 py-2 align-top text-xs">
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
                                </tr>
                                {isExpanded && changeEntries.length > 0 ? (
                                    <tr className="border-t border-border bg-surface-secondary/20">
                                        <td colSpan={5} className="px-3 py-2">
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
                                                        <tr key={field} className="border-t border-border/60">
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
        </div>
    );
}
