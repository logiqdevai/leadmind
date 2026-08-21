import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { TimezoneOptions } from "@/config/constants/dropdowns/timezone.options";
import {
    SendingPeriodUnit,
    type SendingPolicy,
    type UpsertSendingPolicyStagePayload,
} from "../interfaces/sending-policy.interface";
import { validateSendingSchedule } from "../utils/sending-policy-validation";

const DEFAULT_STAGE: UpsertSendingPolicyStagePayload = {
    limit: 30,
    period_unit: SendingPeriodUnit.DAY,
};

export const KNOWN_TIMEZONES: Set<string> = new Set(TimezoneOptions.map((o) => o.value));

export function minutesToTime(minutes: number | null | undefined): string {
    if (minutes == null) return "";
    const h = Math.floor(minutes / 60)
        .toString()
        .padStart(2, "0");
    const m = (minutes % 60).toString().padStart(2, "0");
    return `${h}:${m}`;
}

export function timeToMinutes(value: string): number | undefined {
    if (!value) return undefined;
    const [h, m] = value.split(":").map((v) => Number.parseInt(v, 10));
    if (Number.isNaN(h) || Number.isNaN(m)) return undefined;
    return h * 60 + m;
}

export interface SendingPolicyMeta {
    name: string;
    description?: string;
    timezone: string;
    window_start_minute?: number;
    window_end_minute?: number;
    min_interval_seconds: number;
}

/**
 * Owns all state for the "name/description/window/timezone/interval + stages" form
 * shared by the inline "create new" flow and the standalone policy editor, including
 * feasibility validation. Resets (re-syncing from `initial`, if any) every time `isOpen`
 * transitions from false to true - not merely whenever `initial`'s identity changes -
 * so reopening the editor for the same policy after an unsaved edit re-syncs from the
 * latest server data instead of showing stale in-progress state.
 */
export function useSendingPolicyForm(initial: SendingPolicy | null | undefined, isOpen: boolean) {
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [timezone, setTimezone] = useState("UTC");
    const [windowStart, setWindowStart] = useState("");
    const [windowEnd, setWindowEnd] = useState("");
    const [minIntervalMinutes, setMinIntervalMinutes] = useState("0");
    const [stages, setStages] = useState<UpsertSendingPolicyStagePayload[]>([DEFAULT_STAGE]);
    const wasOpenRef = useRef(false);

    useLayoutEffect(() => {
        if (!isOpen) {
            wasOpenRef.current = false;
            return;
        }
        if (wasOpenRef.current) {
            wasOpenRef.current = isOpen;
            return;
        }
        wasOpenRef.current = isOpen;

        if (initial) {
            setName(initial.name);
            setDescription(initial.description ?? "");
            setTimezone(initial.timezone);
            setWindowStart(minutesToTime(initial.window_start_minute));
            setWindowEnd(minutesToTime(initial.window_end_minute));
            setMinIntervalMinutes(String(Math.round(initial.min_interval_seconds / 60)));
            setStages(
                [...initial.stages]
                    .sort((a, b) => a.order_index - b.order_index)
                    .map((s) => ({
                        limit: s.limit,
                        period_unit: s.period_unit,
                        duration_value: s.duration_value ?? undefined,
                        duration_unit: s.duration_unit ?? undefined,
                    })),
            );
        } else {
            setName("");
            setDescription("");
            const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            setTimezone(browserTimezone && KNOWN_TIMEZONES.has(browserTimezone) ? browserTimezone : "UTC");
            setWindowStart("");
            setWindowEnd("");
            setMinIntervalMinutes("0");
            setStages([DEFAULT_STAGE]);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    const updateStage = (index: number, value: UpsertSendingPolicyStagePayload) => {
        setStages((prev) => prev.map((s, i) => (i === index ? value : s)));
    };

    const removeStage = (index: number) => {
        setStages((prev) => prev.filter((_, i) => i !== index));
    };

    const moveStage = (index: number, direction: -1 | 1) => {
        const target = index + direction;
        if (target < 0 || target >= stages.length) return;
        setStages((prev) => {
            const next = [...prev];
            [next[index], next[target]] = [next[target], next[index]];
            return next;
        });
    };

    const addStage = () => {
        setStages((prev) => [...prev, { limit: prev[prev.length - 1]?.limit ?? 30, period_unit: SendingPeriodUnit.DAY }]);
    };

    const windowStartMinute = timeToMinutes(windowStart);
    const windowEndMinute = timeToMinutes(windowEnd);
    const minIntervalSeconds = Math.max(0, Number.parseInt(minIntervalMinutes, 10) || 0) * 60;
    const { windowOrderError, stageWarnings } = useMemo(
        () => validateSendingSchedule(stages, windowStartMinute, windowEndMinute, minIntervalSeconds),
        [stages, windowStartMinute, windowEndMinute, minIntervalSeconds],
    );

    const timezoneOptions = useMemo(
        () => (KNOWN_TIMEZONES.has(timezone) ? TimezoneOptions : [{ value: timezone, label: timezone }, ...TimezoneOptions]),
        [timezone],
    );

    const isValid = name.trim().length > 0 && stages.length > 0 && !windowOrderError;

    const toMeta = (): SendingPolicyMeta => ({
        name: name.trim(),
        description: description.trim() || undefined,
        timezone: timezone.trim() || "UTC",
        window_start_minute: windowStartMinute,
        window_end_minute: windowEndMinute,
        min_interval_seconds: minIntervalSeconds,
    });

    return {
        name,
        setName,
        description,
        setDescription,
        timezone,
        setTimezone,
        windowStart,
        setWindowStart,
        windowEnd,
        setWindowEnd,
        minIntervalMinutes,
        setMinIntervalMinutes,
        stages,
        addStage,
        updateStage,
        removeStage,
        moveStage,
        windowOrderError,
        stageWarnings,
        timezoneOptions,
        isValid,
        toMeta,
    };
}

export type SendingPolicyFormState = ReturnType<typeof useSendingPolicyForm>;
