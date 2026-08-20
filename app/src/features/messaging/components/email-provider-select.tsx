import { useEffect, useMemo, useRef } from "react";
import { Checkbox, Input, Label, TextField } from "@heroui/react";
import { Link } from "react-router-dom";
import { useIntegrations } from "@/features/integrations/hooks/use-integrations";
import type {
    EmailProviderAllocation,
    EmailProviderTarget,
} from "@/features/integrations/interfaces/integrations.interface";
import {
    allocationKey,
    buildEqualAllocations,
    groupSendableEmailAccounts,
    listReadyEmailAccounts,
    resolveDefaultEmailTarget,
    validateAllocations,
} from "@/features/integrations/utils/email-provider-utils";
import { EmailAccountCombobox } from "@/features/messaging/components/email-account-combobox";
import { Routes } from "@/routes/routes";
import { usePreferredEmailProviderStore } from "@/stores/preferred-email-provider";

type EmailProviderSelectBaseProps = {
    disabled?: boolean;
};

export type EmailProviderSelectProps = EmailProviderSelectBaseProps &
    (
        | {
              totalCount?: undefined;
              value: EmailProviderTarget | null;
              onChange: (target: EmailProviderTarget) => void;
          }
        | {
              totalCount: number;
              value: EmailProviderAllocation[];
              onChange: (allocations: EmailProviderAllocation[]) => void;
          }
    );

export function isEmailProviderAllocationValid(
    allocations: EmailProviderAllocation[],
    totalCount: number,
): boolean {
    return validateAllocations(allocations, totalCount) === null;
}

function EmailProviderSingleSelectSkeleton() {
    return (
        <div className="space-y-1.5 animate-pulse" aria-hidden>
            <div className="h-4 w-20 rounded bg-surface-secondary" />
            <div className="h-10 w-full rounded-md border border-border bg-surface-secondary" />
            <div className="h-3 w-64 max-w-full rounded bg-surface-secondary" />
        </div>
    );
}

function EmailProviderAllocationSelectSkeleton() {
    return (
        <div className="space-y-4 animate-pulse" aria-hidden>
            <div className="space-y-1">
                <div className="h-4 w-28 rounded bg-surface-secondary" />
                <div className="h-3 w-full max-w-md rounded bg-surface-secondary" />
                <div className="h-3 w-3/4 max-w-sm rounded bg-surface-secondary" />
            </div>
            <div className="space-y-2">
                <div className="h-3 w-14 rounded bg-surface-secondary" />
                <div className="space-y-2">
                    {Array.from({ length: 2 }).map((_, i) => (
                        <div
                            key={i}
                            className="flex flex-wrap items-center gap-3 rounded-lg border border-border px-3 py-2"
                        >
                            <div className="size-4 rounded bg-surface-secondary" />
                            <div className="h-4 w-40 max-w-[60%] rounded bg-surface-secondary" />
                            <div className="ml-auto h-9 w-24 rounded-md bg-surface-secondary" />
                        </div>
                    ))}
                </div>
            </div>
            <div className="space-y-2">
                <div className="h-3 w-12 rounded bg-surface-secondary" />
                <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border px-3 py-2">
                    <div className="size-4 rounded bg-surface-secondary" />
                    <div className="h-4 w-36 max-w-[60%] rounded bg-surface-secondary" />
                </div>
            </div>
            <div className="h-3 w-40 rounded bg-surface-secondary" />
        </div>
    );
}

function EmailProviderSingleSelect({
    value,
    onChange,
    disabled,
    visibleAccounts,
    readyAccounts,
    integrations,
}: {
    value: EmailProviderTarget | null;
    onChange: (target: EmailProviderTarget) => void;
    disabled: boolean;
    visibleAccounts: ReturnType<typeof groupSendableEmailAccounts>[number]["accounts"];
    readyAccounts: ReturnType<typeof groupSendableEmailAccounts>[number]["accounts"];
    integrations: ReturnType<typeof useIntegrations>["data"];
}) {
    const preferred = usePreferredEmailProviderStore((s) => s.target);
    const setPreferred = usePreferredEmailProviderStore((s) => s.setTarget);
    const selectedKey = value ? allocationKey(value) : null;
    const incompleteCount = visibleAccounts.filter((row) => !row.canSend).length;

    useEffect(() => {
        if (readyAccounts.length === 0) return;
        if (
            value &&
            readyAccounts.some((row) => allocationKey(row) === selectedKey && row.canSend)
        ) {
            return;
        }
        const defaultTarget = resolveDefaultEmailTarget(integrations, preferred);
        if (defaultTarget) {
            onChange(defaultTarget);
        }
    }, [integrations, onChange, preferred, readyAccounts, selectedKey, value]);

    const handleChange = (target: EmailProviderTarget) => {
        setPreferred(target);
        onChange(target);
    };

    return (
        <div className="space-y-1.5">
            <Label className="text-sm text-foreground">Send from</Label>
            <EmailAccountCombobox
                accounts={visibleAccounts}
                value={value}
                onChange={handleChange}
                disabled={disabled || readyAccounts.length === 0}
                placeholder="Choose send-from email…"
                searchPlaceholder="Search emails…"
                aria-label="Email provider account"
            />
            <p className="text-xs text-muted">
                {readyAccounts.length} ready account
                {readyAccounts.length === 1 ? "" : "s"} across Resend and SMTP.
                {incompleteCount > 0
                    ? ` ${incompleteCount} Resend account${incompleteCount === 1 ? " needs" : "s need"} a from address in Integrations.`
                    : " SMTP sends won't receive delivery or open webhooks."}
            </p>
            {readyAccounts.length === 0 ? (
                <p className="text-xs text-danger">
                    Add a from address to your Resend account in{" "}
                    <Link
                        to={Routes.dashboard.integrations}
                        className="font-medium underline-offset-2 hover:underline"
                    >
                        Integrations
                    </Link>{" "}
                    before sending.
                </p>
            ) : null}
        </div>
    );
}

function EmailProviderAllocationSelect({
    totalCount,
    value,
    onChange,
    disabled,
    groupedAccounts,
    sendableAccounts,
}: {
    totalCount: number;
    value: EmailProviderAllocation[];
    onChange: (allocations: EmailProviderAllocation[]) => void;
    disabled: boolean;
    groupedAccounts: ReturnType<typeof groupSendableEmailAccounts>;
    sendableAccounts: ReturnType<typeof groupSendableEmailAccounts>[number]["accounts"];
}) {
    const selectedKeys = useMemo(
        () => new Set(value.map((row) => allocationKey(row))),
        [value],
    );

    const initializedRef = useRef(false);

    useEffect(() => {
        if (sendableAccounts.length === 0) return;

        if (!initializedRef.current && value.length === 0) {
            initializedRef.current = true;
            onChange(buildEqualAllocations(sendableAccounts, totalCount));
            return;
        }

        initializedRef.current = true;
    }, [onChange, sendableAccounts, totalCount, value.length]);

    useEffect(() => {
        if (sendableAccounts.length === 0 || value.length === 0) return;
        const validKeys = new Set(sendableAccounts.map(allocationKey));
        const filtered = value.filter((row) => validKeys.has(allocationKey(row)));
        if (filtered.length !== value.length) {
            onChange(
                filtered.length > 0
                    ? buildEqualAllocations(filtered, totalCount)
                    : buildEqualAllocations(sendableAccounts, totalCount),
            );
        }
    }, [onChange, sendableAccounts, totalCount, value]);

    const previousTotalCountRef = useRef(totalCount);
    useEffect(() => {
        if (previousTotalCountRef.current === totalCount || value.length === 0) {
            previousTotalCountRef.current = totalCount;
            return;
        }
        previousTotalCountRef.current = totalCount;
        onChange(buildEqualAllocations(value, totalCount));
    }, [onChange, totalCount, value]);

    const validationError = validateAllocations(value, totalCount);
    const allocated = value.reduce((sum, row) => sum + row.count, 0);

    const resendAccounts =
        groupedAccounts.find((group) => group.provider === "RESEND")?.accounts.filter((row) => row.canSend) ?? [];
    const smtpAccounts =
        groupedAccounts.find((group) => group.provider === "SMTP")?.accounts.filter((row) => row.canSend) ?? [];

    const toggleAccount = (account: (typeof sendableAccounts)[number], checked: boolean) => {
        const key = allocationKey(account);
        let nextTargets: EmailProviderAllocation[] = value.filter((row) =>
            selectedKeys.has(allocationKey(row)),
        );

        if (checked) {
            if (!nextTargets.some((row) => allocationKey(row) === key)) {
                nextTargets = [
                    ...nextTargets,
                    { provider: account.provider, account: account.account, count: 0 },
                ];
            }
        } else {
            nextTargets = nextTargets.filter((row) => allocationKey(row) !== key);
        }

        onChange(buildEqualAllocations(nextTargets, totalCount));
    };

    const updateCount = (accountKey: string, count: number) => {
        onChange(
            value.map((row) =>
                allocationKey(row) === accountKey
                    ? { ...row, count: Number.isFinite(count) ? Math.max(0, count) : 0 }
                    : row,
            ),
        );
    };

    const renderGroup = (title: string, accounts: typeof sendableAccounts) => {
        if (accounts.length === 0) return null;
        return (
            <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted">{title}</p>
                <div className="space-y-2">
                    {accounts.map((account) => {
                        const key = allocationKey(account);
                        const selected = selectedKeys.has(key);
                        const allocation = value.find((row) => allocationKey(row) === key);

                        return (
                            <div
                                key={key}
                                className="flex flex-wrap items-center gap-3 rounded-lg border border-border px-3 py-2"
                            >
                                <Checkbox
                                    isSelected={selected}
                                    onChange={(checked) => toggleAccount(account, checked)}
                                    isDisabled={disabled}
                                >
                                    <Checkbox.Control>
                                        <Checkbox.Indicator />
                                    </Checkbox.Control>
                                    <span className="text-sm text-foreground">{account.title}</span>
                                </Checkbox>
                                {selected ? (
                                    <TextField
                                        aria-label={`Allocation for ${account.title}`}
                                        className="ml-auto w-24"
                                    >
                                        <Label className="sr-only">Count</Label>
                                        <Input
                                            type="number"
                                            min={0}
                                            value={String(allocation?.count ?? 0)}
                                            onChange={(e) =>
                                                updateCount(key, parseInt(e.target.value, 10))
                                            }
                                            disabled={disabled}
                                        />
                                    </TextField>
                                ) : null}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-4">
            <div>
                <p className="text-sm font-medium text-foreground">Email providers</p>
                <p className="mt-1 text-xs text-muted">
                    Choose which accounts send this batch. Counts split across selected accounts
                    (SMTP delivery status stays at sent — no open tracking).
                </p>
            </div>

            {renderGroup("Resend", resendAccounts)}
            {renderGroup("SMTP", smtpAccounts)}

            <p className={`text-xs ${validationError ? "text-danger" : "text-muted"}`}>
                {validationError ??
                    `Allocated ${allocated} of ${totalCount} email${totalCount === 1 ? "" : "s"}.`}
            </p>
        </div>
    );
}

export function EmailProviderSelect(props: EmailProviderSelectProps) {
    const { disabled = false } = props;
    const { data: integrations, isLoading } = useIntegrations();
    const groupedAccounts = useMemo(
        () => groupSendableEmailAccounts(integrations),
        [integrations],
    );
    const visibleAccounts = useMemo(
        () => groupedAccounts.flatMap((group) => group.accounts),
        [groupedAccounts],
    );
    const readyAccounts = useMemo(
        () => listReadyEmailAccounts(integrations),
        [integrations],
    );

    if (isLoading) {
        return props.totalCount !== undefined ? (
            <EmailProviderAllocationSelectSkeleton />
        ) : (
            <EmailProviderSingleSelectSkeleton />
        );
    }

    if (visibleAccounts.length === 0) {
        return (
            <div className="rounded-xl border border-border bg-surface-secondary/40 px-4 py-3 text-sm text-muted">
                No sendable Resend or SMTP accounts found.{" "}
                <Link
                    to={Routes.dashboard.integrations}
                    className="font-medium text-foreground underline-offset-2 hover:underline"
                >
                    Configure integrations
                </Link>
                .
            </div>
        );
    }

    if (props.totalCount !== undefined) {
        return (
            <EmailProviderAllocationSelect
                totalCount={props.totalCount}
                value={props.value}
                onChange={props.onChange}
                disabled={disabled}
                groupedAccounts={groupedAccounts}
                sendableAccounts={readyAccounts}
            />
        );
    }

    return (
        <EmailProviderSingleSelect
            value={props.value}
            onChange={props.onChange}
            disabled={disabled}
            visibleAccounts={visibleAccounts}
            readyAccounts={readyAccounts}
            integrations={integrations}
        />
    );
}
