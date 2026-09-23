import { type FC, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound, Plus } from "lucide-react";
import { Button, Chip, Input, Label, ListBox, Modal, Select } from "@heroui/react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CopyButton } from "@/components/ui/copy-button";
import { ApiKeysTableSkeleton } from "./components/api-keys-table-skeleton";
import { useOrganisationPermission } from "@/hooks/use-organisation-permission";
import {
    useApiKeys,
    useCreateApiKey,
    useDeleteApiKey,
    useRevokeApiKey,
} from "@/features/api-keys/hooks/use-api-keys";
import type {
    ApiKey,
    CreatedApiKey,
} from "@/features/api-keys/interfaces/api-key.interfaces";
import { OrganisationRoles } from "@/features/organisations/interfaces/organisation.interfaces";
import {
    createApiKeySchema,
    type CreateApiKeyFormData,
} from "@/features/api-keys/validation-schemas/api-key.schema";

type ApiKeyStatus = "active" | "revoked" | "expired";

function getApiKeyStatus(key: ApiKey): ApiKeyStatus {
    if (key.revoked_at) return "revoked";
    if (key.expires_at && new Date(key.expires_at) < new Date()) return "expired";
    return "active";
}

const STATUS_COLOR: Record<ApiKeyStatus, "success" | "danger" | "warning"> = {
    active: "success",
    revoked: "danger",
    expired: "warning",
};

function formatDate(iso: string | null) {
    if (!iso) return "—";
    return new Date(iso).toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
    });
}

const SettingsApiKeysPage: FC = () => {
    const canManageApiKeys = useOrganisationPermission("org_manage_api_keys");

    const { data: apiKeys = [], isLoading } = useApiKeys(canManageApiKeys);
    const createApiKey = useCreateApiKey();
    const revokeApiKey = useRevokeApiKey();
    const deleteApiKey = useDeleteApiKey();

    const [createOpen, setCreateOpen] = useState(false);
    const [revealOpen, setRevealOpen] = useState(false);
    const [revealedKey, setRevealedKey] = useState<CreatedApiKey | null>(null);
    const [revokeTarget, setRevokeTarget] = useState<{ uuid: string; name: string } | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<{ uuid: string; name: string } | null>(null);

    const createForm = useForm<CreateApiKeyFormData>({
        resolver: zodResolver(createApiKeySchema),
        defaultValues: { name: "", organisation_role: OrganisationRoles.MEMBER, expires_at: "" },
    });

    const roleValue = createForm.watch("organisation_role");

    const onCreateApiKey = createForm.handleSubmit((data) => {
        createApiKey.mutate(
            {
                name: data.name,
                organisation_role: data.organisation_role,
                expires_at: data.expires_at ? new Date(data.expires_at).toISOString() : undefined,
            },
            {
                onSuccess: (created) => {
                    setCreateOpen(false);
                    createForm.reset();
                    setRevealedKey(created);
                    setRevealOpen(true);
                },
            },
        );
    });

    const handleRevoke = async () => {
        if (!revokeTarget) return;
        await revokeApiKey.mutateAsync(revokeTarget.uuid);
        setRevokeTarget(null);
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        await deleteApiKey.mutateAsync(deleteTarget.uuid);
        setDeleteTarget(null);
    };

    return (
        <div className="space-y-6 max-w-4xl">
            <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2.5">
                    <KeyRound className="size-5 text-muted shrink-0" />
                    <div>
                        <h1 className="text-lg font-semibold text-foreground leading-tight">
                            API Keys
                        </h1>
                        <p className="text-xs text-muted mt-0.5">
                            Let external tools call the Leadfinder API on behalf of this
                            organisation.
                        </p>
                    </div>
                </div>
                {canManageApiKeys ? (
                    <Button variant="primary" size="sm" onPress={() => setCreateOpen(true)}>
                        <Plus className="size-3.5" />
                        Create key
                    </Button>
                ) : null}
            </div>

            {!canManageApiKeys ? (
                <p className="text-xs text-muted">
                    Only owners and admins can manage API keys.
                </p>
            ) : isLoading ? (
                <ApiKeysTableSkeleton />
            ) : apiKeys.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-surface-secondary/30 p-8 text-center text-sm text-muted">
                    No API keys yet. Create one to get started.
                </div>
            ) : (
                <div className="w-full max-w-full overflow-x-auto rounded-xl">
                    <table className="w-full min-w-[48rem] border-collapse text-sm">
                        <thead className="bg-surface-secondary/40 text-muted">
                            <tr>
                                <th className="px-3 py-2 text-left font-medium">Name</th>
                                <th className="px-3 py-2 text-left font-medium">Role</th>
                                <th className="px-3 py-2 text-left font-medium">Key</th>
                                <th className="px-3 py-2 text-left font-medium">Last used</th>
                                <th className="px-3 py-2 text-left font-medium">Expires</th>
                                <th className="px-3 py-2 text-left font-medium">Status</th>
                                <th className="px-3 py-2 text-left font-medium">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {apiKeys.map((key) => {
                                const status = getApiKeyStatus(key);
                                return (
                                    <tr key={key.uuid} className="border-t border-border">
                                        <td className="px-3 py-2 align-top text-foreground">
                                            {key.name}
                                        </td>
                                        <td className="px-3 py-2 align-top">
                                            <Chip size="sm" variant="soft">
                                                <Chip.Label>{key.organisation_role}</Chip.Label>
                                            </Chip>
                                        </td>
                                        <td className="px-3 py-2 align-top">
                                            <div className="flex items-center gap-1.5">
                                                <span className="font-mono text-xs text-muted">
                                                    {key.key_prefix}…{key.last4}
                                                </span>
                                                <CopyButton
                                                    value={key.key_prefix}
                                                    label="key prefix"
                                                />
                                            </div>
                                        </td>
                                        <td className="px-3 py-2 align-top text-xs text-muted">
                                            {formatDate(key.last_used_at)}
                                        </td>
                                        <td className="px-3 py-2 align-top text-xs text-muted">
                                            {formatDate(key.expires_at)}
                                        </td>
                                        <td className="px-3 py-2 align-top">
                                            <Chip size="sm" variant="soft" color={STATUS_COLOR[status]}>
                                                <Chip.Label>{status}</Chip.Label>
                                            </Chip>
                                        </td>
                                        <td className="px-3 py-2 align-top">
                                            <div className="flex items-center gap-1.5">
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    isDisabled={status !== "active"}
                                                    onPress={() =>
                                                        setRevokeTarget({
                                                            uuid: key.uuid,
                                                            name: key.name,
                                                        })
                                                    }
                                                >
                                                    Revoke
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="secondary"
                                                    onPress={() =>
                                                        setDeleteTarget({
                                                            uuid: key.uuid,
                                                            name: key.name,
                                                        })
                                                    }
                                                >
                                                    Delete
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            <ConfirmDialog
                isOpen={!!revokeTarget}
                onOpenChange={(open) => {
                    if (!open) setRevokeTarget(null);
                }}
                title={`Revoke "${revokeTarget?.name ?? "this key"}"?`}
                description="Any requests using this key will start failing immediately. This can't be undone."
                confirmLabel="Revoke key"
                cancelLabel="Cancel"
                variant="danger"
                isPending={revokeApiKey.isPending}
                onConfirm={handleRevoke}
            />

            <ConfirmDialog
                isOpen={!!deleteTarget}
                onOpenChange={(open) => {
                    if (!open) setDeleteTarget(null);
                }}
                title={`Delete "${deleteTarget?.name ?? "this key"}"?`}
                description="This permanently removes the key. Any requests using it will start failing immediately."
                confirmLabel="Delete key"
                cancelLabel="Cancel"
                variant="danger"
                isPending={deleteApiKey.isPending}
                onConfirm={handleDelete}
            />

            <Modal.Backdrop isOpen={createOpen} onOpenChange={setCreateOpen}>
                <Modal.Container>
                    <Modal.Dialog className="sm:max-w-md">
                        <Modal.CloseTrigger />
                        <Modal.Header>
                            <Modal.Heading>Create API key</Modal.Heading>
                        </Modal.Header>
                        <Modal.Body className="space-y-4">
                            <form
                                id="create-api-key-form"
                                onSubmit={onCreateApiKey}
                                className="space-y-3"
                            >
                                <div className="flex flex-col gap-1.5">
                                    <Label htmlFor="api-key-name">Name</Label>
                                    <Input
                                        id="api-key-name"
                                        {...createForm.register("name")}
                                        placeholder="Zapier integration"
                                        autoFocus
                                    />
                                    {createForm.formState.errors.name ? (
                                        <p className="text-xs text-danger">
                                            {createForm.formState.errors.name.message}
                                        </p>
                                    ) : null}
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <Label>Role</Label>
                                    <Select
                                        aria-label="API key role"
                                        value={roleValue}
                                        onChange={(v) => {
                                            if (!v) return;
                                            createForm.setValue(
                                                "organisation_role",
                                                v as CreateApiKeyFormData["organisation_role"],
                                            );
                                        }}
                                    >
                                        <Select.Trigger className="w-full">
                                            <Select.Value />
                                            <Select.Indicator />
                                        </Select.Trigger>
                                        <Select.Popover>
                                            <ListBox>
                                                <ListBox.Item
                                                    id={OrganisationRoles.OWNER}
                                                    textValue="Owner"
                                                >
                                                    Owner
                                                    <ListBox.ItemIndicator />
                                                </ListBox.Item>
                                                <ListBox.Item
                                                    id={OrganisationRoles.ADMIN}
                                                    textValue="Admin"
                                                >
                                                    Admin
                                                    <ListBox.ItemIndicator />
                                                </ListBox.Item>
                                                <ListBox.Item
                                                    id={OrganisationRoles.MEMBER}
                                                    textValue="Member"
                                                >
                                                    Member
                                                    <ListBox.ItemIndicator />
                                                </ListBox.Item>
                                            </ListBox>
                                        </Select.Popover>
                                    </Select>
                                    <p className="text-xs text-muted">
                                        Controls what this key is allowed to do, same as an org
                                        member with this role.
                                    </p>
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <Label htmlFor="api-key-expires-at">
                                        Expires (optional)
                                    </Label>
                                    <Input
                                        id="api-key-expires-at"
                                        type="datetime-local"
                                        {...createForm.register("expires_at")}
                                    />
                                    <p className="text-xs text-muted">
                                        Leave blank for a key that never expires.
                                    </p>
                                </div>
                            </form>
                        </Modal.Body>
                        <Modal.Footer>
                            <Button slot="close" variant="secondary">
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                form="create-api-key-form"
                                variant="primary"
                                isDisabled={createApiKey.isPending}
                            >
                                Create
                            </Button>
                        </Modal.Footer>
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>

            <Modal.Backdrop
                isOpen={revealOpen}
                onOpenChange={(open) => {
                    if (!open) {
                        setRevealOpen(false);
                        setRevealedKey(null);
                    }
                }}
            >
                <Modal.Container>
                    <Modal.Dialog className="sm:max-w-md">
                        <Modal.Header>
                            <Modal.Heading>API key created</Modal.Heading>
                        </Modal.Header>
                        <Modal.Body className="space-y-3">
                            <div className="flex items-center gap-1.5">
                                <div className="min-w-0 flex-1 rounded-lg border border-border bg-surface-secondary/40 p-3 font-mono text-sm break-all">
                                    {revealedKey?.token}
                                </div>
                                <CopyButton value={revealedKey?.token ?? ""} label="API key" />
                            </div>
                            <p className="text-xs text-danger">
                                Copy this key now — for security reasons, we can't show it to
                                you again.
                            </p>
                        </Modal.Body>
                        <Modal.Footer>
                            <Button
                                variant="primary"
                                onPress={() => {
                                    setRevealOpen(false);
                                    setRevealedKey(null);
                                }}
                            >
                                Done, I've copied it
                            </Button>
                        </Modal.Footer>
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>
        </div>
    );
};

export default SettingsApiKeysPage;
