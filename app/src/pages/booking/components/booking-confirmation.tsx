import { useEffect, useState, type FC } from "react";
import { buttonVariants } from "@heroui/react";
import { CheckCircle2, Hourglass } from "lucide-react";
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
        <div className="flex flex-col items-center gap-6 text-center">
            <span
                className={cn(
                    "flex size-12 items-center justify-center rounded-xl",
                    isPending ? "bg-warning/15 text-warning" : "bg-success/15 text-success",
                )}
            >
                {isPending ? (
                    <Hourglass className="size-6" aria-hidden />
                ) : (
                    <CheckCircle2 className="size-6" aria-hidden />
                )}
            </span>

            <div className="flex flex-col gap-2" role="status">
                <h1 className="text-2xl font-semibold text-foreground">
                    {isPending ? "Request received" : "You're booked"}
                </h1>
                <p className="text-sm text-muted">
                    {isPending
                        ? `Your request for ${booking.title} was sent. You will get an email once it is confirmed.`
                        : `${booking.title} is confirmed. The details are on their way to your inbox.`}
                </p>
            </div>

            <div className="w-full max-w-md rounded-xl bg-surface-secondary/50 p-4 text-left">
                <BookingSummaryList data={booking} />
            </div>

            {confirmation_message ? (
                <p className="max-w-md whitespace-pre-line text-sm text-foreground">{confirmation_message}</p>
            ) : null}

            <div className="flex w-full max-w-md flex-col gap-2 sm:flex-row sm:justify-center">
                <a href={manage_url} className={buttonVariants({ variant: "secondary" })}>
                    Manage booking
                </a>
                {redirect ? (
                    <a href={redirect} className={buttonVariants({ variant: "primary" })}>
                        Continue
                    </a>
                ) : null}
            </div>

            {redirect && secondsLeft > 0 ? (
                <p className="text-xs text-muted" aria-live="polite">
                    Continuing automatically in {secondsLeft} s…
                </p>
            ) : null}
        </div>
    );
};
