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
            <SectionCard
                title="Contact info"
                icon={AtSign}
                action={
                    <Button size="sm" variant="tertiary" onPress={openCreate}>
                        <Plus className="size-3.5" />
                        Add
                    </Button>
                }
            >
                {infos.length === 0 ? (
                    <button
                        type="button"
                        onClick={openCreate}
                        className="flex w-full flex-col items-center gap-1 rounded-xl border border-dashed border-border/80 px-4 py-6 text-center transition-colors hover:border-accent/40 hover:bg-accent/5"
                    >
                        <span className="text-sm font-medium text-foreground">
                            Add contact info
                        </span>
                        <span className="text-xs text-muted">
                            Email, phone, social links, and more
                        </span>
                    </button>
                ) : (
                    <ul className="space-y-1">
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
                                    className="grid grid-cols-1 gap-1 rounded-lg px-2 py-2 transition-colors hover:bg-surface-secondary/60 sm:grid-cols-[6.5rem_minmax(0,1fr)_auto] sm:items-center sm:gap-3"
                                >
                                    <p className="truncate text-xs font-medium text-muted">
                                        {CONTACT_INFO_TYPE_LABELS[info.type]}
                                    </p>
                                    {href ? (
                                        <a
                                            href={href}
                                            target={isDirectLink ? undefined : "_blank"}
                                            rel={
                                                isDirectLink
                                                    ? undefined
                                                    : "noopener noreferrer"
                                            }
                                            className="min-w-0 truncate text-sm font-medium text-foreground hover:text-link hover:underline"
                                        >
                                            {info.value}
                                        </a>
                                    ) : (
                                        <p className="min-w-0 truncate text-sm font-medium text-foreground">
                                            {info.value}
                                        </p>
                                    )}
                                    <div className="flex shrink-0 items-center gap-0.5 justify-end sm:justify-start">
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
