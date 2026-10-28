import type { CSSProperties, FC, ReactNode } from "react";
import { cn } from "@/lib/utils";

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/** Relative luminance check so light brand colours get dark text on filled buttons. */
const isLightColor = (hex: string): boolean => {
    const channel = (offset: number) => {
        const c = parseInt(hex.slice(offset, offset + 2), 16) / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    const luminance = 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
    return luminance > 0.45;
};

// HeroUI declares the `--color-*` tokens as `var(--accent)` on :root, so they are resolved once there and
// overriding `--accent` in a subtree alone never reaches `bg-accent` / `text-accent`. Each derived token
// is therefore re-declared here against the brand colour.
const BRAND_TOKENS = [
    "[--accent:var(--booking-accent)]",
    "[--focus:var(--booking-accent)]",
    "[--color-accent:var(--booking-accent)]",
    "[--color-focus:var(--booking-accent)]",
    "[--color-accent-hover:color-mix(in_oklab,var(--booking-accent)90%,var(--color-accent-foreground)10%)]",
    "[--color-accent-soft:color-mix(in_oklab,var(--booking-accent)15%,transparent)]",
    "[--color-accent-soft-hover:color-mix(in_oklab,var(--booking-accent)20%,transparent)]",
    "[--color-accent-soft-foreground:var(--booking-accent)]",
].join(" ");

const LIGHT_BRAND_FOREGROUND = "[--accent-foreground:oklch(0.2_0.01_240)] [--color-accent-foreground:oklch(0.2_0.01_240)]";

interface BookingBrandScopeProps {
    color: string | null | undefined;
    className?: string;
    children: ReactNode;
}

/** Applies the booking page's brand colour to everything accent-coloured inside it. */
export const BookingBrandScope: FC<BookingBrandScopeProps> = ({ color, className, children }) => {
    const brand = color && HEX_COLOR.test(color) ? color : null;

    // Inline styles are avoided project-wide. The one exception: the brand colour comes from the
    // API at runtime, so it is published as a single CSS custom property here. The Tailwind
    // arbitrary properties below re-point HeroUI's --accent / --focus tokens at it, so primary
    // buttons, the selected calendar day and focus rings in this subtree use the brand colour.
    const style = brand ? ({ "--booking-accent": brand } as CSSProperties) : undefined;

    return (
        <div
            style={style}
            className={cn(
                brand && BRAND_TOKENS,
                brand && isLightColor(brand) && LIGHT_BRAND_FOREGROUND,
                className,
            )}
        >
            {children}
        </div>
    );
};
