import { useQuery } from "@tanstack/react-query";
import { confirmUnsubscribe } from "../services/unsubscribe.services";

export function useConfirmUnsubscribe(token: string) {
    return useQuery({
        queryKey: ["unsubscribe", token],
        queryFn: () => confirmUnsubscribe(token),
        enabled: !!token,
        retry: false,
        refetchOnWindowFocus: false,
    });
}
