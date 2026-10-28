import type { FC } from "react";
import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

const STEP_LABEL_KEYS = ["booking.stepper.pick", "booking.stepper.details", "booking.stepper.confirmation"] as const;

interface BookingStepperProps {
    /** 1-based index of the active step. */
    current: number;
}

/**
 * Three-step progress indicator. Every step takes an equal column and the connectors run from one
 * circle centre to the next, so spacing stays even at any width. Done steps show a check, the
 * active one has a ring.
 */
export const BookingStepper: FC<BookingStepperProps> = ({ current }) => {
    const { t } = useTranslation();

    return (
        <ol aria-label={t("booking.stepper.label")} className="flex w-full items-start">
            {STEP_LABEL_KEYS.map((key, index) => {
                const number = index + 1;
                const isDone = number < current;
                const isActive = number === current;
                const isLast = index === STEP_LABEL_KEYS.length - 1;
                return (
                    <li
                        key={key}
                        aria-current={isActive ? "step" : undefined}
                        className="flex min-w-0 flex-1 flex-col items-center gap-2"
                    >
                        <div className="relative flex h-9 w-full items-center justify-center sm:h-10">
                            {isLast ? null : (
                                <span
                                    aria-hidden
                                    className={cn(
                                        "absolute left-1/2 top-1/2 h-0.5 w-full -translate-y-1/2 rounded-full transition-colors duration-300",
                                        isDone ? "bg-accent" : "bg-border",
                                    )}
                                />
                            )}
                            <span
                                className={cn(
                                    "relative z-10 flex size-9 items-center justify-center rounded-full text-sm font-semibold transition-all duration-300 sm:size-10",
                                    isDone && "bg-accent text-accent-foreground",
                                    isActive && "bg-accent text-accent-foreground ring-4 ring-accent/20",
                                    !isDone && !isActive && "border border-border bg-surface text-muted",
                                )}
                            >
                                {isDone ? <Check className="size-4 sm:size-5" strokeWidth={3} aria-hidden /> : number}
                            </span>
                        </div>
                        <span
                            className={cn(
                                "w-full px-1 text-center text-xs leading-tight sm:text-sm",
                                isActive ? "font-semibold text-accent" : isDone ? "font-medium text-foreground" : "text-muted",
                            )}
                        >
                            {t(key)}
                        </span>
                    </li>
                );
            })}
        </ol>
    );
};
