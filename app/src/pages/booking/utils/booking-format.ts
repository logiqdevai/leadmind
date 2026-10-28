import i18n from "@/lib/i18n";

/** Localised "30 min", "1 h", "1 h 30 min" for the public booking pages. */
export function formatDurationLocalized(minutes: number): string {
    if (minutes < 60) return i18n.t("duration.minutes", { count: minutes });
    const h = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest ? i18n.t("duration.hoursMinutes", { hours: h, minutes: rest }) : i18n.t("duration.hours", { count: h });
}

/** Localised "1 day", "2 hours", "30 minutes" for notice periods. */
export function formatMinutesSpanLocalized(minutes: number): string {
    if (minutes % 1440 === 0) return i18n.t("duration.spanDays", { count: minutes / 1440 });
    if (minutes % 60 === 0) return i18n.t("duration.spanHours", { count: minutes / 60 });
    return i18n.t("duration.spanMinutes", { count: minutes });
}
