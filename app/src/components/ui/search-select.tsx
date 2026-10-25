import { useMemo, useState } from "react";
import { Input, ListBox, Select } from "@heroui/react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SearchSelectOption {
    id: string;
    label: string;
}

interface SearchSelectProps {
    options: ReadonlyArray<SearchSelectOption>;
    /** Selected option id; "" / null / undefined mean nothing selected (or the empty option). */
    value: string | null | undefined;
    onChange: (id: string) => void;
    /** Adds a first entry with id "" (e.g. "Any list"), shown when nothing is selected. */
    emptyLabel?: string;
    placeholder?: string;
    searchPlaceholder?: string;
    isDisabled?: boolean;
    className?: string;
    fullWidth?: boolean;
    "aria-label": string;
}

/**
 * Single-choice dropdown with a search box in its popover. Same look as the plain
 * Select; use it for long or user-created option lists.
 */
export function SearchSelect({
    options,
    value,
    onChange,
    emptyLabel,
    placeholder = "Select…",
    searchPlaceholder = "Search…",
    isDisabled,
    className,
    fullWidth,
    "aria-label": ariaLabel,
}: SearchSelectProps) {
    const [query, setQuery] = useState("");
    const q = query.trim().toLowerCase();

    const filtered = useMemo(
        () => (q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options),
        [options, q],
    );
    const showEmpty = !!emptyLabel && (!q || emptyLabel.toLowerCase().includes(q));
    const nothingToShow = filtered.length === 0 && !showEmpty;

    const selectedKey = value || (emptyLabel ? "" : undefined);
    const selectedLabel = value
        ? (options.find((o) => o.id === value)?.label ?? null)
        : (emptyLabel ?? null);

    return (
        <Select
            aria-label={ariaLabel}
            selectedKey={selectedKey ?? null}
            placeholder={placeholder}
            onSelectionChange={(key) => {
                if (key == null || key === "__empty") return;
                onChange(String(key));
            }}
            onOpenChange={(open) => {
                if (!open) setQuery("");
            }}
            isDisabled={isDisabled}
            className={className}
            fullWidth={fullWidth}
        >
            <Select.Trigger
                className={cn(
                    "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2",
                )}
            >
                <Select.Value className="min-w-0 flex-1 overflow-hidden">
                    <span className={cn("truncate text-sm", selectedLabel ? "text-foreground" : "text-muted")}>
                        {selectedLabel ?? placeholder}
                    </span>
                </Select.Value>
                <Select.Indicator className="shrink-0" />
            </Select.Trigger>
            <Select.Popover className="w-[var(--trigger-width)] overflow-hidden p-0">
                <div className="relative shrink-0 border-b border-border px-1 pt-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
                    <Input
                        aria-label={`Search ${ariaLabel}`}
                        placeholder={searchPlaceholder}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => e.stopPropagation()}
                        className="rounded-md border-0 bg-transparent pl-9 shadow-none focus-visible:ring-0"
                    />
                </div>
                <ListBox className="max-h-52 overflow-y-auto overscroll-contain p-1">
                    {showEmpty ? (
                        <ListBox.Item id="" textValue={emptyLabel}>
                            {emptyLabel}
                            <ListBox.ItemIndicator />
                        </ListBox.Item>
                    ) : null}
                    {nothingToShow ? (
                        <ListBox.Item id="__empty" textValue="No matches" isDisabled>
                            <span className="text-sm text-muted">No matches.</span>
                        </ListBox.Item>
                    ) : null}
                    {filtered.map((o) => (
                        <ListBox.Item key={o.id} id={o.id} textValue={o.label}>
                            {o.label}
                            <ListBox.ItemIndicator />
                        </ListBox.Item>
                    ))}
                </ListBox>
            </Select.Popover>
        </Select>
    );
}
