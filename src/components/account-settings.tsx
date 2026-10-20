import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { changePassword, deleteAccount, exportAccount } from "@/lib/account.functions";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Card } from "./ui/card";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "./ui/alert-dialog";
import type { PublicUser } from "@/lib/data-model";
export function AccountSettings({ user }: { user: PublicUser }) {
  const change = useServerFn(changePassword);
  const remove = useServerFn(deleteAccount);
  const download = useServerFn(exportAccount);
  const [currentPassword, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [dialog, setDialog] = useState(false);
  async function run(action: string, fn: () => Promise<void>) {
    setError("");
    setMessage("");
    setPending(action);
    try {
      await fn();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "A művelet nem sikerült. Próbáld újra.");
    } finally {
      setPending("");
    }
  }
  return (
    <Card id="account" className="max-w-5xl space-y-6 rounded-3xl p-5">
      <div>
        <h2 className="text-xl font-semibold">Fiók</h2>
        <p className="mt-2 text-sm break-words">
          {user.displayName} · {user.email}
        </p>
        {user.emailVerified === false && user.canUseAi !== true && (
          <Link
            to="/verify-email"
            className="mt-3 inline-flex min-h-11 items-center font-semibold text-primary underline"
          >
            E-mail-cím megerősítése
          </Link>
        )}
      </div>
      <form
        id="password"
        className="max-w-md space-y-3 scroll-mt-28"
        onSubmit={(event) => {
          event.preventDefault();
          void run("password", async () => {
            await change({ data: { currentPassword, password } });
            setCurrent("");
            setPassword("");
            setMessage("Elmentettük az új jelszavad, a többi munkamenetet lezártuk.");
          });
        }}
      >
        <h3 className="font-semibold">Jelszócsere</h3>
        <Label htmlFor="current-password">Jelenlegi jelszó</Label>
        <Input
          id="current-password"
          type="password"
          autoComplete="current-password"
          required
          value={currentPassword}
          onChange={(event) => setCurrent(event.target.value)}
        />
        <Label htmlFor="account-new-password">Új jelszó (legalább 8 karakter)</Label>
        <Input
          id="account-new-password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <Button variant="outline" disabled={!!pending}>
          {pending === "password" ? "Mentés…" : "Jelszó módosítása"}
        </Button>
      </form>
      <div id="export" className="space-y-2 border-t pt-5 scroll-mt-28">
        <h3 className="font-semibold">Saját adatok exportálása</h3>
        <p className="text-sm text-muted-foreground">
          A vállalkozásaid, márkaprofiljaid és tartalmaid JSON fájlban. Jelszavak és hozzáférési
          tokenek nélkül.
        </p>
        <Button
          variant="outline"
          disabled={!!pending}
          onClick={() =>
            void run("export", async () => {
              const data = await download();
              const url = URL.createObjectURL(
                new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
              );
              const link = document.createElement("a");
              link.href = url;
              link.download = "marketingpilot-adataim.json";
              link.click();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
              setMessage("Az export elkészült.");
            })
          }
        >
          {pending === "export" ? "Exportálás…" : "Adataim letöltése"}
        </Button>
      </div>
      <div id="delete-account" className="space-y-2 border-t pt-5 scroll-mt-28">
        <h3 className="font-semibold">Fiók törlése</h3>
        <p className="text-sm text-muted-foreground">
          Végleg törli a fiókodat, saját vállalkozásaidat, posztjaidat és a feltöltött médiát. Előbb
          készíts exportot. Közös vállalkozásnál előbb add át a tulajdonjogot.
        </p>
        <Button
          variant="outline"
          className="text-destructive"
          disabled={!!pending}
          onClick={() => {
            setError("");
            setDialog(true);
          }}
        >
          Fiókom végleges törlése
        </Button>
      </div>
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
      {error && !dialog && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <AlertDialog
        open={dialog}
        onOpenChange={(open) => {
          if (!pending) setDialog(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Biztosan törlöd a fiókodat?</AlertDialogTitle>
            <AlertDialogDescription>
              A törlés végleges. A saját tartalmaid és médiád is törlődnek.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Label htmlFor="delete-password">Jelenlegi jelszó</Label>
          <Input
            id="delete-password"
            type="password"
            autoComplete="current-password"
            value={deletePassword}
            onChange={(event) => setDeletePassword(event.target.value)}
          />
          <Label htmlFor="delete-confirm">Írd be: TÖRLÉS</Label>
          <Input
            id="delete-confirm"
            autoComplete="off"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
          />
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!pending}>Mégse</AlertDialogCancel>
            <AlertDialogAction
              disabled={!!pending || confirmation !== "TÖRLÉS" || !deletePassword}
              onClick={(event) => {
                event.preventDefault();
                void run("delete", async () => {
                  await remove({ data: { password: deletePassword, confirmation: "TÖRLÉS" } });
                  window.location.assign("/login");
                });
              }}
            >
              {pending === "delete" ? "Törlés…" : "Végleges törlés"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
