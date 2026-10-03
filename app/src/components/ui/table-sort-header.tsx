import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

type SortDirection = "ascending" | "descending" | undefined;

interface SortableColumnHeaderProps {
    children: ReactNode;
    direction: SortDirection;
}

export function SortableColumnHeader({ children, direction }: SortableColumnHeaderProps) {
    return (
        <span className="inline-flex items-center gap-1">
            {children}
            {direction === "ascending" ? (
                <ArrowUp className="size-3.5 shrink-0" />
            ) : direction === "descending" ? (
                <ArrowDown className="size-3.5 shrink-0" />
            ) : (
                <ArrowUpDown className="size-3.5 shrink-0 opacity-40" />
            )}
        </span>
    );
}
