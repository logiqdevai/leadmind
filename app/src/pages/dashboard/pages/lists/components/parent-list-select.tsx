import { useMemo, useState, type FC } from "react";
import { Header, Input, Label, ListBox, Select } from "@heroui/react";
import { Search } from "lucide-react";
import { useContactLists } from "@/features/contact-lists/hooks/use-contact-lists";
import { cn } from "@/lib/utils";
import { collectDescendantUuids, listPathLabel } from "../utils/contact-list-tree";

const ROOT_KEY = "__root__";

interface ParentListSelectProps {
  value: string | null;
  onChange: (uuid: string | null) => void;
  enabled?: boolean;
  excludeUuid?: string;
  label?: string;
}

export const ParentListSelect: FC<ParentListSelectProps> = ({
  value,
  onChange,
  enabled = true,
  excludeUuid,
  label = "Parent list",
}) => {
  const { data: listsPage, isLoading } = useContactLists({ limit: 100 }, enabled);
  const allLists = listsPage?.data ?? [];
  const [query, setQuery] = useState("");

  const candidates = useMemo(() => {
    const descendants = excludeUuid ? collectDescendantUuids(allLists, excludeUuid) : new Set<string>();
    const q = query.trim().toLowerCase();
    return allLists
      .filter((item) => item.uuid !== excludeUuid && !descendants.has(item.uuid))
      .map((item) => ({ list: item, label: listPathLabel(allLists, item.uuid) }))
      .filter((item) => (q ? item.label.toLowerCase().includes(q) : true))
      .toSorted((a, b) => a.label.localeCompare(b.label));
  }, [allLists, excludeUuid, query]);

  const selectedKey = value ?? ROOT_KEY;
  const selectedLabel =
    value == null ? "Top level" : listPathLabel(allLists, value) || "Selected list";
  const showRoot = !query.trim() || "top level".includes(query.trim().toLowerCase());

  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <Select
        aria-label={label}
        selectedKey={selectedKey}
        onSelectionChange={(key) => {
          if (key == null) return;
          const next = String(key);
          onChange(next === ROOT_KEY ? null : next);
        }}
        onOpenChange={(open) => {
          if (!open) setQuery("");
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
            <span className="truncate text-sm text-foreground">
              {isLoading ? "Loading lists…" : selectedLabel}
            </span>
          </Select.Value>
          <Select.Indicator className="shrink-0" />
        </Select.Trigger>
        <Select.Popover className="overflow-hidden p-0">
          <div className="relative shrink-0 border-b border-border px-1 pt-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <Input
              aria-label="Search lists"
              placeholder="Search lists…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              className="rounded-md border-0 bg-transparent pl-9 shadow-none focus-visible:ring-0"
            />
          </div>
          <ListBox className="max-h-52 overflow-y-auto overscroll-contain p-1">
            {showRoot ? (
              <ListBox.Section>
                <Header className="px-2 py-1 text-xs font-medium uppercase tracking-wide text-muted">
                  Location
                </Header>
                <ListBox.Item id={ROOT_KEY} textValue="Top level">
                  <span className="truncate text-sm">Top level</span>
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              </ListBox.Section>
            ) : null}
            {candidates.length === 0 ? (
              <ListBox.Item id="__empty" textValue="No matches" isDisabled>
                <span className="text-sm text-muted">
                  {isLoading ? "Loading lists…" : "No matching lists."}
                </span>
              </ListBox.Item>
            ) : (
              <ListBox.Section>
                <Header className="px-2 py-1 text-xs font-medium uppercase tracking-wide text-muted">
                  Lists
                </Header>
                {candidates.map((item) => (
                  <ListBox.Item key={item.list.uuid} id={item.list.uuid} textValue={item.label}>
                    <span className="truncate text-sm">{item.label}</span>
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox.Section>
            )}
          </ListBox>
        </Select.Popover>
      </Select>
    </div>
  );
};
