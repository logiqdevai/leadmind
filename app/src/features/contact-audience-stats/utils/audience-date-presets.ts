export type DateRangePreset = "7d" | "30d" | "90d" | "all";

export const DATE_RANGE_PRESET_OPTIONS: { id: DateRangePreset; label: string }[] = [
    { id: "7d", label: "Last 7 days" },
    { id: "30d", label: "Last 30 days" },
    { id: "90d", label: "Last 90 days" },
    { id: "all", label: "All time" },
];

export function dateRangeFromPreset(preset: DateRangePreset): { from?: string; to?: string } {
    if (preset === "all") return {};
    const days = preset === "7d" ? 7 : preset === "30d" ? 30 : 90;
    const to = new Date();
    to.setHours(23, 59, 59, 999);
    const from = new Date();
    from.setDate(from.getDate() - days);
    from.setHours(0, 0, 0, 0);
    return { from: from.toISOString(), to: to.toISOString() };
}

export function dateRangePresetLabel(preset: DateRangePreset): string {
    return DATE_RANGE_PRESET_OPTIONS.find((o) => o.id === preset)?.label ?? "All time";
}
