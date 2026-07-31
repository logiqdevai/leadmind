export function SendHistoryTableSkeleton() {
    return (
        <div className="space-y-3 animate-pulse">
            <div className="flex items-center justify-between gap-3">
                <div className="h-3 w-24 rounded bg-surface-secondary" />
                <div className="flex items-center gap-1.5">
                    <div className="h-7 w-16 rounded-lg bg-surface-secondary" />
                    <div className="h-3 w-14 rounded bg-surface-secondary" />
                    <div className="h-7 w-16 rounded-lg bg-surface-secondary" />
                </div>
            </div>
            <div className="overflow-hidden rounded-xl border border-border">
                <div className="bg-surface-secondary/40 px-3 py-2 flex gap-4">
                    {[72, 56, 72, 56, 120, 64, 48].map((w, i) => (
                        <div
                            key={i}
                            className="h-3 rounded bg-surface-secondary"
                            style={{ width: `${w}px` }}
                        />
                    ))}
                </div>
                {Array.from({ length: 8 }).map((_, i) => (
                    <div
                        key={i}
                        className="border-t border-border px-3 py-3 flex gap-4 items-center"
                    >
                        <div className="space-y-1.5 min-w-0 flex-1">
                            <div className="h-3.5 w-28 rounded bg-surface-secondary" />
                            <div className="h-3 w-36 rounded bg-surface-secondary" />
                        </div>
                        <div className="h-5 w-14 rounded-full bg-surface-secondary shrink-0" />
                        <div className="h-3 w-16 rounded bg-surface-secondary shrink-0" />
                        <div className="h-5 w-16 rounded-full bg-surface-secondary shrink-0" />
                        <div className="h-3 w-32 rounded bg-surface-secondary shrink-0" />
                        <div className="h-3 w-20 rounded bg-surface-secondary shrink-0" />
                        <div className="h-3 w-16 rounded bg-surface-secondary shrink-0" />
                    </div>
                ))}
            </div>
        </div>
    );
}
