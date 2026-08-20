import { useState, type FC, type ReactNode } from "react";
import { Button } from "@heroui/react";
import { ChevronDown, Filter } from "lucide-react";
import { cn } from "@/lib/utils";

interface MobileListFiltersProps {
  search: ReactNode;
  extras: ReactNode;
  className?: string;
}

export const MobileListFilters: FC<MobileListFiltersProps> = ({
  search,
  extras,
  className,
}) => {
  const [open, setOpen] = useState(false);
  const hasExtras = extras != null;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">{search}</div>
        {hasExtras ? (
        <Button
          size="sm"
          variant="secondary"
          className="shrink-0 lg:hidden"
          onPress={() => setOpen((value) => !value)}
        >
          <Filter className="size-3.5" />
          Filters
          <ChevronDown
            className={cn("size-3.5 transition-transform", open && "rotate-180")}
          />
        </Button>
        ) : null}
      </div>
      {hasExtras ? (
      <div
        className={cn(
          "flex flex-wrap items-center gap-2",
          open ? "flex" : "hidden lg:flex",
        )}
      >
        {extras}
      </div>
      ) : null}
    </div>
  );
};

export function extraListColumnClass(columnId: string, extraIds: readonly string[]): string {
  if (extraIds.includes(columnId)) return "hidden lg:table-cell min-w-0";
  if (columnId === "actions") return "w-36 whitespace-nowrap pl-2 pr-3 lg:pr-4";
  return "min-w-0 overflow-hidden";
}
