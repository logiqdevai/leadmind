import { ListBox, Select } from "@heroui/react";

interface PageSizeSelectProps {
    value: string;
    onChange: (value: string) => void;
}

export function PageSizeSelect({ value, onChange }: PageSizeSelectProps) {
    return (
        <Select
            aria-label="Contacts per page"
            value={value}
            onChange={(v) => {
                if (v == null) return;
                onChange(String(v));
            }}
        >
            <Select.Trigger className="min-w-32 h-8 text-xs">
                <Select.Value />
                <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
                <ListBox>
                    <ListBox.Item id="50" textValue="50 contacts">
                        50 contacts
                        <ListBox.ItemIndicator />
                    </ListBox.Item>
                    <ListBox.Item id="100" textValue="100 contacts">
                        100 contacts
                        <ListBox.ItemIndicator />
                    </ListBox.Item>
                    <ListBox.Item id="all" textValue="All contacts">
                        All contacts
                        <ListBox.ItemIndicator />
                    </ListBox.Item>
                </ListBox>
            </Select.Popover>
        </Select>
    );
}
