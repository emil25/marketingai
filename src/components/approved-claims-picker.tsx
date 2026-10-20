import { useId, useState } from "react";
import { approvedClaimSuggestions, cleanApprovedClaims } from "@/lib/approved-claims";
import { Textarea } from "./ui/textarea";

export function ApprovedClaimsPicker({
  businessType,
  value,
  onChange,
}: {
  businessType: string;
  value: string[];
  onChange: (claims: string[]) => void;
}) {
  const id = useId();
  const options = approvedClaimSuggestions(businessType);
  const selected = cleanApprovedClaims(value);
  const custom = selected.filter((claim) => !options.includes(claim));
  const customText = custom.join("\n");
  const [localText, setLocalText] = useState<string | null>(null);
  return (
    <details className="rounded-xl border bg-card p-4">
      <summary className="cursor-pointer list-none font-medium">
        Mit állíthatunk rólad biztosan?{" "}
        <span className="text-sm text-muted-foreground">
          (opcionális · {selected.length} kiválasztva)
        </span>
      </summary>
      <fieldset className="mt-3 border-0 p-0">
        <legend className="sr-only">Ellenőrzött vállalkozási állítások</legend>
        <p className="mb-3 text-sm text-muted-foreground">
          Csak az igaz állításokat jelöld be. Ezeket az AI megadott tényként használhatja.
          {options.length === 0
            ? " Ennél a vállalkozástípusnál nem ajánlunk ígéretet tartalmazó állítást."
            : ""}
        </p>
        {options.length > 0 && (
          <div className="grid gap-2 sm:grid-cols-2">
            {options.map((claim, index) => (
              <label
                key={claim}
                className="flex min-h-10 items-center gap-2 rounded-lg border px-3 py-2 text-sm"
              >
                <input
                  id={`${id}-${index}`}
                  type="checkbox"
                  checked={selected.includes(claim)}
                  onChange={(event) =>
                    onChange(
                      cleanApprovedClaims(
                        event.target.checked
                          ? [...selected, claim]
                          : selected.filter((item) => item !== claim),
                      ),
                    )
                  }
                />
                <span>{claim}</span>
              </label>
            ))}
          </div>
        )}
        <label className="mt-3 block text-sm">
          Más igaz, ellenőrzött állítás (soronként egy)
          <Textarea
            className="mt-2 min-h-16"
            value={localText ?? customText}
            maxLength={1200}
            onChange={(event) => {
              const nextText = event.target.value;
              setLocalText(nextText);
              const nextCustom = nextText
                .split(/\r?\n/u)
                .map((item) => item.trim())
                .filter(Boolean)
                .slice(0, 10);
              onChange(
                cleanApprovedClaims([
                  ...selected.filter((item) => options.includes(item)),
                  ...nextCustom,
                ]),
              );
            }}
            onBlur={() => setLocalText(null)}
            placeholder="Például: minden termékünk helyben készül"
          />
        </label>
      </fieldset>
    </details>
  );
}
