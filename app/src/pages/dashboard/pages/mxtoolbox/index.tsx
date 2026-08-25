import { Link } from "react-router-dom";
import { useIntegrations } from "@/features/integrations/hooks/use-integrations";
import { useMxToolboxChecks } from "@/features/mxtoolbox/hooks/use-mxtoolbox";
import { Routes } from "@/routes/routes";
import { NewDomainCheckPanel } from "./components/new-domain-check-panel";
import { MxToolboxTable } from "./components/mxtoolbox-table";

export default function MxToolboxPage() {
    const { data: integrations, isLoading: integrationsLoading } = useIntegrations();
    const { data: checks, isLoading: checksLoading } = useMxToolboxChecks();

    const mxToolboxIntegration = integrations?.find((row) => row.provider === "MXTOOLBOX");
    const isConfigured = Boolean(
        mxToolboxIntegration?.keys.some((key) => key.key_type === "API_KEY"),
    );

    return (
        <div className="space-y-6">
            <header className="space-y-1">
                <h1 className="text-xl font-semibold text-foreground">Domain Health</h1>
                <p className="text-sm text-muted max-w-2xl">
                    Run DNS, email authentication (SPF/DKIM/DMARC/BIMI/MTA-STS), and blacklist
                    checks against any domain via MxToolbox - no email needs to be sent.
                </p>
            </header>

            {!integrationsLoading && !isConfigured ? (
                <div className="rounded-xl border border-dashed border-border bg-surface-secondary/30 p-4 text-sm text-muted">
                    Add your MxToolbox API key under{" "}
                    <Link to={Routes.dashboard.integrations} className="text-accent hover:underline">
                        Integrations
                    </Link>{" "}
                    to start running domain health checks.
                </div>
            ) : (
                <NewDomainCheckPanel />
            )}

            {checksLoading ? (
                <div className="rounded-xl border border-border bg-surface p-4 space-y-3 animate-pulse h-40" />
            ) : (
                <MxToolboxTable rows={checks ?? []} />
            )}
        </div>
    );
}
