import { useMemo, useState } from "react";
import { Button } from "@heroui/react";
import { Table2 } from "lucide-react";
import { useCampaignIntegrationsActivity } from "@/features/campaign-integrations/hooks/use-campaign-integrations";
import type { SendingActivitySeries } from "@/features/campaign-integrations/interfaces/campaign-integration.interface";
import { computeLevel, levelBackground, vizHueVar } from "@/features/campaign-integrations/utils/sending-activity-colors";

const MIN_WEEKS = 8;
const MAX_WEEKS = 53;
const CELL_PX = 11;
const CELL_GAP_PX = 3;

const MONTH_LABELS = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function parseISODate(date: string): Date {
    const [y, m, d] = date.split("-").map(Number);
    return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function toISODate(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function startOfDay(date: Date): Date {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
}

function startOfWeek(date: Date): Date {
    const d = startOfDay(date);
    d.setDate(d.getDate() - d.getDay());
    return d;
}

interface AccountMeta {
    campaign_integration_uuid: string;
    title: string;
    provider: string;
    status: string;
    hueVar: string;
    total: number;
}

interface DayCell {
    date: string;
    total: number;
    byAccount: { title: string; hueVar: string; count: number }[];
}

function buildDayIndex(series: SendingActivitySeries[]): {
    days: Map<string, DayCell>;
    accounts: AccountMeta[];
} {
    // Hue assignment is keyed off a stable sort of the uuid, independent of the
    // list's fetch/display order, so a status change or reordering never repaints
    // an integration's colour (colour follows the entity, never its rank).
    const hueOrder = [...series]
        .map((s) => s.campaign_integration_uuid)
        .sort((a, b) => a.localeCompare(b));

    const accounts: AccountMeta[] = series.map((s) => ({
        campaign_integration_uuid: s.campaign_integration_uuid,
        title: s.integration_account.title,
        provider: s.integration_account.provider,
        status: s.status,
        hueVar: vizHueVar(hueOrder.indexOf(s.campaign_integration_uuid)),
        total: s.days.reduce((sum, d) => sum + d.count, 0),
    }));
    const metaByUuid = new Map(accounts.map((a) => [a.campaign_integration_uuid, a]));

    const days = new Map<string, DayCell>();
    for (const s of series) {
        const meta = metaByUuid.get(s.campaign_integration_uuid);
        if (!meta) continue;
        for (const d of s.days) {
            if (d.count <= 0) continue;
            let cell = days.get(d.date);
            if (!cell) {
                cell = { date: d.date, total: 0, byAccount: [] };
                days.set(d.date, cell);
            }
            cell.total += d.count;
            cell.byAccount.push({ title: meta.title, hueVar: meta.hueVar, count: d.count });
        }
    }

    return { days, accounts };
}

/** One unified calendar - a single day can be fed by several accounts, so the grid
 * shows the combined total (GitHub-style single graph) while the legend + tooltip
 * keep the per-account breakdown, instead of stacking a separate calendar per account. */
export function SendingActivityHeatmap({ campaignUuid }: { campaignUuid: string }) {
    const { data: series, isLoading } = useCampaignIntegrationsActivity(campaignUuid);
    const [showTable, setShowTable] = useState(false);

    const { days, accounts } = useMemo(() => buildDayIndex(series ?? []), [series]);

    const sortedNonZero = useMemo(
        () => [...days.values()].map((d) => d.total).filter((t) => t > 0).sort((a, b) => a - b),
        [days],
    );

    const { weeks, gridStart, today } = useMemo(() => {
        const allDates = [...days.keys()];
        const now = startOfDay(new Date());
        if (allDates.length === 0) {
            return { weeks: 0, gridStart: startOfWeek(now), today: now };
        }
        const earliest = parseISODate(allDates.reduce((min, d) => (d < min ? d : min), allDates[0]));
        const earliestWeekStart = startOfWeek(earliest);
        const thisWeekStart = startOfWeek(now);
        const rawWeeks =
            Math.round((thisWeekStart.getTime() - earliestWeekStart.getTime()) / (7 * 86_400_000)) + 1;
        const clamped = Math.min(MAX_WEEKS, Math.max(MIN_WEEKS, rawWeeks));
        const start = new Date(thisWeekStart);
        start.setDate(start.getDate() - (clamped - 1) * 7);
        return { weeks: clamped, gridStart: start, today: now };
    }, [days]);

    const monthMarkers = useMemo(() => {
        const markers: { col: number; label: string }[] = [];
        let lastMonth = -1;
        for (let col = 0; col < weeks; col++) {
            const colDate = new Date(gridStart);
            colDate.setDate(colDate.getDate() + col * 7);
            if (colDate.getMonth() !== lastMonth) {
                markers.push({ col, label: MONTH_LABELS[colDate.getMonth()] });
                lastMonth = colDate.getMonth();
            }
        }
        return markers;
    }, [gridStart, weeks]);

    const { totalSent, peak } = useMemo(() => {
        let total = 0;
        let best: { date: string; count: number } | null = null;
        for (const cell of days.values()) {
            total += cell.total;
            if (!best || cell.total > best.count) best = { date: cell.date, count: cell.total };
        }
        return { totalSent: total, peak: best };
    }, [days]);

    const tableRows = useMemo(
        () =>
            [...days.values()]
                .flatMap((cell) =>
                    cell.byAccount.map((a) => ({ date: cell.date, count: a.count, label: a.title, hueVar: a.hueVar })),
                )
                .sort((a, b) => (a.date < b.date ? 1 : -1)),
        [days],
    );

    if (isLoading) {
        return (
            <div className="space-y-2 animate-pulse" aria-hidden>
                <div className="h-24 rounded-xl bg-surface-secondary" />
            </div>
        );
    }

    if (accounts.length === 0) {
        return null;
    }

    const hasAnyData = days.size > 0;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <p className="text-sm font-medium text-foreground">Sending activity</p>
                    <p className="text-xs text-muted">
                        {hasAnyData
                            ? `${totalSent} sent across ${accounts.length} account${accounts.length === 1 ? "" : "s"}${peak ? ` · peak ${peak.count} on ${peak.date}` : ""}.`
                            : "Real sends per day, combined across every connected account."}
                    </p>
                </div>
                {hasAnyData ? (
                    <Button size="sm" variant="tertiary" onPress={() => setShowTable((v) => !v)}>
                        <Table2 className="size-4" /> {showTable ? "Show calendar" : "View as table"}
                    </Button>
                ) : null}
            </div>

            {!hasAnyData ? (
                <div className="rounded-xl border border-dashed border-border bg-surface-secondary/30 p-6 text-center text-sm text-muted">
                    No sends recorded yet - activity will appear here once this campaign starts sending.
                </div>
            ) : showTable ? (
                <div className="overflow-x-auto rounded-xl border border-border">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="border-b border-border text-left text-muted">
                                <th className="px-3 py-2 font-medium">Date</th>
                                <th className="px-3 py-2 font-medium">Account</th>
                                <th className="px-3 py-2 font-medium text-right">Sent</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {tableRows.map((row, i) => (
                                <tr key={`${row.date}-${row.label}-${i}`}>
                                    <td className="px-3 py-1.5 text-foreground">{row.date}</td>
                                    <td className="px-3 py-1.5 text-foreground">
                                        <span
                                            className="inline-block size-2 rounded-full mr-1.5 align-middle"
                                            style={{ background: row.hueVar }}
                                            aria-hidden
                                        />
                                        {row.label}
                                    </td>
                                    <td className="px-3 py-1.5 text-right font-medium text-foreground tabular-nums">
                                        {row.count}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="space-y-3">
                    {accounts.length > 1 ? (
                        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                            {accounts.map((a) => (
                                <span
                                    key={a.campaign_integration_uuid}
                                    className="inline-flex items-center gap-1.5 text-xs"
                                >
                                    <span
                                        className="inline-block size-2 rounded-full shrink-0"
                                        style={{ background: a.hueVar }}
                                        aria-hidden
                                    />
                                    <span className="font-medium text-foreground">{a.title}</span>
                                    <span className="text-muted">
                                        {a.total} sent{a.status !== "ACTIVE" ? ` · ${a.status.toLowerCase()}` : ""}
                                    </span>
                                </span>
                            ))}
                        </div>
                    ) : null}

                    <div className="overflow-x-auto">
                        <div className="inline-flex flex-col gap-2 min-w-full">
                            <div
                                className="grid text-[10px] text-muted"
                                style={{
                                    gridTemplateColumns: `repeat(${weeks}, ${CELL_PX}px)`,
                                    gap: `${CELL_GAP_PX}px`,
                                }}
                            >
                                {monthMarkers.map((m) => (
                                    <span key={m.col} style={{ gridColumnStart: m.col + 1 }}>
                                        {m.label}
                                    </span>
                                ))}
                            </div>

                            <div
                                className="grid"
                                style={{
                                    gridTemplateColumns: `repeat(${weeks}, ${CELL_PX}px)`,
                                    gridTemplateRows: `repeat(7, ${CELL_PX}px)`,
                                    gridAutoFlow: "column",
                                    gap: `${CELL_GAP_PX}px`,
                                }}
                            >
                                {Array.from({ length: weeks * 7 }, (_, i) => {
                                    const cellDate = new Date(gridStart);
                                    cellDate.setDate(cellDate.getDate() + i);
                                    if (cellDate > today) {
                                        return <span key={i} aria-hidden />;
                                    }
                                    const iso = toISODate(cellDate);
                                    const cell = days.get(iso);
                                    const total = cell?.total ?? 0;
                                    const level = computeLevel(total, sortedNonZero);
                                    const breakdown =
                                        cell && cell.byAccount.length > 1
                                            ? ` (${cell.byAccount.map((a) => `${a.title}: ${a.count}`).join(", ")})`
                                            : "";
                                    const label =
                                        total > 0 ? `${total} sent on ${iso}${breakdown}` : `No sends on ${iso}`;
                                    return (
                                        <button
                                            key={i}
                                            type="button"
                                            title={label}
                                            aria-label={label}
                                            className="rounded-[2px] border border-border/40 hover:outline hover:outline-1 hover:outline-foreground/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                                            style={{
                                                width: CELL_PX,
                                                height: CELL_PX,
                                                background: levelBackground(level, "var(--accent)"),
                                            }}
                                        />
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
