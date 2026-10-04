import { type FC, useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Checkbox, Label, ListBox, Modal, Select } from "@heroui/react";
import {
    createAccessTokenSchema,
    type CreateAccessTokenFormData,
} from "@/features/oauth-connections/validation-schemas/access-token.schema";
import type {
    AccessTokenExpiry,
    AccessTokenScope,
} from "@/features/oauth-connections/interfaces/oauth-connection.interfaces";

const EXPIRY_OPTIONS: { value: AccessTokenExpiry; label: string }[] = [
    { value: "7d", label: "7 days" },
    { value: "30d", label: "30 days" },
    { value: "90d", label: "90 days" },
    { value: "1y", label: "1 year" },
    { value: "never", label: "Never expires" },
];

const SCOPE_OPTIONS: { value: AccessTokenScope; label: string; description: string }[] = [
    {
        value: "mcp:read",
        label: "Read",
        description: "View contacts, campaigns, forms and other workspace data.",
    },
    {
        value: "mcp:write",
        label: "Write",
        description: "Create, update and delete workspace data.",
    },
];

interface CreateAccessTokenModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    isPending: boolean;
    onSubmit: (data: CreateAccessTokenFormData) => void;
}

export const CreateAccessTokenModal: FC<CreateAccessTokenModalProps> = ({
    isOpen,
    onOpenChange,
    isPending,
    onSubmit,
}) => {
    const form = useForm<CreateAccessTokenFormData>({
        resolver: zodResolver(createAccessTokenSchema),
        defaultValues: { expires_in: "30d", scopes: ["mcp:read"] },
    });

    const expiresIn = useWatch({ control: form.control, name: "expires_in" });
    const scopes = useWatch({ control: form.control, name: "scopes" });

    useEffect(() => {
        if (!isOpen) form.reset();
    }, [isOpen, form]);

    const setScope = (scope: AccessTokenScope, selected: boolean) => {
        const next = selected
            ? [...scopes.filter((s) => s !== scope), scope]
            : scopes.filter((s) => s !== scope);
        form.setValue("scopes", next, { shouldValidate: true });
    };

    return (
        <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
            <Modal.Container>
                <Modal.Dialog className="sm:max-w-md">
                    <Modal.CloseTrigger />
                    <Modal.Header>
                        <Modal.Heading>Create access token</Modal.Heading>
                    </Modal.Header>
                    <Modal.Body className="space-y-4">
                        <form
                            id="create-access-token-form"
                            onSubmit={form.handleSubmit(onSubmit)}
                            className="space-y-4"
                        >
                            <div className="flex flex-col gap-1.5">
                                <Label>Expires</Label>
                                <Select
                                    aria-label="Token expiry"
                                    value={expiresIn}
                                    onChange={(v) => {
                                        if (!v) return;
                                        form.setValue("expires_in", v as AccessTokenExpiry, {
                                            shouldValidate: true,
                                        });
                                    }}
                                >
                                    <Select.Trigger className="w-full">
                                        <Select.Value />
                                        <Select.Indicator />
                                    </Select.Trigger>
                                    <Select.Popover>
                                        <ListBox>
                                            {EXPIRY_OPTIONS.map((option) => (
                                                <ListBox.Item
                                                    key={option.value}
                                                    id={option.value}
                                                    textValue={option.label}
                                                >
                                                    {option.label}
                                                    <ListBox.ItemIndicator />
                                                </ListBox.Item>
                                            ))}
                                        </ListBox>
                                    </Select.Popover>
                                </Select>
                                {expiresIn === "never" ? (
                                    <p className="text-xs text-danger">
                                        This token never expires. It stops working only if you
                                        remove this user from the organisation or the server's
                                        signing key is rotated.
                                    </p>
                                ) : null}
                            </div>

                            <div className="flex flex-col gap-2">
                                <Label>Permissions</Label>
                                {SCOPE_OPTIONS.map((option) => (
                                    <Checkbox
                                        key={option.value}
                                        isSelected={scopes.includes(option.value)}
                                        onChange={(checked: boolean) =>
                                            setScope(option.value, checked)
                                        }
                                    >
                                        <Checkbox.Control>
                                            <Checkbox.Indicator />
                                        </Checkbox.Control>
                                        <span className="text-xs text-muted">
                                            <span className="font-medium text-foreground">
                                                {option.label}
                                            </span>
                                            {" — "}
                                            {option.description}
                                        </span>
                                    </Checkbox>
                                ))}
                                {form.formState.errors.scopes ? (
                                    <p className="text-xs text-danger">
                                        {form.formState.errors.scopes.message}
                                    </p>
                                ) : null}
                            </div>
                        </form>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button slot="close" variant="secondary">
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            form="create-access-token-form"
                            variant="primary"
                            isDisabled={isPending}
                        >
                            Create token
                        </Button>
                    </Modal.Footer>
                </Modal.Dialog>
            </Modal.Container>
        </Modal.Backdrop>
    );
};
