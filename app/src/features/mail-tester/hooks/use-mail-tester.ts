import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import {
    listMailTesterTests,
    refreshMailTesterTest,
    startMailTesterTest,
} from "../services/mail-tester.service";
import type { CreateMailTesterTestPayload } from "../interfaces/mail-tester.interface";

export const mailTesterQueryKeys = {
    all: ["mail-tester"] as const,
    list: () => ["mail-tester", "list"] as const,
};

export function useMailTesterTests() {
    return useQuery({
        queryKey: mailTesterQueryKeys.list(),
        queryFn: () => listMailTesterTests(),
    });
}

export function useStartMailTesterTest() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (payload: CreateMailTesterTestPayload) => startMailTesterTest(payload),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: mailTesterQueryKeys.all });
            toast({ title: "Test email sent", duration: 1500 });
        },
        onError: (error: Error) => {
            toast({
                title: "Could not start test",
                description: error.message,
                variant: "error",
                duration: 4000,
            });
        },
    });
}

export function useRefreshMailTesterTest() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (uuid: string) => refreshMailTesterTest(uuid),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: mailTesterQueryKeys.all });
        },
        onError: (error: Error) => {
            toast({
                title: "Could not fetch result",
                description: error.message,
                variant: "error",
                duration: 4000,
            });
        },
    });
}
