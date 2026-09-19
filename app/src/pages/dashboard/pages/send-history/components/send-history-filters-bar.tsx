import { Input, TextField } from "@heroui/react";
import { Search } from "lucide-react";
import { MobileListFilters } from "@/components/ui/mobile-list-filters";
import { FollowUpFilterToggle } from "./follow-up-marker";
import { SendHistoryFiltersForm, type SendHistoryFiltersFormProps } from "./send-history-filters-form";

export type { SendHistoryFilterOption } from "./send-history-filters-form";

interface SendHistoryFiltersBarProps extends SendHistoryFiltersFormProps {
    search: string;
    onSearchChange: (value: string) => void;
    needsFollowUp: boolean;
    onNeedsFollowUpChange: (value: boolean) => void;
}

export function SendHistoryFiltersBar({
    search,
    onSearchChange,
    needsFollowUp,
    onNeedsFollowUpChange,
    ...form
}: SendHistoryFiltersBarProps) {
    return (
        <MobileListFilters
            search={
                <div className="flex items-center gap-2">
                    <div className="relative min-w-0 flex-1">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted pointer-events-none" />
                        <TextField name="search" className="w-full">
                            <Input
                                className="h-8 pl-8 text-[13px]"
                                placeholder="Search name, email, or phone…"
                                value={search}
                                onChange={(e) => onSearchChange(e.target.value)}
                                aria-label="Search by contact name, email, or phone"
                            />
                        </TextField>
                    </div>
                    <FollowUpFilterToggle
                        isActive={needsFollowUp}
                        onToggle={() => onNeedsFollowUpChange(!needsFollowUp)}
                    />
                </div>
            }
            extras={<SendHistoryFiltersForm {...form} />}
        />
    );
}
