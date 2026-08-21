import {
    Children,
    createContext,
    isValidElement,
    useContext,
    useMemo,
    type ComponentProps,
    type FC,
    type ReactNode,
} from "react";
import { Tabs } from "@heroui/react";
import { cn } from "@/lib/utils";

export const tabListClassName =
    "inline-flex w-fit max-w-full min-w-0 gap-1 rounded-lg bg-surface-secondary p-1 border border-border *:w-fit";

export const tabTriggerClassName =
    "shrink-0 w-fit whitespace-nowrap px-3 py-1.5 text-sm font-medium rounded-md cursor-pointer transition-colors text-muted hover:text-foreground data-[selected]:bg-accent data-[selected]:text-accent-foreground data-[selected]:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent";

const mobileTabClassName =
    "flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg px-2 text-[13px] font-medium leading-none tracking-[-0.01em] transition-colors";

interface TabNavContextValue {
    selectedKey: string;
    onSelect: (key: string) => void;
}

const TabNavContext = createContext<TabNavContextValue | null>(null);

function collectTabItems(children: ReactNode): { id: string; node: ReactNode }[] {
    return Children.toArray(children).flatMap((child) => {
        if (!isValidElement<{ id?: string; children?: ReactNode }>(child)) return [];
        if (child.props.id == null) return [];
        return [{ id: String(child.props.id), node: child.props.children }];
    });
}

interface ScrollableTabsListProps {
    children: ReactNode;
    className?: string;
}

export const ScrollableTabsList: FC<ScrollableTabsListProps> = ({ children, className }) => {
    const nav = useContext(TabNavContext);
    const items = useMemo(() => collectTabItems(children), [children]);

    return (
        <>
            <div
                className="grid w-full max-w-full grid-cols-2 gap-1.5 lg:hidden"
                role="tablist"
                aria-orientation="vertical"
            >
                {items.map((item) => {
                    const selected = nav?.selectedKey === item.id;
                    return (
                        <button
                            key={item.id}
                            type="button"
                            role="tab"
                            aria-selected={selected}
                            className={cn(
                                mobileTabClassName,
                                selected
                                    ? "bg-accent text-accent-foreground shadow-sm"
                                    : "bg-surface-secondary text-muted border border-border",
                            )}
                            onClick={() => nav?.onSelect(item.id)}
                        >
                            {item.node}
                        </button>
                    );
                })}
            </div>
            <Tabs.ListContainer className="hidden w-fit max-w-full min-w-0 overflow-x-auto lg:block">
                <Tabs.List className={cn(tabListClassName, className)}>{children}</Tabs.List>
            </Tabs.ListContainer>
        </>
    );
};

type TabsRootProps = ComponentProps<typeof Tabs>;

export const ScrollableTabs: FC<TabsRootProps> = ({ className, children, ...props }) => {
    const selectedKey = props.selectedKey != null ? String(props.selectedKey) : "";
    const onSelect = (key: string) => {
        props.onSelectionChange?.(key);
    };

    return (
        <TabNavContext.Provider value={{ selectedKey, onSelect }}>
            <Tabs {...props} className={cn("flex w-fit max-w-full min-w-0 flex-col", className)}>
                {children}
            </Tabs>
        </TabNavContext.Provider>
    );
};
