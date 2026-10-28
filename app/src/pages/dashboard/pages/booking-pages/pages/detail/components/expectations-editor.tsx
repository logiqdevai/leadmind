import { useState, type FC } from "react";
import { Button, Input } from "@heroui/react";
import { Check, Plus, X } from "lucide-react";

const MAX_ITEMS = 8;
const MAX_LENGTH = 120;

interface ExpectationsEditorProps {
    value: string[];
    onChange: (value: string[]) => void;
    readOnly: boolean;
}

/** Editable list of short "What to expect" points shown on the public booking page. */
export const ExpectationsEditor: FC<ExpectationsEditorProps> = ({ value, onChange, readOnly }) => {
    const [draft, setDraft] = useState("");
    const trimmed = draft.trim();
    const canAdd = trimmed.length > 0 && value.length < MAX_ITEMS && !value.includes(trimmed);
    const add = () => {
        if (!canAdd) return;
        onChange([...value, trimmed]);
        setDraft("");
    };

    return (
        <div className="space-y-2">
            {value.length > 0 ? (
                <ul className="space-y-1.5">
                    {value.map((item, index) => (
                        <li key={`${item}-${index}`} className="flex items-center gap-2">
                            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                                <Check className="size-3" strokeWidth={3} aria-hidden />
                            </span>
                            <Input
                                aria-label={`Expectation ${index + 1}`}
                                value={item}
                                maxLength={MAX_LENGTH}
                                disabled={readOnly}
                                onChange={(e) => onChange(value.map((v, i) => (i === index ? e.target.value : v)))}
                                fullWidth
                            />
                            {!readOnly ? (
                                <Button
                                    isIconOnly
                                    size="sm"
                                    variant="tertiary"
                                    aria-label={`Remove expectation ${index + 1}`}
                                    onPress={() => onChange(value.filter((_, i) => i !== index))}
                                >
                                    <X className="size-4" />
                                </Button>
                            ) : null}
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="text-xs text-muted">No points yet. The section is hidden on the public page.</p>
            )}
            {!readOnly ? (
                <div className="flex items-center gap-2">
                    <Input
                        aria-label="Add what to expect"
                        placeholder="e.g. Short introduction"
                        value={draft}
                        maxLength={MAX_LENGTH}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                e.preventDefault();
                                add();
                            }
                        }}
                        className="w-full sm:max-w-sm"
                    />
                    <Button size="sm" variant="secondary" isDisabled={!canAdd} onPress={add}>
                        <Plus className="size-3.5" />
                        Add
                    </Button>
                </div>
            ) : null}
        </div>
    );
};
