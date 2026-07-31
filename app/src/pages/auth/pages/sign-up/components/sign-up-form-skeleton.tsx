export function SignUpFormSkeleton() {
    return (
        <div className="grid gap-4 animate-pulse">
            {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex flex-col gap-1">
                    <div className="h-3.5 w-20 rounded bg-surface-secondary" />
                    <div className="h-10 w-full rounded-lg bg-surface-secondary" />
                </div>
            ))}
            <div className="h-10 w-full rounded-lg bg-surface-secondary mt-1" />
        </div>
    );
}
