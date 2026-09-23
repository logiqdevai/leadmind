export function ApiKeysTableSkeleton() {
    return (
        <div className="w-full max-w-full overflow-hidden rounded-xl animate-pulse">
            <div className="bg-surface-secondary/40 px-3 py-2 flex gap-4">
                {[64, 48, 96, 64, 64, 56, 96].map((w, i) => (
                    <div
                        key={i}
                        className="h-3 rounded bg-surface-secondary"
                        style={{ width: `${w}px` }}
                    />
                ))}
            </div>
            {Array.from({ length: 4 }).map((_, i) => (
                <div
                    key={i}
                    className="border-t border-border px-3 py-3 flex items-center gap-4"
                >
                    <div className="h-3.5 w-28 rounded bg-surface-secondary shrink-0" />
                    <div className="h-5 w-14 rounded-full bg-surface-secondary shrink-0" />
                    <div className="h-3.5 w-32 rounded bg-surface-secondary shrink-0" />
                    <div className="h-3 w-16 rounded bg-surface-secondary shrink-0" />
                    <div className="h-3 w-16 rounded bg-surface-secondary shrink-0" />
                    <div className="h-5 w-16 rounded-full bg-surface-secondary shrink-0" />
                    <div className="flex items-center gap-1.5 shrink-0">
                        <div className="h-7 w-14 rounded-lg bg-surface-secondary" />
                        <div className="h-7 w-14 rounded-lg bg-surface-secondary" />
                    </div>
                </div>
            ))}
        </div>
    );
}
