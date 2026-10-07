import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Lightbulb, Megaphone, PenLine, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/app-chrome";
import { getWorkspace } from "@/lib/workspace.functions";

export const Route = createFileRoute("/app/ideas")({
  loader: () => getWorkspace(),
  component: Ideas,
});

function Ideas() {
  const data = Route.useLoaderData();
  const brand = data.activeBrand;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Ötletek és következő lépések"
        sub="Témák és kampányirányok a mentett márkakontextusodból."
        action={
          <Badge className="rounded-full" variant="secondary">
            <Lightbulb className="mr-1 h-3.5 w-3.5" />
            Tartalomtervezés
          </Badge>
        }
      />
      <section className="v2-tool-hero overflow-hidden rounded-[2rem] p-6 text-white shadow-xl md:p-8">
        <div className="relative z-10 max-w-2xl">
          <div className="flex items-center gap-2 text-sm font-semibold text-white/70">
            <Sparkles className="h-4 w-4" />
            Ötletből következő lépés
          </div>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight md:text-4xl">
            A jó ötletből kész tartalom legyen.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-white/70">
            A létrehozott ötleteket a kampánybriefben és a 30 napos tervben tudod valódi tartalommá
            alakítani.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/app/campaigns">
              <Button className="rounded-full bg-white text-slate-900 hover:bg-white/90">
                <Megaphone className="mr-1 h-4 w-4" />
                Kampányötlet indítása
              </Button>
            </Link>
            <Link to="/app/posts/$id" params={{ id: "new" }}>
              <Button
                variant="outline"
                className="rounded-full border-white/30 bg-white/10 text-white hover:bg-white/20"
              >
                <PenLine className="mr-1 h-4 w-4" />
                Posztötletből poszt
              </Button>
            </Link>
          </div>
        </div>
      </section>
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="v2-feature-card p-6">
          <div className="flex items-center justify-between">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-soft text-brand">
              <Megaphone className="h-5 w-5" />
            </div>
            <Badge variant="outline" className="rounded-full">
              Kampány
            </Badge>
          </div>
          <h3 className="mt-5 text-lg font-semibold">Kampányirány létrehozása</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Egy cél, közönség és ajánlat alapján az AI stratégia és a 30 napos terv valódi
            kampányrekordba menthető.
          </p>
          <Link
            to="/app/campaigns"
            className="mt-5 inline-flex items-center text-sm font-semibold text-primary"
          >
            Kampányok megnyitása
            <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Card>
        <Card className="v2-feature-card p-6">
          <div className="flex items-center justify-between">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-accent text-accent-foreground">
              <PenLine className="h-5 w-5" />
            </div>
            <Badge variant="outline" className="rounded-full">
              Tartalom
            </Badge>
          </div>
          <h3 className="mt-5 text-lg font-semibold">Posztötletből platformváltozat</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            A posztkészítő a Brand Voice és a kampány kontextusával készít szerkeszthető
            változatokat Facebookra, Instagramra, TikTokra és LinkedInre.
          </p>
          <Link
            to="/app/posts/$id"
            params={{ id: "new" }}
            className="mt-5 inline-flex items-center text-sm font-semibold text-primary"
          >
            Posztkészítő megnyitása
            <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Card>
      </div>
      <Card className="v2-feature-card p-6">
        <h3 className="text-lg font-semibold">Mit érdemes következőként elvégezni?</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Márkabeállítások, tartalomkészítés és a valódi méréshez szükséges lépések. Teljesítmény
          alapú ajánlást adat nélkül nem mutatunk.
        </p>
        <Link
          to="/app/recommendations"
          className="mt-4 inline-flex items-center text-sm font-semibold text-primary"
        >
          Következő lépések
          <ArrowRight className="ml-1 h-4 w-4" />
        </Link>
      </Card>
      {!brand && (
        <Card className="v2-empty-state p-8">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand">
              <Lightbulb className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">Még nincs márkakontextus</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                A személyre szabott tartalmak akkor lesznek használhatók, ha előbb létrehozol egy
                márkát és kitöltöd a Brand Voice alapjait.
              </p>
            </div>
            <Link to="/app/brand">
              <Button className="rounded-full">Márkahang beállítása</Button>
            </Link>
          </div>
        </Card>
      )}
    </div>
  );
}
