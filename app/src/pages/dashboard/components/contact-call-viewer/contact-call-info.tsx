import type { FC, ReactNode } from "react";
import { Globe, Mail, MapPin, Phone } from "lucide-react";
import type { Contact } from "@/features/contacts/interfaces/contact.interface";
import { ContactInfoType } from "@/features/contacts/constants/contact-info-types.constants";
import { CopyButton } from "@/components/ui/copy-button";
import { EnrichmentSnapshotPanel } from "@/components/ui/enrichment-snapshot-panel";
import { ProfileValue } from "@/components/ui/profile-section";
import { normalizeUrl } from "@/lib/profile";

const LABEL_CLASS = "text-xs font-semibold uppercase tracking-[0.12em] text-muted";

const InfoRow: FC<{ icon: FC<{ className?: string }>; label: string; children: ReactNode }> = ({
    icon: Icon,
    label,
    children,
}) => (
    <div className="flex items-start gap-3 min-w-0">
        <Icon className="size-4 shrink-0 mt-0.5 text-muted" aria-hidden />
        <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium text-muted leading-none mb-1">{label}</p>
            {children}
        </div>
    </div>
);

const CopyableValue: FC<{ value: string | null | undefined; href?: string; label: string }> = ({
    value,
    href,
    label,
}) => {
    const text = value?.trim();
    return (
        <div className="flex items-center gap-2 min-w-0">
            <ProfileValue value={value} href={href} />
            {text ? <CopyButton value={text} label={label} /> : null}
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

export const ContactCallInfo: FC<ContactCallInfoProps> = ({ contact }) => {
    const websiteHref = contact.website?.trim() ? normalizeUrl(contact.website.trim()) : undefined;
    const extraPhones = extraValues(contact, ContactInfoType.PHONE, contact.phone);
    const extraEmails = extraValues(contact, ContactInfoType.EMAIL, contact.email);

    return (
        <div className="flex flex-col gap-4">
            <section className="rounded-2xl border border-border/80 bg-surface/80 p-4 flex flex-col gap-3.5">
                <InfoRow icon={Phone} label="Phone">
                    <div className="flex flex-col gap-1">
                        <CopyableValue
                            value={contact.phone}
                            href={contact.phone?.trim() ? `tel:${contact.phone.trim()}` : undefined}
                            label="phone"
                        />
                        {extraPhones.map((phone) => (
                            <CopyableValue key={phone} value={phone} href={`tel:${phone}`} label="phone" />
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
