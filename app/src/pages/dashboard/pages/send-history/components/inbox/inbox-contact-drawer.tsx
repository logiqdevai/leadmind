import { Drawer } from "@heroui/react";
import { ContactDetailView } from "@/pages/dashboard/pages/contacts/pages/detail/components";

interface InboxContactDrawerProps {
    contactUuid: string | null;
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
}

export function InboxContactDrawer({ contactUuid, isOpen, onOpenChange }: InboxContactDrawerProps) {
    return (
        <Drawer.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
            <Drawer.Content placement="right">
                <Drawer.Dialog className="w-full sm:max-w-2xl lg:max-w-3xl">
                    <Drawer.CloseTrigger />
                    <Drawer.Header>
                        <Drawer.Heading>Contact details</Drawer.Heading>
                    </Drawer.Header>
                    <Drawer.Body>
                        {contactUuid ? (
                            <ContactDetailView contactUuid={contactUuid} showDelete={false} />
                        ) : null}
                    </Drawer.Body>
                </Drawer.Dialog>
            </Drawer.Content>
        </Drawer.Backdrop>
    );
}
