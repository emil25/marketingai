import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { prepareLogoFile } from "@/lib/logo-file-browser";

export function LogoFilePicker({
  onSelected,
  onError,
  disabled = false,
  onPendingChange,
  selectedFile,
}: {
  onSelected: (file: File) => void;
  onError: (message: string) => void;
  disabled?: boolean;
  onPendingChange?: (pending: boolean) => void;
  selectedFile?: File | null;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [name, setName] = useState("");
  const displayedName =
    selectedFile === undefined
      ? name
      : selectedFile
        ? `${selectedFile.name} · ${Math.ceil(selectedFile.size / 1024)} KB`
        : "";
  return (
    <div className="mt-2 space-y-1">
      <input
        ref={input}
        id={id}
        type="file"
        className="hidden"
        accept="image/png,image/jpeg,image/webp"
        disabled={disabled || pending}
        onChange={async (event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (!file) return;
          setPending(true);
          onPendingChange?.(true);
          onError("");
          try {
            const prepared = await prepareLogoFile(file);
            onSelected(prepared);
            setName(`${prepared.name} · ${Math.ceil(prepared.size / 1024)} KB`);
          } catch (cause) {
            onError(cause instanceof Error ? cause.message : "A kép előkészítése sikertelen.");
          } finally {
            setPending(false);
            onPendingChange?.(false);
          }
        }}
      />
      <Button
        type="button"
        variant="outline"
        className="min-h-11"
        disabled={disabled || pending}
        onClick={() => input.current?.click()}
      >
        {pending ? "Kép előkészítése…" : "Logó kiválasztása"}
      </Button>
      {displayedName && (
        <p className="break-all text-sm" role="status">
          {displayedName}
        </p>
      )}
      <p className="text-sm text-muted-foreground">
        PNG/JPEG/WebP, privát Médiatár. A nagy képet automatikusan 2 MB alá kicsinyítjük.
      </p>
    </div>
  );
}
