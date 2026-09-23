import { type FC, useState } from "react";
import { Plug } from "lucide-react";
import { Button, Chip } from "@heroui/react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CopyButton } from "@/components/ui/copy-button";
import { useOrganisationPermission } from "@/hooks/use-organisation-permission";
import { environments } from "@/config/environments";
import {
    useOAuthConnections,
    useRevokeOAuthConnection,
} from "@/features/oauth-connections/hooks/use-oauth-connections";

const MCP_SERVER_URL = new URL("/mcp", environments.API_URL).href;

function formatDate(iso: string | null) {
    if (!iso) return "—";
    return new Date(iso).toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
    });
}

function scopeLabel(scope: string) {
    const scopes = scope.split(" ").filter(Boolean);
    const parts: string[] = [];
    if (scopes.includes("mcp:read")) parts.push("Read");
    if (scopes.includes("mcp:write")) parts.push("Write");
    return parts.length ? parts.join(" + ") : "—";
}

const SettingsConnectedAppsPage: FC = () => {
    const canManage = useOrganisationPermission("org_manage_oauth_connections");
    const { data: connections = [], isLoading } = useOAuthConnections(canManage);
    const revoke = useRevokeOAuthConnection();

    const [tab, setTab] = useState<"claude" | "chatgpt">("claude");
    const [revokeTarget, setRevokeTarget] = useState<{ uuid: string; name: string } | null>(null);

    const handleRevoke = async () => {
        if (!revokeTarget) return;
        await revoke.mutateAsync(revokeTarget.uuid);
        setRevokeTarget(null);
    };

    return (
        <div className="space-y-6 max-w-4xl">
            <div className="flex items-center gap-2.5">
                <Plug className="size-5 text-muted shrink-0" />
                <div>
                    <h1 className="text-lg font-semibold text-foreground leading-tight">
                        Connected Apps
                    </h1>
                    <p className="text-xs text-muted mt-0.5">
                        Let AI assistants like Claude and ChatGPT act on this workspace, with your
                        explicit consent for what they can see and change.
                    </p>
                </div>
            </div>

            <div className="rounded-xl border border-border bg-surface-secondary/30 p-4 space-y-4">
                <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-foreground">MCP server URL</span>
                    <div className="flex items-center gap-1.5">
                        <div className="min-w-0 flex-1 rounded-lg border border-border bg-surface p-2.5 font-mono text-xs break-all">
                            {MCP_SERVER_URL}
                        </div>
                        <CopyButton value={MCP_SERVER_URL} label="MCP server URL" />
                    </div>
                </div>

                <div className="flex items-center gap-1.5">
                    <Button
                        size="sm"
                        variant={tab === "claude" ? "primary" : "secondary"}
                        onPress={() => setTab("claude")}
                    >
                        Claude
                    </Button>
                    <Button
                        size="sm"
                        variant={tab === "chatgpt" ? "primary" : "secondary"}
                        onPress={() => setTab("chatgpt")}
                    >
                        ChatGPT
                    </Button>
                </div>

                {tab === "claude" ? (
                    <ol className="list-decimal list-inside space-y-1.5 text-xs text-muted">
                        <li>
                            In Claude, open{" "}
                            <strong className="text-foreground">Settings → Connectors</strong>{" "}
                            (claude.ai) — or in Claude Code, run{" "}
                            <code className="rounded bg-surface px-1 py-0.5 font-mono">
                                /mcp add
                            </code>
                            .
                        </li>
                        <li>
                            Choose <strong className="text-foreground">Add custom connector</strong>{" "}
                            and paste the MCP server URL above.
                        </li>
                        <li>
                            Claude redirects you here to sign in to Leadmind and approve access —
                            pick the workspace and the access level (read / write) to allow.
                        </li>
                        <li>
                            Once approved, Claude can use your Leadmind tools in any conversation.
                            Revoke access any time below.
                        </li>
                    </ol>
                ) : (
                    <ol className="list-decimal list-inside space-y-1.5 text-xs text-muted">
                        <li>
                            In ChatGPT, open{" "}
                            <strong className="text-foreground">
                                Settings → Connectors → Advanced → Add custom connector
                            </strong>{" "}
                            (requires a Plus, Pro, Business, or Enterprise plan).
                        </li>
                        <li>Paste the MCP server URL above as the connector's server URL.</li>
                        <li>
                            ChatGPT redirects you here to sign in to Leadmind and approve access —
                            pick the workspace and the access level to allow.
                        </li>
                        <li>
                            Once approved, enable the connector in a chat (Tools → Leadmind) to
                            start using it. Revoke access any time below.
                        </li>
                    </ol>
                )}
            </div>

            {!canManage ? (
                <p className="text-xs text-muted">
                    Only owners and admins can view and manage connected apps.
                </p>
            ) : isLoading ? (
                <p className="text-xs text-muted">Loading…</p>
            ) : connections.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-surface-secondary/30 p-8 text-center text-sm text-muted">
                    No apps connected yet.
                </div>
            ) : (
                <div className="w-full max-w-full overflow-x-auto rounded-xl">
                    <table className="w-full min-w-[48rem] border-collapse text-sm">
                        <thead className="bg-surface-secondary/40 text-muted">
                            <tr>
                                <th className="px-3 py-2 text-left font-medium">App</th>
                                <th className="px-3 py-2 text-left font-medium">Access</th>
                                <th className="px-3 py-2 text-left font-medium">Granted by</th>
                                <th className="px-3 py-2 text-left font-medium">Last used</th>
                                <th className="px-3 py-2 text-left font-medium">Status</th>
                                <th className="px-3 py-2 text-left font-medium">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {connections.map((connection) => (
                                <tr key={connection.uuid} className="border-t border-border">
                                    <td className="px-3 py-2 align-top">
                                        <div className="text-foreground">
                                            {connection.client_name || connection.oauth_client_id}
                                        </div>
                                        {connection.client_uri ? (
                                            <a
                                                href={connection.client_uri}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-xs text-muted hover:text-foreground"
                                            >
                                                {connection.client_uri}
                                            </a>
                                        ) : null}
                                    </td>
                                    <td className="px-3 py-2 align-top">
                                        <Chip size="sm" variant="soft">
                                            <Chip.Label>{scopeLabel(connection.scope)}</Chip.Label>
                                        </Chip>
                                    </td>
                                    <td className="px-3 py-2 align-top text-xs text-muted">
                                        {connection.granted_by.full_name || connection.granted_by.email}
                                    </td>
                                    <td className="px-3 py-2 align-top text-xs text-muted">
                                        {formatDate(connection.last_used_at)}
                                    </td>
                                    <td className="px-3 py-2 align-top">
                                        <Chip
                                            size="sm"
                                            variant="soft"
                                            color={connection.status === "ACTIVE" ? "success" : "danger"}
                                        >
                                            <Chip.Label>
                                                {connection.status === "ACTIVE" ? "active" : "revoked"}
                                            </Chip.Label>
                                        </Chip>
                                    </td>
                                    <td className="px-3 py-2 align-top">
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            isDisabled={connection.status !== "ACTIVE"}
                                            onPress={() =>
                                                setRevokeTarget({
                                                    uuid: connection.uuid,
                                                    name: connection.client_name || connection.oauth_client_id,
                                                })
                                            }
                                        >
                                            Revoke
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <ConfirmDialog
                isOpen={!!revokeTarget}
                onOpenChange={(open) => {
                    if (!open) setRevokeTarget(null);
                }}
                title={`Revoke access for "${revokeTarget?.name ?? "this app"}"?`}
                description="This immediately ends every active session for this app. It will need to be reconnected and re-approved to access this workspace again."
                confirmLabel="Revoke access"
                cancelLabel="Cancel"
                variant="danger"
                isPending={revoke.isPending}
                onConfirm={handleRevoke}
            />
        </div>
    );
};

export default SettingsConnectedAppsPage;
