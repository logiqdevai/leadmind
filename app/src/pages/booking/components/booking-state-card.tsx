import type { FC, ReactNode } from "react";
import { CalendarX2 } from "lucide-react";
import { BookingCard } from "@/pages/booking/components/booking-card";

interface BookingStateCardProps {
    title: string;
    description: ReactNode;
    action?: ReactNode;
    icon?: ReactNode;
}

/** Friendly full-card message: unknown link, load failure and similar dead ends. */
export const BookingStateCard: FC<BookingStateCardProps> = ({ title, description, action, icon }) => (
    <BookingCard className="mx-auto max-w-md text-center">
        <div className="flex flex-col items-center gap-3">
            <span className="flex size-12 items-center justify-center rounded-xl bg-surface-secondary text-muted">
                {icon ?? <CalendarX2 className="size-6" aria-hidden />}
            </span>
            <h1 className="text-xl font-semibold text-foreground">{title}</h1>
            <div className="text-sm text-muted">{description}</div>
            {action ? <div className="mt-2">{action}</div> : null}
        </div>
    </BookingCard>
);
