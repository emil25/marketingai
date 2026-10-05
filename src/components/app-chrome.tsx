import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  sub,
  action,
}: {
  title: string;
  sub?: string;
  action?: React.ReactNode;
}) {
  return (
    <div data-ui="page-header" className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="font-display text-3xl tracking-tight md:text-4xl">{title}</h1>
        {sub && <p className="mt-1 text-sm text-muted-foreground">{sub}</p>}
      </div>
      {action && <div className="max-w-full shrink-0">{action}</div>}
    </div>
  );
}

export function StatusPill({ status }: { status: "kész" | "tervezett" | "időzített" }) {
  const map = {
    kész: "bg-success/15 text-success",
    tervezett: "bg-muted text-muted-foreground",
    időzített: "bg-info/15 text-info",
  } as const;
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", map[status])}>
      {status}
    </span>
  );
}
