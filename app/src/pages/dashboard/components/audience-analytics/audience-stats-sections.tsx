import type { ContactAudienceStats } from "@/features/contact-audience-stats/interfaces/contact-audience-stats.interface";
import {
    buildAudienceStatSections,
    type StatTile,
} from "@/features/contact-audience-stats/utils/audience-stat-sections";

interface AudienceStatsSectionsProps {
    stats: ContactAudienceStats | undefined;
    isLoading: boolean;
}

export function AudienceStatsSections({ stats, isLoading }: AudienceStatsSectionsProps) {
    if (isLoading) {
        return (
            <div className="space-y-5">
                {Array.from({ length: 3 }).map((_, i) => (
                    <section key={i} className="space-y-2">
                        <div className="h-3 w-24 rounded bg-surface-secondary animate-pulse" />
                        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                            {Array.from({ length: 4 }).map((_, j) => (
                                <div
                                    key={j}
                                    className="rounded-xl border border-border bg-surface p-3 h-[72px] animate-pulse"
                                />
                            ))}
                        </div>
                    </section>
                ))}
            </div>
        );
    }

    if (!stats) return null;

    const sections = buildAudienceStatSections(stats);

    return (
        <div className="space-y-5">
            {sections.map((section) => (
                <section key={section.title} className="space-y-2">
                    <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
                        {section.title}
                    </h2>
                    <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                        {section.tiles.map((tile) => (
                            <Tile key={`${section.title}-${tile.label}`} {...tile} />
                        ))}
                    </div>
                </section>
            ))}
        </div>
    );
}

function Tile({ label, value, sublabel, accent = "neutral" }: StatTile) {
    const tone =
        accent === "primary"
            ? "text-accent"
            : accent === "success"
              ? "text-success"
              : accent === "warning"
                ? "text-warning"
                : accent === "error"
                  ? "text-error"
                  : "text-foreground";

    const displayValue =
        label.includes("rate") && sublabel ? sublabel.replace("%", "") : value.toLocaleString();

    return (
        <div className="rounded-xl border border-border bg-surface p-3">
            <div className="text-xs text-muted">{label}</div>
            <div className={`text-2xl font-semibold tabular-nums ${tone}`}>
                {label.includes("rate") && sublabel ? sublabel : displayValue}
            </div>
            {sublabel && !label.includes("rate") ? (
                <div className="text-xs text-muted mt-0.5 tabular-nums">{sublabel}</div>
            ) : null}
        </div>
    );
}
