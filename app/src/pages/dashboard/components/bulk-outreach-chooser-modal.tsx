import type { FC } from "react";
import { Modal } from "@heroui/react";
import { Mail, Workflow } from "lucide-react";
import { cn } from "@/lib/utils";

export const OutreachActionTypes = {
    MESSAGE: "message",
    SEQUENCE: "sequence",
} as const;

export type OutreachActionType =
    (typeof OutreachActionTypes)[keyof typeof OutreachActionTypes];

interface BulkOutreachChooserModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    contactCount: number;
    onSelect: (action: OutreachActionType) => void;
}

const OPTIONS = [
    {
        id: OutreachActionTypes.MESSAGE,
        title: "Send message",
        description: "Compose one email or SMS and send it to the selected contacts now.",
        icon: Mail,
    },
    {
        id: OutreachActionTypes.SEQUENCE,
        title: "Enroll in sequence",
        description: "Add contacts to an active sequence so steps run on their configured delays.",
        icon: Workflow,
    },
] as const;

export const BulkOutreachChooserModal: FC<BulkOutreachChooserModalProps> = ({
    isOpen,
    onOpenChange,
    contactCount,
    onSelect,
}) => {
    const countLabel =
        contactCount === 1 ? "1 contact" : `${contactCount} contacts`;

    return (
        <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
            <Modal.Container>
                <Modal.Dialog className="sm:max-w-xl">
                    <Modal.CloseTrigger />
                    <Modal.Header>
                        <Modal.Heading>Send to selected</Modal.Heading>
                        <p className="text-sm text-muted mt-1">
                            Choose how to reach {countLabel}. You can review recipients next.
                        </p>
                    </Modal.Header>
                    <Modal.Body>
                        <div className="grid gap-3 sm:grid-cols-2">
                            {OPTIONS.map((option) => {
                                const Icon = option.icon;
                                return (
                                    <button
                                        key={option.id}
                                        type="button"
                                        onClick={() => {
                                            onSelect(option.id);
                                            onOpenChange(false);
                                        }}
                                        className={cn(
                                            "group flex flex-col gap-3 rounded-2xl border border-border bg-surface-secondary/40 p-4 text-left transition-colors",
                                            "hover:border-accent/50 hover:bg-accent/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                                        )}
                                    >
                                        <span className="inline-flex size-11 items-center justify-center rounded-xl bg-accent/12 text-accent transition-colors group-hover:bg-accent/18">
                                            <Icon className="size-5" strokeWidth={2} />
                                        </span>
                                        <span className="flex flex-col gap-1">
                                            <span className="text-sm font-semibold text-foreground">
                                                {option.title}
                                            </span>
                                            <span className="text-xs leading-relaxed text-muted">
                                                {option.description}
                                            </span>
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </Modal.Body>
                </Modal.Dialog>
            </Modal.Container>
        </Modal.Backdrop>
    );
};
