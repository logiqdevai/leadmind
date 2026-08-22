import type { ReactNode } from "react";

interface SectionProps {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  emptyText?: string;
}

function hasEmptyChildArray(children: ReactNode): boolean {
  if (children === null || typeof children !== "object") return false;
  const props = (children as { props?: { children?: unknown } }).props;
  const inner = props?.children;
  return Array.isArray(inner) && inner.length === 0;
}

export function Section({ title, action, children, emptyText }: SectionProps) {
  const empty = hasEmptyChildArray(children);
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
        {action ? <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">{action}</div> : null}
      </div>
      {empty && emptyText ? <p className="text-sm leading-relaxed text-muted">{emptyText}</p> : children}
    </section>
  );
}
