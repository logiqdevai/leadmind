import { useEffect, useState, type FC } from "react";
import { buttonVariants } from "@heroui/react";
import { ArrowRight, CalendarDays, Check, Hourglass } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
    BookingStatuses,
    type PublicBookingResult,
} from "@/features/bookings/interfaces/bookings.interfaces";
import { cn } from "@/lib/utils";
import { isSafeRedirectUrl } from "@/pages/booking/utils/booking-dates";
import { BookingSummaryList } from "@/pages/booking/components/booking-summary-list";

const REDIRECT_SECONDS = 5;

interface BookingConfirmationProps {
    result: PublicBookingResult;
}

export const BookingConfirmation: FC<BookingConfirmationProps> = ({ result }) => {
    const { t } = useTranslation();
    const { booking, manage_url, confirmation_message, redirect_url } = result;
    const isPending = booking.status === BookingStatuses.PENDING;
    const redirect = isSafeRedirectUrl(redirect_url) ? redirect_url : null;
    const [secondsLeft, setSecondsLeft] = useState(REDIRECT_SECONDS);

    useEffect(() => {
        if (!redirect) return;
        const timer = window.setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
        return () => window.clearInterval(timer);
    }, [redirect]);

    useEffect(() => {
        if (redirect && secondsLeft === 0) window.location.assign(redirect);
    }, [redirect, secondsLeft]);

    return (
        <div className="flex flex-col items-center gap-8 text-center">
            <span
                aria-hidden
                className={cn(
                    "flex size-28 items-center justify-center rounded-full ring-1",
                    isPending ? "bg-warning/10 ring-warning/20" : "bg-accent/10 ring-accent/20",
                )}
            >
                <span
                    className={cn(
                        "flex size-20 items-center justify-center rounded-full",
                        isPending ? "bg-warning/20" : "bg-accent/20",
                    )}
                >
                    <span
                        className={cn(
                            "flex size-14 items-center justify-center rounded-full",
                            isPending ? "bg-warning text-warning-foreground" : "bg-accent text-accent-foreground",
                        )}
                    >
                        {isPending ? (
                            <Hourglass className="size-7" />
                        ) : (
                            <Check className="size-8" strokeWidth={3} />
                        )}
                    </span>
                </span>
            </span>

            <div className="flex flex-col gap-2" role="status">
                <h1 className="text-3xl font-bold text-foreground sm:text-4xl">
                    {isPending ? t("booking.confirmation.requestReceived") : t("booking.confirmation.booked")}
                </h1>
                <p className="text-base text-muted">
                    {isPending
                        ? t("booking.confirmation.pendingText", { title: booking.title })
                        : t("booking.confirmation.confirmedText", { title: booking.title })}
                </p>
            </div>

            <div className="w-full max-w-xl rounded-2xl border border-border bg-surface p-6 text-left">
                <BookingSummaryList data={booking} />
            </div>

            {confirmation_message ? (
                <p className="max-w-xl whitespace-pre-line text-sm text-foreground">{confirmation_message}</p>
            ) : null}

            <div className="flex w-full max-w-xl flex-col items-center gap-3 sm:flex-row sm:justify-center">
                <a href={manage_url} className={buttonVariants({ variant: "primary", size: "lg" })}>
                    <CalendarDays className="size-5" aria-hidden />
                    {t("booking.confirmation.manage")}
                    <ArrowRight className="size-5" aria-hidden />
                </a>
                {redirect ? (
                    <a href={redirect} className={buttonVariants({ variant: "secondary", size: "lg" })}>
                        {t("booking.confirmation.continue")}
                    </a>
                ) : null}
            </div>

            {redirect && secondsLeft > 0 ? (
                <p className="text-xs text-muted" aria-live="polite">
                    {t("booking.confirmation.continuing", { seconds: secondsLeft })}
                </p>
            ) : null}
        </div>
    );
};
