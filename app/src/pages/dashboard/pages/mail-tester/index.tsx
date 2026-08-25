import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useIntegrations } from "@/features/integrations/hooks/use-integrations";
import {
    listReadyEmailAccounts,
    resolveDefaultEmailTarget,
} from "@/features/integrations/utils/email-provider-utils";
import { useMailTesterTests } from "@/features/mail-tester/hooks/use-mail-tester";
import { Routes } from "@/routes/routes";
import { NewMailTestPanel } from "./components/new-mail-test-panel";
import { MailTesterTable } from "./components/mail-tester-table";

export default function MailTesterPage() {
    const { data: integrations, isLoading: integrationsLoading } = useIntegrations();
    const { data: tests, isLoading: testsLoading } = useMailTesterTests();

    const mailTesterIntegration = integrations?.find((row) => row.provider === "MAILTESTER");
    const isConfigured = Boolean(
        mailTesterIntegration?.keys.some((key) => key.key_type === "USERNAME"),
    );

    const accounts = useMemo(() => listReadyEmailAccounts(integrations), [integrations]);
    const defaultTarget = useMemo(
        () => resolveDefaultEmailTarget(integrations),
        [integrations],
    );

    return (
        <div className="space-y-6">
            <header className="space-y-1">
                <h1 className="text-xl font-semibold text-foreground">Deliverability</h1>
                <p className="text-sm text-muted max-w-2xl">
                    Send a test email through Mail-Tester to check your spam score, SPF/DKIM/rDNS
                    authentication, and blacklist status.
                </p>
            </header>

            {!integrationsLoading && !isConfigured ? (
                <div className="rounded-xl border border-dashed border-border bg-surface-secondary/30 p-4 text-sm text-muted">
                    Add your Mail-Tester username under{" "}
                    <Link to={Routes.dashboard.integrations} className="text-accent hover:underline">
                        Integrations
                    </Link>{" "}
                    to start running tests.
                </div>
            ) : (
                <NewMailTestPanel accounts={accounts} defaultTarget={defaultTarget} />
            )}

            {testsLoading ? (
                <div className="rounded-xl border border-border bg-surface p-4 space-y-3 animate-pulse h-40" />
            ) : (
                <MailTesterTable rows={tests ?? []} />
            )}
        </div>
    );
}
