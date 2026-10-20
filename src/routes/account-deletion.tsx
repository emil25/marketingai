import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { deleteAccount } from "@/lib/account.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/account-deletion")({ component: AccountDeletion });
function AccountDeletion() {
  const remove = useServerFn(deleteAccount);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <main className="mx-auto min-h-screen max-w-lg px-5 py-16">
      <h1 className="text-2xl font-bold">Fióktörlés folytatása</h1>
      <p className="my-5">
        A törlésre kijelölt fiók zárolva marad. Ha a média törlése átmenetileg nem sikerült, itt
        biztonságosan újrapróbálhatod.
      </p>
      <form
        className="space-y-4"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError("");
          try {
            await remove({ data: { password, confirmation: "TÖRLÉS" } });
            window.location.assign("/login");
          } catch (cause) {
            setError(
              cause instanceof Error
                ? cause.message
                : "A törlés most nem sikerült. Próbáld újra később.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <Label htmlFor="deletion-password">Jelenlegi jelszó</Label>
        <Input
          id="deletion-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        <Label htmlFor="deletion-confirmation">Írd be: TÖRLÉS</Label>
        <Input
          id="deletion-confirmation"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          required
        />
        <Button
          type="submit"
          variant="destructive"
          disabled={busy || confirmation !== "TÖRLÉS" || !password}
        >
          {busy ? "Törlés…" : "Végleges törlés újrapróbálása"}
        </Button>
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
      </form>
      <Link to="/login" className="mt-6 inline-flex min-h-11 items-center underline">
        Vissza a bejelentkezéshez
      </Link>
    </main>
  );
}
