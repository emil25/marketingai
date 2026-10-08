import { contentPlaceholders, contentReviewItems } from "@/lib/content-quality";

export function ContentReviewNotice({
  warnings = [],
  texts = [],
}: {
  warnings?: string[];
  texts?: string[];
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
    </div>
  );
}
