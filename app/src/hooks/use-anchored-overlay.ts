import { type CSSProperties, type RefObject, useLayoutEffect, useState } from "react";

const PANEL_MAX_HEIGHT = 280;
const MIN_BELOW = 140;
const OVERLAY_SELECTOR = '.modal[data-open], .drawer[data-open], [role="dialog"]';

function containingBounds(el: HTMLElement): DOMRect {
    const overlay = el.closest(OVERLAY_SELECTOR);
    if (overlay instanceof HTMLElement) return overlay.getBoundingClientRect();
    return new DOMRect(0, 0, window.innerWidth, window.innerHeight);
}

export function isInsideOverlay(el: HTMLElement | null): boolean {
    return Boolean(el?.closest(OVERLAY_SELECTOR));
}

export function useAnchoredOverlay(
    open: boolean,
    anchorRef: RefObject<HTMLElement | null>,
): CSSProperties {
    const [style, setStyle] = useState<CSSProperties>({});

    useLayoutEffect(() => {
        if (!open) return;

        const update = () => {
            const el = anchorRef.current;
            if (!el) return;
            const r = el.getBoundingClientRect();
            const box = containingBounds(el);
            const spaceBelow = box.bottom - r.bottom - 8;
            const spaceAbove = r.top - box.top - 8;
            const placeAbove = spaceBelow < MIN_BELOW && spaceAbove > spaceBelow;
            const maxHeight = Math.max(
                96,
                Math.min(PANEL_MAX_HEIGHT, placeAbove ? spaceAbove : spaceBelow),
            );

            setStyle({
                position: "fixed",
                left: Math.max(box.left + 8, r.left),
                width: Math.min(Math.max(r.width, 160), box.right - r.left - 8),
                zIndex: 100050,
                maxHeight,
                ...(placeAbove
                    ? { bottom: window.innerHeight - r.top + 4 }
                    : { top: r.bottom + 4 }),
            });
        };

        update();
        window.addEventListener("resize", update);
        document.addEventListener("scroll", update, true);
        return () => {
            window.removeEventListener("resize", update);
            document.removeEventListener("scroll", update, true);
        };
    }, [open, anchorRef]);

    return style;
}
