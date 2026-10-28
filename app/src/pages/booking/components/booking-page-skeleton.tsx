import type { FC } from "react";
import { Skeleton } from "@heroui/react";
import { useTranslation } from "react-i18next";
import { BookingCard } from "@/pages/booking/components/booking-card";

export const BookingPageSkeleton: FC = () => {
    const { t } = useTranslation();
    return (
    <BookingCard aria-busy>
        <span className="sr-only" role="status">
            {t("booking.loading")}
        </span>
        <div className="grid gap-8 md:grid-cols-[16rem_minmax(0,1fr)]">
            <div className="flex flex-col gap-3">
                <Skeleton className="size-10 rounded-xl" />
                <Skeleton className="h-6 w-3/4 rounded-lg" />
                <Skeleton className="h-4 w-full rounded-lg" />
                <Skeleton className="h-4 w-2/3 rounded-lg" />
                <Skeleton className="mt-2 h-4 w-1/2 rounded-lg" />
            </div>
            <div className="flex flex-col gap-4">
                <Skeleton className="h-10 w-full rounded-xl" />
                <div className="grid gap-6 md:grid-cols-[18rem_minmax(0,1fr)]">
                    <Skeleton className="aspect-square w-full max-w-sm rounded-2xl" />
                    <div className="grid grid-cols-2 content-start gap-2">
                        {Array.from({ length: 6 }, (_, i) => (
                            <Skeleton key={i} className="h-10 rounded-xl" />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    </BookingCard>
    );
};
