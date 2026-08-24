import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import {
    listMxToolboxChecks,
    rerunMxToolboxCheck,
    runMxToolboxAiAudit,
    startMxToolboxCheck,
} from "../services/mxtoolbox.service";
import type { CreateMxToolboxCheckPayload } from "../interfaces/mxtoolbox.interface";

export const mxToolboxQueryKeys = {
    all: ["mxtoolbox"] as const,
    list: () => ["mxtoolbox", "list"] as const,
};

export function useMxToolboxChecks() {
    return useQuery({
        queryKey: mxToolboxQueryKeys.list(),
        queryFn: () => listMxToolboxChecks(),
    });
}

export function useStartMxToolboxCheck() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (payload: CreateMxToolboxCheckPayload) => startMxToolboxCheck(payload),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: mxToolboxQueryKeys.all });
            toast({ title: "Domain health check started", duration: 1500 });
        },
        onError: (error: Error) => {
            toast({
                title: "Could not run check",
                description: error.message,
                variant: "error",
                duration: 4000,
            });
        },
    });
}

export function useRerunMxToolboxCheck() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (uuid: string) => rerunMxToolboxCheck(uuid),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: mxToolboxQueryKeys.all });
        },
        onError: (error: Error) => {
            toast({
                title: "Could not re-run check",
                description: error.message,
                variant: "error",
                duration: 4000,
            });
        },
    });
}

export function useRunMxToolboxAiAudit() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (uuid: string) => runMxToolboxAiAudit(uuid),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: mxToolboxQueryKeys.all });
        },
        onError: (error: Error) => {
            toast({
                title: "Could not run AI audit",
                description: error.message,
                variant: "error",
                duration: 4000,
            });
        },
    });
}
