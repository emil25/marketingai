import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/app-chrome";
import { requireAdmin } from "@/lib/auth.functions";
import { getAiValidationSummary } from "@/lib/ai-validation.functions";

export const Route = createFileRoute("/app/admin")({
  beforeLoad: () => requireAdmin(),
  loader: () => getAiValidationSummary(),
  component: Admin,
});

function Admin() {
  const summary = Route.useLoaderData();
  return (
    <div className="space-y-6">
      <PageHeader title="Admin" sub="A mai AI-tartalmi ellenőrzések összesítése." />
      <Card className="rounded-3xl p-6 sm:p-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">Ellenőrzési okok</h2>
          <p className="text-sm text-muted-foreground">
            {summary.date} · {summary.total} kategorizált eset
          </p>
        </div>
        {summary.reasons.length ? (
          <ul className="mt-5 divide-y">
            {summary.reasons.map((item) => (
              <li key={item.category} className="flex flex-wrap justify-between gap-2 py-3 text-sm">
                <span>{item.category}</span>
                <span className="text-muted-foreground">
                  {item.count} · {item.sharePercent}%
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            Ma még nincs kategorizált ellenőrzési esemény. A napló csak kategóriát és darabszámot
            tartalmaz; posztszöveget, kérdést vagy személyes adatot nem.
          </p>
        )}
      </Card>
    </div>
  );
}
