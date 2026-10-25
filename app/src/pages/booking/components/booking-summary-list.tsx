import type { FC, ReactNode } from "react";
import { CalendarDays, Clock, Globe, MapPin, Phone, User, Video } from "lucide-react";
import {
    BookingLocationTypes,
    type BookingLocationType,
} from "@/features/bookings/interfaces/bookings.interfaces";
import { describeLocation } from "@/pages/booking/utils/booking-location";
import {
    formatDateLong,
    formatDuration,
    formatTimeRange,
    timeZoneOffsetLabel,
} from "@/features/bookings/utils/booking-time";
import { cn } from "@/lib/utils";

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

const Row: FC<{ icon: ReactNode; label: string; children: ReactNode }> = ({ icon, label, children }) => (
    <div className="flex items-start gap-3">
        <span className="mt-0.5 text-muted">{icon}</span>
        <div className="min-w-0">
            <dt className="sr-only">{label}</dt>
            <dd className="text-sm text-foreground break-words">{children}</dd>
        </div>
    </div>
);

interface BookingSummaryListProps {
    data: BookingSummaryData;
    className?: string;
}

/** Date, time, timezone, duration and location of a (prospective) booking. */
export const BookingSummaryList: FC<BookingSummaryListProps> = ({ data, className }) => {
    const location = describeLocation(data.location_type, data.location_details);
    return (
        <dl className={cn("flex flex-col gap-3", className)}>
            <Row icon={<CalendarDays className="size-4" aria-hidden />} label="Date">
                {formatDateLong(data.start_at, data.timezone)}
            </Row>
            <Row icon={<Clock className="size-4" aria-hidden />} label="Time">
                {formatTimeRange(data.start_at, data.end_at, data.timezone)}
                <span className="text-muted"> ({formatDuration(data.duration_minutes)})</span>
            </Row>
            <Row icon={<Globe className="size-4" aria-hidden />} label="Timezone">
                {data.timezone.replace(/_/g, " ")}{" "}
                <span className="text-muted">({timeZoneOffsetLabel(data.timezone, new Date(data.start_at))})</span>
            </Row>
            {location ? (
                <Row icon={<LocationIcon type={data.location_type} />} label="Location">
                    {location}
                </Row>
            ) : null}
            {data.meeting_url ? (
                <Row icon={<Video className="size-4" aria-hidden />} label="Meeting link">
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
                <Row icon={<User className="size-4" aria-hidden />} label="With">
                    With {data.team_member}
                </Row>
            ) : null}
        </dl>
    );
};
