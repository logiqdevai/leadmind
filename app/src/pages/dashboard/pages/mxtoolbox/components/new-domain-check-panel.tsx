import { useState } from "react";
import { Input, Label } from "@heroui/react";
import { ShieldCheck } from "lucide-react";
import { ActionButtonWithPending } from "@/components/ui/action-button-with-pending";
import { useStartMxToolboxCheck } from "@/features/mxtoolbox/hooks/use-mxtoolbox";
import {
    DEFAULT_DOMAIN_HEALTH_COMMANDS,
    MXTOOLBOX_COMMAND_LABELS,
    MxToolboxCommands,
    type MxToolboxCommand,
} from "@/features/mxtoolbox/interfaces/mxtoolbox.interface";
import { cn } from "@/lib/utils";

const borderedFieldClass = cn(
    "rounded-md border border-border bg-surface-primary",
    "focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40",
);

const ALL_COMMANDS = Object.keys(MxToolboxCommands) as MxToolboxCommand[];

export function NewDomainCheckPanel() {
    const startCheck = useStartMxToolboxCheck();
    const [domain, setDomain] = useState("");
    const [label, setLabel] = useState("");
    const [dkimSelector, setDkimSelector] = useState("");
    const [commands, setCommands] = useState<MxToolboxCommand[]>(DEFAULT_DOMAIN_HEALTH_COMMANDS);
    const [error, setError] = useState<string | null>(null);

    const toggleCommand = (command: MxToolboxCommand) => {
        setCommands((prev) =>
            prev.includes(command) ? prev.filter((c) => c !== command) : [...prev, command],
        );
    };

    const handleRun = async () => {
        const trimmedDomain = domain.trim();
        if (!trimmedDomain) {
            setError("Enter a domain to check.");
            return;
        }
        // DKIM needs a selector to run - rather than blocking the whole check over one
        // unfilled field, drop it from this run and let the rest proceed.
        const skipDkim = commands.includes("DKIM") && !dkimSelector.trim();
        const effectiveCommands = skipDkim ? commands.filter((c) => c !== "DKIM") : commands;
        if (effectiveCommands.length === 0) {
            setError("Select at least one check to run.");
            return;
        }
        setError(null);
        try {
            await startCheck.mutateAsync({
                domain: trimmedDomain,
                ...(label.trim() ? { label: label.trim() } : {}),
                ...(dkimSelector.trim() ? { dkim_selector: dkimSelector.trim() } : {}),
                commands: effectiveCommands,
            });
            setLabel("");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Could not run check.");
        }
    };

    return (
        <div className="rounded-xl border border-border bg-surface p-4 space-y-4">
            <div>
                <h2 className="text-sm font-semibold text-foreground">New domain health check</h2>
                <p className="text-xs text-muted mt-0.5">
                    Runs DNS, email authentication, and blacklist lookups against a domain via
                    MxToolbox - no email needs to be sent.
                </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="mxtoolbox-domain">Domain</Label>
                    <Input
                        id="mxtoolbox-domain"
                        className={borderedFieldClass}
                        value={domain}
                        onChange={(e) => setDomain(e.target.value)}
                        placeholder="example.com"
                        disabled={startCheck.isPending}
                    />
                </div>
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="mxtoolbox-label">Label (optional)</Label>
                    <Input
                        id="mxtoolbox-label"
                        className={borderedFieldClass}
                        value={label}
                        onChange={(e) => setLabel(e.target.value)}
                        placeholder="Before campaign launch"
                        disabled={startCheck.isPending}
                    />
                </div>
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="mxtoolbox-dkim">DKIM selector (optional)</Label>
                    <Input
                        id="mxtoolbox-dkim"
                        className={borderedFieldClass}
                        value={dkimSelector}
                        onChange={(e) => setDkimSelector(e.target.value)}
                        placeholder="default"
                        disabled={startCheck.isPending}
                    />
                </div>
            </div>

            <div>
                <Label>Checks to run</Label>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {ALL_COMMANDS.map((command) => {
                        const active = commands.includes(command);
                        const isDkim = command === "DKIM";
                        return (
                            <button
                                key={command}
                                type="button"
                                disabled={startCheck.isPending}
                                onClick={() => toggleCommand(command)}
                                className={cn(
                                    "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                                    active
                                        ? "border-accent bg-accent/15 text-accent"
                                        : "border-border text-muted hover:text-foreground",
                                )}
                            >
                                {MXTOOLBOX_COMMAND_LABELS[command]}
                                {isDkim && !dkimSelector.trim() ? " *" : ""}
                            </button>
                        );
                    })}
                </div>
                {commands.includes("DKIM") && !dkimSelector.trim() ? (
                    <p className="mt-1 text-xs text-muted">
                        * DKIM will be skipped unless you enter a selector above.
                    </p>
                ) : null}
            </div>

            <div className="flex items-center justify-between gap-2">
                {error ? <p className="text-xs text-danger">{error}</p> : <span />}
                <ActionButtonWithPending
                    isPending={startCheck.isPending}
                    onPress={handleRun}
                    isDisabled={!domain.trim() || commands.length === 0}
                >
                    <ShieldCheck className="size-4" />
                    Run check
                </ActionButtonWithPending>
            </div>
        </div>
    );
}
