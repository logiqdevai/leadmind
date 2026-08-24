import { useMemo, useState } from "react";
import { Input, Label } from "@heroui/react";
import { Send } from "lucide-react";
import { ActionButtonWithPending } from "@/components/ui/action-button-with-pending";
import { EmailAccountCombobox } from "@/features/messaging/components/email-account-combobox";
import type { EmailProviderTarget } from "@/features/integrations/interfaces/integrations.interface";
import type { SendableEmailAccount } from "@/features/integrations/utils/email-provider-utils";
import { useStartMailTesterTest } from "@/features/mail-tester/hooks/use-mail-tester";
import { cn } from "@/lib/utils";

const borderedFieldClass = cn(
    "rounded-md border border-border bg-surface-primary",
    "focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40",
);

interface NewMailTestPanelProps {
    accounts: SendableEmailAccount[];
    defaultTarget: EmailProviderTarget | null;
}

export function NewMailTestPanel({ accounts, defaultTarget }: NewMailTestPanelProps) {
    const startTest = useStartMailTesterTest();
    const [target, setTarget] = useState<EmailProviderTarget | null>(defaultTarget);
    const [label, setLabel] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [lastAddress, setLastAddress] = useState<string | null>(null);

    const effectiveTarget = useMemo(() => target ?? defaultTarget, [target, defaultTarget]);

    const handleSend = async () => {
        if (!effectiveTarget) {
            setError("Select a sending account first.");
            return;
        }
        setError(null);
        try {
            const test = await startTest.mutateAsync({
                from: effectiveTarget,
                ...(label.trim() ? { label: label.trim() } : {}),
            });
            setLastAddress(test.test_address);
            setLabel("");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Could not start test.");
        }
    };

    return (
        <div className="rounded-xl border border-border bg-surface p-4 space-y-4">
            <div>
                <h2 className="text-sm font-semibold text-foreground">New deliverability test</h2>
                <p className="text-xs text-muted mt-0.5">
                    Sends a test email to Mail-Tester from one of your connected accounts, then
                    reports back a spam score and authentication checks.
                </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
                <div className="flex flex-col gap-1.5">
                    <Label>Send from</Label>
                    <EmailAccountCombobox
                        accounts={accounts}
                        value={effectiveTarget}
                        onChange={setTarget}
                        disabled={startTest.isPending}
                        placeholder="Choose an account…"
                    />
                </div>
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="mail-test-label">Label (optional)</Label>
                    <Input
                        id="mail-test-label"
                        className={borderedFieldClass}
                        value={label}
                        onChange={(e) => setLabel(e.target.value)}
                        placeholder="Before campaign launch"
                        disabled={startTest.isPending}
                    />
                </div>
                <ActionButtonWithPending
                    isPending={startTest.isPending}
                    onPress={handleSend}
                    isDisabled={!effectiveTarget || accounts.length === 0}
                >
                    <Send className="size-4" />
                    Send test email
                </ActionButtonWithPending>
            </div>

            {error ? <p className="text-xs text-danger">{error}</p> : null}

            {accounts.length === 0 ? (
                <p className="text-xs text-muted">
                    No sendable Resend or SMTP account is configured yet. Set one up under Integrations.
                </p>
            ) : null}

            {lastAddress ? (
                <p className="text-xs text-muted">
                    Sent to <span className="font-mono text-foreground/90">{lastAddress}</span>. Results
                    show up below once Mail-Tester processes the email — click{" "}
                    <span className="font-medium">Check results</span> after a moment.
                </p>
            ) : null}
        </div>
    );
}
