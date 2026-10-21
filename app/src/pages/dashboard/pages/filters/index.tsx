import { useNavigate, useSearchParams } from "react-router-dom";
import { Button, Input } from "@heroui/react";
import { Plus, Search } from "lucide-react";
import { TagFilterBar } from "@/components/tags/tag-filter-bar";
import { useTagFilterParams } from "@/components/tags/use-tag-filter-params";
import { TablePagination } from "@/components/ui/table-pagination";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useFiltersPage } from "@/features/filters/hooks/use-filters";
import { Routes } from "@/routes/routes";
import { FilterCard } from "./components/filter-card";

const PAGE_SIZE = 18;

export default function FiltersPage() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const page = Math.max(1, Number(searchParams.get("page") ?? 1));
    const search = searchParams.get("search") ?? "";
    const debouncedSearch = useDebouncedValue(search, 300);
    const { state: tagFilter, setState: setTagFilter, query: tagQuery, isActive: tagFilterActive } =
        useTagFilterParams();

    const updateParams = (next: Record<string, string | undefined | null>) => {
        const params = new URLSearchParams(searchParams);
        for (const [k, v] of Object.entries(next)) {
            if (v == null || v === "") params.delete(k);
            else params.set(k, v);
        }
        setSearchParams(params, { replace: true });
    };

    const { data: filtersPage, isLoading, isFetching } = useFiltersPage({
        page,
        limit: PAGE_SIZE,
        search: debouncedSearch || undefined,
        ...tagQuery,
    });
    const filters = filtersPage?.data;
    const isFiltered = !!debouncedSearch || tagFilterActive;

    return (
        <div className="filters-page space-y-4">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <h1 className="text-xl font-semibold text-foreground">Filters</h1>
                    <p className="text-sm text-muted">
                        Configure scheduled scrapes and the channels they create drafts for.
                    </p>
                </div>
                <Button onPress={() => navigate(Routes.dashboard.filters_new)}>
                    <Plus className="size-4" />
                    New filter
                </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-full max-w-sm">
                    <Search className="size-4 text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <Input
                        placeholder="Search filters…"
                        className="pl-9"
                        value={search}
                        onChange={(e) => updateParams({ search: e.target.value, page: "1" })}
                        fullWidth
                    />
                </div>
                <TagFilterBar entityType="FILTER" value={tagFilter} onChange={setTagFilter} />
            </div>

            {isLoading ? (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div
                            key={i}
                            className="h-52 rounded-xl bg-surface-secondary animate-pulse"
                        />
                    ))}
                </div>
            ) : !filters || filters.length === 0 ? isFiltered ? (
                <div className="bg-surface rounded-xl border border-border p-12 text-center text-sm text-muted">
                    No filters match your search or tag filter.
                </div>
            ) : (
                <div className="bg-surface rounded-xl border border-border p-12 text-center flex flex-col items-center gap-2">
                    <p className="text-sm font-medium text-foreground">No filters yet.</p>
                    <p className="text-xs text-muted max-w-sm">
                        Create a filter to start collecting leads from LinkedIn or Google
                        Maps on a schedule.
                    </p>
                    <Button
                        className="mt-2"
                        onPress={() => navigate(Routes.dashboard.filters_new)}
                    >
                        <Plus className="size-4" />
                        Create your first filter
                    </Button>
                </div>
            ) : (
                <>
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        {filters.map((filter) => (
                            <FilterCard key={filter.uuid} filter={filter} />
                        ))}
                    </div>
                    {(filtersPage?.total ?? 0) > PAGE_SIZE && (
                        <TablePagination
                            page={page}
                            totalPages={filtersPage?.totalPages ?? 1}
                            total={filtersPage?.total ?? 0}
                            pageSize={PAGE_SIZE}
                            onPageChange={(p) => updateParams({ page: String(p) })}
                            isFetching={isFetching}
                            isLoading={isLoading}
                            label="filters"
                        />
                    )}
                </>
            )}
        </div>
    );
}
