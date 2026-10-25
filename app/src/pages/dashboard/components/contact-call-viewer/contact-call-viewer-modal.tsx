import { useEffect, useRef, type FC } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Modal } from "@heroui/react";
import { cn } from "@/lib/utils";
import { contactsQueryKeys } from "@/features/contacts/hooks/use-contacts";
import { getContact } from "@/features/contacts/services/contacts.service";
import { ContactStackViewerToolbar } from "../contact-stack-viewer/contact-stack-viewer-toolbar";
import { useContactStackNavigation } from "../contact-stack-viewer/use-contact-stack-navigation";
import type { ContactStackViewerProps } from "../contact-stack-viewer/types";
import { ContactCallView } from "./contact-call-view";

export const ContactCallViewerModal: FC<ContactStackViewerProps> = ({
    isOpen,
    onOpenChange,
    contactUuids,
    listUuid,
    activeUuid,
    currentIndex,
    onIndexChange,
    totalCount,
    globalOffset = 0,
    onRequestNextPage,
    onRequestPrevPage,
    hasNextPage = false,
    hasPrevPage = false,
}) => {
    const queryClient = useQueryClient();
    const bodyRef = useRef<HTMLDivElement | null>(null);

    const { navigation, goPrev, goNext } = useContactStackNavigation({
        contactUuids,
        currentIndex,
        onIndexChange,
        totalCount,
        globalOffset,
        onRequestNextPage,
        onRequestPrevPage,
        hasNextPage,
        hasPrevPage,
    });

    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            const isPrev = event.key === "ArrowUp" || event.key === "ArrowLeft";
            const isNext = event.key === "ArrowDown" || event.key === "ArrowRight";
            if (!isPrev && !isNext) return;

            // Arrow keys belong to whatever the user is typing in or interacting with:
            // notes, selects, and any nested modal (log activity, reminders).
            const target = event.target as HTMLElement | null;
            if (target?.closest("input, textarea, select, [contenteditable], [role='listbox'], [role='menu']")) return;
            const targetDialog = target?.closest("[role='dialog']");
            if (targetDialog && targetDialog !== bodyRef.current?.closest("[role='dialog']")) return;

            event.preventDefault();
            if (isPrev) goPrev();
            else goNext();
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [goNext, goPrev, isOpen]);

    useEffect(() => {
        if (!isOpen) return;

        const prefetchUuid = contactUuids[currentIndex + 1] ?? contactUuids[currentIndex - 1];
        if (!prefetchUuid) return;

        void queryClient.prefetchQuery({
            queryKey: contactsQueryKeys.detail(prefetchUuid),
            queryFn: () => getContact(prefetchUuid),
        });
    }, [contactUuids, currentIndex, isOpen, queryClient]);

    const handleClose = () => onOpenChange(false);

    return (
        <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange} isDismissable>
            <Modal.Container scroll="inside">
                <Modal.Dialog
                    className={cn(
                        "w-full sm:max-w-2xl max-h-[92dvh]",
                        "flex flex-col bg-background overflow-hidden p-0",
                    )}
                >
                    {activeUuid ? (
                        <ContactStackViewerToolbar
                            contactUuid={activeUuid}
                            listUuid={listUuid}
                            navigation={navigation}
                            onClose={handleClose}
                            onPrev={goPrev}
                            onNext={goNext}
                        />
                    ) : null}

                    <div
                        ref={bodyRef}
                        className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain px-4 py-4 sm:px-6"
                    >
                        {activeUuid ? (
                            <ContactCallView key={activeUuid} contactUuid={activeUuid} />
                        ) : (
                            <div className="flex min-h-[30vh] items-center justify-center text-sm text-muted">
                                No contacts to display.
                            </div>
                        )}
                    </div>
                </Modal.Dialog>
            </Modal.Container>
        </Modal.Backdrop>
    );
};
