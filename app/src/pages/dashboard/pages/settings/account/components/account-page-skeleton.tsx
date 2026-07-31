export function AccountPageSkeleton() {
    return (
        <div className="space-y-8 max-w-lg animate-pulse">
            <div className="flex items-center gap-2.5">
                <div className="size-5 rounded bg-surface-secondary shrink-0" />
                <div className="space-y-1.5">
                    <div className="h-5 w-24 rounded bg-surface-secondary" />
                    <div className="h-3 w-48 rounded bg-surface-secondary" />
                </div>
            </div>

            <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="space-y-1.5">
                        <div className="h-3.5 w-20 rounded bg-surface-secondary" />
                        <div className="h-10 w-full rounded-lg bg-surface-secondary" />
                    </div>
                ))}
                <div className="h-9 w-28 rounded-lg bg-surface-secondary" />
            </div>

            <div className="border-t border-border pt-6 space-y-3">
                <div className="space-y-1.5">
                    <div className="h-4 w-20 rounded bg-surface-secondary" />
                    <div className="h-3 w-40 rounded bg-surface-secondary" />
                </div>
                {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="space-y-1.5">
                        <div className="h-3.5 w-28 rounded bg-surface-secondary" />
                        <div className="h-10 w-full rounded-lg bg-surface-secondary" />
                    </div>
                ))}
                <div className="h-9 w-36 rounded-lg bg-surface-secondary" />
            </div>
        </div>
    );
}
