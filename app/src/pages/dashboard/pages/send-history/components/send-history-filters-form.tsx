import { Button, ListBox, Select } from "@heroui/react";
import { X } from "lucide-react";
import { AppDatePicker } from "@/components/ui/date-picker";

export interface SendHistoryFilterOption {
    id: string;
    label: string;
}

export interface SendHistoryFiltersFormProps {
    channel: string;
    source: string;
    status: string;
    emailProvider: string;
    emailAccount: string;
    campaignUuid: string;
    sequenceUuid: string;
    sentByUserUuid: string;
    dateFrom: string;
    dateTo: string;
    channelOptions: SendHistoryFilterOption[];
    sourceOptions: SendHistoryFilterOption[];
    statusOptions: SendHistoryFilterOption[];
    providerOptions: SendHistoryFilterOption[];
    emailAccountOptions: SendHistoryFilterOption[];
    campaignOptions: SendHistoryFilterOption[];
    sequenceOptions: SendHistoryFilterOption[];
    userOptions: SendHistoryFilterOption[];
    hasActiveFilters: boolean;
    onChannelChange: (value: string) => void;
    onSourceChange: (value: string) => void;
    onStatusChange: (value: string) => void;
    onEmailProviderChange: (value: string) => void;
    onEmailAccountChange: (value: string) => void;
    onCampaignChange: (value: string) => void;
    onSequenceChange: (value: string) => void;
    onSentByUserChange: (value: string) => void;
    onDateFromChange: (value: string) => void;
    onDateToChange: (value: string) => void;
    onClear: () => void;
    /** "inline" (default) wraps fixed-width fields in a row, for the table's filters bar. "stacked" makes every field full-width, for the filters modal. */
    layout?: "inline" | "stacked";
}

/**
 * The send-history filter fields (channel/source/status/integration/email/campaign/sequence/sent-by
 * + date range), shared between the table's inline filters bar and the inbox's filters modal so
 * both stay in sync instead of duplicating the field markup.
 */
export function SendHistoryFiltersForm({
    channel,
    source,
    status,
    emailProvider,
    emailAccount,
    campaignUuid,
    sequenceUuid,
    sentByUserUuid,
    dateFrom,
    dateTo,
    channelOptions,
    sourceOptions,
    statusOptions,
    providerOptions,
    emailAccountOptions,
    campaignOptions,
    sequenceOptions,
    userOptions,
    hasActiveFilters,
    onChannelChange,
    onSourceChange,
    onStatusChange,
    onEmailProviderChange,
    onEmailAccountChange,
    onCampaignChange,
    onSequenceChange,
    onSentByUserChange,
    onDateFromChange,
    onDateToChange,
    onClear,
    layout = "inline",
}: SendHistoryFiltersFormProps) {
    const stacked = layout === "stacked";
    const fieldClassName = stacked ? "w-full" : "w-[9.5rem]";

    return (
        <div className={stacked ? "flex flex-col gap-3" : "contents"}>
            <FilterSelect
                label="Channel"
                value={channel}
                options={channelOptions}
                onChange={onChannelChange}
                className={fieldClassName}
            />
            <FilterSelect
                label="Source"
                value={source}
                options={sourceOptions}
                onChange={onSourceChange}
                className={fieldClassName}
            />
            <FilterSelect
                label="Status"
                value={status}
                options={statusOptions}
                onChange={onStatusChange}
                className={fieldClassName}
            />
            <FilterSelect
                label="Integration"
                value={emailProvider}
                options={providerOptions}
                onChange={onEmailProviderChange}
                className={fieldClassName}
            />
            <FilterSelect
                label="Email"
                value={emailAccount}
                options={emailAccountOptions}
                onChange={onEmailAccountChange}
                className={stacked ? "w-full" : "w-[16rem]"}
            />
            <FilterSelect
                label="Campaign"
                value={campaignUuid}
                options={campaignOptions}
                onChange={onCampaignChange}
                className={stacked ? "w-full" : "w-[11rem]"}
            />
            <FilterSelect
                label="Sequence"
                value={sequenceUuid}
                options={sequenceOptions}
                onChange={onSequenceChange}
                className={stacked ? "w-full" : "w-[11rem]"}
            />
            <FilterSelect
                label="Sent by"
                value={sentByUserUuid}
                options={userOptions}
                onChange={onSentByUserChange}
                className={stacked ? "w-full" : "w-[11rem]"}
            />

            <div className={stacked ? "flex gap-2" : "contents"}>
                <AppDatePicker
                    name="date_from"
                    className={`${stacked ? "flex-1" : "w-[10.5rem]"} [&_[data-slot=input]]:h-8 [&_[data-slot=input]]:text-[12px]`}
                    aria-label="Sent from"
                    value={dateFrom}
                    maxValue={dateTo || undefined}
                    onChange={onDateFromChange}
                />
                <AppDatePicker
                    name="date_to"
                    className={`${stacked ? "flex-1" : "w-[10.5rem]"} [&_[data-slot=input]]:h-8 [&_[data-slot=input]]:text-[12px]`}
                    aria-label="Sent to"
                    value={dateTo}
                    minValue={dateFrom || undefined}
                    onChange={onDateToChange}
                />
            </div>

            {hasActiveFilters ? (
                <Button
                    size="sm"
                    variant="tertiary"
                    className={stacked ? "w-full justify-center text-[12px]" : "h-8 px-2.5 text-[12px]"}
                    onPress={onClear}
                >
                    <X className="size-3.5" />
                    Reset
                </Button>
            ) : null}
        </div>
    );
}

export function FilterSelect({
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
            <Select.Trigger className="grid h-8 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-1.5 overflow-hidden text-[13px]">
                <Select.Value className="min-w-0 truncate">
                    <span className="block truncate">{selected.label}</span>
                </Select.Value>
                <Select.Indicator className="shrink-0" />
            </Select.Trigger>
            <Select.Popover className="min-w-[var(--trigger-width)]">
                <ListBox>
                    {options.map((option) => (
                        <ListBox.Item
                            key={option.id}
                            id={option.id}
                            textValue={option.label}
                            className="gap-2"
                        >
                            <span className="min-w-0 truncate">{option.label}</span>
                            <ListBox.ItemIndicator className="shrink-0" />
                        </ListBox.Item>
                    ))}
                </ListBox>
            </Select.Popover>
        </Select>
    );
}
