export function RouteFallbackSkeleton() {
    return (
        <div className="flex h-full min-h-0 flex-1 flex-col gap-6 p-6 animate-pulse">
            <div className="space-y-2">
                <div className="h-7 w-48 max-w-full rounded-md bg-surface-secondary" />
                <div className="h-3.5 w-72 max-w-full rounded bg-surface-secondary" />
            </div>
            <div className="flex flex-wrap gap-2">
                <div className="h-9 w-28 rounded-lg bg-surface-secondary" />
                <div className="h-9 w-24 rounded-lg bg-surface-secondary" />
                <div className="h-9 w-32 rounded-lg bg-surface-secondary" />
            </div>
            <div className="overflow-hidden rounded-xl border border-border flex-1 min-h-[12rem]">
                <div className="bg-surface-secondary/40 px-3 py-2 flex gap-4">
                    {[80, 64, 96, 56, 72].map((w, i) => (
                        <div
                            key={i}
                            className="h-3 rounded bg-surface-secondary"
                            style={{ width: `${w}px` }}
                        />
                    ))}
                </div>
                {Array.from({ length: 6 }).map((_, i) => (
                    <div
                        key={i}
                        className="border-t border-border px-3 py-3 flex gap-4 items-center"
                    >
                        <div className="h-3.5 w-32 rounded bg-surface-secondary" />
                        <div className="h-3 w-24 rounded bg-surface-secondary" />
                        <div className="h-3 w-40 rounded bg-surface-secondary flex-1" />
                        <div className="h-5 w-14 rounded-full bg-surface-secondary" />
                        <div className="h-3 w-16 rounded bg-surface-secondary" />
                    </div>
                ))}
            </div>
        </div>
    );
}
