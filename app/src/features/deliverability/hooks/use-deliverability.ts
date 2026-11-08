import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import {
    applyDeliverabilityRecommendation,
    createDeliverabilitySchedule,
    deleteDeliverabilitySchedule,
    liftDeliverabilityRestriction,
    listDeliverabilityRuns,
    listDeliverabilitySchedules,
    runDeliverabilityScheduleNow,
    updateDeliverabilitySchedule,
} from "../services/deliverability.service";
import type {
    DeliverabilitySchedulePayload,
    UpdateDeliverabilitySchedulePayload,
} from "../interfaces/deliverability.interface";

export const deliverabilityQueryKeys = {
    all: ["deliverability"] as const,
    schedules: () => ["deliverability", "schedules"] as const,
    runs: (uuid: string) => ["deliverability", "runs", uuid] as const,
};

/** A run finishes in the background (Mail-Tester takes a few minutes), so refresh while any is in flight. */
const RUNNING_POLL_MS = 15_000;

export function useDeliverabilitySchedules() {
    return useQuery({
        queryKey: deliverabilityQueryKeys.schedules(),
        queryFn: listDeliverabilitySchedules,
        refetchInterval: (query) =>
            query.state.data?.some((row) => row.latest_run?.status === "RUNNING")
                ? RUNNING_POLL_MS
                : false,
    });
}

export function useDeliverabilityRuns(uuid: string | null) {
    return useQuery({
        queryKey: deliverabilityQueryKeys.runs(uuid ?? ""),
        queryFn: () => listDeliverabilityRuns(uuid!),
        enabled: Boolean(uuid),
    });
}

function useDeliverabilityMutation<TVars, TData>(
    mutationFn: (vars: TVars) => Promise<TData>,
    messages: { success?: string; error: string },
) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn,
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: deliverabilityQueryKeys.all });
            if (messages.success) toast({ title: messages.success, duration: 1500 });
        },
        onError: (error: Error) => {
            toast({
                title: messages.error,
                description: error.message,
                variant: "error",
                duration: 4000,
            });
        },
    });
}

export const useCreateDeliverabilitySchedule = () =>
    useDeliverabilityMutation(
        (payload: DeliverabilitySchedulePayload) => createDeliverabilitySchedule(payload),
        { success: "Schedule created", error: "Could not create schedule" },
    );

/**
 * Creates one schedule per payload (same settings, different sending target) and reports a single
 * toast. Rejects only when every create failed, so the caller can keep the form open to retry.
 */
export function useCreateDeliverabilitySchedules() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (payloads: DeliverabilitySchedulePayload[]) => {
            const results = await Promise.allSettled(
                payloads.map((payload) => createDeliverabilitySchedule(payload)),
            );
            const failed = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
            if (failed.length === results.length) {
                throw failed[0].reason instanceof Error ? failed[0].reason : new Error("Request failed");
            }
            return { created: results.length - failed.length, failed: failed.length };
        },
        onSuccess: ({ created, failed }) => {
            qc.invalidateQueries({ queryKey: deliverabilityQueryKeys.all });
            if (failed > 0) {
                toast({
                    title: `${created} created, ${failed} failed`,
                    description: "Some accounts could not be scheduled. Check the list and retry those.",
                    variant: "error",
                    duration: 4000,
                });
            } else {
                toast({
                    title: created === 1 ? "Schedule created" : `${created} schedules created`,
                    duration: 1500,
                });
            }
        },
        onError: (error: Error) => {
            qc.invalidateQueries({ queryKey: deliverabilityQueryKeys.all });
            toast({
                title: "Could not create schedule",
                description: error.message,
                variant: "error",
                duration: 4000,
            });
        },
    });
}

export const useUpdateDeliverabilitySchedule = () =>
    useDeliverabilityMutation(
        (vars: { uuid: string; payload: UpdateDeliverabilitySchedulePayload }) =>
            updateDeliverabilitySchedule(vars.uuid, vars.payload),
        { success: "Schedule updated", error: "Could not update schedule" },
    );

export const useDeleteDeliverabilitySchedule = () =>
    useDeliverabilityMutation((uuid: string) => deleteDeliverabilitySchedule(uuid), {
        success: "Schedule deleted",
        error: "Could not delete schedule",
    });

export const useRunDeliverabilityScheduleNow = () =>
    useDeliverabilityMutation((uuid: string) => runDeliverabilityScheduleNow(uuid), {
        success: "Check queued",
        error: "Could not queue check",
    });

export const useLiftDeliverabilityRestriction = () =>
    useDeliverabilityMutation((uuid: string) => liftDeliverabilityRestriction(uuid), {
        success: "Sending restriction lifted",
        error: "Could not lift restriction",
    });

export const useApplyDeliverabilityRecommendation = () =>
    useDeliverabilityMutation((runUuid: string) => applyDeliverabilityRecommendation(runUuid), {
        success: "Send cap applied",
        error: "Could not apply recommendation",
    });
