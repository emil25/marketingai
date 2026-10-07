import { createFileRoute, Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app-chrome";
import { getWorkspace } from "@/lib/workspace.functions";
import { BarChart3, ChevronRight, FileText, Radio, Sparkles } from "lucide-react";

export const Route = createFileRoute("/app/recommendations")({
  loader: () => getWorkspace(),
  component: Recommendations,
});

function Recommendations() {
  const data = Route.useLoaderData();
  const brand = data.activeBrand;
  return (
    <div className="space-y-6">
      <PageHeader
        title="Következő lépések"
        sub="Márkabeállítás, tartalomkészítés és mérés egy helyen."
        action={<span className="tt-badge rounded-full px-2 py-1">Tervezési segítség</span>}
      />
      <Card className="tt-onboarding rounded-2xl p-6 md:p-7">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <div className="tt-eyebrow">TARTALOM ÉS MÉRÉS</div>
            <h2 className="mt-3 font-display text-2xl font-extrabold tracking-tight">
              Legyen minden ötletből következő lépés.
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Posztötletből a posztkészítőben készíthetsz tartalmat, kampányötletből pedig tervet. A
              teljesítmény alapú ajánlás még nincs bekötve; ehhez valódi mérések és külön
              kiértékelés szükséges.
            </p>
          </div>
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-soft text-primary">
            <Sparkles className="h-6 w-6" />
          </span>
        </div>
      </Card>
      <section className="grid gap-4 md:grid-cols-3">
        <Requirement
          icon={FileText}
          title="Tartalom"
          detail={brand ? "Készíts legalább egy mentett posztot." : "Márkakontextus szükséges."}
          to={brand ? "/app/posts/new" : "/app/brand"}
          action={brand ? "Poszt készítése" : "Márka beállítása"}
        />
        <Requirement
          icon={Radio}
          title="Csatornák"
          detail="Facebook és Instagram kapcsolható; a többi platform szövege másolható."
          to="/app/channels"
          action="Kapcsolatok"
        />
        <Requirement
          icon={BarChart3}
          title="Mérés"
          detail="Valódi mérési adat nélkül nincs teljesítményjavaslat."
          to="/app/analytics"
          action="Eredmények"
        />
      </section>
      <Card className="tt-card p-6">
        <div className="tt-empty min-h-48 items-center justify-center text-center">
          <Sparkles className="h-7 w-7 text-primary" />
          <strong className="mt-3 text-sm">
            {brand ? "Teljesítményjavaslat még nem érhető el" : "Még nincs márkakontextus"}
          </strong>
          <span className="mt-1 max-w-md text-xs text-muted-foreground">
            {brand
              ? "Tartalomötletekhez használd a meglévő posztkészítőt és kampánytervezőt. Ezek mérési adat nélkül is használhatók."
              : "Előbb hozz létre és tölts ki egy márkát."}
          </span>
          <Link to={brand ? "/app/ideas" : "/app/brand"}>
            <Button className="tt-primary mt-4">
              {brand ? "Tartalom tervezése" : "Márka létrehozása"}
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}

function Requirement({
  icon: Icon,
  title,
  detail,
  to,
  action,
}: {
  icon: typeof FileText;
  title: string;
  detail: string;
  to: string;
  action: string;
}) {
  return (
    <Card className="tt-card p-5">
      <span className="tt-quick-icon">
        <Icon className="h-4 w-4" />
      </span>
      <h3 className="mt-4 font-display text-base font-extrabold">{title}</h3>
      <p className="mt-2 min-h-10 text-xs leading-relaxed text-muted-foreground">{detail}</p>
      <Link to={to} className="tt-link mt-4 inline-flex items-center">
        {action}
        <ChevronRight className="ml-1 h-3.5 w-3.5" />
      </Link>
    </Card>
  );
}
