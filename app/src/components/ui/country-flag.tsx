import { lazy, Suspense, type ComponentType, type FC, type SVGProps } from "react";
import { cn } from "@/lib/utils";

type FlagProps = SVGProps<SVGSVGElement> & { title?: string };

export const FLAG_CLASS = "block h-3.5 w-5 shrink-0 rounded-[3px] shadow-[0_0_0_1px_rgb(0_0_0/0.12)]";

// All ~270 flags live in one lazily loaded chunk, so pages that never show a flag don't download them.
const FlagSet = lazy(async () => {
    const flags = (await import("country-flag-icons/react/3x2")) as unknown as Record<string, ComponentType<FlagProps>>;
    const Flag: FC<FlagProps & { code: string }> = ({ code, ...props }) => {
        const Icon = flags[code];
        return Icon ? <Icon {...props} /> : null;
    };
    return { default: Flag };
});

interface CountryFlagProps {
    /** ISO 3166-1 alpha-2 country code, e.g. "GR". */
    code: string;
    /** Accessible name, e.g. the country name. */
    label?: string;
    className?: string;
}

/** Flag of a country, from the shared icon library. Renders an empty placeholder while the flag set loads. */
export const CountryFlag: FC<CountryFlagProps> = ({ code, label, className }) => (
    <Suspense fallback={<span className={cn(FLAG_CLASS, "bg-surface-secondary", className)} aria-hidden />}>
        <FlagSet code={code.toUpperCase()} title={label} className={cn(FLAG_CLASS, className)} />
    </Suspense>
);
