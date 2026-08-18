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

lockDocumentScroll();
