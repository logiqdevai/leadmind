import { useEffect, useMemo, useState } from "react";
import {
    Button,
    FieldError,
    Input,
    Label,
    ListBox,
    Modal,
    Select,
} from "@heroui/react";
import { Check, Copy, RefreshCw, Save } from "lucide-react";
import { ActionButtonWithPending } from "@/components/ui/action-button-with-pending";
import { toast } from "@/hooks/use-toast";
import {
    useCreateIntegrationKey,
    useUpdateIntegrationKey,
} from "@/features/integrations/hooks/use-integrations";
import {
    formatIntegrationKeyEnvName,
    getMissingKeyTypesForAccount,
    KEY_TYPE_PLACEHOLDERS,
    MASKED_INTEGRATION_KEY_TYPES,
    providerAllowsMultipleAccounts,
    shouldExposeIntegrationKeyDisplayValue,
    suggestNextAccountLabel,
    suggestAccountForKeyType,
} from "@/features/integrations/constants/integration-key-types";
import type {
    IntegrationKey,
    IntegrationKeyType,
    IntegrationProviderView,
} from "@/features/integrations/interfaces/integrations.interface";
import { cn } from "@/lib/utils";
import { IntegrationOfficialLink } from "./integration-official-link";

const borderedFieldClass = cn(
    "rounded-md border border-border bg-surface-primary",
    "focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40",
);

const generateUuid = () =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

interface IntegrationKeyFormModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    providerView: IntegrationProviderView;
    keyItem?: IntegrationKey | null;
    initialKeyType?: IntegrationKeyType;
    initialAccount?: string;
}

export function IntegrationKeyFormModal({
    isOpen,
    onOpenChange,
    providerView,
    keyItem,
    initialKeyType,
    initialAccount,
}: IntegrationKeyFormModalProps) {
    const createKey = useCreateIntegrationKey(providerView.provider);
    const updateKey = useUpdateIntegrationKey();
    const isEdit = !!keyItem;

    const allowsMultipleAccounts =
        providerView.allows_multiple_accounts ??
        providerAllowsMultipleAccounts(providerView.provider);

    const suggestedAccount = useMemo(
        () => suggestNextAccountLabel(providerView.keys),
        [providerView.keys],
    );

    const availableKeyTypes = useMemo(() => {
        if (isEdit) {
            return providerView.keyTypes;
        }
        if (!allowsMultipleAccounts) {
            const used = new Set(providerView.keys.map((key) => key.key_type));
            return providerView.keyTypes.filter((row) => !used.has(row.key_type));
        }
        const accountForTypes = (initialAccount ?? suggestedAccount).trim();
        const missing = getMissingKeyTypesForAccount(
            providerView.provider,
            providerView.keys,
            accountForTypes,
        );
        if (missing.length === 0) {
            return providerView.keyTypes;
        }
        return providerView.keyTypes.filter((row) => missing.includes(row.key_type));
    }, [
        allowsMultipleAccounts,
        initialAccount,
        isEdit,
        providerView.keyTypes,
        providerView.keys,
        providerView.provider,
        suggestedAccount,
    ]);

    const defaultKeyType =
        initialKeyType ??
        keyItem?.key_type ??
        availableKeyTypes[0]?.key_type ??
        providerView.keyTypes[0]?.key_type ??
        "API_KEY";

    const [keyType, setKeyType] = useState<IntegrationKeyType>(defaultKeyType);
    const [account, setAccount] = useState("1");
    const [title, setTitle] = useState("");
    const [secret, setSecret] = useState("");
    const [keyTypeError, setKeyTypeError] = useState<string | null>(null);
    const [accountError, setAccountError] = useState<string | null>(null);
    const [titleError, setTitleError] = useState<string | null>(null);
    const [secretError, setSecretError] = useState<string | null>(null);
    const [secretCopied, setSecretCopied] = useState(false);

    const keyTypeMeta = useMemo(
        () => providerView.keyTypes.find((row) => row.key_type === keyType),
        [providerView.keyTypes, keyType],
    );

    useEffect(() => {
        if (!isOpen) return;
        setKeyType(keyItem?.key_type ?? initialKeyType ?? defaultKeyType);
        setAccount(
            keyItem?.account ??
                initialAccount ??
                suggestAccountForKeyType(providerView.provider, providerView.keys, keyItem?.key_type ?? initialKeyType ?? defaultKeyType),
        );
        setTitle("");
        setSecret(
            keyItem &&
                shouldExposeIntegrationKeyDisplayValue(
                    providerView.provider,
                    keyItem.key_type,
                )
                ? (keyItem.display_value ?? "")
                : "",
        );
        setKeyTypeError(null);
        setAccountError(null);
        setTitleError(null);
        setSecretError(null);
        setSecretCopied(false);
    }, [isOpen, initialAccount, keyItem, initialKeyType, defaultKeyType, suggestedAccount, providerView.provider]);

    const pending = createKey.isPending || updateKey.isPending;
    const envPreview = formatIntegrationKeyEnvName(
        providerView.provider,
        keyType,
        account,
    );
    const isNewAccount =
        allowsMultipleAccounts &&
        !isEdit &&
        !providerView.keys.some((key) => key.account === account.trim());

    const handleCopySecret = async () => {
        if (!secret) return;
        try {
            await navigator.clipboard.writeText(secret);
            setSecretCopied(true);
            toast({ title: "Copied to clipboard", duration: 1500 });
            window.setTimeout(() => setSecretCopied(false), 2000);
        } catch {
            toast({
                title: "Could not copy to clipboard",
                variant: "error",
                duration: 2000,
            });
        }
    };

    const handleSubmit = async () => {
        const trimmedAccount = allowsMultipleAccounts ? account.trim() : "1";
        const trimmedTitle = title.trim();
        const trimmedSecret = secret.trim();
        let valid = true;

        if (!keyType) {
            setKeyTypeError("Credential type is required");
            valid = false;
        } else {
            setKeyTypeError(null);
        }

        if (allowsMultipleAccounts) {
            if (!/^[a-zA-Z0-9_-]+$/.test(trimmedAccount)) {
                setAccountError("Use letters, numbers, underscores, or hyphens");
                valid = false;
            } else {
                setAccountError(null);
            }
        } else {
            setAccountError(null);
        }

        if (isNewAccount && !trimmedTitle) {
            setTitleError("Title is required for a new account");
            valid = false;
        } else {
            setTitleError(null);
        }

        if (!trimmedSecret) {
            setSecretError("Secret is required");
            valid = false;
        } else {
            setSecretError(null);
        }

        if (!valid) return;

        try {
            if (isEdit && keyItem) {
                await updateKey.mutateAsync({
                    uuid: keyItem.uuid,
                    payload: { secret: trimmedSecret },
                });
            } else {
                await createKey.mutateAsync({
                    key_type: keyType,
                    account: trimmedAccount,
                    secret: trimmedSecret,
                    ...(isNewAccount ? { title: trimmedTitle } : {}),
                });
            }
            onOpenChange(false);
        } catch {
        }
    };

    return (
        <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
            <Modal.Backdrop>
                <Modal.Container size="md">
                    <Modal.Dialog>
                        <Modal.CloseTrigger />
                        <Modal.Header>
                            <Modal.Heading>
                                {isEdit ? (
                                    `Update ${keyItem?.env_name ?? "key"}`
                                ) : (
                                    <>
                                        Add{" "}
                                        <IntegrationOfficialLink
                                            provider={providerView.provider}
                                        >
                                            {providerView.label}
                                        </IntegrationOfficialLink>{" "}
                                        key
                                    </>
                                )}
                            </Modal.Heading>
                        </Modal.Header>
                        <Modal.Body className="space-y-4">
                            <div className="flex flex-col gap-1.5">
                                <Select
                                    className="w-full"
                                    isDisabled={isEdit}
                                    value={keyType}
                                    onChange={(value) =>
                                        setKeyType(
                                            String(value ?? defaultKeyType) as IntegrationKeyType,
                                        )
                                    }
                                >
                                    <Label>Credential type</Label>
                                    <Select.Trigger className={borderedFieldClass}>
                                        <Select.Value />
                                        <Select.Indicator />
                                    </Select.Trigger>
                                    <Select.Popover>
                                        <ListBox>
                                            {availableKeyTypes.map((row) => (
                                                <ListBox.Item
                                                    key={row.key_type}
                                                    id={row.key_type}
                                                    textValue={row.label}
                                                >
                                                    {row.label}
                                                    <ListBox.ItemIndicator />
                                                </ListBox.Item>
                                            ))}
                                        </ListBox>
                                    </Select.Popover>
                                </Select>
                                {keyTypeError && (
                                    <FieldError>{keyTypeError}</FieldError>
                                )}
                            </div>

                            {allowsMultipleAccounts && (
                                <div className="flex flex-col gap-1.5">
                                    <Label htmlFor="integration-key-account">
                                        Account
                                    </Label>
                                    <Input
                                        id="integration-key-account"
                                        className={borderedFieldClass}
                                        disabled={isEdit}
                                        placeholder="1, production, main"
                                        value={account}
                                        onChange={(e) => setAccount(e.target.value)}
                                    />
                                    <p className="text-xs text-muted">
                                        Use the same account for keys that belong
                                        together. Example: account{" "}
                                        <span className="font-mono">1</span> gives{" "}
                                        <span className="font-mono">
                                            {providerView.provider}_HOST_1
                                        </span>
                                        ,{" "}
                                        <span className="font-mono">
                                            {providerView.provider}_PORT_1
                                        </span>
                                        , and{" "}
                                        <span className="font-mono">
                                            {providerView.provider}_PASSWORD_1
                                        </span>
                                        .
                                    </p>
                                    {accountError && (
                                        <FieldError>{accountError}</FieldError>
                                    )}
                                </div>
                            )}

                            {isNewAccount && (
                                <div className="flex flex-col gap-1.5">
                                    <Label htmlFor="integration-key-title">
                                        Title
                                    </Label>
                                    <Input
                                        id="integration-key-title"
                                        className={borderedFieldClass}
                                        placeholder="Sales inbox, Marketing Resend"
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                    />
                                    <p className="text-xs text-muted">
                                        Shown in send menus so you can tell accounts apart.
                                    </p>
                                    {titleError && (
                                        <FieldError>{titleError}</FieldError>
                                    )}
                                </div>
                            )}

                            <div className="rounded-lg border border-border bg-surface-secondary/40 px-3 py-2">
                                <p className="text-xs text-muted">Reference name</p>
                                <p className="text-sm font-mono text-foreground mt-1">
                                    {envPreview}
                                </p>
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <div className="flex items-center justify-between gap-2">
                                    <Label htmlFor="integration-key-secret">
                                        {keyTypeMeta?.label ?? "Secret"}
                                    </Label>
                                    <div className="flex items-center gap-1.5">
                                        {keyType === "WEBHOOK_SECRET" && (
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onPress={() => {
                                                    setSecret(generateUuid());
                                                    setSecretError(null);
                                                    setSecretCopied(false);
                                                }}
                                            >
                                                <RefreshCw className="size-3.5" />
                                                Generate
                                            </Button>
                                        )}
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            isDisabled={!secret}
                                            onPress={handleCopySecret}
                                            aria-label="Copy secret"
                                        >
                                            {secretCopied ? (
                                                <Check className="size-3.5" />
                                            ) : (
                                                <Copy className="size-3.5" />
                                            )}
                                            Copy
                                        </Button>
                                    </div>
                                </div>
                                <Input
                                    id="integration-key-secret"
                                    className={borderedFieldClass}
                                    type={
                                        MASKED_INTEGRATION_KEY_TYPES.has(keyType)
                                            ? "password"
                                            : "text"
                                    }
                                    autoComplete="off"
                                    placeholder={
                                        keyTypeMeta?.placeholder ??
                                        KEY_TYPE_PLACEHOLDERS[keyType]
                                    }
                                    value={secret}
                                    onChange={(e) => {
                                        setSecret(e.target.value);
                                        setSecretCopied(false);
                                    }}
                                />
                                {secretError && (
                                    <FieldError>{secretError}</FieldError>
                                )}
                            </div>
                        </Modal.Body>
                        <Modal.Footer>
                            <Button
                                variant="secondary"
                                onPress={() => onOpenChange(false)}
                            >
                                Cancel
                            </Button>
                            <ActionButtonWithPending
                                isPending={pending}
                                onPress={handleSubmit}
                            >
                                <Save className="size-4" />
                                {isEdit ? "Save secret" : "Save key"}
                            </ActionButtonWithPending>
                        </Modal.Footer>
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>
        </Modal>
    );
}
