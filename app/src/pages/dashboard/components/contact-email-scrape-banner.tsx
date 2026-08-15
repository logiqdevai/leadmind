import { Spinner } from "@heroui/react/spinner";
import { useContactEmailScrapeStore } from "@/stores/contact-email-scrape";

export function ContactEmailScrapeBanner() {
    const jobs = useContactEmailScrapeStore((state) => state.jobs);
    const active = Object.values(jobs);
    if (active.length === 0) return null;

    return (
        <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex max-w-sm flex-col gap-2">
            {active.map((job) => {
                const pct =
                    job.queued > 0 ? Math.round((job.completed / job.queued) * 100) : 0;
                return (
                    <div
                        key={job.job_id}
                        className="pointer-events-auto rounded-xl border border-border bg-surface px-4 py-3 shadow-lg"
                    >
                        <div className="flex items-start gap-3">
                            <Spinner size="sm" className="mt-0.5 shrink-0" />
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-foreground">
                                    Finding emails from websites
                                </p>
                                <p className="mt-0.5 text-xs text-muted">
                                    {job.completed} of {job.queued} checked
                                    {job.found > 0 ? ` · ${job.found} found` : ""}
                                </p>
                                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-secondary">
                                    <div
                                        className="h-full rounded-full bg-accent transition-[width] duration-300"
                                        style={{ width: `${pct}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
