import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    addSidebarFavorite,
    listSidebarFavorites,
    removeSidebarFavorite,
    reorderSidebarFavorites,
} from "../services/sidebar-favorites.service";
import type { SidebarFavorite } from "../interfaces/sidebar-favorite.interface";

export const sidebarFavoritesQueryKeys = {
    all: ["sidebar-favorites"] as const,
    list: () => ["sidebar-favorites", "list"] as const,
};

export function useSidebarFavorites() {
    return useQuery({
        queryKey: sidebarFavoritesQueryKeys.list(),
        queryFn: () => listSidebarFavorites(),
        staleTime: 60_000,
    });
}

export function useAddSidebarFavorite() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (nav_key: string) => addSidebarFavorite(nav_key),
        onMutate: async (nav_key) => {
            await qc.cancelQueries({ queryKey: sidebarFavoritesQueryKeys.list() });
            const previous = qc.getQueryData<SidebarFavorite[]>(
                sidebarFavoritesQueryKeys.list(),
            );
            const optimistic: SidebarFavorite = {
                uuid: `optimistic-${nav_key}`,
                nav_key,
                order_index: previous?.length ?? 0,
                created_at: new Date().toISOString(),
            };
            qc.setQueryData<SidebarFavorite[]>(sidebarFavoritesQueryKeys.list(), (old) => [
                ...(old ?? []),
                optimistic,
            ]);
            return { previous };
        },
        // Merge the server-confirmed row in place of the optimistic one instead of
        // invalidating: an invalidate-triggered refetch can land mid-flight of a
        // second concurrent add/remove and briefly wipe it back out of the cache.
        onSuccess: (saved, nav_key) => {
            qc.setQueryData<SidebarFavorite[]>(sidebarFavoritesQueryKeys.list(), (old) => {
                const withoutOptimistic = (old ?? []).filter(
                    (fav) => fav.uuid !== `optimistic-${nav_key}`,
                );
                return [...withoutOptimistic, saved];
            });
        },
        onError: (_error, _nav_key, ctx) => {
            if (ctx?.previous) {
                qc.setQueryData(sidebarFavoritesQueryKeys.list(), ctx.previous);
            }
        },
    });
}

export function useRemoveSidebarFavorite() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (nav_key: string) => removeSidebarFavorite(nav_key),
        onMutate: async (nav_key) => {
            await qc.cancelQueries({ queryKey: sidebarFavoritesQueryKeys.list() });
            const previous = qc.getQueryData<SidebarFavorite[]>(
                sidebarFavoritesQueryKeys.list(),
            );
            qc.setQueryData<SidebarFavorite[]>(sidebarFavoritesQueryKeys.list(), (old) =>
                (old ?? []).filter((fav) => fav.nav_key !== nav_key),
            );
            return { previous };
        },
        onError: (_error, _nav_key, ctx) => {
            if (ctx?.previous) {
                qc.setQueryData(sidebarFavoritesQueryKeys.list(), ctx.previous);
            }
        },
    });
}

export function useReorderSidebarFavorites() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (nav_keys: string[]) => reorderSidebarFavorites(nav_keys),
        onMutate: async (nav_keys) => {
            await qc.cancelQueries({ queryKey: sidebarFavoritesQueryKeys.list() });
            const previous = qc.getQueryData<SidebarFavorite[]>(
                sidebarFavoritesQueryKeys.list(),
            );
            if (previous) {
                const byKey = new Map(previous.map((fav) => [fav.nav_key, fav]));
                const reordered = nav_keys
                    .map((key, index) => {
                        const fav = byKey.get(key);
                        return fav ? { ...fav, order_index: index } : undefined;
                    })
                    .filter((fav): fav is SidebarFavorite => Boolean(fav));
                qc.setQueryData<SidebarFavorite[]>(sidebarFavoritesQueryKeys.list(), reordered);
            }
            return { previous };
        },
        onSuccess: (saved) => {
            qc.setQueryData<SidebarFavorite[]>(sidebarFavoritesQueryKeys.list(), saved);
        },
        onError: (_error, _nav_keys, ctx) => {
            if (ctx?.previous) {
                qc.setQueryData(sidebarFavoritesQueryKeys.list(), ctx.previous);
            }
        },
    });
}
