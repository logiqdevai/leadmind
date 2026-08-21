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

interface RowLayout {
    series: SendingActivitySeries;
    hueVar: string;
    total: number;
    peak: { date: string; count: number } | null;
    dayMap: Map<string, number>;
    sortedNonZero: number[];
}

function buildRows(series: SendingActivitySeries[]): RowLayout[] {
    // Hue assignment is keyed off a stable sort of the uuid, independent of the
    // list's fetch/display order, so a status change or reordering never repaints
    // an integration's colour (colour follows the entity, never its rank).
    const hueOrder = [...series]
        .map((s) => s.campaign_integration_uuid)
        .sort((a, b) => a.localeCompare(b));

    return series.map((s) => {
        const dayMap = new Map(s.days.map((d) => [d.date, d.count]));
        const total = s.days.reduce((sum, d) => sum + d.count, 0);
        const peak = s.days.reduce<{ date: string; count: number } | null>(
            (best, d) => (!best || d.count > best.count ? { date: d.date, count: d.count } : best),
            null,
        );
        const sortedNonZero = s.days.map((d) => d.count).filter((c) => c > 0).sort((a, b) => a - b);
        return {
            series: s,
            hueVar: vizHueVar(hueOrder.indexOf(s.campaign_integration_uuid)),
            total,
            peak,
            dayMap,
            sortedNonZero,
        };
    });
}

export function SendingActivityHeatmap({ campaignUuid }: { campaignUuid: string }) {
    const { data: series, isLoading } = useCampaignIntegrationsActivity(campaignUuid);
    const [showTable, setShowTable] = useState(false);

    const rows = useMemo(() => buildRows(series ?? []), [series]);

    const { weeks, gridStart, today } = useMemo(() => {
        const allDates = rows.flatMap((r) => r.series.days.map((d) => d.date));
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
    }, [rows]);

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

    const tableRows = useMemo(
        () =>
            rows
                .flatMap((r) =>
                    r.series.days
                        .filter((d) => d.count > 0)
                        .map((d) => ({
                            date: d.date,
                            count: d.count,
                            label: r.series.integration_account.title,
                            hueVar: r.hueVar,
                        })),
                )
                .sort((a, b) => (a.date < b.date ? 1 : -1)),
        [rows],
    );

    if (isLoading) {
        return (
            <div className="space-y-2 animate-pulse" aria-hidden>
                <div className="h-24 rounded-xl bg-surface-secondary" />
            </div>
        );
    }

    if (rows.length === 0) {
        return null;
    }

    const hasAnyData = tableRows.length > 0;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <p className="text-sm font-medium text-foreground">Sending activity</p>
                    <p className="text-xs text-muted">
                        Real sends per day, per email account. Colour intensity is relative to each
                        account's own busiest day - hover a day for the exact count.
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
                <div className="overflow-x-auto">
                    <div className="inline-flex flex-col gap-3 min-w-full">
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

                        {rows.map((row) => (
                            <div key={row.series.campaign_integration_uuid} className="space-y-1">
                                <div className="flex items-center gap-2 text-xs">
                                    <span
                                        className="inline-block size-2.5 rounded-full shrink-0"
                                        style={{ background: row.hueVar }}
                                        aria-hidden
                                    />
                                    <span className="font-medium text-foreground truncate">
                                        {row.series.integration_account.title}
                                    </span>
                                    <span className="text-muted">({row.series.integration_account.provider})</span>
                                    {row.series.status !== "ACTIVE" ? (
                                        <span className="text-muted italic">- {row.series.status.toLowerCase()}</span>
                                    ) : null}
                                    <span className="text-muted ml-auto shrink-0">
                                        {row.total} sent
                                        {row.peak ? ` · peak ${row.peak.count} on ${row.peak.date}` : ""}
                                    </span>
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
                                        const count = row.dayMap.get(iso) ?? 0;
                                        const level = computeLevel(count, row.sortedNonZero);
                                        const label = `${count} sent on ${iso} via ${row.series.integration_account.title}`;
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
                                                    background: levelBackground(level, row.hueVar),
                                                }}
                                            />
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
