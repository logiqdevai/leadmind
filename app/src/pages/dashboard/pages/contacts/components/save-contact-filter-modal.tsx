import { useEffect, useState } from "react";
import { Button, FieldError, Input, Label, Modal } from "@heroui/react";
import { Save } from "lucide-react";
import { ActionButtonWithPending } from "@/components/ui/action-button-with-pending";
import {
    useCreateSavedContactFilter,
    useUpdateSavedContactFilter,
} from "@/features/saved-contact-filters/hooks/use-saved-contact-filters";
import type { ContactFilters } from "@/interfaces/contact-filters.interface";

export type SaveContactFilterModalMode = "create" | "duplicate" | "rename";

interface SaveContactFilterModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    mode: SaveContactFilterModalMode;
    filters: ContactFilters;
    currentUuid?: string;
    currentName?: string;
    onSaved: (uuid: string) => void;
}

const TITLES: Record<SaveContactFilterModalMode, string> = {
    create: "Save filter",
    duplicate: "Save as new filter",
    rename: "Rename filter",
};

const SUBMIT_LABELS: Record<SaveContactFilterModalMode, string> = {
    create: "Save filter",
    duplicate: "Save as new",
    rename: "Save name",
};

export function SaveContactFilterModal({
    isOpen,
    onOpenChange,
    mode,
    filters,
    currentUuid,
    currentName,
    onSaved,
}: SaveContactFilterModalProps) {
    const createFilter = useCreateSavedContactFilter();
    const updateFilter = useUpdateSavedContactFilter();

    const [name, setName] = useState("");
    const [error, setError] = useState<string | null>(null);

    const isPending = createFilter.isPending || updateFilter.isPending;

    useEffect(() => {
        if (!isOpen) return;
        setError(null);
        setName(mode === "rename" ? (currentName ?? "") : "");
    }, [isOpen, mode, currentName]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        const trimmed = name.trim();
        if (!trimmed) {
            setError("Filter name is required.");
            return;
        }

        try {
            if (mode === "rename" && currentUuid) {
                const updated = await updateFilter.mutateAsync({
                    uuid: currentUuid,
                    payload: { name: trimmed },
                });
                onSaved(updated.uuid);
            } else {
                const created = await createFilter.mutateAsync({ name: trimmed, filters });
                onSaved(created.uuid);
            }
            onOpenChange(false);
        } catch {
            // toast surfaced by hooks
        }
    };

    return (
        <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
            <Modal.Container>
                <Modal.Dialog className="sm:max-w-md">
                    <Modal.CloseTrigger />
                    <Modal.Header>
                        <Modal.Heading>{TITLES[mode]}</Modal.Heading>
                    </Modal.Header>
                    <form onSubmit={handleSubmit}>
                        <Modal.Body className="space-y-3">
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="scf-name">
                                    Filter name <span className="text-danger">*</span>
                                </Label>
                                <Input
                                    id="scf-name"
                                    placeholder="e.g. High-Value Leads"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    maxLength={100}
                                    required
                                />
                            </div>
                            {error && <FieldError>{error}</FieldError>}
                        </Modal.Body>
                        <Modal.Footer>
                            <Button slot="close" variant="secondary" type="button">
                                Cancel
                            </Button>
                            <ActionButtonWithPending
                                type="submit"
                                isDisabled={isPending}
                                isPending={isPending}
                                idleLeading={<Save className="size-4" />}
                            >
                                {SUBMIT_LABELS[mode]}
                            </ActionButtonWithPending>
                        </Modal.Footer>
                    </form>
                </Modal.Dialog>
            </Modal.Container>
        </Modal.Backdrop>
    );
}
