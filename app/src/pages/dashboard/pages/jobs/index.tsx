import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Checkbox, Chip, ListBox, Select, Table, type Selection } from "@heroui/react";
import {
    AlertTriangle,
    CheckCircle2,
    Clock,
    Loader2,
    ListTodo,
    XCircle,
} from "lucide-react";
import {
    useBulkJobs,
    useCancelBulkJobs,
    useRetryBulkJobs,
} from "@/features/bulk-jobs/hooks/use-bulk-jobs";
import {
    BulkJobStatus,
    BulkJobType,
    type BulkJob,
} from "@/features/bulk-jobs/interfaces/bulk-job.interface";
import { TablePagination } from "@/components/ui/table-pagination";
import { JobsActionsDropdown } from "./components/jobs-actions-dropdown";

const PAGE_LIMIT = 20;

const ACTIVE_STATUSES = new Set<BulkJobStatus>([
    BulkJobStatus.PENDING,
    BulkJobStatus.QUEUED,
    BulkJobStatus.RUNNING,
]);

const RETRYABLE_STATUSES = new Set<BulkJobStatus>([
    BulkJobStatus.CANCELLED,
    BulkJobStatus.FAILED,
]);

const RESUMABLE_TYPES = new Set<BulkJobType>([
    BulkJobType.CONTACT_SCORE,
    BulkJobType.CONTACT_ENRICH,
    BulkJobType.LEAD_ENRICH,
]);

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

const FILTER_ALL = "all";

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
    const selected = value || FILTER_ALL;
    return (
        <Select
            aria-label={label}
            placeholder={label}
            value={selected}
            onChange={(v) => {
                const key = v != null ? String(v) : FILTER_ALL;
                onChange(key === FILTER_ALL ? "" : key);
            }}
        >
            <Select.Trigger className="min-w-36 h-8 text-xs">
                <Select.Value />
                <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
                <ListBox>
                    <ListBox.Item id={FILTER_ALL} textValue={label}>
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
    const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

    const page = Math.max(1, Number(searchParams.get("page") ?? 1));
    const typeFilter = (searchParams.get("type") as BulkJobType) || undefined;
    const statusFilter = (searchParams.get("status") as BulkJobStatus) || undefined;

    const { data, isLoading } = useBulkJobs({
        page,
        limit: PAGE_LIMIT,
        type: typeFilter,
        status: statusFilter,
    });
    const cancelJobs = useCancelBulkJobs();
    const retryJobs = useRetryBulkJobs();

    const jobs = data?.data ?? [];
    const selectedJobs = jobs.filter((job) => selectedKeys.has(job.uuid));
    const canCancel = selectedJobs.some((job) => ACTIVE_STATUSES.has(job.status));
    const canRetry = selectedJobs.some(
        (job) =>
            RETRYABLE_STATUSES.has(job.status) &&
            RESUMABLE_TYPES.has(job.type) &&
            (job.progress_total === 0 || job.progress_current < job.progress_total),
    );

    const setParam = (key: string, value: string) => {
        setSearchParams(
            (prev) => {
                const next = new URLSearchParams(prev);
                if (value) next.set(key, value);
                else next.delete(key);
                next.delete("page");
                next.delete("scope");
                return next;
            },
            { replace: true },
        );
        setSelectedKeys(new Set());
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
        setSelectedKeys(new Set());
    };

    const handleSelectionChange = (keys: Selection) => {
        if (keys === "all") {
            setSelectedKeys(new Set(jobs.map((job) => job.uuid)));
            return;
        }
        setSelectedKeys(new Set(Array.from(keys, String)));
    };

    const handleCancel = async () => {
        const uuids = selectedJobs
            .filter((job) => ACTIVE_STATUSES.has(job.status))
            .map((job) => job.uuid);
        if (uuids.length === 0) return;
        await cancelJobs.mutateAsync(uuids);
        setSelectedKeys(new Set());
    };

    const handleRetry = async () => {
        const uuids = selectedJobs
            .filter(
                (job) =>
                    RETRYABLE_STATUSES.has(job.status) &&
                    RESUMABLE_TYPES.has(job.type) &&
                    (job.progress_total === 0 || job.progress_current < job.progress_total),
            )
            .map((job) => job.uuid);
        if (uuids.length === 0) return;
        await retryJobs.mutateAsync(uuids);
        setSelectedKeys(new Set());
    };

    const totalPages = Math.ceil((data?.total ?? 0) / PAGE_LIMIT);

    return (
        <div className="jobs-page space-y-4">
            <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                        <ListTodo className="size-5 text-muted shrink-0" />
                        <div>
                            <h1 className="text-lg font-semibold text-foreground leading-tight">Jobs</h1>
                            <p className="text-xs text-muted mt-0.5">
                                {data?.total ?? "—"} jobs
                                {selectedKeys.size > 0 ? ` · ${selectedKeys.size} selected` : ""}
                            </p>
                        </div>
                    </div>
                    <JobsActionsDropdown
                        onCancelSelected={handleCancel}
                        cancelDisabled={!canCancel}
                        cancelPending={cancelJobs.isPending}
                        onRetrySelected={handleRetry}
                        retryDisabled={!canRetry}
                        retryPending={retryJobs.isPending}
                    />
                </div>

                <div className="flex flex-wrap items-center gap-2">
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
                        onChange={(v) => setParam("status", v)}
                    />
                </div>
            </div>

            <div className="rounded-xl overflow-hidden">
                <Table>
                    <Table.ScrollContainer className="w-full max-w-full overflow-x-hidden">
                        <Table.Content
                            aria-label="Jobs"
                            className="w-full table-fixed"
                            selectionMode="multiple"
                            selectionBehavior="toggle"
                            selectedKeys={selectedKeys}
                            onSelectionChange={handleSelectionChange}
                        >
                            <Table.Header>
                                <Table.Column className="pr-0 w-10">
                                    <Checkbox aria-label="Select all" slot="selection">
                                        <Checkbox.Control>
                                            <Checkbox.Indicator />
                                        </Checkbox.Control>
                                    </Checkbox>
                                </Table.Column>
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
                                              <Table.Cell className="pr-0">
                                                  <div className="h-4 w-4 rounded bg-surface-secondary animate-pulse" />
                                              </Table.Cell>
                                              {Array.from({ length: 9 }).map((__, j) => (
                                                  <Table.Cell key={j} className={j >= 3 ? "hidden lg:table-cell" : undefined}>
                                                      <div className="h-4 w-3/4 rounded bg-surface-secondary animate-pulse" />
                                                  </Table.Cell>
                                              ))}
                                          </Table.Row>
                                      ))
                                    : jobs.map((job) => (
                                          <Table.Row key={job.uuid} id={job.uuid}>
                                              <Table.Cell className="pr-0">
                                                  <Checkbox aria-label={`Select ${job.title}`} slot="selection">
                                                      <Checkbox.Control>
                                                          <Checkbox.Indicator />
                                                      </Checkbox.Control>
                                                  </Checkbox>
                                              </Table.Cell>
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
                                                          className="job-error-text text-danger line-clamp-2 max-w-[200px]"
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
