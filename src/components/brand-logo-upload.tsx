import { useState } from "react";
import { Label } from "@/components/ui/label";
import { LogoFilePicker } from "@/components/logo-file-picker";

export function BrandLogoUpload({
  brandId,
  logoUrl,
  onUploaded,
}: {
  brandId: string;
  logoUrl: string;
  onUploaded: (url: string) => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  return (
    <div>
      <Label>Logó feltöltése</Label>
      <LogoFilePicker
        disabled={pending}
        onError={(message) => {
          setError(message);
          if (message) setSaved(false);
        }}
        onSelected={async (file) => {
          setError("");
          setSaved(false);
          setPending(true);
          try {
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
          }
        }}
      />
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
