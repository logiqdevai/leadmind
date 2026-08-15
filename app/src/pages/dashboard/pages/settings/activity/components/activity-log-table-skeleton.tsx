export function ActivityLogTableSkeleton() {
    return (
        <div className="space-y-3 animate-pulse">
            <div className="overflow-hidden rounded-xl">
                <div className="bg-surface-secondary/40 px-3 py-2 flex gap-4">
                    {[48, 72, 96, 64, 56].map((w, i) => (
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
                        className="border-t border-border px-3 py-3 flex gap-4 items-start"
                    >
                        <div className="h-3 w-24 rounded bg-surface-secondary shrink-0 mt-0.5" />
                        <div className="space-y-1.5 min-w-[7rem] shrink-0">
                            <div className="h-3.5 w-28 rounded bg-surface-secondary" />
                            <div className="h-3 w-36 rounded bg-surface-secondary" />
                        </div>
                        <div className="h-3.5 w-40 rounded bg-surface-secondary flex-1 min-w-0" />
                        <div className="space-y-1.5 min-w-[6rem] shrink-0">
                            <div className="h-3.5 w-20 rounded bg-surface-secondary" />
                            <div className="h-3 w-24 rounded bg-surface-secondary" />
                        </div>
                        <div className="h-3 w-16 rounded bg-surface-secondary shrink-0 mt-0.5" />
                    </div>
                ))}
            </div>
            <div className="flex items-center justify-between gap-3">
                <div className="h-3 w-20 rounded bg-surface-secondary" />
                <div className="flex items-center gap-1.5">
                    <div className="h-7 w-16 rounded-lg bg-surface-secondary" />
                    <div className="h-7 w-16 rounded-lg bg-surface-secondary" />
                </div>
            </div>
        </div>
    );
}
