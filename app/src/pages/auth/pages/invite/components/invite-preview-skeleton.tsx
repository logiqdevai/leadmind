export function InvitePreviewSkeleton() {
    return (
        <div className="space-y-4 animate-pulse">
            <div className="rounded-xl border border-border p-4 space-y-2">
                <div className="h-4 w-40 rounded bg-surface-secondary" />
                <div className="h-3 w-56 max-w-full rounded bg-surface-secondary" />
            </div>
            <div className="h-10 w-full rounded-lg bg-surface-secondary" />
        </div>
    );
}
