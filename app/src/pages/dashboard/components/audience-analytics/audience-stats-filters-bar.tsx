import { Button, ListBox, Select } from "@heroui/react";
import { X } from "lucide-react";
import type { ContactFilters } from "@/interfaces/contact-filters.interface";
import {
    DATE_RANGE_PRESET_OPTIONS,
    type DateRangePreset,
} from "@/features/contact-audience-stats/utils/audience-date-presets";
import { ContactFiltersForm } from "../contact-filters-form";

interface AudienceStatsFiltersBarProps {
    preset: DateRangePreset;
    onPresetChange: (preset: DateRangePreset) => void;
    contactFilters: ContactFilters;
    onContactFiltersChange: (patch: Partial<ContactFilters>) => void;
    showSourceFilter?: boolean;
    filtersOpen?: boolean;
    onFiltersOpenChange?: (open: boolean) => void;
    /** Shown as a "Clear filters" button when provided. */
    onClearFilters?: () => void;
}

export function AudienceStatsFiltersBar({
    preset,
    onPresetChange,
    contactFilters,
    onContactFiltersChange,
    showSourceFilter = true,
    filtersOpen,
    onFiltersOpenChange,
    onClearFilters,
}: AudienceStatsFiltersBarProps) {
    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
                <div className="flex flex-col gap-1.5 min-w-[160px]">
                    <span className="text-xs text-muted">Activity period</span>
                    <Select
                        aria-label="Activity period"
                        value={preset}
                        onChange={(v) => {
                            if (typeof v !== "string") return;
                            onPresetChange(v as DateRangePreset);
                        }}
                    >
                        <Select.Trigger className="h-9">
                            <Select.Value />
                            <Select.Indicator />
                        </Select.Trigger>
                        <Select.Popover>
                            <ListBox>
                                {DATE_RANGE_PRESET_OPTIONS.map((opt) => (
                                    <ListBox.Item key={opt.id} id={opt.id} textValue={opt.label}>
                                        {opt.label}
                                        <ListBox.ItemIndicator />
                                    </ListBox.Item>
                                ))}
                            </ListBox>
                        </Select.Popover>
                    </Select>
                </div>
                {onClearFilters ? (
                    <Button size="sm" variant="tertiary" className="self-end h-9" onPress={onClearFilters}>
                        <X className="size-4" />
                        Clear filters
                    </Button>
                ) : null}
            </div>
            <ContactFiltersForm
                value={contactFilters}
                onChange={onContactFiltersChange}
                showSourceFilter={showSourceFilter}
                sections={{ engagement: true, outreach: true }}
                collapsible
                defaultOpen={false}
                open={filtersOpen}
                onOpenChange={onFiltersOpenChange}
            />
        </div>
    );
}
