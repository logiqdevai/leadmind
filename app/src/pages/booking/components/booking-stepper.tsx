import type { FC } from "react";
import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

const STEP_LABEL_KEYS = ["booking.stepper.pick", "booking.stepper.details", "booking.stepper.confirmation"] as const;

interface BookingStepperProps {
    /** 1-based index of the active step. */
    current: number;
}

/** Three-step progress indicator: done steps show a check, the active one is highlighted. */
export const BookingStepper: FC<BookingStepperProps> = ({ current }) => {
    const { t } = useTranslation();

    return (
        <ol aria-label={t("booking.stepper.label")} className="flex items-start">
            {STEP_LABEL_KEYS.map((key, index) => {
                const number = index + 1;
                const isDone = number < current;
                const isActive = number === current;
                return (
                    <li
                        key={key}
                        aria-current={isActive ? "step" : undefined}
                        className={cn("flex items-start", index < STEP_LABEL_KEYS.length - 1 && "flex-1")}
                    >
                        <div className="flex w-20 flex-col items-center gap-2 sm:w-32">
                            <span
                                className={cn(
                                    "flex size-9 items-center justify-center rounded-full text-sm font-semibold sm:size-10",
                                    isDone || isActive
                                        ? "bg-accent text-accent-foreground"
                                        : "bg-surface-tertiary text-muted",
                                )}
                            >
                                {isDone ? <Check className="size-4" strokeWidth={3} aria-hidden /> : number}
                            </span>
                            <span
                                className={cn(
                                    "text-center text-xs leading-tight sm:text-sm",
                                    isActive ? "font-semibold text-accent" : isDone ? "text-foreground" : "text-muted",
                                )}
                            >
                                {t(key)}
                            </span>
                        </div>
                        {index < STEP_LABEL_KEYS.length - 1 ? (
                            <span
                                aria-hidden
                                className={cn(
                                    "mx-1 mt-[1.1rem] h-0.5 flex-1 rounded-full sm:mt-5",
                                    isDone ? "bg-accent" : "bg-border",
                                )}
                            />
                        ) : null}
                    </li>
                );
            })}
        </ol>
    );
};
