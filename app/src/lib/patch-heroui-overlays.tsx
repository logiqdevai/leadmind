import { type ComponentType } from "react";
import {
    Autocomplete,
    ComboBox,
    DatePicker,
    DateRangePicker,
    Dropdown,
    Popover,
    Select,
} from "@heroui/react";

function withNonModal<T>(Component: T): T {
    const Comp = Component as ComponentType<Record<string, unknown> & { isNonModal?: boolean }>;
    function Wrapped(props: Record<string, unknown>) {
        return <Comp {...props} isNonModal />;
    }
    Object.assign(Wrapped, {
        displayName:
            (Component as { displayName?: string }).displayName ??
            (Component as { name?: string }).name,
    });
    return Wrapped as T;
}

Select.Popover = withNonModal(Select.Popover);
Dropdown.Popover = withNonModal(Dropdown.Popover);
ComboBox.Popover = withNonModal(ComboBox.Popover);
Autocomplete.Popover = withNonModal(Autocomplete.Popover);
DatePicker.Popover = withNonModal(DatePicker.Popover);
DateRangePicker.Popover = withNonModal(DateRangePicker.Popover);
Popover.Content = withNonModal(Popover.Content);

const OPEN_POPOVER_SELECTOR = [
    ".select__popover",
    ".dropdown__popover",
    ".popover",
    ".combo-box__popover",
    ".autocomplete__popover",
    ".date-picker__popover",
    ".date-range-picker__popover",
    "[data-portaled-menu]",
].join(",");

function isDismissButton(button: HTMLButtonElement): boolean {
    return button.tabIndex === -1 && (button.style.width === "1px" || button.style.height === "1px");
}

function closePopover(popover: Element): void {
    const buttons = popover.querySelectorAll("button");
    for (let i = buttons.length - 1; i >= 0; i -= 1) {
        const button = buttons[i];
        if (button instanceof HTMLButtonElement && isDismissButton(button)) {
            button.click();
            return;
        }
    }
    popover.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
}

function dismissOverlaysOnOutsidePointer(): void {
    if (typeof window === "undefined") return;

    document.addEventListener(
        "pointerdown",
        (event) => {
            const target = event.target;
            if (!(target instanceof Element)) return;
            if (target.closest(OPEN_POPOVER_SELECTOR)) return;
            if (target.closest('[aria-expanded="true"]')) return;

            const popovers = document.querySelectorAll(OPEN_POPOVER_SELECTOR);
            for (const popover of popovers) {
                closePopover(popover);
            }
        },
        true,
    );
}

function lockDocumentScroll() {
    if (typeof window === "undefined") return;

    const reset = () => {
        const html = document.documentElement;
        const body = document.body;
        if (html.scrollTop !== 0) html.scrollTop = 0;
        if (body.scrollTop !== 0) body.scrollTop = 0;
        if (window.scrollY !== 0 || window.scrollX !== 0) {
            window.scrollTo(0, 0);
        }
    };

    reset();
    window.addEventListener("scroll", reset, true);

    const nativeFocus = HTMLElement.prototype.focus;
    HTMLElement.prototype.focus = function focus(options?: FocusOptions) {
        nativeFocus.call(this, {
            ...options,
            preventScroll: options?.preventScroll ?? true,
        });
    };

    const nativeScrollIntoView = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function scrollIntoView(
        arg?: boolean | ScrollIntoViewOptions,
    ) {
        const htmlTop = document.documentElement.scrollTop;
        const bodyTop = document.body.scrollTop;
        nativeScrollIntoView.call(this, arg);
        document.documentElement.scrollTop = htmlTop;
        document.body.scrollTop = bodyTop;
    };
}

const OPEN_BLOCKING_OVERLAY_SELECTOR = [
    ".drawer[data-open]:not([data-exiting])",
    ".modal[data-open]:not([data-exiting])",
    ".alert-dialog[data-open]:not([data-exiting])",
].join(",");

function restorePageInteractivity(): void {
    const root = document.getElementById("root");
    const hasBlockingOverlay = Boolean(document.querySelector(OPEN_BLOCKING_OVERLAY_SELECTOR));

    document.body.style.removeProperty("pointer-events");
    document.documentElement.style.removeProperty("pointer-events");

    if (hasBlockingOverlay) return;

    document.body.removeAttribute("inert");
    document.documentElement.removeAttribute("inert");
    if (root) {
        root.removeAttribute("inert");
        if (root.getAttribute("aria-hidden") === "true") {
            root.removeAttribute("aria-hidden");
        }
    }
}

function restoreInteractivityAfterOverlayClose(): void {
    if (typeof window === "undefined") return;

    const scheduleRestore = () => {
        requestAnimationFrame(restorePageInteractivity);
        window.setTimeout(restorePageInteractivity, 0);
        window.setTimeout(restorePageInteractivity, 350);
    };

    document.addEventListener("pointerup", scheduleRestore, true);
    document.addEventListener("keyup", (event) => {
        if (event.key === "Escape") scheduleRestore();
    }, true);
}

function findVerticalScroller(start: Element, boundary: Element): HTMLElement {
    let node: Element | null = start;
    while (node && boundary.contains(node)) {
        if (node instanceof HTMLElement) {
            const style = window.getComputedStyle(node);
            const overflowY = style.overflowY;
            if (
                (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") &&
                node.scrollHeight > node.clientHeight
            ) {
                return node;
            }
        }
        if (node === boundary) break;
        node = node.parentElement;
    }
    return boundary instanceof HTMLElement ? boundary : (boundary.parentElement as HTMLElement);
}

function isolateOverlayWheel(): void {
    if (typeof window === "undefined") return;

    document.addEventListener(
        "wheel",
        (event) => {
            const target = event.target;
            if (!(target instanceof Element)) return;
            const panel = target.closest(OPEN_POPOVER_SELECTOR);
            if (!panel) return;

            const scroller = findVerticalScroller(target, panel);
            if (scroller.scrollHeight > scroller.clientHeight) {
                scroller.scrollTop += event.deltaY;
            }
            event.preventDefault();
            event.stopPropagation();
        },
        { capture: true, passive: false },
    );
}

lockDocumentScroll();
dismissOverlaysOnOutsidePointer();
restoreInteractivityAfterOverlayClose();
isolateOverlayWheel();
