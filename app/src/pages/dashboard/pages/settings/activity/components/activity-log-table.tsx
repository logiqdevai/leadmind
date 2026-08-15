import type { ActivityLog } from "@/features/activity-logs/interfaces/activity-log.interface";
import {
    formatActivityActor,
    formatActivityDate,
    formatActivityDescription,
    formatActivityEntityType,
} from "../utils/activity-log.utils";

export function ActivityLogTable({ rows }: { rows: ActivityLog[] }) {
    if (rows.length === 0) {
        return (
            <div className="rounded-xl border border-dashed border-border bg-surface-secondary/30 p-8 text-center text-sm text-muted">
                No activity matches your filters.
            </div>
        );
    }

    return (
        <div className="overflow-x-auto rounded-xl">
            <table className="w-full text-sm">
                <thead className="bg-surface-secondary/40 text-muted">
                    <tr>
                        <th className="px-3 py-2 text-left font-medium">When</th>
                        <th className="px-3 py-2 text-left font-medium">User</th>
                        <th className="px-3 py-2 text-left font-medium">Action</th>
                        <th className="px-3 py-2 text-left font-medium">Entity</th>
                        <th className="px-3 py-2 text-left font-medium">Details</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row) => (
                        <tr key={row.uuid} className="border-t border-border">
                            <td className="px-3 py-2 align-top text-xs text-muted whitespace-nowrap">
                                {formatActivityDate(row.created_at)}
                            </td>
                            <td className="px-3 py-2 align-top">
                                <div className="font-medium text-foreground">
                                    {formatActivityActor(row.actor)}
                                </div>
                                {row.actor?.email ? (
                                    <div className="text-xs text-muted">{row.actor.email}</div>
                                ) : null}
                            </td>
                            <td className="px-3 py-2 align-top text-foreground/90">
                                {formatActivityDescription(row)}
                            </td>
                            <td className="px-3 py-2 align-top text-foreground/90">
                                <div>{formatActivityEntityType(row.entity_type)}</div>
                                {row.entity_uuid ? (
                                    <div className="text-xs text-muted font-mono truncate max-w-[10rem]">
                                        {row.entity_uuid}
                                    </div>
                                ) : null}
                            </td>
                            <td className="px-3 py-2 align-top text-xs text-muted">
                                {row.action}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
