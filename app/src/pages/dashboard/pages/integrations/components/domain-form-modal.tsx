import { useEffect, useState } from "react";
import { Button, FieldError, Input, Label, Modal } from "@heroui/react";
import { Save } from "lucide-react";
import { ActionButtonWithPending } from "@/components/ui/action-button-with-pending";
import {
    useAddAccountDomain,
    useUpdateAccountDomain,
} from "@/features/integrations/hooks/use-integrations";
import type { IntegrationAccountDomain } from "@/features/integrations/interfaces/integrations.interface";
import { cn } from "@/lib/utils";

const borderedFieldClass = cn(
    "rounded-md border border-border bg-surface-primary",
    "focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40",
);

interface DomainFormModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    accountUuid: string | null;
    domain?: IntegrationAccountDomain | null;
}

export function DomainFormModal({
    isOpen,
    onOpenChange,
    accountUuid,
    domain,
}: DomainFormModalProps) {
    const addDomain = useAddAccountDomain();
    const updateDomain = useUpdateAccountDomain();
    const isEdit = !!domain;

    const [fromEmail, setFromEmail] = useState("");
    const [fromName, setFromName] = useState("");
    const [formError, setFormError] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        setFromEmail(domain?.from_email ?? "");
        setFromName(domain?.from_name ?? "");
        setFormError(null);
    }, [isOpen, domain]);

    const pending = addDomain.isPending || updateDomain.isPending;

    const handleSubmit = async () => {
        const trimmedFromEmail = fromEmail.trim();
        const trimmedFromName = fromName.trim();

        if (!trimmedFromEmail) {
            setFormError("From email is required.");
            return;
        }

        setFormError(null);

        try {
            if (isEdit && domain) {
                await updateDomain.mutateAsync({
                    domainUuid: domain.uuid,
                    payload: {
                        from_email: trimmedFromEmail,
                        from_name: trimmedFromName || undefined,
                    },
                });
            } else if (accountUuid) {
                await addDomain.mutateAsync({
                    accountUuid,
                    payload: {
                        from_email: trimmedFromEmail,
                        ...(trimmedFromName ? { from_name: trimmedFromName } : {}),
                    },
                });
            }
            onOpenChange(false);
        } catch (error) {
            setFormError(error instanceof Error ? error.message : "Could not save domain.");
        }
    };

    return (
        <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
            <Modal.Backdrop>
                <Modal.Container size="md">
                    <Modal.Dialog>
                        <Modal.CloseTrigger />
                        <Modal.Header>
                            <Modal.Heading>{isEdit ? "Edit domain" : "Add domain"}</Modal.Heading>
                        </Modal.Header>
                        <Modal.Body className="space-y-4">
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="domain-from-email">From address</Label>
                                <Input
                                    id="domain-from-email"
                                    className={borderedFieldClass}
                                    value={fromEmail}
                                    onChange={(e) => setFromEmail(e.target.value)}
                                    placeholder="sales@yourdomain.com"
                                />
                                <p className="text-xs text-muted">
                                    Must be a verified domain or address in this Resend account.
                                </p>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="domain-from-name">Sender name (optional)</Label>
                                <Input
                                    id="domain-from-name"
                                    className={borderedFieldClass}
                                    value={fromName}
                                    onChange={(e) => setFromName(e.target.value)}
                                    placeholder="Acme Sales"
                                />
                            </div>
                            {formError ? <FieldError>{formError}</FieldError> : null}
                        </Modal.Body>
                        <Modal.Footer>
                            <Button variant="secondary" onPress={() => onOpenChange(false)}>
                                Cancel
                            </Button>
                            <ActionButtonWithPending isPending={pending} onPress={handleSubmit}>
                                <Save className="size-4" />
                                Save domain
                            </ActionButtonWithPending>
                        </Modal.Footer>
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>
        </Modal>
    );
}
