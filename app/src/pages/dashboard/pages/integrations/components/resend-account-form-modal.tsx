import { useEffect, useMemo, useState } from "react";
import {
    Button,
    FieldError,
    Input,
    Label,
    Modal,
} from "@heroui/react";
import { Save } from "lucide-react";
import { ActionButtonWithPending } from "@/components/ui/action-button-with-pending";
import { useCreateResendAccount } from "@/features/integrations/hooks/use-integrations";
import { suggestNextAccountLabel } from "@/features/integrations/constants/integration-key-types";
import type { IntegrationProviderView } from "@/features/integrations/interfaces/integrations.interface";
import { cn } from "@/lib/utils";
import { IntegrationOfficialLink } from "./integration-official-link";

const borderedFieldClass = cn(
    "rounded-md border border-border bg-surface-primary",
    "focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40",
);

interface ResendAccountFormModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    providerView: IntegrationProviderView;
}

export function ResendAccountFormModal({
    isOpen,
    onOpenChange,
    providerView,
}: ResendAccountFormModalProps) {
    const createResendAccount = useCreateResendAccount();
    const defaultAccount = useMemo(
        () => suggestNextAccountLabel(providerView.keys),
        [providerView.keys],
    );

    const [account, setAccount] = useState(defaultAccount);
    const [title, setTitle] = useState("");
    const [apiKey, setApiKey] = useState("");
    const [webhookSecret, setWebhookSecret] = useState("");
    const [fromEmail, setFromEmail] = useState("");
    const [fromName, setFromName] = useState("");
    const [formError, setFormError] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        setAccount(defaultAccount);
        setTitle("");
        setApiKey("");
        setWebhookSecret("");
        setFromEmail("");
        setFromName("");
        setFormError(null);
    }, [defaultAccount, isOpen]);

    const handleSubmit = async () => {
        const trimmedAccount = account.trim();
        const trimmedTitle = title.trim();
        const trimmedApiKey = apiKey.trim();
        const trimmedFromEmail = fromEmail.trim();
        const trimmedWebhookSecret = webhookSecret.trim();
        const trimmedFromName = fromName.trim();

        if (!trimmedTitle) {
            setFormError("Title is required.");
            return;
        }

        if (!/^[a-zA-Z0-9_-]+$/.test(trimmedAccount)) {
            setFormError("Account label may only use letters, numbers, underscores, or hyphens.");
            return;
        }

        if (!trimmedApiKey || !trimmedFromEmail) {
            setFormError("API key and from email are required.");
            return;
        }

        setFormError(null);

        try {
            await createResendAccount.mutateAsync({
                account: trimmedAccount,
                title: trimmedTitle,
                api_key: trimmedApiKey,
                from_email: trimmedFromEmail,
                ...(trimmedWebhookSecret ? { webhook_secret: trimmedWebhookSecret } : {}),
                ...(trimmedFromName ? { from_name: trimmedFromName } : {}),
            });
            onOpenChange(false);
        } catch (error) {
            setFormError(error instanceof Error ? error.message : "Could not save Resend account.");
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
                                Add{" "}
                                <IntegrationOfficialLink provider="RESEND">
                                    Resend
                                </IntegrationOfficialLink>{" "}
                                account
                            </Modal.Heading>
                        </Modal.Header>
                        <Modal.Body className="space-y-4">
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="resend-account-title">Title</Label>
                                <Input
                                    id="resend-account-title"
                                    className={borderedFieldClass}
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="Marketing Resend, Product emails"
                                />
                                <p className="text-xs text-muted">
                                    Shown in send menus so you can tell accounts apart.
                                </p>
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="resend-account-label">Account label</Label>
                                <Input
                                    id="resend-account-label"
                                    className={borderedFieldClass}
                                    value={account}
                                    onChange={(e) => setAccount(e.target.value)}
                                    placeholder="1, production, sales"
                                />
                                <p className="text-xs text-muted">
                                    Internal ID for this credential set. Letters, numbers, underscores, or hyphens.
                                </p>
                            </div>

                            <div className="grid gap-3">
                                <div className="flex flex-col gap-1.5">
                                    <Label htmlFor="resend-api-key">API key</Label>
                                    <Input
                                        id="resend-api-key"
                                        className={borderedFieldClass}
                                        type="password"
                                        autoComplete="off"
                                        value={apiKey}
                                        onChange={(e) => setApiKey(e.target.value)}
                                        placeholder="re_..."
                                    />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <Label htmlFor="resend-webhook-secret">Webhook secret (optional)</Label>
                                    <Input
                                        id="resend-webhook-secret"
                                        className={borderedFieldClass}
                                        type="password"
                                        autoComplete="off"
                                        value={webhookSecret}
                                        onChange={(e) => setWebhookSecret(e.target.value)}
                                        placeholder="whsec_..."
                                    />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <Label htmlFor="resend-from">From address</Label>
                                    <Input
                                        id="resend-from"
                                        className={borderedFieldClass}
                                        value={fromEmail}
                                        onChange={(e) => setFromEmail(e.target.value)}
                                        placeholder="noreply@yourdomain.com"
                                    />
                                    <p className="text-xs text-muted">
                                        Must be a verified domain or address in your Resend account. You can add more
                                        domains to this account later without re-entering the API key.
                                    </p>
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <Label htmlFor="resend-from-name">Sender name (optional)</Label>
                                    <Input
                                        id="resend-from-name"
                                        className={borderedFieldClass}
                                        value={fromName}
                                        onChange={(e) => setFromName(e.target.value)}
                                        placeholder="Acme Sales"
                                    />
                                </div>
                            </div>

                            {formError ? <FieldError>{formError}</FieldError> : null}
                        </Modal.Body>
                        <Modal.Footer>
                            <Button variant="secondary" onPress={() => onOpenChange(false)}>
                                Cancel
                            </Button>
                            <ActionButtonWithPending
                                isPending={createResendAccount.isPending}
                                onPress={handleSubmit}
                            >
                                <Save className="size-4" />
                                Save Resend account
                            </ActionButtonWithPending>
                        </Modal.Footer>
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>
        </Modal>
    );
}
