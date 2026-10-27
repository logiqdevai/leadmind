import { useState, type FC } from "react";
import { Button, Checkbox, Input } from "@heroui/react";
import { Clock, Copy, Pencil, Plus, X } from "lucide-react";
import { SectionCard } from "@/components/ui/profile-section";
import { ActionButtonWithPending } from "@/components/ui/action-button-with-pending";
import { useUpdateContact } from "@/features/contacts/hooks/use-contacts";
import {
    DEFAULT_INTERVAL,
    WEEKDAYS,
    WEEKDAY_LABELS,
    emptyOpeningHours,
    formatDayHours,
    hasAnyOpeningHours,
    validateOpeningHours,
    type OpeningHours,
    type Weekday,
} from "@/features/contacts/constants/opening-hours.constants";
import { toast } from "@/hooks/use-toast";

interface OpeningHoursSectionProps {
    contactUuid: string;
    hours: OpeningHours | null | undefined;
}

const cloneHours = (hours: OpeningHours | null | undefined): OpeningHours => {
    const draft = emptyOpeningHours();
    for (const day of WEEKDAYS) draft[day] = (hours?.[day] ?? []).map((i) => ({ ...i }));
    return draft;
};

/** Opening and closing hours of the contact's business, shown per weekday and editable in place. */
export const OpeningHoursSection: FC<OpeningHoursSectionProps> = ({ contactUuid, hours }) => {
    const updateContact = useUpdateContact();
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState<OpeningHours>(() => cloneHours(hours));

    const startEditing = () => {
        setDraft(cloneHours(hours));
        setEditing(true);
    };

    const setDay = (day: Weekday, intervals: OpeningHours[Weekday]) => setDraft((prev) => ({ ...prev, [day]: intervals }));

    const copyToAll = (from: Weekday) =>
        setDraft((prev) => {
            const next = { ...prev };
            for (const day of WEEKDAYS) next[day] = prev[from].map((i) => ({ ...i }));
            return next;
        });

    const handleSave = () => {
        const error = validateOpeningHours(draft);
        if (error) {
            toast({ title: "Check the opening hours", description: error, duration: 3500, variant: "error" });
            return;
        }
        updateContact.mutate(
            { uuid: contactUuid, payload: { opening_hours: hasAnyOpeningHours(draft) ? draft : null } },
            { onSuccess: () => setEditing(false) },
        );
    };

    const action = editing ? null : (
        <Button size="sm" variant="tertiary" onPress={startEditing}>
            <Pencil className="size-3.5" />
            {hasAnyOpeningHours(hours) ? "Edit" : "Add"}
        </Button>
    );

    return (
        <SectionCard title="Opening hours" icon={Clock} action={action}>
            {editing ? (
                <div className="space-y-3">
                    {WEEKDAYS.map((day) => {
                        const intervals = draft[day];
                        const closed = intervals.length === 0;
                        return (
                            <div key={day} className="flex flex-col gap-2 sm:flex-row sm:items-start">
                                <div className="flex items-center justify-between gap-2 sm:w-40 sm:shrink-0 sm:pt-1.5">
                                    <span className="text-sm font-medium text-foreground">{WEEKDAY_LABELS[day]}</span>
                                    <Checkbox
                                        isSelected={closed}
                                        onChange={(isClosed) => setDay(day, isClosed ? [] : [{ ...DEFAULT_INTERVAL }])}
                                        aria-label={`${WEEKDAY_LABELS[day]} closed`}
                                    >
                                        <Checkbox.Control>
                                            <Checkbox.Indicator />
                                        </Checkbox.Control>
                                        <Checkbox.Content className="text-xs text-muted">Closed</Checkbox.Content>
                                    </Checkbox>
                                </div>

                                <div className="flex min-w-0 flex-1 flex-col gap-2">
                                    {closed ? (
                                        <span className="pt-1.5 text-sm text-muted">Closed</span>
                                    ) : (
                                        intervals.map((interval, index) => (
                                            <div key={index} className="flex items-center gap-2">
                                                <Input
                                                    type="time"
                                                    aria-label={`${WEEKDAY_LABELS[day]} opens`}
                                                    className="w-32"
                                                    value={interval.open}
                                                    onChange={(e) =>
                                                        setDay(
                                                            day,
                                                            intervals.map((i, n) => (n === index ? { ...i, open: e.target.value } : i)),
                                                        )
                                                    }
                                                />
                                                <span className="text-muted">–</span>
                                                <Input
                                                    type="time"
                                                    aria-label={`${WEEKDAY_LABELS[day]} closes`}
                                                    className="w-32"
                                                    value={interval.close === "24:00" ? "23:59" : interval.close}
                                                    onChange={(e) =>
                                                        setDay(
                                                            day,
                                                            intervals.map((i, n) => (n === index ? { ...i, close: e.target.value } : i)),
                                                        )
                                                    }
                                                />
                                                <button
                                                    type="button"
                                                    aria-label="Remove interval"
                                                    onClick={() => setDay(day, intervals.filter((_, n) => n !== index))}
                                                    className="rounded-md p-1 text-muted transition-colors hover:text-danger"
                                                >
                                                    <X className="size-4" />
                                                </button>
                                            </div>
                                        ))
                                    )}
                                    {!closed && intervals.length < 4 ? (
                                        <div className="flex flex-wrap gap-3">
                                            <button
                                                type="button"
                                                onClick={() => setDay(day, [...intervals, { open: "14:00", close: "18:00" }])}
                                                className="flex items-center gap-1 text-xs text-accent hover:opacity-80"
                                            >
                                                <Plus className="size-3" />
                                                Add hours
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => copyToAll(day)}
                                                className="flex items-center gap-1 text-xs text-muted hover:text-foreground"
                                            >
                                                <Copy className="size-3" />
                                                Copy to all days
                                            </button>
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        );
                    })}

                    <div className="flex justify-end gap-2 pt-1">
                        <Button size="sm" variant="tertiary" onPress={() => setEditing(false)} isDisabled={updateContact.isPending}>
                            Cancel
                        </Button>
                        <ActionButtonWithPending
                            size="sm"
                            variant="secondary"
                            isPending={updateContact.isPending}
                            isDisabled={updateContact.isPending}
                            onPress={handleSave}
                        >
                            Save hours
                        </ActionButtonWithPending>
                    </div>
                </div>
            ) : hasAnyOpeningHours(hours) ? (
                <dl className="divide-y divide-border/50">
                    {WEEKDAYS.map((day) => (
                        <div key={day} className="grid grid-cols-[8rem_1fr] gap-3 py-1.5 text-sm">
                            <dt className="text-muted">{WEEKDAY_LABELS[day]}</dt>
                            <dd className={hours[day]?.length ? "text-foreground" : "text-muted"}>{formatDayHours(hours[day])}</dd>
                        </div>
                    ))}
                </dl>
            ) : (
                <p className="text-sm text-muted">No opening hours yet. Scraped places fill this in automatically when they list hours.</p>
            )}
        </SectionCard>
    );
};
