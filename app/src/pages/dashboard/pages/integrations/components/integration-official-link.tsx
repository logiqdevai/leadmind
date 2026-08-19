import type { ReactNode } from "react";
import { ExternalLink } from "lucide-react";
import { getIntegrationOfficialUrl } from "@/features/integrations/constants/integration-official-urls";
import type { IntegrationProvider } from "@/features/integrations/interfaces/integrations.interface";
import { cn } from "@/lib/utils";

interface IntegrationOfficialLinkProps {
    provider: IntegrationProvider;
    children: ReactNode;
    className?: string;
}

export function IntegrationOfficialLink({
    provider,
    children,
    className,
}: IntegrationOfficialLinkProps) {
    const href = getIntegrationOfficialUrl(provider);
    if (!href) return children;

    return (
        <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            className={cn(
                "group/official inline-flex items-center gap-1.5 text-inherit no-underline",
                "transition-opacity hover:opacity-70",
                className,
            )}
        >
            {children}
            <ExternalLink className="size-3.5 shrink-0 opacity-40 transition-opacity group-hover/official:opacity-70" />
        </a>
    );
}
