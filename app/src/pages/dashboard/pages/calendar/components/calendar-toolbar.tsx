import type { FC } from "react";
import { Button, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { Ban, ChevronLeft, ChevronRight, Download, Plus } from "lucide-react";
import { ActionButtonWithPending } from "@/components/ui/action-button-with-pending";
import { DateKeyPicker } from "@/components/bookings/booking-date-time-fields";
import { CalendarViews, ListScopes, rangeLabel, type CalendarView, type ListScope } from "../utils/calendar-grid";

const VIEW_OPTIONS: { id: CalendarView; label: string }[] = [
    { id: CalendarViews.MONTH, label: "Month" },
    { id: CalendarViews.WEEK, label: "Week" },
    { id: CalendarViews.DAY, label: "Day" },
    { id: CalendarViews.LIST, label: "List" },
];

interface CalendarToolbarProps {
    view: CalendarView;
    anchor: string;
    timezoneLabel: string;
    onViewChange: (view: CalendarView) => void;
    onPrev: () => void;
    onNext: () => void;
    onToday: () => void;
    scope: ListScope;
    onScopeChange: (scope: ListScope) => void;
    listFrom: string;
    listTo: string;
    onListRangeChange: (from: string, to: string) => void;
    onNewBooking: () => void;
    onBlockTime: () => void;
    onExport: () => void;
    isExporting: boolean;
}

export const CalendarToolbar: FC<CalendarToolbarProps> = ({
    view,
    anchor,
    timezoneLabel,
    onViewChange,
    onPrev,
    onNext,
    onToday,
    scope,
    onScopeChange,
    listFrom,
    listTo,
    onListRangeChange,
    onNewBooking,
    onBlockTime,
    onExport,
    isExporting,
}) => {
    const isList = view === CalendarViews.LIST;
    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <ToggleButtonGroup
                    size="sm"
                    selectionMode="single"
                    disallowEmptySelection
                    selectedKeys={new Set([view])}
                    onSelectionChange={(keys) => {
                        const next = [...keys][0];
                        if (next) onViewChange(next as CalendarView);
                    }}
                    aria-label="Calendar view"
                >
                    {VIEW_OPTIONS.map((opt) => (
                        <ToggleButton key={opt.id} id={opt.id}>
                            {opt.label}
                        </ToggleButton>
                    ))}
                </ToggleButtonGroup>
                <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="secondary" onPress={onBlockTime}>
                        <Ban className="size-3.5" />
                        Block time
                    </Button>
                    <ActionButtonWithPending
                        size="sm"
                        variant="secondary"
                        isPending={isExporting}
                        isDisabled={isExporting}
                        onPress={onExport}
                    >
                        <Download className="size-3.5" />
                        Export CSV
                    </ActionButtonWithPending>
                    <Button size="sm" variant="primary" onPress={onNewBooking}>
                        <Plus className="size-3.5" />
                        New booking
                    </Button>
                </div>
            </div>

            {isList ? (
                <div className="flex flex-wrap items-end gap-2">
                    <ToggleButtonGroup
                        size="sm"
                        selectionMode="single"
                        disallowEmptySelection
                        selectedKeys={new Set([scope])}
                        onSelectionChange={(keys) => {
                            const next = [...keys][0];
                            if (next) onScopeChange(next as ListScope);
                        }}
                        aria-label="Upcoming or past"
                    >
                        <ToggleButton id={ListScopes.UPCOMING}>Upcoming</ToggleButton>
                        <ToggleButton id={ListScopes.PAST}>Past</ToggleButton>
                    </ToggleButtonGroup>
                    <DateKeyPicker
                        aria-label="From date"
                        value={listFrom}
                        onChange={(v) => onListRangeChange(v, listTo && listTo < v ? v : listTo)}
                        className="w-40"
                    />
                    <span className="pb-2 text-xs text-muted">to</span>
                    <DateKeyPicker
                        aria-label="To date"
                        value={listTo}
                        minValue={listFrom || undefined}
                        onChange={(v) => onListRangeChange(listFrom, v)}
                        className="w-40"
                    />
                    {listFrom || listTo ? (
                        <Button size="sm" variant="tertiary" onPress={() => onListRangeChange("", "")}>
                            Any date
                        </Button>
                    ) : null}
                    <span className="ml-auto pb-2 text-xs text-muted">{timezoneLabel}</span>
                </div>
            ) : (
                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1">
                        <Button size="sm" variant="tertiary" isIconOnly aria-label="Previous" onPress={onPrev}>
                            <ChevronLeft className="size-4" />
                        </Button>
                        <Button size="sm" variant="secondary" onPress={onToday}>
                            Today
                        </Button>
                        <Button size="sm" variant="tertiary" isIconOnly aria-label="Next" onPress={onNext}>
                            <ChevronRight className="size-4" />
                        </Button>
                    </div>
                    <h2 className="text-base font-semibold text-foreground">{rangeLabel(view, anchor)}</h2>
                    <span className="ml-auto text-xs text-muted">{timezoneLabel}</span>
                </div>
            )}
        </div>
    );
};
