import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/app-chrome";
import { requireAdmin } from "@/lib/auth.functions";
export const Route = createFileRoute("/app/admin")({ beforeLoad: () => requireAdmin(), component: Admin });
function Admin() { return <div className="space-y-6"><PageHeader title="Admin" sub="Munkatér- és előfizetési adminisztráció." /><Card className="rounded-3xl p-10 text-center"><h2 className="text-lg font-semibold">Admin adatok még nincsenek bekötve</h2><p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">A képernyő csak admin vagy owner szerepkörrel érhető el. Felhasználó-, subscription- és kuponadatot nem töltünk be mintaértékkel.</p></Card></div>; }
