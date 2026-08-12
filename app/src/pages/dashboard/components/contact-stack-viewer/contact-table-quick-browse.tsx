import type { FC, ReactNode } from "react";
import { Button } from "@heroui/react";
import { ChevronsUpDown, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { Routes } from "@/routes/routes";

interface ContactTableNameCellProps {
    contactUuid: string;
    name: string | null | undefined;
    onOpen?: (contactUuid: string) => void;
}

export const ContactTableNameCell: FC<ContactTableNameCellProps> = ({
    contactUuid,
    name,
    onOpen,
}) => {
    const label = name ?? "—";

    if (onOpen) {
        return (
            <button
                type="button"
                title={name ?? undefined}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                    e.stopPropagation();
                    onOpen(contactUuid);
                }}
                className="block w-full min-w-0 truncate text-left font-medium text-foreground hover:text-accent transition-colors"
            >
                {label}
            </button>
        );
    }

    return (
        <span title={name ?? undefined} className="block w-full min-w-0 truncate font-medium text-foreground">
            {label}
        </span>
    );
};

interface ContactTableQuickViewButtonProps {
    contactUuid: string;
    contactName: string | null | undefined;
    onOpen?: (contactUuid: string) => void;
}

export const ContactTableQuickViewButton: FC<ContactTableQuickViewButtonProps> = ({
    contactUuid,
    contactName,
    onOpen,
}) => {
    if (!onOpen) return null;

    return (
        <Button
            size="sm"
            variant="tertiary"
            onPress={() => onOpen(contactUuid)}
            aria-label={`Quick view ${contactName ?? "contact"}`}
        >
            <ChevronsUpDown className="size-3.5" />
        </Button>
    );
};

interface ContactTableDetailLinkProps {
    contactUuid: string;
    contactName: string | null | undefined;
    children?: ReactNode;
}

export const ContactTableDetailLink: FC<ContactTableDetailLinkProps> = ({
    contactUuid,
    contactName,
    children,
}) => {
    const detailHref = Routes.dashboard.contacts_detail.replace(":uuid", contactUuid);

    return (
        <Link
            to={detailHref}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            aria-label={`Open ${contactName ?? "contact"} in full page`}
            className="inline-flex items-center justify-center rounded-md p-1.5 text-muted hover:text-accent hover:bg-surface-secondary transition-colors"
        >
            {children ?? <ExternalLink className="size-3.5" />}
        </Link>
    );
};
