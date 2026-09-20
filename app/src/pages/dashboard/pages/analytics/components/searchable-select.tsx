import { useMemo, useState } from "react";
import { Input, Label, ListBox, Select } from "@heroui/react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SearchableSelectOption {
    id: string;
    label: string;
    description?: string;
}

interface SearchableSelectProps {
    label: string;
    value: string | null;
    options: SearchableSelectOption[];
    onChange: (id: string) => void;
    placeholder: string;
    isLoading?: boolean;
    searchPlaceholder?: string;
    /** Label for the current value when it is not among `options` (e.g. filtered out by a server-side search). */
    selectedLabel?: string;
    /** When set, searching is delegated to the caller (server-side) instead of filtering `options` locally. */
    onSearchChange?: (query: string) => void;
}

export function SearchableSelect({
    label,
    value,
    options,
    onChange,
    placeholder,
    isLoading = false,
    searchPlaceholder = "Search…",
    selectedLabel: selectedLabelProp,
    onSearchChange,
}: SearchableSelectProps) {
    const [query, setQuery] = useState("");

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (onSearchChange || !q) return options;
        return options.filter((o) => o.label.toLowerCase().includes(q));
    }, [options, query, onSearchChange]);

    const selectedLabel = options.find((o) => o.id === value)?.label ?? selectedLabelProp;

    const updateQuery = (next: string) => {
        setQuery(next);
        onSearchChange?.(next);
    };

    return (
        <div className="flex flex-col gap-1.5 min-w-0">
            <Label>{label}</Label>
            <Select
                aria-label={label}
                selectedKey={value ?? undefined}
                placeholder={placeholder}
                onSelectionChange={(key) => {
                    if (key != null) onChange(String(key));
                }}
                onOpenChange={(open) => {
                    if (!open) updateQuery("");
                }}
                isDisabled={isLoading}
                fullWidth
            >
                <Select.Trigger
                    className={cn(
                        "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-md border border-border bg-surface-primary",
                        "focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40",
                    )}
                >
                    <Select.Value className="min-w-0 flex-1 overflow-hidden">
                        <span className={cn("truncate text-sm", selectedLabel ? "text-foreground" : "text-muted")}>
                            {isLoading ? "Loading…" : selectedLabel ?? placeholder}
                        </span>
                    </Select.Value>
                    <Select.Indicator className="shrink-0" />
                </Select.Trigger>
                <Select.Popover className="w-[var(--trigger-width)] overflow-hidden p-0">
                    <div className="relative shrink-0 border-b border-border px-1 pt-1">
                        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
                        <Input
                            aria-label={searchPlaceholder}
                            placeholder={searchPlaceholder}
                            value={query}
                            onChange={(e) => updateQuery(e.target.value)}
                            onKeyDown={(e) => e.stopPropagation()}
                            className="rounded-md border-0 bg-transparent pl-9 shadow-none focus-visible:ring-0"
                        />
                    </div>
                    <ListBox className="max-h-64 overflow-y-auto overscroll-contain p-1">
                        {filtered.length === 0 ? (
                            <ListBox.Item id="__empty" textValue="No matches" isDisabled>
                                <span className="text-sm text-muted">No matches.</span>
                            </ListBox.Item>
                        ) : (
                            filtered.map((option) => (
                                <ListBox.Item key={option.id} id={option.id} textValue={option.label}>
                                    <div className="flex min-w-0 flex-col">
                                        <span className="truncate text-sm">{option.label}</span>
                                        {option.description ? (
                                            <span className="truncate text-xs text-muted">{option.description}</span>
                                        ) : null}
                                    </div>
                                    <ListBox.ItemIndicator />
                                </ListBox.Item>
                            ))
                        )}
                    </ListBox>
                </Select.Popover>
            </Select>
        </div>
    );
}
