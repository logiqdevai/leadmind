import type { FC, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface BookingCardProps {
    className?: string;
    children: ReactNode;
    "aria-busy"?: boolean;
}

/** The single centred container of the public booking pages. */
export const BookingCard: FC<BookingCardProps> = ({ className, children, ...rest }) => (
    <article
        className={cn("w-full rounded-2xl border border-border bg-surface p-5 sm:p-8", className)}
        {...rest}
    >
        {children}
    </article>
);
