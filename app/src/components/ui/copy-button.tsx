import { useState } from "react";
import { Button } from "@heroui/react";
import { Check, Copy } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export function CopyButton({ value, label }: { value: string; label: string }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        if (!value) return;
        try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            toast({ title: `Copied ${label}`, variant: "success", duration: 1500 });
            window.setTimeout(() => setCopied(false), 1200);
        } catch {
            toast({ title: "Couldn't copy to clipboard", variant: "error" });
        }
    };

    return (
        <span
            className="inline-flex shrink-0"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            role="presentation"
        >
            <Button
                size="sm"
                variant="ghost"
                isDisabled={!value}
                onPress={handleCopy}
                aria-label={`Copy ${label}`}
                className="shrink-0 min-w-7 h-7 px-1"
            >
                {copied ? (
                    <Check className="size-3.5 text-accent" />
                ) : (
                    <Copy className="size-3.5 text-muted" />
                )}
            </Button>
        </span>
    );
}
