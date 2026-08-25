import { useMemo, useState } from "react";
import { Header, Input, ListBox, Select } from "@heroui/react";
import { Search } from "lucide-react";
import type { EmailProviderTarget } from "@/features/integrations/interfaces/integrations.interface";
import {
    allocationKey,
    type SendableEmailAccount,
} from "@/features/integrations/utils/email-provider-utils";
import { cn } from "@/lib/utils";

export interface EmailAccountComboboxProps {
    accounts: SendableEmailAccount[];
    value: EmailProviderTarget | null;
    onChange: (target: EmailProviderTarget) => void;
    disabled?: boolean;
    placeholder?: string;
    searchPlaceholder?: string;
    className?: string;
    "aria-label"?: string;
}

function accountSearchText(account: SendableEmailAccount): string {
    return [
        account.title,
        account.label,
        account.detail,
        account.provider,
        account.account,
        account.fromEmail,
    ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
}

function accountDisplayLabel(account: SendableEmailAccount): string {
    return account.fromEmail ? `${account.title} — ${account.fromEmail}` : account.title;
}

export function EmailAccountCombobox({
    accounts,
    value,
    onChange,
    disabled = false,
    placeholder = "Send from…",
    searchPlaceholder = "Search emails…",
    className,
    "aria-label": ariaLabel = "Send from email",
}: EmailAccountComboboxProps) {
    const [query, setQuery] = useState("");
    const selectedKey = value ? allocationKey(value) : null;
    const selectedAccount = accounts.find((row) => allocationKey(row) === selectedKey);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return accounts;
        return accounts.filter((row) => accountSearchText(row).includes(q));
    }, [accounts, query]);

    const grouped = useMemo(() => {
        const resend = filtered.filter((row) => row.provider === "RESEND");
        const smtp = filtered.filter((row) => row.provider === "SMTP");
        return [
            { provider: "RESEND" as const, label: "Resend", accounts: resend },
            { provider: "SMTP" as const, label: "SMTP", accounts: smtp },
        ].filter((group) => group.accounts.length > 0);
    }, [filtered]);

    return (
        <div className={cn("w-full", className)}>
            <Select
                aria-label={ariaLabel}
                selectedKey={selectedKey}
                onSelectionChange={(key) => {
                    const match = accounts.find((row) => allocationKey(row) === key);
                    if (match?.canSend) {
                        onChange({
                            provider: match.provider,
                            account: match.account,
                            ...(match.domain_uuid ? { domain_uuid: match.domain_uuid } : {}),
                        });
                    }
                }}
                onOpenChange={(isOpen) => {
                    if (!isOpen) setQuery("");
                }}
                isDisabled={disabled || accounts.length === 0}
                fullWidth
            >
                <Select.Trigger
                    className={cn(
                        "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-md border border-border bg-surface-primary",
                        "focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40",
                    )}
                >
                    <Select.Value className="min-w-0 flex-1 overflow-hidden">
                        {selectedAccount ? (
                            <span className="truncate text-sm text-foreground">
                                {accountDisplayLabel(selectedAccount)}
                            </span>
                        ) : (
                            <span className="truncate text-sm text-muted">{placeholder}</span>
                        )}
                    </Select.Value>
                    <Select.Indicator className="shrink-0" />
                </Select.Trigger>
                <Select.Popover className="overflow-hidden p-0">
                    <div className="relative shrink-0 border-b border-border px-1 pt-1">
                        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
                        <Input
                            aria-label={searchPlaceholder}
                            placeholder={searchPlaceholder}
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={(e) => e.stopPropagation()}
                            className="rounded-md border-0 bg-transparent pl-9 shadow-none focus-visible:ring-0"
                        />
                    </div>
                    <ListBox className="max-h-52 overflow-y-auto overscroll-contain p-1">
                        {grouped.length === 0 ? (
                            <ListBox.Item id="__empty" textValue="No matches" isDisabled>
                                <span className="text-sm text-muted">No matches.</span>
                            </ListBox.Item>
                        ) : (
                            grouped.map((group) => (
                                <ListBox.Section key={group.provider}>
                                    <Header className="px-2 py-1 text-xs font-medium uppercase tracking-wide text-muted">
                                        {group.label}
                                    </Header>
                                    {group.accounts.map((account) => {
                                        const key = allocationKey(account);
                                        const incomplete = !account.canSend;
                                        return (
                                            <ListBox.Item
                                                key={key}
                                                id={key}
                                                textValue={accountDisplayLabel(account)}
                                                isDisabled={incomplete}
                                                className={cn(
                                                    "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3",
                                                    incomplete && "opacity-60",
                                                )}
                                            >
                                                <div className="min-w-0 overflow-hidden">
                                                    <div className="flex items-center gap-2">
                                                        <span
                                                            className={cn(
                                                                "truncate text-sm",
                                                                incomplete && "text-muted",
                                                            )}
                                                        >
                                                            {account.title}
                                                        </span>
                                                        {account.isDefault ? (
                                                            <span className="shrink-0 text-xs text-muted">
                                                                Default
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                    {account.detail === "no domain configured" ? (
                                                        <span className="truncate text-xs text-danger">
                                                            Add a domain in Integrations
                                                        </span>
                                                    ) : account.detail ? (
                                                        <span className="truncate text-xs text-muted">
                                                            {account.detail}
                                                        </span>
                                                    ) : null}
                                                </div>
                                                <ListBox.ItemIndicator className="shrink-0" />
                                            </ListBox.Item>
                                        );
                                    })}
                                </ListBox.Section>
                            ))
                        )}
                    </ListBox>
                </Select.Popover>
            </Select>
        </div>
    );
}
