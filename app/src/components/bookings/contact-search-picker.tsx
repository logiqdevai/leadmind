import { useState, type FC } from "react";
import { Button, Input } from "@heroui/react";
import { Search, User } from "lucide-react";
import { useContacts } from "@/features/contacts/hooks/use-contacts";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

export interface PickedContact {
    uuid: string;
    name: string | null;
    email: string | null;
    phone: string | null;
    company: string | null;
}

const ContactResults: FC<{ search: string; onPick: (contact: PickedContact) => void }> = ({ search, onPick }) => {
    const { data, isLoading } = useContacts({ search, limit: 8, page: 1 });
    const results = data?.data ?? [];

    return (
        <div className="max-h-48 overflow-y-auto rounded-lg border border-border bg-surface divide-y divide-border/60">
            {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="px-3 py-2.5">
                        <div className="h-3.5 w-2/3 rounded bg-surface-secondary animate-pulse" />
                        <div className="mt-1.5 h-3 w-1/2 rounded bg-surface-secondary animate-pulse" />
                    </div>
                ))
            ) : results.length === 0 ? (
                <p className="px-3 py-4 text-center text-xs text-muted">No contacts found.</p>
            ) : (
                results.map((c) => (
                    <button
                        key={c.uuid}
                        type="button"
                        className="flex w-full flex-col items-start px-3 py-2.5 text-left transition-colors duration-200 hover:bg-surface-secondary"
                        onClick={() =>
                            onPick({ uuid: c.uuid, name: c.name, email: c.email, phone: c.phone, company: c.company })
                        }
                    >
                        <span className="text-sm font-medium text-foreground">{c.name ?? c.email ?? "Contact"}</span>
                        {c.company || c.email ? (
                            <span className="text-xs text-muted">{[c.company, c.email].filter(Boolean).join(" · ")}</span>
                        ) : null}
                    </button>
                ))
            )}
        </div>
    );
};

interface ContactSearchPickerProps {
    value: PickedContact | null;
    onChange: (contact: PickedContact | null) => void;
    /** Hide the "Change" action (contact fixed by the caller). */
    isLocked?: boolean;
}

/** Search the CRM and pick one contact. */
export const ContactSearchPicker: FC<ContactSearchPickerProps> = ({ value, onChange, isLocked }) => {
    const [search, setSearch] = useState("");
    const debounced = useDebouncedValue(search.trim(), 300);

    if (value) {
        return (
            <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface-secondary px-3 py-2.5">
                <div className="flex min-w-0 items-center gap-2">
                    <User className="size-3.5 shrink-0 text-muted" />
                    <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{value.name ?? value.email ?? "Contact"}</p>
                        {value.email || value.company ? (
                            <p className="truncate text-xs text-muted">{[value.company, value.email].filter(Boolean).join(" · ")}</p>
                        ) : null}
                    </div>
                </div>
                {!isLocked ? (
                    <Button
                        size="sm"
                        variant="tertiary"
                        className="shrink-0 text-xs"
                        onPress={() => {
                            onChange(null);
                            setSearch("");
                        }}
                    >
                        Change
                    </Button>
                ) : null}
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-1.5">
            <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted" />
                <Input
                    aria-label="Search contacts"
                    className="w-full pl-9"
                    placeholder="Search contacts by name, email, company…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>
            {debounced ? <ContactResults search={debounced} onPick={onChange} /> : null}
        </div>
    );
};
