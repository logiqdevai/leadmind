import type { FC, ReactNode } from "react";
import { ContactCallViewerModal } from "../contact-call-viewer/contact-call-viewer-modal";
import { ContactStackViewerModal } from "./contact-stack-viewer-modal";
import { useContactStackViewer } from "@/pages/dashboard/hooks/use-contact-stack-viewer";

export interface ContactStackViewerControls {
    openAt: (contactUuid: string) => void;
    openFirst: () => void;
    hasContacts: boolean;
}

interface ContactStackViewerScopeProps {
    contactUuids: string[];
    listUuid?: string;
    /** "call" opens the compact cold-calling modal instead of the full contact detail. */
    variant?: "full" | "call";
    page: number;
    totalPages: number;
    pageSize: number;
    totalCount: number;
    onPageChange: (page: number) => void;
    children: (controls: ContactStackViewerControls) => ReactNode;
}

export const ContactStackViewerScope: FC<ContactStackViewerScopeProps> = ({
    contactUuids,
    listUuid,
    variant = "full",
    page,
    totalPages,
    pageSize,
    totalCount,
    onPageChange,
    children,
}) => {
    const stackViewer = useContactStackViewer({
        contactUuids,
        page,
        totalPages,
        pageSize,
        onPageChange,
    });

    const controls: ContactStackViewerControls = {
        openAt: stackViewer.openAt,
        openFirst: () => {
            const firstUuid = contactUuids[0];
            if (firstUuid) stackViewer.openAt(firstUuid);
        },
        hasContacts: contactUuids.length > 0,
    };

    const Modal = variant === "call" ? ContactCallViewerModal : ContactStackViewerModal;

    return (
        <>
            {children(controls)}
            <Modal
                isOpen={stackViewer.isOpen}
                onOpenChange={stackViewer.setIsOpen}
                contactUuids={contactUuids}
                listUuid={listUuid}
                activeUuid={stackViewer.activeUuid}
                currentIndex={stackViewer.currentIndex}
                onIndexChange={stackViewer.setCurrentIndex}
                totalCount={totalCount}
                globalOffset={stackViewer.globalOffset}
                onRequestNextPage={stackViewer.handleRequestNextPage}
                onRequestPrevPage={stackViewer.handleRequestPrevPage}
                hasNextPage={stackViewer.hasNextPage}
                hasPrevPage={stackViewer.hasPrevPage}
            />
        </>
    );
};
