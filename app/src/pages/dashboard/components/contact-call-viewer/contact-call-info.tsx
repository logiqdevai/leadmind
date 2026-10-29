import { useState, type FC, type ReactNode } from "react";
import { Button, Form, Input, Label } from "@heroui/react";
import { Globe, Mail, MapPin, Pencil, Phone, User } from "lucide-react";
import { ActionButtonWithPending } from "@/components/ui/action-button-with-pending";
import { useUpdateContact } from "@/features/contacts/hooks/use-contacts";
import type { Contact, UpdateContactPayload } from "@/features/contacts/interfaces/contact.interface";
import { ContactInfoType } from "@/features/contacts/constants/contact-info-types.constants";
import { CopyButton } from "@/components/ui/copy-button";
import { EnrichmentSnapshotPanel } from "@/components/ui/enrichment-snapshot-panel";
import { ProfileValue } from "@/components/ui/profile-section";
import { normalizeUrl } from "@/lib/profile";

const LABEL_CLASS = "text-xs font-semibold uppercase tracking-[0.12em] text-muted";

const InfoRow: FC<{
    icon: FC<{ className?: string }>;
    label: string;
    children: ReactNode;
}> = ({ icon: Icon, label, children }) => (
    <div className="flex items-start gap-3 min-w-0">
        <Icon className="size-4 shrink-0 mt-0.5 text-muted" aria-hidden />
        <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium text-muted leading-none mb-1">{label}</p>
            {children}
        </div>
    </div>
);

const CopyableValue: FC<{
    value: string | null | undefined;
    href?: string;
    label: string;
}> = ({ value, href, label }) => {
    const text = value?.trim();
    return (
        <div className="flex items-center gap-2 min-w-0">
            <ProfileValue value={value} href={href} />
            {text ? <CopyButton value={text} label={label} /> : null}
        </div>
    );
};

// Dialers want digits (and a leading +) only; spaces/parens/dashes can break tel: links on some devices.
const toTelHref = (phone: string) => `tel:${phone.trim().replace(/(?!^\+)[^\d]/g, "")}`;

const PhoneValue: FC<{ value: string | null | undefined }> = ({ value }) => {
    const text = value?.trim();
    if (!text) return <ProfileValue value={value} />;
    return (
        <div className="flex items-center gap-2 min-w-0">
            {/* No target="_blank": it would open a blank tab instead of the dialer on mobile. */}
            <a
                href={toTelHref(text)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-accent/10 px-2.5 py-1.5 text-sm font-semibold text-accent hover:bg-accent/15 active:bg-accent/20 transition-colors break-all"
                aria-label={`Call ${text}`}
            >
                <Phone className="size-3.5 shrink-0" aria-hidden />
                {text}
            </a>
            <CopyButton value={text} label="phone" />
        </div>
    );
};

const extraValues = (contact: Contact, type: ContactInfoType, primary: string | null | undefined) => {
    const seen = new Set([primary?.trim().toLowerCase()]);
    return (contact.contact_infos ?? [])
        .filter((info) => info.type === type)
        .map((info) => info.value.trim())
        .filter((value) => {
            const key = value.toLowerCase();
            if (!value || seen.has(key)) return false;
            seen.add(key);
            return true;
        });
};

interface ContactCallInfoProps {
    contact: Contact;
}

/** Contacts store one `name`; the first word is shown as first name, the rest as last name. */
const splitName = (name: string | null | undefined) => {
    const trimmed = name?.trim() ?? "";
    const space = trimmed.indexOf(" ");
    return space === -1
        ? { first: trimmed, last: "" }
        : { first: trimmed.slice(0, space), last: trimmed.slice(space + 1).trim() };
};

const ContactDetailsEditor: FC<{ contact: Contact; onDone: () => void }> = ({ contact, onDone }) => {
    const updateContact = useUpdateContact();
    const initial = splitName(contact.name);
    const [first, setFirst] = useState(initial.first);
    const [last, setLast] = useState(initial.last);
    const [phone, setPhone] = useState(contact.phone ?? "");
    const [email, setEmail] = useState(contact.email ?? "");

    const save = () => {
        const payload: UpdateContactPayload = {};
        const name = [first.trim(), last.trim()].filter(Boolean).join(" ");
        if (name !== (contact.name?.trim() ?? "")) payload.name = name || null;
        if (phone.trim() !== (contact.phone ?? "")) payload.phone = phone.trim() || null;
        if (email.trim() !== (contact.email ?? "")) payload.email = email.trim() || null;
        if (!Object.keys(payload).length) return onDone();
        updateContact.mutate({ uuid: contact.uuid, payload }, { onSuccess: onDone });
    };

    return (
        <Form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={(e) => {
                e.preventDefault();
                save();
            }}
        >
            <div className="flex flex-col gap-1.5">
                <Label htmlFor="cc-first">First name</Label>
                <Input id="cc-first" value={first} onChange={(e) => setFirst(e.target.value)} autoFocus />
            </div>
            <div className="flex flex-col gap-1.5">
                <Label htmlFor="cc-last">Last name</Label>
                <Input id="cc-last" value={last} onChange={(e) => setLast(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
                <Label htmlFor="cc-phone">Phone</Label>
                <Input id="cc-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
                <Label htmlFor="cc-email">Email</Label>
                <Input id="cc-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2 sm:col-span-2">
                <Button type="button" size="sm" variant="tertiary" onPress={onDone}>
                    Cancel
                </Button>
                <ActionButtonWithPending
                    type="submit"
                    size="sm"
                    isDisabled={updateContact.isPending}
                    isPending={updateContact.isPending}
                >
                    Save
                </ActionButtonWithPending>
            </div>
        </Form>
    );
};

export const ContactCallInfo: FC<ContactCallInfoProps> = ({ contact }) => {
    const [editing, setEditing] = useState(false);
    const websiteHref = contact.website?.trim() ? normalizeUrl(contact.website.trim()) : undefined;
    const extraPhones = extraValues(contact, ContactInfoType.PHONE, contact.phone);
    const extraEmails = extraValues(contact, ContactInfoType.EMAIL, contact.email);

    return (
        <div className="flex flex-col gap-4">
            <section className="rounded-2xl border border-border/80 bg-surface/80 p-4 flex flex-col gap-3.5">
                <div className="flex items-center justify-between gap-2">
                    <h3 className={LABEL_CLASS}>Details</h3>
                    {!editing ? (
                        <Button size="sm" variant="tertiary" onPress={() => setEditing(true)}>
                            <Pencil className="size-3.5" />
                            Edit
                        </Button>
                    ) : null}
                </div>
                {editing ? (
                    <ContactDetailsEditor contact={contact} onDone={() => setEditing(false)} />
                ) : (
                    <>
                        <InfoRow icon={User} label="Name">
                            <ProfileValue value={contact.name} />
                        </InfoRow>
                        <InfoRow icon={Phone} label="Phone">
                            <div className="flex flex-col gap-1">
                                <PhoneValue value={contact.phone} />
                                {extraPhones.map((phone) => (
                                    <PhoneValue key={phone} value={phone} />
                                ))}
                            </div>
                        </InfoRow>
                        <InfoRow icon={Mail} label="Email">
                            <div className="flex flex-col gap-1">
                                <CopyableValue
                                    value={contact.email}
                                    href={contact.email?.trim() ? `mailto:${contact.email.trim()}` : undefined}
                                    label="email"
                                />
                                {extraEmails.map((email) => (
                                    <CopyableValue key={email} value={email} href={`mailto:${email}`} label="email" />
                                ))}
                            </div>
                        </InfoRow>
                        <InfoRow icon={Globe} label="Website">
                            <CopyableValue value={contact.website} href={websiteHref} label="website" />
                        </InfoRow>
                        <InfoRow icon={MapPin} label="Address">
                            <ProfileValue value={contact.location} />
                        </InfoRow>
                    </>
                )}
            </section>

            <section className="flex flex-col gap-2">
                <h3 className={LABEL_CLASS}>Latest enrichment</h3>
                <EnrichmentSnapshotPanel
                    summary={contact.enrichment_summary ?? contact.lead.enrichment_summary}
                    metadata={contact.enrichment_metadata ?? contact.lead.enrichment_metadata}
                    scrollClassName="max-h-48"
                />
            </section>
        </div>
    );
};
