import type { FC } from "react";
import { Button, Spinner } from "@heroui/react";
import { FileSpreadsheet } from "lucide-react";

interface ExportExcelButtonProps {
    onPress: () => void;
    isPending?: boolean;
    isDisabled?: boolean;
}

export const ExportExcelButton: FC<ExportExcelButtonProps> = ({
    onPress,
    isPending = false,
    isDisabled = false,
}) => (
    <Button
        size="sm"
        variant="secondary"
        onPress={onPress}
        isDisabled={isDisabled || isPending}
        aria-label="Download Excel"
    >
        {isPending ? (
            <Spinner size="sm" color="current" className="size-4 shrink-0" />
        ) : (
            <FileSpreadsheet className="size-4" />
        )}
        <span className="hidden sm:inline">Download Excel</span>
    </Button>
);
