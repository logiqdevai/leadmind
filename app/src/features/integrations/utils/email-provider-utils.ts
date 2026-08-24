import {
    isEmailAccountSendable,
    isEmailProviderAccountVisible,
} from "@/features/integrations/constants/integration-key-types";
import type {
    EmailProviderAllocation,
    EmailProviderTarget,
    IntegrationAccountDomain,
    IntegrationKey,
    IntegrationProviderView,
} from "@/features/integrations/interfaces/integrations.interface";

export interface SendableEmailAccount extends EmailProviderTarget {
    uuid: string | null;
    title: string;
    label: string;
    detail: string | null;
    last4: string | null;
    isDefault: boolean;
    canSend: boolean;
    fromEmail: string | null;
    fromName: string | null;
}

const EMAIL_PROVIDERS = ["RESEND", "SMTP"] as const;

function distinctAccounts(keys: IntegrationKey[]): string[] {
    return [...new Set(keys.map((k) => k.account))].sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true }),
    );
}

function keyValueHint(keys: IntegrationKey[], account: string, keyType: IntegrationKey["key_type"]): string | null {
    const key = keys.find((row) => row.account === account && row.key_type === keyType);
    if (!key) return null;
    if (key.display_value) return key.display_value;
    if (!key.last4) return null;
    return `····${key.last4}`;
}

function buildSmtpAccountDetail(
    keys: IntegrationKey[],
    account: string,
): string | null {
    const host = keys.find(
        (row) => row.account === account && row.key_type === "HOST",
    );
    const fromEmail = keys.find(
        (row) => row.account === account && row.key_type === "FROM_EMAIL",
    );
    const fromName = keys.find(
        (row) => row.account === account && row.key_type === "FROM_NAME",
    );
    const hostHint = host?.display_value ?? (host?.last4 ? `····${host.last4}` : null);
    const fromHint = fromEmail?.display_value ?? (fromEmail?.last4 ? fromEmail.last4 : null);
    const nameHint = fromName?.display_value?.trim() || null;
    const fromLabel =
        fromHint && nameHint ? `${nameHint} <${fromHint}>` : fromHint;

    if (hostHint && fromLabel) {
        return `host ${hostHint} · from ${fromLabel}`;
    }
    if (fromLabel) {
        return `from ${fromLabel}`;
    }
    if (hostHint) {
        return `host ${hostHint}`;
    }
    return null;
}

function buildAccountLabel(integrationLabel: string, title: string): string {
    return `${integrationLabel} · ${title}`;
}

function resolveAccountTitle(
    integration: IntegrationProviderView,
    account: string,
): string {
    return (
        integration.accounts?.find((row) => row.account === account)?.title ??
        account
    );
}

function resolveAccountUuid(
    integration: IntegrationProviderView,
    account: string,
): string | null {
    return (
        integration.accounts?.find((row) => row.account === account)?.uuid ?? null
    );
}

function resolveAccountDomains(
    integration: IntegrationProviderView,
    account: string,
): IntegrationAccountDomain[] {
    return integration.accounts?.find((row) => row.account === account)?.domains ?? [];
}

function listProviderAccounts(
    provider: EmailProviderTarget["provider"],
    keys: IntegrationKey[],
): string[] {
    if (provider === "RESEND") {
        return [...new Set(keys.filter((key) => key.key_type === "API_KEY").map((key) => key.account))].sort(
            (left, right) => left.localeCompare(right, undefined, { numeric: true }),
        );
    }
    return distinctAccounts(keys);
}

export function listSendableEmailAccounts(
    integrations: IntegrationProviderView[] | undefined,
): SendableEmailAccount[] {
    if (!integrations?.length) return [];

    const accounts: SendableEmailAccount[] = [];

    for (const provider of EMAIL_PROVIDERS) {
        const integration = integrations.find((row) => row.provider === provider);
        if (!integration) continue;

        for (const account of listProviderAccounts(provider, integration.keys)) {
            if (!isEmailProviderAccountVisible(provider, integration.keys, account)) {
                continue;
            }
            const title = resolveAccountTitle(integration, account);
            const uuid = resolveAccountUuid(integration, account);
            const isDefault = integration.default_account === account;
            const hasApiKey = isEmailAccountSendable(provider, integration.keys, account);

            if (provider === "RESEND") {
                const domains = resolveAccountDomains(integration, account);

                if (domains.length > 0) {
                    for (const domain of domains) {
                        accounts.push({
                            provider,
                            account,
                            domain_uuid: domain.uuid,
                            uuid,
                            title,
                            label: buildAccountLabel(integration.label, title),
                            detail: `from ${domain.from_email}`,
                            last4: null,
                            isDefault,
                            canSend: hasApiKey,
                            fromEmail: domain.from_email,
                            fromName: domain.from_name,
                        });
                    }
                    continue;
                }

                // Legacy fallback: account not yet migrated to IntegrationAccountDomain.
                const legacyFromEmail = keyValueHint(integration.keys, account, "FROM_EMAIL");
                const hasLegacyFromEmailKey = integration.keys.some(
                    (key) => key.account === account && key.key_type === "FROM_EMAIL",
                );
                accounts.push({
                    provider,
                    account,
                    uuid,
                    title,
                    label: buildAccountLabel(integration.label, title),
                    detail: legacyFromEmail
                        ? `from ${legacyFromEmail}`
                        : hasApiKey
                          ? "from address missing"
                          : null,
                    last4: legacyFromEmail,
                    isDefault,
                    canSend: hasApiKey && hasLegacyFromEmailKey,
                    fromEmail: legacyFromEmail,
                    fromName: null,
                });
                continue;
            }

            accounts.push({
                provider,
                account,
                uuid,
                title,
                label: buildAccountLabel(integration.label, title),
                detail: buildSmtpAccountDetail(integration.keys, account),
                last4: keyValueHint(integration.keys, account, "FROM_EMAIL"),
                isDefault,
                canSend: hasApiKey,
                fromEmail: keyValueHint(integration.keys, account, "FROM_EMAIL"),
                fromName: keyValueHint(integration.keys, account, "FROM_NAME"),
            });
        }
    }

    return accounts.sort((left, right) =>
        `${left.provider}:${left.account}:${left.domain_uuid ?? ""}`.localeCompare(
            `${right.provider}:${right.account}:${right.domain_uuid ?? ""}`,
            undefined,
            { numeric: true },
        ),
    );
}

export function listReadyEmailAccounts(
    integrations: IntegrationProviderView[] | undefined,
): SendableEmailAccount[] {
    return listSendableEmailAccounts(integrations).filter((row) => row.canSend);
}

export function groupSendableEmailAccounts(
    integrations: IntegrationProviderView[] | undefined,
): { provider: EmailProviderTarget["provider"]; label: string; accounts: SendableEmailAccount[] }[] {
    const sendable = listSendableEmailAccounts(integrations);
    return EMAIL_PROVIDERS.map((provider) => ({
        provider,
        label: provider === "RESEND" ? "Resend" : "SMTP",
        accounts: sendable.filter((row) => row.provider === provider),
    })).filter((group) => group.accounts.length > 0);
}

export function buildEqualAllocations(
    accounts: EmailProviderTarget[],
    totalCount: number,
): EmailProviderAllocation[] {
    if (accounts.length === 0 || totalCount <= 0) return [];

    const base = Math.floor(totalCount / accounts.length);
    let remainder = totalCount % accounts.length;

    return accounts.map((account) => {
        const extra = remainder > 0 ? 1 : 0;
        if (remainder > 0) remainder -= 1;
        return {
            ...account,
            count: base + extra,
        };
    });
}

export function validateAllocations(
    allocations: EmailProviderAllocation[],
    totalCount: number,
): string | null {
    if (allocations.length === 0) {
        return "Select at least one email provider account.";
    }
    if (allocations.some((row) => row.count < 0)) {
        return "Allocation counts cannot be negative.";
    }
    const sum = allocations.reduce((acc, row) => acc + row.count, 0);
    if (sum !== totalCount) {
        return `Allocated ${sum} of ${totalCount} emails. Adjust counts to match.`;
    }
    return null;
}

function toTarget(row: SendableEmailAccount): EmailProviderTarget {
    return {
        provider: row.provider,
        account: row.account,
        ...(row.domain_uuid ? { domain_uuid: row.domain_uuid } : {}),
    };
}

export function resolveDefaultEmailTarget(
    integrations: IntegrationProviderView[] | undefined,
    preferred?: EmailProviderTarget | null,
): EmailProviderTarget | null {
    if (!integrations?.length) return null;

    const ready = listReadyEmailAccounts(integrations);
    if (ready.length === 0) return null;

    if (preferred) {
        const match = ready.find(
            (row) =>
                row.provider === preferred.provider &&
                row.account === preferred.account &&
                (preferred.domain_uuid === undefined || row.domain_uuid === preferred.domain_uuid),
        );
        if (match) {
            return toTarget(match);
        }
    }

    for (const provider of EMAIL_PROVIDERS) {
        const integration = integrations.find((row) => row.provider === provider);
        if (!integration?.default_account) continue;
        const account = integration.default_account;
        const candidates = ready.filter((row) => row.provider === provider && row.account === account);
        if (candidates.length === 0) continue;
        const defaultDomainUuid = resolveAccountDomains(integration, account).find(
            (domain) => domain.is_default,
        )?.uuid;
        const preferredRow =
            candidates.find((row) => row.domain_uuid === defaultDomainUuid) ?? candidates[0];
        return toTarget(preferredRow);
    }

    return toTarget(ready[0]);
}

export function allocationKey(row: EmailProviderTarget): string {
    return `${row.provider}:${row.account}:${row.domain_uuid ?? ""}`;
}

export function emailProviderFromAllocations(
    allocations: EmailProviderAllocation[] | null | undefined,
): EmailProviderTarget | null {
    const first = allocations?.[0];
    if (!first) return null;
    return {
        provider: first.provider,
        account: first.account,
        ...(first.domain_uuid ? { domain_uuid: first.domain_uuid } : {}),
    };
}

export function emailProviderToAllocations(
    target: EmailProviderTarget,
    count: number,
): EmailProviderAllocation[] {
    if (count <= 0) return [];
    return [
        {
            provider: target.provider,
            account: target.account,
            ...(target.domain_uuid ? { domain_uuid: target.domain_uuid } : {}),
            count,
        },
    ];
}

export function assignEmailProviders(
    contactUuids: string[],
    allocations: EmailProviderAllocation[],
): Map<string, EmailProviderTarget> {
    const sorted = [...contactUuids].sort();
    const assignments = new Map<string, EmailProviderTarget>();
    let index = 0;

    for (const allocation of allocations) {
        for (let count = 0; count < allocation.count; count++) {
            if (index >= sorted.length) break;
            assignments.set(sorted[index], {
                provider: allocation.provider,
                account: allocation.account,
                ...(allocation.domain_uuid ? { domain_uuid: allocation.domain_uuid } : {}),
            });
            index += 1;
        }
    }

    return assignments;
}
