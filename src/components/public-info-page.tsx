import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";

export function PublicInfoLinks() {
  return (
    <nav
      aria-label="Tájékoztatók"
      className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm"
    >
      <Link to="/privacy" className="hover:underline">
        Adatvédelem
      </Link>
      <Link to="/terms" className="hover:underline">
        Használati feltételek
      </Link>
      <Link to="/contact" className="hover:underline">
        Kapcsolat és üzemeltető
      </Link>
    </nav>
  );
}

export function PublicInfoPage({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="theme-marketingpilot-v2 public-site min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-5 py-4">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <span className="grid h-8 w-8 place-items-center rounded-xl gradient-brand text-primary-foreground">
              M
            </span>
            MarketingPilot
          </Link>
          <Link to="/login" className="text-sm font-medium text-primary hover:underline">
            Belépés
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-5 py-12">
        <h1 className="font-display text-3xl font-bold sm:text-4xl">{title}</h1>
        <p className="mt-3 text-base text-muted-foreground">{subtitle}</p>
        <div className="mt-8 space-y-7 leading-relaxed [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:font-semibold [&_p]:text-base [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6 [&_a]:text-primary [&_a]:underline">
          {children}
        </div>
      </main>
      <footer className="border-t border-border px-5 py-6 text-muted-foreground">
        <PublicInfoLinks />
      </footer>
    </div>
  );
}

export function LegalDraftNotice() {
  return (
    <div role="note" className="rounded-2xl border border-primary/25 bg-primary/5 p-5">
      <h2>Előkészítés alatt</h2>
      <p>
        Ez a béta jelenlegi működését ismertető tájékoztató, nem végleges ÁSZF vagy teljes
        adatkezelési tájékoztató. Az üzemeltető adatai, az adatkezelés jogalapjai, megőrzési ideje
        és a szolgáltatói feltételek véglegesítése még szükséges.
      </p>
    </div>
  );
}
