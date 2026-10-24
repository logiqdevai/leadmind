import { useRef, useState } from "react";
import { Label, ListBox, Select } from "@heroui/react";

export interface QuickNoteOption {
  id: string;
  label: string;
}

interface QuickNoteSelectProps {
  options: QuickNoteOption[];
  value: string | null;
  onChange: (id: string) => void;
}

/** Dropdown of ready-made notes; clicking the trigger again while it's open closes it. */
export function QuickNoteSelect({ options, value, onChange }: QuickNoteSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const closedAt = useRef(0);

  // Clicking the trigger while open first dismisses the popover (outside press) and then
  // the trigger's own press re-opens it. Ignoring an open that lands right after a close
  // turns that click into a plain toggle.
  const handleOpenChange = (open: boolean) => {
    if (open && Date.now() - closedAt.current < 250) return;
    if (!open) closedAt.current = Date.now();
    setIsOpen(open);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <Label>Quick note</Label>
      <Select
        aria-label="Quick note"
        placeholder="Choose a ready note"
        value={value}
        isOpen={isOpen}
        onOpenChange={handleOpenChange}
        onChange={(key) => key != null && onChange(String(key))}
      >
        <Select.Trigger className="w-full">
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            {options.map((n) => (
              <ListBox.Item key={n.id} id={n.id} textValue={n.label}>
                {n.label}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>
    </div>
  );
}
