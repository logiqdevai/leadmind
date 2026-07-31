import { useState } from "react";
import { AlertDialog, Button } from "@heroui/react";
import { AlertTriangle, AtSign, Pencil, Plus, Trash2 } from "lucide-react";
import { ActionButtonWithPending } from "@/components/ui/action-button-with-pending";
import { SectionCard } from "@/components/ui/profile-section";
import {
    CONTACT_INFO_TYPE_LABELS,
    ContactInfoType,
} from "@/features/contacts/constants/contact-info-types.constants";
import type { ContactInfo } from "@/features/contacts/interfaces/contact.interface";
import { useDeleteContactInfo } from "@/features/contacts/hooks/use-contacts";
import { normalizeUrl } from "@/lib/profile";
import { ContactInfoFormModal } from "./contact-info-form-modal";

interface ContactInfosSectionProps {
    contactUuid: string;
    infos: ContactInfo[];
}

function contactInfoHref(info: ContactInfo): string | undefined {
    const value = info.value.trim();
    if (!value) return undefined;

    switch (info.type) {
        case ContactInfoType.EMAIL:
            return `mailto:${value}`;
        case ContactInfoType.PHONE:
        case ContactInfoType.SMS:
        case ContactInfoType.WHATSAPP:
            return `tel:${value.replace(/\s+/g, "")}`;
        case ContactInfoType.WEBSITE:
        case ContactInfoType.LINKEDIN:
        case ContactInfoType.FACEBOOK:
        case ContactInfoType.INSTAGRAM:
        case ContactInfoType.TWITTER:
        case ContactInfoType.YOUTUBE:
        case ContactInfoType.GOOGLE_MAPS:
            return normalizeUrl(value);
        case ContactInfoType.TELEGRAM:
            if (value.startsWith("http")) return normalizeUrl(value);
            if (value.startsWith("@")) return `https://t.me/${value.slice(1)}`;
            return `https://t.me/${value}`;
        default:
            if (value.startsWith("http")) return normalizeUrl(value);
            return undefined;
    }
}

export function ContactInfosSection({ contactUuid, infos }: ContactInfosSectionProps) {
    const deleteInfo = useDeleteContactInfo(contactUuid);
    const [formOpen, setFormOpen] = useState(false);
    const [editing, setEditing] = useState<ContactInfo | null>(null);
    const [deleting, setDeleting] = useState<ContactInfo | null>(null);

    const openCreate = () => {
        setEditing(null);
        setFormOpen(true);
    };

    const openEdit = (info: ContactInfo) => {
        setEditing(info);
        setFormOpen(true);
    };

    return (
        <>
            <SectionCard title="Contact info" icon={AtSign}>
                <div className="flex justify-end">
                    <Button size="sm" variant="secondary" onPress={openCreate}>
                        <Plus className="size-3.5" />
                        Add
                    </Button>
                </div>
                {infos.length === 0 ? (
                    <p className="px-1 text-sm text-muted">
                        No contact info yet. Add emails, phones, or social links.
                    </p>
                ) : (
                    <ul className="divide-y divide-border/50">
                        {infos.map((info) => {
                            const href = contactInfoHref(info);
                            const isDirectLink =
                                info.type === ContactInfoType.EMAIL ||
                                info.type === ContactInfoType.PHONE ||
                                info.type === ContactInfoType.SMS ||
                                info.type === ContactInfoType.WHATSAPP;
                            return (
                                <li
                                    key={info.uuid}
                                    className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
                                >
                                    <div className="min-w-0 flex-1">
                                        <p className="text-xs font-medium uppercase tracking-wide text-muted">
                                            {CONTACT_INFO_TYPE_LABELS[info.type]}
                                        </p>
                                        {href ? (
                                            <a
                                                href={href}
                                                target={isDirectLink ? undefined : "_blank"}
                                                rel={isDirectLink ? undefined : "noopener noreferrer"}
                                                className="block truncate text-sm text-foreground hover:text-accent hover:underline"
                                            >
                                                {info.value}
                                            </a>
                                        ) : (
                                            <p className="truncate text-sm text-foreground">
                                                {info.value}
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex shrink-0 items-center gap-1">
                                        <Button
                                            size="sm"
                                            variant="tertiary"
                                            aria-label="Edit contact info"
                                            onPress={() => openEdit(info)}
                                        >
                                            <Pencil className="size-3.5" />
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="tertiary"
                                            aria-label="Delete contact info"
                                            onPress={() => setDeleting(info)}
                                        >
                                            <Trash2 className="size-3.5 text-danger" />
                                        </Button>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </SectionCard>

            <ContactInfoFormModal
                contactUuid={contactUuid}
                isOpen={formOpen}
                onOpenChange={(open) => {
                    setFormOpen(open);
                    if (!open) setEditing(null);
                }}
                editing={editing}
            />

            <AlertDialog.Backdrop
                isOpen={!!deleting}
                onOpenChange={(open) => {
                    if (!open) setDeleting(null);
                }}
            >
                <AlertDialog.Container>
                    <AlertDialog.Dialog className="sm:max-w-md">
                        <AlertDialog.Header>
                            <AlertDialog.Icon status="danger">
                                <AlertTriangle className="size-5" />
                            </AlertDialog.Icon>
                            <AlertDialog.Heading>Delete contact info?</AlertDialog.Heading>
                        </AlertDialog.Header>
                        <AlertDialog.Body>
                            <p className="text-sm text-muted">
                                Remove{" "}
                                <span className="font-medium text-foreground">
                                    {deleting
                                        ? `${CONTACT_INFO_TYPE_LABELS[deleting.type]} · ${deleting.value}`
                                        : ""}
                                </span>
                                ?
                            </p>
                        </AlertDialog.Body>
                        <AlertDialog.Footer>
                            <Button
                                slot="close"
                                variant="secondary"
                                isDisabled={deleteInfo.isPending}
                            >
                                Cancel
                            </Button>
                            <ActionButtonWithPending
                                variant="danger"
                                isDisabled={deleteInfo.isPending}
                                isPending={deleteInfo.isPending}
                                onPress={() => {
                                    if (!deleting) return;
                                    deleteInfo.mutate(deleting.uuid, {
                                        onSuccess: () => setDeleting(null),
                                    });
                                }}
                            >
                                Delete
                            </ActionButtonWithPending>
                        </AlertDialog.Footer>
                    </AlertDialog.Dialog>
                </AlertDialog.Container>
            </AlertDialog.Backdrop>
        </>
    );
}
