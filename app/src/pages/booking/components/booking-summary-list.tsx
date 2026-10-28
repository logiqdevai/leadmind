import type { FC, ReactNode } from "react";
import { CalendarDays, Clock, Globe, MapPin, Phone, User, Video } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
    BookingLocationTypes,
    type BookingLocationType,
} from "@/features/bookings/interfaces/bookings.interfaces";
import { describeLocation } from "@/pages/booking/utils/booking-location";
import {
    formatDateLong,
    formatTimeRange,
    timeZoneOffsetLabel,
} from "@/features/bookings/utils/booking-time";
import { cn } from "@/lib/utils";
import { formatDurationLocalized } from "@/pages/booking/utils/booking-format";

export interface BookingSummaryData {
    start_at: string;
    end_at: string;
    timezone: string;
    duration_minutes: number;
    location_type: BookingLocationType;
    location_details?: string | null;
    team_member?: string | null;
    meeting_url?: string | null;
}

const LOCATION_ICONS: Record<BookingLocationType, typeof MapPin> = {
    [BookingLocationTypes.NONE]: MapPin,
    [BookingLocationTypes.GOOGLE_MEET]: Video,
    [BookingLocationTypes.PHONE]: Phone,
    [BookingLocationTypes.IN_PERSON]: MapPin,
    [BookingLocationTypes.CUSTOM]: MapPin,
};

export const LocationIcon: FC<{ type: BookingLocationType; className?: string }> = ({ type, className }) => {
    const Icon = LOCATION_ICONS[type];
    return <Icon className={cn("size-4 shrink-0", className)} aria-hidden />;
};

const Row: FC<{ icon: ReactNode; label: string; children: ReactNode; accent?: boolean }> = ({
    icon,
    label,
    children,
    accent,
}) => (
    <div className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
        <span
            className={cn(
                "flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-secondary",
                accent ? "text-accent" : "text-foreground",
            )}
        >
            {icon}
        </span>
        <div className="min-w-0">
            <dt className="text-sm text-muted">{label}</dt>
            <dd className="break-words text-base font-medium text-foreground">{children}</dd>
        </div>
    </div>
);

interface BookingSummaryListProps {
    data: BookingSummaryData;
    className?: string;
}

/** Date, time, timezone, duration and location of a (prospective) booking. */
export const BookingSummaryList: FC<BookingSummaryListProps> = ({ data, className }) => {
    const { t } = useTranslation();
    const location = describeLocation(data.location_type, data.location_details);
    const isMeetingApp = data.location_type === BookingLocationTypes.GOOGLE_MEET;
    return (
        <dl className={cn("flex flex-col divide-y divide-border/60", className)}>
            <Row accent icon={<CalendarDays className="size-5" aria-hidden />} label={t("booking.summary.date")}>
                {formatDateLong(data.start_at, data.timezone)}
            </Row>
            <Row icon={<Clock className="size-5" aria-hidden />} label={t("booking.summary.time")}>
                {formatTimeRange(data.start_at, data.end_at, data.timezone)}
                <span className="font-normal text-muted"> ({formatDurationLocalized(data.duration_minutes)})</span>
            </Row>
            <Row icon={<Globe className="size-5" aria-hidden />} label={t("booking.summary.timezone")}>
                {data.timezone.replace(/_/g, " ")}{" "}
                <span className="font-normal text-muted">
                    ({timeZoneOffsetLabel(data.timezone, new Date(data.start_at))})
                </span>
            </Row>
            {location ? (
                <Row
                    icon={<LocationIcon type={data.location_type} className="size-5" />}
                    label={isMeetingApp ? t("booking.summary.meetingApp") : t("booking.summary.location")}
                >
                    {location}
                </Row>
            ) : null}
            {data.meeting_url ? (
                <Row icon={<Video className="size-5" aria-hidden />} label={t("booking.summary.meetingLink")}>
                    <a
                        href={data.meeting_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-link underline-offset-2 hover:underline"
                    >
                        {data.meeting_url}
                    </a>
                </Row>
            ) : null}
            {data.team_member ? (
                <Row icon={<User className="size-5" aria-hidden />} label={t("booking.summary.with")}>
                    {data.team_member}
                </Row>
            ) : null}
        </dl>
    );
};
