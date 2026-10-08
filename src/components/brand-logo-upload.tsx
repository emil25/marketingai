import { useId, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { validateLogoFile } from "@/lib/onboarding-details";

export function BrandLogoUpload({
  brandId,
  logoUrl,
  onUploaded,
}: {
  brandId: string;
  logoUrl: string;
  onUploaded: (url: string) => void;
}) {
  const id = useId();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  return (
    <div>
      <Label htmlFor={id}>Logó feltöltése</Label>
      <Input
        id={id}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="mt-2"
        disabled={pending}
        onChange={async (event) => {
          const input = event.currentTarget;
          const file = input.files?.[0];
          if (!file) return;
          setError("");
          setSaved(false);
          setPending(true);
          try {
            validateLogoFile(file);
            const body = new FormData();
            body.set("file", file);
            body.set("purpose", "brand-logo");
            body.set("brandId", brandId);
            body.set("altText", "Vállalkozás logója");
            const response = await fetch("/api/media", { method: "POST", body });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || "A logó mentése sikertelen.");
            if (!result.asset?.id) throw new Error("A feltöltés nem adott vissza mentett képet.");
            onUploaded(`/api/media/${result.asset.id}`);
            setSaved(true);
          } catch (cause) {
            setError(
              cause instanceof TypeError
                ? "A logó feltöltése megszakadt. Próbáld újra."
                : cause instanceof Error
                  ? cause.message
                  : "A logó mentése sikertelen.",
            );
          } finally {
            setPending(false);
            input.value = "";
          }
        }}
      />
      <p className="mt-1 text-sm text-muted-foreground">
        PNG, JPEG vagy WebP, legfeljebb 2 MB. A logó a márkához és a Médiatárba is mentődik.
      </p>
      {pending && (
        <p role="status" className="mt-2 text-sm">
          Logó mentése…
        </p>
      )}
      {saved && (
        <p role="status" className="mt-2 text-sm">
          A logó mentve.
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      )}
      {logoUrl && (
        <img
          src={logoUrl}
          alt="A márka logója"
          className="mt-3 h-16 w-16 rounded-xl border object-contain"
        />
      )}
    </div>
  );
}
