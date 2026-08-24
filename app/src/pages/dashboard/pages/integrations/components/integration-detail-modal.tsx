import { useEffect, useMemo, useState } from "react";
import { Button, Chip, Input, Modal } from "@heroui/react";
import {
    Check,
    CheckCircle2,
    Copy,
    KeyRound,
    Mail,
    Pencil,
    Plus,
    Star,
    Trash2,
} from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ActionButtonWithPending } from "@/components/ui/action-button-with-pending";
import {
    useDeleteIntegrationKey,
    useRemoveAccountDomain,
    useSetDefaultAccountDomain,
    useSetDefaultIntegrationAccount,
    useUpdateIntegrationAccount,
} from "@/features/integrations/hooks/use-integrations";
import {
    canShowAddKeyButton,
    formatIntegrationKeyDisplay,
    getMissingKeyTypesForAccount,
    groupKeysByAccount,
    isEmailAccountSendable,
    OPTIONAL_PROVIDER_KEY_TYPES,
    providerAllowsMultipleAccounts,
    providerSupportsDefaultAccountSelection,
    suggestNextAccountLabel,
} from "@/features/integrations/constants/integration-key-types";
import type {
    IntegrationAccountDomain,
    IntegrationKey,
    IntegrationKeyType,
    IntegrationProviderView,
} from "@/features/integrations/interfaces/integrations.interface";
import { toast } from "@/hooks/use-toast";
import { DomainFormModal } from "./domain-form-modal";
import { IntegrationKeyFormModal } from "./integration-key-form-modal";
import { IntegrationOfficialLink } from "./integration-official-link";
import { ResendAccountFormModal } from "./resend-account-form-modal";
import { SmtpAccountFormModal } from "./smtp-account-form-modal";
import { cn } from "@/lib/utils";

const borderedFieldClass = cn(
    "rounded-md border border-border bg-surface-primary",
    "focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40",
);

interface IntegrationDetailModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    providerView: IntegrationProviderView | null;
}

export function IntegrationDetailModal({
    isOpen,
    onOpenChange,
    providerView,
}: IntegrationDetailModalProps) {
    const deleteKey = useDeleteIntegrationKey();
    const setDefaultAccount = useSetDefaultIntegrationAccount();
    const updateAccount = useUpdateIntegrationAccount();
    const setDefaultDomain = useSetDefaultAccountDomain();
    const removeDomain = useRemoveAccountDomain();

    const [formOpen, setFormOpen] = useState(false);
    const [smtpFormOpen, setSmtpFormOpen] = useState(false);
    const [resendFormOpen, setResendFormOpen] = useState(false);
    const [editingKey, setEditingKey] = useState<IntegrationKey | null>(null);
    const [initialKeyType, setInitialKeyType] = useState<
        IntegrationKeyType | undefined
    >();
    const [initialAccount, setInitialAccount] = useState<string | undefined>();
    const [keyToDelete, setKeyToDelete] = useState<IntegrationKey | null>(null);
    const [renamingAccount, setRenamingAccount] = useState<string | null>(null);
    const [renameTitle, setRenameTitle] = useState("");
    const [webhookUrlCopied, setWebhookUrlCopied] = useState(false);
    const [domainFormOpen, setDomainFormOpen] = useState(false);
    const [domainFormAccountUuid, setDomainFormAccountUuid] = useState<
        string | null
    >(null);
    const [editingDomain, setEditingDomain] =
        useState<IntegrationAccountDomain | null>(null);
    const [domainToDelete, setDomainToDelete] =
        useState<IntegrationAccountDomain | null>(null);

    const groupedKeys = useMemo(
        () => (providerView ? groupKeysByAccount(providerView.keys) : []),
        [providerView],
    );

    useEffect(() => {
        if (!isOpen) return;
        setEditingKey(null);
        setInitialKeyType(undefined);
        setInitialAccount(undefined);
        setKeyToDelete(null);
        setRenamingAccount(null);
        setRenameTitle("");
        setWebhookUrlCopied(false);
        setDomainFormOpen(false);
        setDomainFormAccountUuid(null);
        setEditingDomain(null);
        setDomainToDelete(null);
    }, [isOpen]);

    if (!providerView) {
        return null;
    }

    const allowsMultipleAccounts =
        providerView.allows_multiple_accounts ??
        providerAllowsMultipleAccounts(providerView.provider);

    const supportsDefaultAccountSelection =
        providerView.supports_default_account_selection ??
        providerSupportsDefaultAccountSelection(providerView.provider);

    const defaultAccount = providerView.default_account;
    const showDefaultAccountControls =
        supportsDefaultAccountSelection && groupedKeys.length > 1;

    const canAddKey = canShowAddKeyButton(providerView);
    const canAddAccount =
        allowsMultipleAccounts &&
        (providerView.provider === "RESEND" || providerView.provider === "SMTP");
    const canAddWebhookSecret =
        providerView.keyTypes.some((row) => row.key_type === "WEBHOOK_SECRET") &&
        (allowsMultipleAccounts ||
            !providerView.keys.some((key) => key.key_type === "WEBHOOK_SECRET"));

    const openCreate = (keyType?: IntegrationKeyType, account?: string) => {
        setEditingKey(null);
        setInitialKeyType(keyType);
        setInitialAccount(account);
        setFormOpen(true);
    };

    const openAddAccount = () => {
        if (!providerView) return;
        if (providerView.provider === "SMTP") {
            setSmtpFormOpen(true);
            return;
        }
        if (providerView.provider === "RESEND") {
            setResendFormOpen(true);
            return;
        }
        const nextAccount = suggestNextAccountLabel(providerView.keys);
        openCreate("API_KEY", nextAccount);
    };

    const openEdit = (key: IntegrationKey) => {
        setEditingKey(key);
        setInitialKeyType(undefined);
        setInitialAccount(undefined);
        setFormOpen(true);
    };

    const handleDelete = async () => {
        if (!keyToDelete) return;
        try {
            await deleteKey.mutateAsync(keyToDelete.uuid);
            setKeyToDelete(null);
        } catch {
        }
    };

    const handleSetDefaultAccount = async (account: string) => {
        if (!providerView || account === defaultAccount) return;
        try {
            await setDefaultAccount.mutateAsync({
                provider: providerView.provider,
                payload: { account },
            });
        } catch {
        }
    };

    const startRename = (account: string) => {
        const current =
            providerView?.accounts?.find((row) => row.account === account)
                ?.title ?? account;
        setRenamingAccount(account);
        setRenameTitle(current);
    };

    const handleRename = async () => {
        if (!providerView || !renamingAccount) return;
        const trimmed = renameTitle.trim();
        if (!trimmed) return;
        try {
            await updateAccount.mutateAsync({
                provider: providerView.provider,
                account: renamingAccount,
                payload: { title: trimmed },
            });
            setRenamingAccount(null);
            setRenameTitle("");
        } catch {
        }
    };

    const accountDomains = (account: string): IntegrationAccountDomain[] =>
        providerView.accounts?.find((row) => row.account === account)?.domains ?? [];

    const accountIsSendable = (account: string) => {
        if (providerView.provider !== "RESEND" && providerView.provider !== "SMTP") {
            return null;
        }
        const hasRequiredKeys = isEmailAccountSendable(
            providerView.provider,
            providerView.keys,
            account,
        );
        if (providerView.provider !== "RESEND") {
            return hasRequiredKeys;
        }
        const hasLegacyFromEmail = providerView.keys.some(
            (key) => key.account === account && key.key_type === "FROM_EMAIL",
        );
        return hasRequiredKeys && (accountDomains(account).length > 0 || hasLegacyFromEmail);
    };

    const openAddDomain = (accountUuid: string | null) => {
        if (!accountUuid) return;
        setEditingDomain(null);
        setDomainFormAccountUuid(accountUuid);
        setDomainFormOpen(true);
    };

    const openEditDomain = (accountUuid: string | null, domain: IntegrationAccountDomain) => {
        setEditingDomain(domain);
        setDomainFormAccountUuid(accountUuid);
        setDomainFormOpen(true);
    };

    const handleSetDefaultDomain = async (domain: IntegrationAccountDomain) => {
        if (domain.is_default) return;
        try {
            await setDefaultDomain.mutateAsync(domain.uuid);
        } catch {
        }
    };

    const handleDeleteDomain = async () => {
        if (!domainToDelete) return;
        try {
            await removeDomain.mutateAsync(domainToDelete.uuid);
            setDomainToDelete(null);
        } catch {
        }
    };

    const webhookUrl = providerView.webhook_url ?? null;

    const handleCopyWebhookUrl = async () => {
        if (!webhookUrl) return;
        try {
            await navigator.clipboard.writeText(webhookUrl);
            setWebhookUrlCopied(true);
            toast({ title: "Webhook URL copied", duration: 1500 });
            window.setTimeout(() => setWebhookUrlCopied(false), 2000);
        } catch {
            toast({
                title: "Could not copy webhook URL",
                variant: "error",
                duration: 2000,
            });
        }
    };

    return (
        <>
            <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
                <Modal.Backdrop>
                    <Modal.Container size="lg">
                        <Modal.Dialog>
                            <Modal.CloseTrigger />
                            <Modal.Header>
                                <Modal.Heading>
                                    <IntegrationOfficialLink
                                        provider={providerView.provider}
                                    >
                                        {providerView.label}
                                    </IntegrationOfficialLink>
                                </Modal.Heading>
                                <p className="text-sm text-muted font-normal">
                                    {providerView.description}
                                </p>
                            </Modal.Header>
                            <Modal.Body className="space-y-5">
                                {webhookUrl ? (
                                    <div className="rounded-lg border border-border bg-surface-secondary/20 p-3 space-y-2">
                                        <div>
                                            <p className="text-sm font-semibold text-foreground">
                                                Webhook URL
                                            </p>
                                            <p className="text-xs text-muted mt-0.5">
                                                Paste this URL in the{" "}
                                                {providerView.provider === "OPENAI"
                                                    ? "OpenAI"
                                                    : providerView.label}{" "}
                                                dashboard webhook settings, then store the
                                                signing secret below.
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <code className="flex-1 min-w-0 truncate rounded-md border border-border bg-surface-primary px-2.5 py-1.5 text-xs font-mono text-foreground">
                                                {webhookUrl}
                                            </code>
                                            <Button
                                                size="sm"
                                                variant="secondary"
                                                onPress={handleCopyWebhookUrl}
                                                aria-label="Copy webhook URL"
                                            >
                                                {webhookUrlCopied ? (
                                                    <Check className="size-3.5" />
                                                ) : (
                                                    <Copy className="size-3.5" />
                                                )}
                                                Copy
                                            </Button>
                                        </div>
                                    </div>
                                ) : null}

                                <div className="flex items-center justify-between gap-3 flex-wrap">
                                    <h3 className="text-sm font-semibold text-foreground">
                                        Keys
                                    </h3>
                                    <div className="flex items-center gap-2">
                                        {canAddWebhookSecret && (
                                            <Button
                                                size="sm"
                                                variant="secondary"
                                                onPress={() =>
                                                    openCreate("WEBHOOK_SECRET")
                                                }
                                            >
                                                Add webhook secret
                                            </Button>
                                        )}
                                        {canAddAccount && (
                                            <Button
                                                size="sm"
                                                variant="secondary"
                                                onPress={openAddAccount}
                                            >
                                                <Plus className="size-4" />
                                                Add account
                                            </Button>
                                        )}
                                        {canAddKey && (
                                            <Button size="sm" onPress={() => openCreate()}>
                                                <Plus className="size-4" />
                                                Add key
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                {groupedKeys.length === 0 ? (
                                    <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted">
                                        No keys yet. Add credentials for{" "}
                                        {providerView.label}.
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {groupedKeys.map((group) => {
                                            const isDefault =
                                                defaultAccount === group.account;
                                            const sendable = accountIsSendable(
                                                group.account,
                                            );
                                            const missingTypes =
                                                getMissingKeyTypesForAccount(
                                                    providerView.provider,
                                                    providerView.keys,
                                                    group.account,
                                                );
                                            const optionalMissingTypes = (
                                                OPTIONAL_PROVIDER_KEY_TYPES[
                                                    providerView.provider
                                                ] ?? []
                                            ).filter((keyType) =>
                                                missingTypes.includes(keyType),
                                            );
                                            const requiredMissingTypes = missingTypes.filter(
                                                (keyType) =>
                                                    !optionalMissingTypes.includes(keyType),
                                            );

                                            return (
                                                <section
                                                    key={group.account}
                                                    className="rounded-lg border border-border bg-surface-secondary/20"
                                                >
                                                    {allowsMultipleAccounts && (
                                                        <div className="px-3 py-2 border-b border-border flex items-center justify-between gap-2">
                                                            <div className="min-w-0 flex-1">
                                                                <p className="text-xs font-medium uppercase tracking-wide text-muted">
                                                                    Account
                                                                </p>
                                                                {renamingAccount ===
                                                                group.account ? (
                                                                    <div className="mt-1 flex flex-wrap items-center gap-2">
                                                                        <Input
                                                                            aria-label="Account title"
                                                                            className={cn(
                                                                                borderedFieldClass,
                                                                                "max-w-xs",
                                                                            )}
                                                                            value={renameTitle}
                                                                            onChange={(e) =>
                                                                                setRenameTitle(
                                                                                    e.target.value,
                                                                                )
                                                                            }
                                                                        />
                                                                        <ActionButtonWithPending
                                                                            size="sm"
                                                                            isPending={
                                                                                updateAccount.isPending
                                                                            }
                                                                            onPress={handleRename}
                                                                        >
                                                                            Save
                                                                        </ActionButtonWithPending>
                                                                        <Button
                                                                            size="sm"
                                                                            variant="ghost"
                                                                            onPress={() =>
                                                                                setRenamingAccount(
                                                                                    null,
                                                                                )
                                                                            }
                                                                        >
                                                                            Cancel
                                                                        </Button>
                                                                    </div>
                                                                ) : (
                                                                    <div className="flex items-center gap-1.5">
                                                                        <p className="text-sm font-semibold text-foreground">
                                                                            {providerView.accounts?.find(
                                                                                (row) =>
                                                                                    row.account ===
                                                                                    group.account,
                                                                            )?.title ??
                                                                                group.account}
                                                                        </p>
                                                                        <Button
                                                                            size="sm"
                                                                            variant="ghost"
                                                                            onPress={() =>
                                                                                startRename(
                                                                                    group.account,
                                                                                )
                                                                            }
                                                                        >
                                                                            <Pencil className="size-3.5" />
                                                                        </Button>
                                                                    </div>
                                                                )}
                                                                <p className="text-xs text-muted font-mono mt-0.5">
                                                                    {group.account}
                                                                </p>
                                                                {sendable !== null ? (
                                                                    <p className="text-xs text-muted mt-0.5">
                                                                        {sendable
                                                                            ? "Ready to send email"
                                                                            : `Missing: ${requiredMissingTypes.join(", ").toLowerCase()}`}
                                                                    </p>
                                                                ) : null}
                                                            </div>
                                                            <div className="flex items-center gap-2 shrink-0">
                                                                {sendable ? (
                                                                    <Chip
                                                                        size="sm"
                                                                        variant="soft"
                                                                        color="success"
                                                                    >
                                                                        <Chip.Label className="inline-flex items-center gap-1">
                                                                            <CheckCircle2 className="size-3" />
                                                                            Sendable
                                                                        </Chip.Label>
                                                                    </Chip>
                                                                ) : null}
                                                                {supportsDefaultAccountSelection && (
                                                                    <>
                                                                        {isDefault ? (
                                                                            <Chip
                                                                                size="sm"
                                                                                variant="soft"
                                                                                color="warning"
                                                                            >
                                                                                <Chip.Label className="inline-flex items-center gap-1">
                                                                                    <Star className="size-3 fill-current" />
                                                                                    Default
                                                                                </Chip.Label>
                                                                            </Chip>
                                                                        ) : showDefaultAccountControls ? (
                                                                            <Button
                                                                                size="sm"
                                                                                variant="secondary"
                                                                                isDisabled={
                                                                                    setDefaultAccount.isPending
                                                                                }
                                                                                onPress={() =>
                                                                                    handleSetDefaultAccount(
                                                                                        group.account,
                                                                                    )
                                                                                }
                                                                            >
                                                                                Set as default
                                                                            </Button>
                                                                        ) : null}
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                    {providerView.provider === "RESEND" && (
                                                        <div className="px-3 py-2.5 border-b border-border space-y-2">
                                                            <div className="flex items-center justify-between gap-2">
                                                                <p className="text-xs font-medium uppercase tracking-wide text-muted">
                                                                    Domains
                                                                </p>
                                                                <Button
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    onPress={() =>
                                                                        openAddDomain(
                                                                            providerView.accounts?.find(
                                                                                (row) =>
                                                                                    row.account === group.account,
                                                                            )?.uuid ?? null,
                                                                        )
                                                                    }
                                                                >
                                                                    <Plus className="size-3.5" />
                                                                    Add domain
                                                                </Button>
                                                            </div>
                                                            {accountDomains(group.account).length === 0 ? (
                                                                <p className="text-xs text-muted">
                                                                    No domains yet. Add a sending address for this
                                                                    account.
                                                                </p>
                                                            ) : (
                                                                <ul className="space-y-1.5">
                                                                    {accountDomains(group.account).map((domain) => (
                                                                        <li
                                                                            key={domain.uuid}
                                                                            className="flex items-center gap-2 rounded-md border border-border bg-surface-primary px-2.5 py-1.5"
                                                                        >
                                                                            <Mail className="size-3.5 text-accent shrink-0" />
                                                                            <div className="flex-1 min-w-0">
                                                                                <p className="text-sm text-foreground truncate">
                                                                                    {domain.from_name
                                                                                        ? `${domain.from_name} <${domain.from_email}>`
                                                                                        : domain.from_email}
                                                                                </p>
                                                                            </div>
                                                                            {domain.is_default ? (
                                                                                <Chip size="sm" variant="soft" color="warning">
                                                                                    <Chip.Label className="inline-flex items-center gap-1">
                                                                                        <Star className="size-3 fill-current" />
                                                                                        Default
                                                                                    </Chip.Label>
                                                                                </Chip>
                                                                            ) : (
                                                                                <Button
                                                                                    size="sm"
                                                                                    variant="ghost"
                                                                                    isDisabled={setDefaultDomain.isPending}
                                                                                    onPress={() =>
                                                                                        handleSetDefaultDomain(domain)
                                                                                    }
                                                                                >
                                                                                    Set default
                                                                                </Button>
                                                                            )}
                                                                            <Button
                                                                                size="sm"
                                                                                variant="ghost"
                                                                                onPress={() =>
                                                                                    openEditDomain(
                                                                                        providerView.accounts?.find(
                                                                                            (row) =>
                                                                                                row.account ===
                                                                                                group.account,
                                                                                        )?.uuid ?? null,
                                                                                        domain,
                                                                                    )
                                                                                }
                                                                            >
                                                                                <Pencil className="size-3.5" />
                                                                            </Button>
                                                                            <Button
                                                                                size="sm"
                                                                                variant="ghost"
                                                                                isDisabled={
                                                                                    domain.is_default ||
                                                                                    accountDomains(group.account)
                                                                                        .length <= 1
                                                                                }
                                                                                onPress={() => setDomainToDelete(domain)}
                                                                            >
                                                                                <Trash2 className="size-3.5" />
                                                                            </Button>
                                                                        </li>
                                                                    ))}
                                                                </ul>
                                                            )}
                                                        </div>
                                                    )}
                                                    <ul className="divide-y divide-border">
                                                        {group.keys.map((key) => {
                                                            const valueDisplay =
                                                                formatIntegrationKeyDisplay(key);

                                                            return (
                                                            <li
                                                                key={key.uuid}
                                                                className="flex items-center gap-3 px-3 py-2.5"
                                                            >
                                                                <KeyRound className="size-4 text-accent shrink-0" />
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-sm font-medium text-foreground truncate">
                                                                        {key.label}
                                                                    </p>
                                                                    <p className="text-xs text-muted font-mono truncate">
                                                                        {key.env_name}
                                                                        {valueDisplay
                                                                            ? ` · ${valueDisplay}`
                                                                            : ""}
                                                                    </p>
                                                                </div>
                                                                <div className="flex items-center gap-1 shrink-0">
                                                                    <Button
                                                                        size="sm"
                                                                        variant="ghost"
                                                                        onPress={() =>
                                                                            openEdit(key)
                                                                        }
                                                                    >
                                                                        <Pencil className="size-3.5" />
                                                                    </Button>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="ghost"
                                                                        onPress={() =>
                                                                            setKeyToDelete(key)
                                                                        }
                                                                    >
                                                                        <Trash2 className="size-3.5" />
                                                                    </Button>
                                                                </div>
                                                            </li>
                                                            );
                                                        })}
                                                        {optionalMissingTypes.map((keyType) => {
                                                            const meta = providerView.keyTypes.find(
                                                                (row) => row.key_type === keyType,
                                                            );
                                                            const missingHint =
                                                                keyType === "WEBHOOK_SECRET"
                                                                    ? "Optional — needed to verify Resend delivery events."
                                                                    : "Not set yet — recipients see only the from email.";
                                                            return (
                                                                <li
                                                                    key={`missing-${group.account}-${keyType}`}
                                                                    className="flex items-center gap-3 px-3 py-2.5"
                                                                >
                                                                    <KeyRound className="size-4 text-muted shrink-0" />
                                                                    <div className="flex-1 min-w-0">
                                                                        <p className="text-sm font-medium text-foreground truncate">
                                                                            {meta?.label ?? keyType}
                                                                        </p>
                                                                        <p className="text-xs text-muted">
                                                                            {missingHint}
                                                                        </p>
                                                                    </div>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="secondary"
                                                                        onPress={() =>
                                                                            openCreate(
                                                                                keyType,
                                                                                group.account,
                                                                            )
                                                                        }
                                                                    >
                                                                        <Plus className="size-3.5" />
                                                                        Add
                                                                    </Button>
                                                                </li>
                                                            );
                                                        })}
                                                    </ul>
                                                </section>
                                            );
                                        })}
                                    </div>
                                )}
                            </Modal.Body>
                            <Modal.Footer>
                                <Button
                                    variant="secondary"
                                    onPress={() => onOpenChange(false)}
                                >
                                    Close
                                </Button>
                            </Modal.Footer>
                        </Modal.Dialog>
                    </Modal.Container>
                </Modal.Backdrop>
            </Modal>

            <IntegrationKeyFormModal
                isOpen={formOpen}
                onOpenChange={setFormOpen}
                providerView={providerView}
                keyItem={editingKey}
                initialKeyType={initialKeyType}
                initialAccount={initialAccount}
            />

            <SmtpAccountFormModal
                isOpen={smtpFormOpen}
                onOpenChange={setSmtpFormOpen}
                providerView={providerView}
            />

            <ResendAccountFormModal
                isOpen={resendFormOpen}
                onOpenChange={setResendFormOpen}
                providerView={providerView}
            />

            <DomainFormModal
                isOpen={domainFormOpen}
                onOpenChange={setDomainFormOpen}
                accountUuid={domainFormAccountUuid}
                domain={editingDomain}
            />

            <ConfirmDialog
                isOpen={!!keyToDelete}
                onOpenChange={(open) => {
                    if (!open) setKeyToDelete(null);
                }}
                title="Delete key?"
                description={
                    keyToDelete ? (
                        <>
                            Remove{" "}
                            <span className="font-medium text-foreground">
                                {keyToDelete.env_name}
                            </span>
                            ? This cannot be undone.
                        </>
                    ) : null
                }
                confirmLabel="Delete"
                variant="danger"
                isPending={deleteKey.isPending}
                onConfirm={handleDelete}
            />

            <ConfirmDialog
                isOpen={!!domainToDelete}
                onOpenChange={(open) => {
                    if (!open) setDomainToDelete(null);
                }}
                title="Delete domain?"
                description={
                    domainToDelete ? (
                        <>
                            Remove{" "}
                            <span className="font-medium text-foreground">
                                {domainToDelete.from_email}
                            </span>
                            ? This cannot be undone.
                        </>
                    ) : null
                }
                confirmLabel="Delete"
                variant="danger"
                isPending={removeDomain.isPending}
                onConfirm={handleDeleteDomain}
            />
        </>
    );
}
