import { useState, type FC } from "react";
import { Button, Input } from "@heroui/react";
import { Plus, Search, Workflow } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { TagFilterBar } from "@/components/tags/tag-filter-bar";
import { useTagFilterParams } from "@/components/tags/use-tag-filter-params";
import { TablePagination } from "@/components/ui/table-pagination";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useDeleteSequence, useSequencesPage } from "@/features/sequences/hooks/use-sequences";
import type { OutreachSequence } from "@/features/sequences/interfaces/sequence.interface";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Routes } from "@/routes/routes";
import { SequencesTable } from "./components/sequences-table";

const PAGE_SIZE = 20;

const SequencesPage: FC = () => {
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

    const { data: sequencesPage, isLoading, isFetching } = useSequencesPage({
        page,
        limit: PAGE_SIZE,
        search: debouncedSearch || undefined,
        ...tagQuery,
    });
    const sequences = sequencesPage?.data ?? [];
    const deleteMut = useDeleteSequence();
    const [deleteTarget, setDeleteTarget] = useState<OutreachSequence | null>(null);

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                    <Workflow className="size-5 text-muted" />
                    <div>
                        <h1 className="text-xl font-semibold text-foreground">Sequences</h1>
                        <p className="text-sm text-muted">
                            Multi-step Email/SMS drips with configurable delays between messages.
                        </p>
                    </div>
                </div>
                <Button size="sm" onPress={() => navigate(Routes.dashboard.sequences_new)}>
                    <Plus className="size-3.5" />
                    New sequence
                </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-full max-w-sm">
                    <Search className="size-4 text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <Input
                        placeholder="Search sequences…"
                        className="pl-9"
                        value={search}
                        onChange={(e) => updateParams({ search: e.target.value, page: "1" })}
                        fullWidth
                    />
                </div>
                <TagFilterBar entityType="SEQUENCE" value={tagFilter} onChange={setTagFilter} />
            </div>

            {isLoading ? (
                <div className="h-48 rounded-xl bg-surface-secondary animate-pulse" />
            ) : (
                <>
                    <SequencesTable
                        sequences={sequences}
                        onDelete={setDeleteTarget}
                        isFiltered={!!debouncedSearch || tagFilterActive}
                    />
                    {(sequencesPage?.total ?? 0) > PAGE_SIZE && (
                        <TablePagination
                            page={page}
                            totalPages={sequencesPage?.totalPages ?? 1}
                            total={sequencesPage?.total ?? 0}
                            pageSize={PAGE_SIZE}
                            onPageChange={(p) => updateParams({ page: String(p) })}
                            isFetching={isFetching}
                            isLoading={isLoading}
                            label="sequences"
                        />
                    )}
                </>
            )}

            <ConfirmDialog
                isOpen={!!deleteTarget}
                onOpenChange={(open) => !open && setDeleteTarget(null)}
                title="Delete sequence?"
                description="This cannot be undone. Sequences with active enrollments or in-use campaigns cannot be deleted."
                confirmLabel="Delete"
                variant="danger"
                isPending={deleteMut.isPending}
                onConfirm={async () => {
                    if (!deleteTarget) return;
                    await deleteMut.mutateAsync(deleteTarget.uuid);
                    setDeleteTarget(null);
                }}
            />
        </div>
    );
};

export default SequencesPage;
