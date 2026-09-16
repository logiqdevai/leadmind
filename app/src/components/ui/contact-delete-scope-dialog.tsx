import { useEffect, useState, type FC } from "react";
import { AlertDialog, Button } from "@heroui/react";
import { AlertTriangle, ListMinus, Trash2 } from "lucide-react";
import { ActionButtonWithPending } from "@/components/ui/action-button-with-pending";
import { cn } from "@/lib/utils";

export const ContactDeleteScopeModes = {
    FROM_LIST: "FROM_LIST",
    ABSOLUTE: "ABSOLUTE",
} as const;

export type ContactDeleteScopeMode =
    (typeof ContactDeleteScopeModes)[keyof typeof ContactDeleteScopeModes];

interface ContactDeleteScopeDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    count: number;
    isPending?: boolean;
    onConfirm: (mode: ContactDeleteScopeMode) => void | Promise<void>;
}

export const ContactDeleteScopeDialog: FC<ContactDeleteScopeDialogProps> = ({
    isOpen,
    onOpenChange,
    count,
    isPending = false,
    onConfirm,
}) => {
    const [mode, setMode] = useState<ContactDeleteScopeMode>(ContactDeleteScopeModes.FROM_LIST);

    useEffect(() => {
        if (isOpen) setMode(ContactDeleteScopeModes.FROM_LIST);
    }, [isOpen]);

    const plural = count === 1 ? "contact" : "contacts";
    const title = count === 1 ? "Delete contact?" : `Delete ${count} selected contacts?`;

    const handleConfirm = async () => {
        await onConfirm(mode);
    };

    return (
        <AlertDialog.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
            <AlertDialog.Container>
                <AlertDialog.Dialog className="sm:max-w-md">
                    <AlertDialog.Header>
                        <AlertDialog.Icon
                            status={mode === ContactDeleteScopeModes.ABSOLUTE ? "danger" : "warning"}
                        >
                            <AlertTriangle className="size-5" />
                        </AlertDialog.Icon>
                        <AlertDialog.Heading>{title}</AlertDialog.Heading>
                    </AlertDialog.Header>
                    <AlertDialog.Body>
                        <div className="flex flex-col gap-3">
                            <p className="text-sm text-muted">
                                Do you want to remove {count === 1 ? "this contact" : "these contacts"}{" "}
                                from the list only, or permanently delete{" "}
                                {count === 1 ? "it" : "them"} from your CRM?
                            </p>
                            <div className="flex flex-col gap-2" role="radiogroup" aria-label="Delete scope">
                                <button
                                    type="button"
                                    role="radio"
                                    aria-checked={mode === ContactDeleteScopeModes.FROM_LIST}
                                    disabled={isPending}
                                    onClick={() => setMode(ContactDeleteScopeModes.FROM_LIST)}
                                    className={cn(
                                        "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                                        mode === ContactDeleteScopeModes.FROM_LIST
                                            ? "border-accent bg-accent/5"
                                            : "border-border hover:border-muted",
                                    )}
                                >
                                    <ListMinus className="size-4 shrink-0 mt-0.5 text-muted" />
                                    <span className="flex flex-col gap-0.5 min-w-0">
                                        <span className="text-sm font-medium text-foreground">
                                            Remove from this list
                                        </span>
                                        <span className="text-xs text-muted">
                                            Keeps the {plural} in your CRM. Only membership in this list
                                            is removed.
                                        </span>
                                    </span>
                                </button>
                                <button
                                    type="button"
                                    role="radio"
                                    aria-checked={mode === ContactDeleteScopeModes.ABSOLUTE}
                                    disabled={isPending}
                                    onClick={() => setMode(ContactDeleteScopeModes.ABSOLUTE)}
                                    className={cn(
                                        "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                                        mode === ContactDeleteScopeModes.ABSOLUTE
                                            ? "border-danger bg-danger/5"
                                            : "border-border hover:border-muted",
                                    )}
                                >
                                    <Trash2 className="size-4 shrink-0 mt-0.5 text-danger" />
                                    <span className="flex flex-col gap-0.5 min-w-0">
                                        <span className="text-sm font-medium text-danger">
                                            Delete from CRM
                                        </span>
                                        <span className="text-xs text-muted">
                                            Permanently removes the {plural} from your CRM (and all lists).
                                            Underlying lead records stay in the public directory.
                                        </span>
                                    </span>
                                </button>
                            </div>
                        </div>
                    </AlertDialog.Body>
                    <AlertDialog.Footer>
                        <Button slot="close" variant="secondary" isDisabled={isPending}>
                            Cancel
                        </Button>
                        <ActionButtonWithPending
                            variant={mode === ContactDeleteScopeModes.ABSOLUTE ? "danger" : "primary"}
                            isDisabled={isPending}
                            isPending={isPending}
                            onPress={handleConfirm}
                        >
                            {mode === ContactDeleteScopeModes.ABSOLUTE
                                ? "Delete from CRM"
                                : "Remove from list"}
                        </ActionButtonWithPending>
                    </AlertDialog.Footer>
                </AlertDialog.Dialog>
            </AlertDialog.Container>
        </AlertDialog.Backdrop>
    );
};
