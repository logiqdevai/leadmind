import type { FC, ReactNode } from "react";
import { Button, Label, ListBox, Select } from "@heroui/react";
import { Check, Clock, User } from "lucide-react";
import { useTranslation } from "react-i18next";
import { BookingLocationTypes, type PublicBookingPage } from "@/features/bookings/interfaces/bookings.interfaces";
import { formatDurationLocalized } from "@/pages/booking/utils/booking-format";
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

const InfoRow: FC<{ icon: ReactNode; title: string; subtitle?: string | null }> = ({ icon, title, subtitle }) => (
    <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-secondary text-foreground">
            {icon}
        </span>
        <div className="min-w-0">
            <p className="break-words text-sm font-semibold text-foreground">{title}</p>
            {subtitle ? <p className="break-words text-sm text-muted">{subtitle}</p> : null}
        </div>
    </div>
);

/** Left panel of the booking page: brand, appointment summary and "what to expect". */
export const BookingPageHeader: FC<BookingPageHeaderProps> = ({
    data,
    duration,
    onDurationChange,
    memberUuid,
    onMemberChange,
    isLocked,
}) => {
    const { t } = useTranslation();
    const { page } = data;
    const location = describeLocation(page.location_type, page.location_details);
    const durations = page.durations.length > 1 ? page.durations : [];
    const teamNames = page.team.map((m) => m.name).filter(Boolean);
    const brand = page.brand_name?.trim() || "";
    const expectations = page.expectations ?? [];

    return (
        <header className="flex flex-col gap-6">
            {page.logo_url ? (
                <img
                    src={page.logo_url}
                    alt={t("booking.header.logoAlt", { brand: brand || page.title })}
                    className="h-9 max-w-full self-start object-contain"
                />
            ) : brand ? (
                <span className="text-2xl font-semibold tracking-tight text-foreground">{brand}</span>
            ) : null}

            <div className="flex flex-col gap-3">
                <h1 className="text-2xl font-bold leading-tight text-foreground sm:text-3xl">{page.title}</h1>
                {page.description ? (
                    <p className="whitespace-pre-line text-base text-muted">{page.description}</p>
                ) : null}
                {page.intro_text ? (
                    <p className="whitespace-pre-line text-sm text-foreground">{page.intro_text}</p>
                ) : null}
            </div>

            <div className="flex flex-col gap-4">
                {durations.length > 0 ? (
                    <div className="flex flex-col gap-2">
                        <span className="flex items-center gap-2 text-sm text-muted">
                            <Clock className="size-4" aria-hidden />
                            {t("booking.header.duration")}
                        </span>
                        <div className="flex flex-wrap gap-2" role="group" aria-label={t("booking.header.durationGroup")}>
                            {durations.map((minutes) => (
                                <Button
                                    key={minutes}
                                    size="sm"
                                    variant={minutes === duration ? "primary" : "secondary"}
                                    aria-pressed={minutes === duration}
                                    isDisabled={isLocked && minutes !== duration}
                                    onPress={() => onDurationChange(minutes)}
                                >
                                    {formatDurationLocalized(minutes)}
                                </Button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <InfoRow
                        icon={<Clock className="size-5" aria-hidden />}
                        title={formatDurationLocalized(duration)}
                        subtitle={t("booking.header.callDuration")}
                    />
                )}

                {location ? (
                    <InfoRow
                        icon={<LocationIcon type={page.location_type} className="size-5" />}
                        title={location}
                        subtitle={page.location_type === BookingLocationTypes.GOOGLE_MEET ? t("booking.header.onlineMeeting") : null}
                    />
                ) : null}

                {teamNames.length > 0 ? (
                    <InfoRow
                        icon={<User className="size-5" aria-hidden />}
                        title={t("booking.header.with", { names: teamNames.join(", ") })}
                    />
                ) : null}

                {page.allow_member_choice && page.members.length > 0 ? (
                    <div className="flex flex-col gap-1.5">
                        <Label>{t("booking.header.meetWith")}</Label>
                        <Select
                            aria-label={t("booking.header.meetWith")}
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
                                    <ListBox.Item id={ANY_MEMBER} textValue={t("booking.header.anyone")}>
                                        {t("booking.header.anyone")}
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

            {expectations.length > 0 ? (
                <section className="flex flex-col gap-3 border-t border-border/60 pt-6">
                    <h2 className="text-base font-semibold text-foreground">{t("booking.header.whatToExpect")}</h2>
                    <ul className="flex flex-col gap-2.5">
                        {expectations.map((item, index) => (
                            <li key={`${item}-${index}`} className="flex items-center gap-3 text-sm text-foreground">
                                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                                    <Check className="size-3.5" strokeWidth={3} aria-hidden />
                                </span>
                                <span className="min-w-0 break-words">{item}</span>
                            </li>
                        ))}
                    </ul>
                </section>
            ) : null}
        </header>
    );
};
