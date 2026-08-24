import { useSearchParams } from "react-router-dom";
import { Chip, ListBox, Select, Table } from "@heroui/react";
import {
    AlertTriangle,
    CheckCircle2,
    Clock,
    Loader2,
    ListTodo,
    XCircle,
} from "lucide-react";
import { useBulkJobs } from "@/features/bulk-jobs/hooks/use-bulk-jobs";
import {
    BulkJobStatus,
    BulkJobType,
    type BulkJob,
} from "@/features/bulk-jobs/interfaces/bulk-job.interface";
import { TablePagination } from "@/components/ui/table-pagination";
import { MobileListFilters } from "@/components/ui/mobile-list-filters";

const PAGE_LIMIT = 20;

type ChipColor = "default" | "accent" | "success" | "warning" | "danger";

const STATUS_META: Record<
    BulkJobStatus,
    { label: string; color: ChipColor; icon: React.ComponentType<{ className?: string }> }
> = {
    PENDING: { label: "Pending", color: "default", icon: Clock },
    QUEUED: { label: "Queued", color: "accent", icon: Clock },
    RUNNING: { label: "Running", color: "warning", icon: Loader2 },
    COMPLETED: { label: "Completed", color: "success", icon: CheckCircle2 },
    FAILED: { label: "Failed", color: "danger", icon: AlertTriangle },
    CANCELLED: { label: "Cancelled", color: "default", icon: XCircle },
};

const TYPE_LABELS: Record<BulkJobType, string> = {
    CONTACT_EMAIL_SCRAPE: "Email scrape",
    FILTER_SCRAPE: "Filter scrape",
    CONTACT_SCORE: "Contact score",
    CONTACT_ENRICH: "Contact enrich",
    LEAD_ENRICH: "Lead enrich",
    AI_DRAFT_MESSAGES: "AI draft messages",
    CAMPAIGN_DISPATCH: "Campaign dispatch",
    CAMPAIGN_MESSAGE_SEND: "Campaign send",
    OPENAI_BATCH: "OpenAI batch",
    OTHER: "Other",
};

function formatDate(iso: string | null): string {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function formatProgress(job: BulkJob): string {
    if (!job.progress_total) return "—";
    return `${job.progress_current}/${job.progress_total}`;
}

function StatusChip({ status }: { status: BulkJobStatus }) {
    const { label, color, icon: Icon } = STATUS_META[status];
    return (
        <Chip size="sm" variant="soft" color={color}>
            <Icon className={`size-3 ${status === BulkJobStatus.RUNNING ? "animate-spin" : ""}`} />
            <Chip.Label>{label}</Chip.Label>
        </Chip>
    );
}

function FilterSelect({
    label,
    value,
    options,
    onChange,
}: {
    label: string;
    value: string;
    options: { key: string; label: string }[];
    onChange: (key: string) => void;
}) {
    return (
        <Select
            aria-label={label}
            placeholder={label}
            value={value || null}
            onChange={(v) => onChange(v != null ? String(v) : "")}
        >
            <Select.Trigger className="min-w-36 h-8 text-xs">
                <Select.Value />
                <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
                <ListBox>
                    <ListBox.Item key="" id="" textValue={label}>
                        {label}
                        <ListBox.ItemIndicator />
                    </ListBox.Item>
                    {options.map((o) => (
                        <ListBox.Item key={o.key} id={o.key} textValue={o.label}>
                            {o.label}
                            <ListBox.ItemIndicator />
                        </ListBox.Item>
                    ))}
                </ListBox>
            </Select.Popover>
        </Select>
    );
}

export default function JobsPage() {
    const [searchParams, setSearchParams] = useSearchParams();

    const page = Math.max(1, Number(searchParams.get("page") ?? 1));
    const typeFilter = (searchParams.get("type") as BulkJobType) || undefined;
    const statusFilter = (searchParams.get("status") as BulkJobStatus) || undefined;
    const scope = searchParams.get("scope") ?? "all";
    const activeOnly = scope !== "all" && !statusFilter;

    const { data, isLoading } = useBulkJobs({
        page,
        limit: PAGE_LIMIT,
        type: typeFilter,
        status: statusFilter,
        active_only: activeOnly,
    });

    const setParam = (key: string, value: string) => {
        setSearchParams(
            (prev) => {
                const next = new URLSearchParams(prev);
                if (value) next.set(key, value);
                else next.delete(key);
                next.delete("page");
                return next;
            },
            { replace: true },
        );
    };

    const setScope = (value: string) => {
        setSearchParams(
            (prev) => {
                const next = new URLSearchParams(prev);
                if (value === "all") next.set("scope", "all");
                else next.delete("scope");
                next.delete("status");
                next.delete("page");
                return next;
            },
            { replace: true },
        );
    };

    const setPage = (p: number) => {
        setSearchParams(
            (prev) => {
                const next = new URLSearchParams(prev);
                next.set("page", String(p));
                return next;
            },
            { replace: true },
        );
    };

    const totalPages = Math.ceil((data?.total ?? 0) / PAGE_LIMIT);

    return (
        <div className="space-y-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2.5">
                    <ListTodo className="size-5 text-muted shrink-0" />
                    <div>
                        <h1 className="text-lg font-semibold text-foreground leading-tight">Jobs</h1>
                        <p className="text-xs text-muted mt-0.5">
                            {data?.total ?? "—"} {scope === "all" || statusFilter ? "jobs" : "active jobs"}
                        </p>
                    </div>
                </div>

                <MobileListFilters
                    search={
                    <FilterSelect
                        label="Active only"
                        value={statusFilter ? "" : scope === "all" ? "all" : "active"}
                        options={[
                            { key: "active", label: "Active only" },
                            { key: "all", label: "All jobs" },
                        ]}
                        onChange={(v) => setScope(v === "all" ? "all" : "active")}
                    />
                    }
                    extras={
                        <>
                    <FilterSelect
                        label="All types"
                        value={typeFilter ?? ""}
                        options={Object.entries(TYPE_LABELS).map(([key, label]) => ({ key, label }))}
                        onChange={(v) => setParam("type", v)}
                    />
                    <FilterSelect
                        label="All statuses"
                        value={statusFilter ?? ""}
                        options={Object.keys(STATUS_META).map((s) => ({
                            key: s,
                            label: STATUS_META[s as BulkJobStatus].label,
                        }))}
                        onChange={(v) => {
                            setSearchParams(
                                (prev) => {
                                    const next = new URLSearchParams(prev);
                                    if (v) {
                                        next.set("status", v);
                                        next.set("scope", "all");
                                    } else {
                                        next.delete("status");
                                    }
                                    next.delete("page");
                                    return next;
                                },
                                { replace: true },
                            );
                        }}
                    />
                        </>
                    }
                />
            </div>

            <div className="rounded-xl overflow-hidden">
                <Table>
                    <Table.ScrollContainer className="w-full max-w-full overflow-x-hidden">
                        <Table.Content aria-label="Jobs" className="w-full table-fixed">
                            <Table.Header>
                                <Table.Column id="title" isRowHeader className="min-w-0 overflow-hidden">
                                    Title
                                </Table.Column>
                                <Table.Column id="type" className="w-28">Type</Table.Column>
                                <Table.Column id="status" className="w-36">Status</Table.Column>
                                <Table.Column id="progress" className="hidden lg:table-cell">Progress</Table.Column>
                                <Table.Column id="retries" className="hidden lg:table-cell">Retries</Table.Column>
                                <Table.Column id="error" className="hidden lg:table-cell">Error</Table.Column>
                                <Table.Column id="started" className="hidden lg:table-cell">Started</Table.Column>
                                <Table.Column id="completed" className="hidden lg:table-cell">Completed</Table.Column>
                                <Table.Column id="created" className="hidden lg:table-cell">Created</Table.Column>
                            </Table.Header>
                            <Table.Body
                                renderEmptyState={() =>
                                    isLoading ? null : (
                                        <div className="flex items-center justify-center py-12 text-center text-sm text-muted">
                                            No jobs found.
                                        </div>
                                    )
                                }
                            >
                                {isLoading
                                    ? Array.from({ length: 5 }).map((_, i) => (
                                          <Table.Row key={`sk-${i}`} id={`sk-${i}`}>
                                              {Array.from({ length: 9 }).map((__, j) => (
                                                  <Table.Cell key={j} className={j >= 3 ? "hidden lg:table-cell" : undefined}>
                                                      <div className="h-4 w-3/4 rounded bg-surface-secondary animate-pulse" />
                                                  </Table.Cell>
                                              ))}
                                          </Table.Row>
                                      ))
                                    : (data?.data ?? []).map((job) => (
                                          <Table.Row key={job.uuid} id={job.uuid}>
                                              <Table.Cell className="min-w-0 overflow-hidden">
                                                  <span className="text-sm text-foreground font-medium truncate block">
                                                      {job.title}
                                                  </span>
                                              </Table.Cell>
                                              <Table.Cell>
                                                  <span className="text-xs text-foreground">
                                                      {TYPE_LABELS[job.type] ?? job.type}
                                                  </span>
                                              </Table.Cell>
                                              <Table.Cell>
                                                  <StatusChip status={job.status} />
                                              </Table.Cell>
                                              <Table.Cell className="hidden lg:table-cell">
                                                  <span className="text-xs text-foreground tabular-nums">
                                                      {formatProgress(job)}
                                                  </span>
                                              </Table.Cell>
                                              <Table.Cell className="hidden lg:table-cell">
                                                  <span className="text-xs text-muted tabular-nums">
                                                      {job.retries}/{job.max_retries}
                                                  </span>
                                              </Table.Cell>
                                              <Table.Cell className="hidden lg:table-cell">
                                                  {job.error ? (
                                                      <span
                                                          className="text-xs text-danger line-clamp-2 max-w-[200px]"
                                                          title={job.error}
                                                      >
                                                          {job.error}
                                                      </span>
                                                  ) : (
                                                      <span className="text-xs text-muted">—</span>
                                                  )}
                                              </Table.Cell>
                                              <Table.Cell className="hidden lg:table-cell">
                                                  <span className="text-xs text-muted tabular-nums">
                                                      {formatDate(job.started_at)}
                                                  </span>
                                              </Table.Cell>
                                              <Table.Cell className="hidden lg:table-cell">
                                                  <span className="text-xs text-muted tabular-nums">
                                                      {formatDate(job.completed_at)}
                                                  </span>
                                              </Table.Cell>
                                              <Table.Cell className="hidden lg:table-cell">
                                                  <span className="text-xs text-muted tabular-nums">
                                                      {formatDate(job.created_at)}
                                                  </span>
                                              </Table.Cell>
                                          </Table.Row>
                                      ))}
                            </Table.Body>
                        </Table.Content>
                    </Table.ScrollContainer>
                </Table>
            </div>

            {totalPages > 1 && (
                <TablePagination
                    page={page}
                    totalPages={totalPages}
                    total={data?.total ?? 0}
                    pageSize={PAGE_LIMIT}
                    onPageChange={setPage}
                    label="jobs"
                />
            )}
        </div>
    );
}
