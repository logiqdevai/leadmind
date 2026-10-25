import type { FC } from "react";
import { Chip } from "@heroui/react";
import { CALENDAR_CONNECTION_STATUS_LABELS } from "@/features/bookings/constants/booking-labels";
import {
    CalendarConnectionStatuses,
    type CalendarConnectionStatus,
} from "@/features/bookings/interfaces/bookings.interfaces";

const STATUS_COLORS: Record<CalendarConnectionStatus, "default" | "success" | "warning" | "danger"> = {
    [CalendarConnectionStatuses.INITIATED]: "warning",
    [CalendarConnectionStatuses.ACTIVE]: "success",
    [CalendarConnectionStatuses.EXPIRED]: "warning",
    [CalendarConnectionStatuses.FAILED]: "danger",
    [CalendarConnectionStatuses.DISCONNECTED]: "default",
};

interface ConnectionStatusChipProps {
    /** null = never connected. */
    status: CalendarConnectionStatus | null;
}

export const ConnectionStatusChip: FC<ConnectionStatusChipProps> = ({ status }) => (
    <Chip size="sm" variant="soft" color={status ? STATUS_COLORS[status] : "default"}>
        <Chip.Label>{status ? CALENDAR_CONNECTION_STATUS_LABELS[status] : "Not connected"}</Chip.Label>
    </Chip>
);
