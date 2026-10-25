import type { FC } from "react";
import { Label, ListBox, Select, Switch } from "@heroui/react";
import { Link } from "react-router-dom";
import { useBookingPages } from "@/features/bookings/hooks/use-booking-pages";
import { Routes } from "@/routes/routes";
import { cn } from "@/lib/utils";

interface BookingLinkSettingsProps {
    /** null = the organisation's default booking page. */
    bookingPageUuid: string | null;
    onBookingPageChange: (uuid: string | null) => void;
    appendCta: boolean;
    onAppendCtaChange: (value: boolean) => void;
    disabled?: boolean;
    /** Label of the null option, e.g. "Use the template's page" for sequence steps. */
    defaultOptionLabel?: string;
}

const DEFAULT_KEY = "__default__";

/**
 * Picks which booking page `{{booking_link}}` points to. Every recipient gets their own
 * contact-specific link to that page, resolved when the email is sent.
 */
export const BookingLinkSettings: FC<BookingLinkSettingsProps> = ({
    bookingPageUuid,
    onBookingPageChange,
    appendCta,
    onAppendCtaChange,
    disabled = false,
    defaultOptionLabel = "Default booking page",
}) => {
    const { data: pages, isLoading } = useBookingPages();
    const activePages = (pages ?? []).filter((p) => p.is_active || p.uuid === bookingPageUuid);

    if (!isLoading && !pages?.length) {
        return (
            <div className="rounded-xl border border-border bg-surface-secondary/40 px-4 py-3 text-sm text-muted">
                Add a booking page to send each recipient a personal booking link with {"{{booking_link}}"}.{" "}
                <Link
                    to={Routes.dashboard.booking_pages}
                    className="font-medium text-foreground underline-offset-2 hover:underline"
                >
                    Create one
                </Link>
                .
            </div>
        );
    }

    return (
        <div className="space-y-3 rounded-xl border border-border px-4 py-3">
            <div className="space-y-1.5">
                <Label className="text-sm text-foreground">Booking link</Label>
                <Select
                    aria-label="Booking page"
                    selectedKey={bookingPageUuid ?? DEFAULT_KEY}
                    onSelectionChange={(key) => onBookingPageChange(key === DEFAULT_KEY || !key ? null : String(key))}
                    isDisabled={disabled || isLoading}
                    fullWidth
                >
                    <Select.Trigger
                        className={cn(
                            "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-md border border-border bg-surface-primary",
                            "focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40",
                        )}
                    >
                        <Select.Value className="min-w-0 flex-1 overflow-hidden" />
                        <Select.Indicator className="shrink-0" />
                    </Select.Trigger>
                    <Select.Popover>
                        <ListBox>
                            <ListBox.Item id={DEFAULT_KEY} textValue={defaultOptionLabel}>
                                {defaultOptionLabel}
                                <ListBox.ItemIndicator />
                            </ListBox.Item>
                            {activePages.map((page) => (
                                <ListBox.Item key={page.uuid} id={page.uuid} textValue={page.name}>
                                    <span className="truncate">{page.name}</span>
                                    {page.is_default ? <span className="ml-2 text-xs text-muted">Default</span> : null}
                                    <ListBox.ItemIndicator />
                                </ListBox.Item>
                            ))}
                        </ListBox>
                    </Select.Popover>
                </Select>
                <p className="text-xs text-muted">
                    Insert {"{{booking_link}}"} anywhere in the email. Each recipient gets their own link to this page,
                    so bookings land on their contact.
                </p>
            </div>
            <label className="flex items-center justify-between gap-3">
                <span className="text-sm text-foreground">
                    Add a booking button when the email has no {"{{booking_link}}"}
                </span>
                <Switch
                    isSelected={appendCta}
                    onChange={(v) => onAppendCtaChange(typeof v === "boolean" ? v : !appendCta)}
                    isDisabled={disabled}
                    aria-label="Append booking button"
                >
                    <Switch.Control>
                        <Switch.Thumb />
                    </Switch.Control>
                </Switch>
            </label>
        </div>
    );
};
