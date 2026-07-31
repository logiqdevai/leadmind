export function QueryConfigFieldsSkeleton() {
    return (
        <div className="flex flex-col gap-5 animate-pulse rounded-lg border border-border/60 bg-surface-secondary/40 p-4">
            <div className="flex flex-col gap-3">
                <div className="h-3 w-16 rounded bg-surface-secondary" />
                <div className="grid gap-3 sm:grid-cols-2">
                    <div className="flex flex-col gap-1.5 sm:col-span-2">
                        <div className="h-3.5 w-20 rounded bg-surface-secondary" />
                        <div className="h-10 w-full rounded-lg bg-surface-secondary" />
                        <div className="h-3 w-56 max-w-full rounded bg-surface-secondary" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <div className="h-3.5 w-16 rounded bg-surface-secondary" />
                        <div className="h-10 w-full rounded-lg bg-surface-secondary" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <div className="h-3.5 w-20 rounded bg-surface-secondary" />
                        <div className="h-10 w-full rounded-lg bg-surface-secondary" />
                    </div>
                </div>
            </div>
            <div className="flex flex-col gap-3">
                <div className="h-3 w-20 rounded bg-surface-secondary" />
                <div className="grid gap-3 sm:grid-cols-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="flex flex-col gap-1.5">
                            <div className="h-3.5 w-24 rounded bg-surface-secondary" />
                            <div className="h-10 w-full rounded-lg bg-surface-secondary" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
