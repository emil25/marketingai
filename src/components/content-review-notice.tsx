import { contentPlaceholders, contentReviewItems } from "@/lib/content-quality";
import { Link } from "@tanstack/react-router";

export function ContentReviewNotice({
  warnings = [],
  texts = [],
  onReplace,
}: {
  warnings?: string[];
  texts?: string[];
  onReplace?: (placeholder: string, value: string) => void;
}) {
  const missing = contentPlaceholders(...texts);
  const items = contentReviewItems(warnings, texts);
  if (!items.length) return null;
  return (
    <div
      role="note"
      className="my-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"
    >
      <strong>Ellenőrizendő</strong>
      <ul className="mt-1 list-inside list-disc">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      {missing.length > 0 && (
        <p className="mt-2">
          A szögletes zárójeles adatokat töltsd ki a szövegben. Addig nem ütemezhető és nem tehető
          közzé.
        </p>
      )}
      {onReplace &&
        missing.map((placeholder) => (
          <label key={placeholder} className="mt-3 block">
            {placeholder}
            <input
              className="mt-1 block w-full rounded-md border bg-white px-3 py-2 text-foreground"
              placeholder="Add meg a valódi adatot, majd nyomj Entert"
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                const value = event.currentTarget.value.trim();
                if (value && !contentPlaceholders(value).length) onReplace(placeholder, value);
              }}
            />
          </label>
        ))}
      {missing.some((item) => /\[(?:cím|nyitvatartás)\]/iu.test(item)) && (
        <p className="mt-2">
          <Link to="/app/brand" className="font-medium underline underline-offset-4">
            Cím és nyitvatartás megadása a Márkaprofilban →
          </Link>
          <br />A mentett adatokat a következő generálás használja. A már elkészült szöveg
          helykitöltőit itt kell kitöltened.
        </p>
      )}
    </div>
  );
}
