const VIZ_HUE_COUNT = 8;

/** Fixed categorical hue order - assign by a stable sort key, never by array position/rank. */
export function vizHueVar(index: number): string {
    return `var(--viz-hue-${(index % VIZ_HUE_COUNT) + 1})`;
}

const LEVEL_MIX_PERCENT = [30, 55, 78, 100];

/** Sequential ramp: one hue, light -> dark, computed by mixing toward the chart surface. */
export function levelBackground(level: number, hueVar: string): string {
    if (level <= 0) return "var(--surface-tertiary)";
    const percent = LEVEL_MIX_PERCENT[Math.min(level, LEVEL_MIX_PERCENT.length) - 1];
    return `color-mix(in oklab, var(--surface) ${100 - percent}%, ${hueVar} ${percent}%)`;
}

/**
 * GitHub-style quartile bucketing: a day's intensity level (0-4) is relative to
 * that integration's own busiest days, not a fixed global cap - so a low-volume
 * account still shows visible variation instead of every active day looking identical.
 */
export function computeLevel(count: number, sortedNonZero: number[]): number {
    if (count <= 0 || sortedNonZero.length === 0) return 0;
    const quartile = (p: number) => sortedNonZero[Math.min(sortedNonZero.length - 1, Math.floor(p * sortedNonZero.length))];
    if (count <= quartile(0.25)) return 1;
    if (count <= quartile(0.5)) return 2;
    if (count <= quartile(0.75)) return 3;
    return 4;
}
