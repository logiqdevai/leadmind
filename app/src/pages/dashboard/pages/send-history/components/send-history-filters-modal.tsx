import { Button, Modal } from "@heroui/react";
import { SendHistoryFiltersForm, type SendHistoryFiltersFormProps } from "./send-history-filters-form";

interface SendHistoryFiltersModalProps extends SendHistoryFiltersFormProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
}

/**
 * The same send-history filter fields as the table's inline bar, presented in a modal - for
 * contexts (like the inbox's contact list) where there isn't room for a permanent filters row.
 */
export function SendHistoryFiltersModal({ isOpen, onOpenChange, ...form }: SendHistoryFiltersModalProps) {
    return (
        <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
            <Modal.Container>
                <Modal.Dialog className="sm:max-w-md">
                    <Modal.CloseTrigger />
                    <Modal.Header>
                        <Modal.Heading>Filters</Modal.Heading>
                    </Modal.Header>
                    <Modal.Body>
                        <SendHistoryFiltersForm {...form} layout="stacked" />
                    </Modal.Body>
                    <Modal.Footer>
                        <Button slot="close" variant="secondary">
                            Done
                        </Button>
                    </Modal.Footer>
                </Modal.Dialog>
            </Modal.Container>
        </Modal.Backdrop>
    );
}
