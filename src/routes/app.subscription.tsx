import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/app-chrome";
export const Route = createFileRoute("/app/subscription")({ component: Subscription });
function Subscription() { return <div className="space-y-6"><PageHeader title="Előfizetés" sub="Az előfizetés és számlázás backendje a következő fázisban kapcsolódik be." /><Card className="rounded-3xl p-10 text-center"><h2 className="text-lg font-semibold">Nincs aktív előfizetési adat</h2><p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">A felület nem jelöl ki kitalált csomagot és nem indít ál-fizetést. A subscriptions modell és a fizetési szolgáltató bekötése külön fázis.</p></Card></div>; }
