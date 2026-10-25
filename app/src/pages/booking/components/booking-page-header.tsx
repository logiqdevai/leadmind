import type { FC } from "react";
import { Button, Label, ListBox, Select } from "@heroui/react";
import { Clock, Users } from "lucide-react";
import type { PublicBookingPage } from "@/features/bookings/interfaces/bookings.interfaces";
import { formatDuration } from "@/features/bookings/utils/booking-time";
import { describeLocation } from "@/pages/booking/utils/booking-location";
import { LocationIcon } from "@/pages/booking/components/booking-summary-list";

const ANY_MEMBER = "__any";

interface BookingPageHeaderProps {
    data: PublicBookingPage;
    duration: number;
    onDurationChange: (minutes: number) => void;
    memberUuid: string | null;
    onMemberChange: (uuid: string | null) => void;
    /** Duration and member are fixed once a time has been picked. */
    isLocked: boolean;
}

export const BookingPageHeader: FC<BookingPageHeaderProps> = ({
    data,
    duration,
    onDurationChange,
    memberUuid,
    onMemberChange,
    isLocked,
}) => {
    const { page } = data;
    const location = describeLocation(page.location_type, page.location_details);
    const durations = page.durations.length > 0 ? page.durations : [page.default_duration];
    const teamNames = page.team.map((m) => m.name).filter(Boolean);
    const brand = page.brand_name || data.organisation_name;

    return (
        <header className="flex flex-col gap-5">
            <div className="flex items-center gap-3">
                {page.logo_url ? (
                    <img
                        src={page.logo_url}
                        alt={`${brand} logo`}
                        className="size-10 shrink-0 rounded-xl object-contain"
                    />
                ) : null}
                {brand ? <span className="text-sm font-semibold text-muted">{brand}</span> : null}
            </div>

            <div className="flex flex-col gap-2">
                <h1 className="text-2xl font-semibold leading-tight text-foreground">{page.title}</h1>
                {page.description ? <p className="text-sm text-muted whitespace-pre-line">{page.description}</p> : null}
                {page.intro_text ? (
                    <p className="text-sm text-foreground whitespace-pre-line">{page.intro_text}</p>
                ) : null}
            </div>

            <div className="flex flex-col gap-3 text-sm text-foreground">
                {durations.length > 1 ? (
                    <div className="flex flex-col gap-2">
                        <span className="flex items-center gap-2 text-muted">
                            <Clock className="size-4" aria-hidden />
                            Duration
                        </span>
                        <div className="flex flex-wrap gap-2" role="group" aria-label="Meeting duration">
                            {durations.map((minutes) => (
                                <Button
                                    key={minutes}
                                    size="sm"
                                    variant={minutes === duration ? "primary" : "secondary"}
                                    aria-pressed={minutes === duration}
                                    isDisabled={isLocked && minutes !== duration}
                                    onPress={() => onDurationChange(minutes)}
                                >
                                    {formatDuration(minutes)}
                                </Button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <span className="flex items-center gap-2">
                        <Clock className="size-4 text-muted" aria-hidden />
                        {formatDuration(duration)}
                    </span>
                )}

                {location ? (
                    <span className="flex items-start gap-2">
                        <LocationIcon type={page.location_type} className="mt-0.5 text-muted" />
                        <span className="break-words">{location}</span>
                    </span>
                ) : null}

                {teamNames.length > 0 ? (
                    <span className="flex items-start gap-2">
                        <Users className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
                        <span>With {teamNames.join(", ")}</span>
                    </span>
                ) : null}

                {page.allow_member_choice && page.members.length > 0 ? (
                    <div className="flex flex-col gap-1.5">
                        <Label>Meet with</Label>
                        <Select
                            aria-label="Meet with"
                            value={memberUuid ?? ANY_MEMBER}
                            onChange={(key) => onMemberChange(!key || key === ANY_MEMBER ? null : String(key))}
                            isDisabled={isLocked}
                            fullWidth
                        >
                            <Select.Trigger>
                                <Select.Value />
                                <Select.Indicator />
                            </Select.Trigger>
                            <Select.Popover>
                                <ListBox>
                                    <ListBox.Item id={ANY_MEMBER} textValue="Anyone available">
                                        Anyone available
                                        <ListBox.ItemIndicator />
                                    </ListBox.Item>
                                    {page.members.map((member) => (
                                        <ListBox.Item key={member.uuid} id={member.uuid} textValue={member.name}>
                                            {member.name}
                                            <ListBox.ItemIndicator />
                                        </ListBox.Item>
                                    ))}
                                </ListBox>
                            </Select.Popover>
                        </Select>
                    </div>
                ) : null}
            </div>
        </header>
    );
};
