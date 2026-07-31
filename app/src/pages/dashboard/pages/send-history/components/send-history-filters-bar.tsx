import { Button, Input, ListBox, Select, TextField } from "@heroui/react";
import { Search, X } from "lucide-react";
import { AppDatePicker } from "@/components/ui/date-picker";


export interface SendHistoryFilterOption {
    id: string;
    label: string;
}

interface SendHistoryFiltersBarProps {
    search: string;
    channel: string;
    source: string;
    status: string;
    emailProvider: string;
    campaignUuid: string;
    sentByUserUuid: string;
    dateFrom: string;
    dateTo: string;
    channelOptions: SendHistoryFilterOption[];
    sourceOptions: SendHistoryFilterOption[];
    statusOptions: SendHistoryFilterOption[];
    providerOptions: SendHistoryFilterOption[];
    campaignOptions: SendHistoryFilterOption[];
    userOptions: SendHistoryFilterOption[];
    hasActiveFilters: boolean;
    onSearchChange: (value: string) => void;
    onChannelChange: (value: string) => void;
    onSourceChange: (value: string) => void;
    onStatusChange: (value: string) => void;
    onEmailProviderChange: (value: string) => void;
    onCampaignChange: (value: string) => void;
    onSentByUserChange: (value: string) => void;
    onDateFromChange: (value: string) => void;
    onDateToChange: (value: string) => void;
    onClear: () => void;
}

export function SendHistoryFiltersBar({
    search,
    channel,
    source,
    status,
    emailProvider,
    campaignUuid,
    sentByUserUuid,
    dateFrom,
    dateTo,
    channelOptions,
    sourceOptions,
    statusOptions,
    providerOptions,
    campaignOptions,
    userOptions,
    hasActiveFilters,
    onSearchChange,
    onChannelChange,
    onSourceChange,
    onStatusChange,
    onEmailProviderChange,
    onCampaignChange,
    onSentByUserChange,
    onDateFromChange,
    onDateToChange,
    onClear,
}: SendHistoryFiltersBarProps) {
    return (
        <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full min-w-[220px] max-w-sm grow sm:grow-0 sm:w-72">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted pointer-events-none" />
                <TextField name="search" className="w-full">
                    <Input
                        className="h-8 pl-8 text-[13px]"
                        placeholder="Search contacts…"
                        value={search}
                        onChange={(e) => onSearchChange(e.target.value)}
                        aria-label="Search contacts"
                    />
                </TextField>
            </div>

            <div className="hidden h-4 w-px bg-border sm:block" aria-hidden />

            <FilterSelect
                label="Channel"
                value={channel}
                options={channelOptions}
                onChange={onChannelChange}
                className="w-[9.5rem]"
            />
            <FilterSelect
                label="Source"
                value={source}
                options={sourceOptions}
                onChange={onSourceChange}
                className="w-[9.5rem]"
            />
            <FilterSelect
                label="Status"
                value={status}
                options={statusOptions}
                onChange={onStatusChange}
                className="w-[9.5rem]"
            />
            <FilterSelect
                label="Integration"
                value={emailProvider}
                options={providerOptions}
                onChange={onEmailProviderChange}
                className="w-[9.5rem]"
            />
            <FilterSelect
                label="Campaign"
                value={campaignUuid}
                options={campaignOptions}
                onChange={onCampaignChange}
                className="w-[11rem]"
            />
            <FilterSelect
                label="Sent by"
                value={sentByUserUuid}
                options={userOptions}
                onChange={onSentByUserChange}
                className="w-[11rem]"
            />

            <AppDatePicker
                name="date_from"
                className="w-[10.5rem] [&_[data-slot=input]]:h-8 [&_[data-slot=input]]:text-[12px]"
                aria-label="Sent from"
                value={dateFrom}
                maxValue={dateTo || undefined}
                onChange={onDateFromChange}
            />
            <AppDatePicker
                name="date_to"
                className="w-[10.5rem] [&_[data-slot=input]]:h-8 [&_[data-slot=input]]:text-[12px]"
                aria-label="Sent to"
                value={dateTo}
                minValue={dateFrom || undefined}
                onChange={onDateToChange}
            />

            {hasActiveFilters ? (
                <Button
                    size="sm"
                    variant="tertiary"
                    className="h-8 px-2.5 text-[12px]"
                    onPress={onClear}
                >
                    <X className="size-3.5" />
                    Reset
                </Button>
            ) : null}
        </div>
    );
}

function FilterSelect({
    label,
    value,
    options,
    onChange,
    className,
}: {
    label: string;
    value: string;
    options: SendHistoryFilterOption[];
    onChange: (value: string) => void;
    className?: string;
}) {
    const selected = options.find((option) => option.id === value) ?? options[0];

    return (
        <Select
            className={className}
            aria-label={label}
            selectedKey={selected.id}
            onSelectionChange={(key) => onChange(String(key ?? ""))}
        >
            <Select.Trigger className="h-8 w-full text-[13px]">
                <Select.Value />
                <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
                <ListBox>
                    {options.map((option) => (
                        <ListBox.Item key={option.id} id={option.id} textValue={option.label}>
                            {option.label}
                            <ListBox.ItemIndicator />
                        </ListBox.Item>
                    ))}
                </ListBox>
            </Select.Popover>
        </Select>
    );
}
