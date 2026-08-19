import { useState } from "react";
import { Button, Input, Switch } from "@heroui/react";
import { AlertTriangle, Trash2 } from "lucide-react";
import {
    useDeleteEmailSendLimit,
    useEmailSendLimits,
    useUpsertEmailSendLimit,
} from "@/features/email-send-limits/hooks/use-email-send-limits";
import type { EmailSendLimitStatus } from "@/features/email-send-limits/interfaces/email-send-limits.interfaces";
import { useIntegrations } from "@/features/integrations/hooks/use-integrations";
import type { IntegrationProvider } from "@/features/integrations/interfaces/integrations.interface";
import { PERIOD_LABELS } from "../utils/goals-copy";

const EMAIL_PROVIDERS: IntegrationProvider[] = ["RESEND", "SMTP"];

const PROVIDER_LABELS: Record<string, string> = {
    RESEND: "Resend",
    SMTP: "SMTP",
};

function EmailSendLimitRow({ status }: { status: EmailSendLimitStatus }) {
    const upsert = useUpsertEmailSendLimit();
    const remove = useDeleteEmailSendLimit();
    const [maxCount, setMaxCount] = useState(String(status.limit ?? ""));
    const [isActive, setIsActive] = useState(status.is_active);

    const isConfigured = status.uuid !== null;
    const dirty =
        maxCount !== String(status.limit ?? "") || isActive !== status.is_active;

    const handleSave = () => {
        const count = Number(maxCount);
        if (!Number.isFinite(count) || count < 1) return;
        upsert.mutate({
            provider: status.provider,
            period: status.period,
            max_count: count,
            is_active: isActive,
        });
    };

    return (
        <div className="px-4 py-3 grid gap-3 sm:grid-cols-[minmax(9rem,1fr)_auto] sm:items-center">
            <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                    {PERIOD_LABELS[status.period]}
                </p>
                <p className="text-xs text-muted">
                    {status.used}
                    {status.limit !== null ? ` / ${status.limit} sent` : " sent · no limit set"}
                    {status.reached && (
                        <span className="ml-1.5 inline-flex items-center gap-1 text-danger font-medium">
                            <AlertTriangle className="size-3" /> limit reached
                        </span>
                    )}
                </p>
            </div>
            <div className="grid grid-cols-[7rem_auto_auto_2.25rem] items-center gap-3 justify-items-start">
                <Input
                    aria-label={`${PERIOD_LABELS[status.period]} limit for ${PROVIDER_LABELS[status.provider]}`}
                    type="number"
                    min={1}
                    value={maxCount}
                    onChange={(e) => setMaxCount(e.target.value)}
                    placeholder="No limit"
                    className="w-full"
                />
                <Switch
                    isSelected={isActive}
                    onChange={(v) => setIsActive(typeof v === "boolean" ? v : !isActive)}
                    aria-label={`Enable ${PERIOD_LABELS[status.period]} limit`}
                >
                    <Switch.Control>
                        <Switch.Thumb />
                    </Switch.Control>
                </Switch>
                <Button
                    size="sm"
                    onPress={handleSave}
                    isDisabled={!dirty || upsert.isPending || !maxCount}
                >
                    Save
                </Button>
                {isConfigured ? (
                    <Button
                        size="sm"
                        variant="tertiary"
                        aria-label="Remove limit"
                        isDisabled={remove.isPending}
                        onPress={() => status.uuid && remove.mutate(status.uuid)}
                    >
                        <Trash2 className="size-4 text-danger" />
                    </Button>
                ) : (
                    <span className="size-9" aria-hidden />
                )}
            </div>
        </div>
    );
}

export function EmailSendLimitsPanel() {
    const { data: limits = [], isLoading: limitsLoading } = useEmailSendLimits();
    const { data: integrations = [], isLoading: integrationsLoading } = useIntegrations();

    const configuredProviders = EMAIL_PROVIDERS.filter((provider) =>
        integrations.some((i) => i.provider === provider && i.keys.length > 0),
    );

    const isLoading = limitsLoading || integrationsLoading;

    return (
        <div className="rounded-xl bg-surface overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
                <h2 className="text-sm font-semibold text-foreground">
                    Email sending limits
                </h2>
                <p className="text-xs text-muted mt-0.5">
                    Cap how many emails your team can send manually per day, week, or month for
                    each connected email integration. Campaign sends are not affected.
                </p>
            </div>
            {isLoading ? (
                <div className="p-4 space-y-2">
                    {Array.from({ length: 2 }).map((_, i) => (
                        <div key={i} className="h-10 rounded-lg bg-surface-secondary animate-pulse" />
                    ))}
                </div>
            ) : configuredProviders.length === 0 ? (
                <p className="p-6 text-sm text-muted text-center">
                    Connect Resend or SMTP under Integrations to set send limits.
                </p>
            ) : (
                <div className="divide-y divide-border">
                    {configuredProviders.map((provider) => (
                        <div key={provider}>
                            <div className="px-4 pt-3 pb-1 bg-surface-secondary/40">
                                <p className="text-xs font-semibold text-foreground uppercase tracking-wide">
                                    {PROVIDER_LABELS[provider]}
                                </p>
                            </div>
                            <div className="divide-y divide-border">
                                {limits
                                    .filter((status) => status.provider === provider)
                                    .map((status) => (
                                        <EmailSendLimitRow
                                            key={`${status.provider}:${status.period}:${status.limit}:${status.is_active}`}
                                            status={status}
                                        />
                                    ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
