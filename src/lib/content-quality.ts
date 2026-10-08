/** The same unresolved-data check is used by the editor and server mutations. */
export function contentPlaceholders(...texts: Array<string | null | undefined>): string[] {
  return [...new Set(texts.flatMap((text) => text?.match(/\[[^\]]+\]/g) ?? []))];
}

export function assertContentReady(...texts: Array<string | null | undefined>) {
  const missing = contentPlaceholders(...texts);
  if (missing.length) {
    throw new Error(
      `Ütemezés vagy közzététel előtt töltsd ki a hiányzó adatokat: ${missing.join(", ")}.`,
    );
  }
}

/** Hide resolved placeholder reminders without hiding independent fact-review tasks. */
export function contentReviewItems(warnings: string[], texts: string[]) {
  const missing = contentPlaceholders(...texts);
  const reminders = warnings.filter((warning) => {
    const references = contentPlaceholders(warning);
    return references.length === 0 || references.some((reference) => missing.includes(reference));
  });
  return [
    ...new Set([
      ...reminders,
      ...missing.filter(
        (placeholder) => !reminders.some((warning) => warning.includes(placeholder)),
      ),
    ]),
  ];
}

/** Check explicit contract violations; semantic fact review still belongs to the user. */
export function contentRuleViolations(
  text: string,
  platform: string,
  facts: string,
  hashtags?: string[],
  language = "magyar",
): string[] {
  const errors: string[] = [];
  const published = text.replace(/\[[^\]]+\]/g, "");
  const tags = [
    ...new Set(
      (hashtags ?? published.match(/#[\p{L}\p{N}_]+/gu) ?? [])
        .map((tag) => tag.trim().replace(/^#+/, ""))
        .filter((tag) => /^[\p{L}\p{N}_]+$/u.test(tag)),
    ),
  ];
  if (platform === "facebook" && tags.length > 2) errors.push("Facebook: legfeljebb két hashtag.");
  if ((platform === "google-business" || platform === "google_business") && tags.length)
    errors.push("Google Business: hashtag nélkül.");
  if (platform === "instagram") {
    if (tags.length < 4 || tags.length > 6)
      errors.push(
        "Instagram: adj pontosan öt releváns #hashtaget a séma szerinti helyre (a heti tervben a vazlat legvégére). Jelenleg " +
          tags.length +
          " hashtag van.",
      );
    const emojiCount = published.match(/\p{Extended_Pictographic}/gu)?.length ?? 0;
    if (emojiCount < 1 || emojiCount > 3) errors.push("Instagram: 1–3 emoji szükséges.");
  }
  const unsupported = [
    {
      pattern:
        /hajnal\w*|korai nyitás|korán nyit|korán (?:munkába áll|elkezdjük a munkát)|még a város alszik/iu,
      evidence: /hajnal|korai nyitás|korán nyit|korán (?:munkába áll|elkezdjük a munkát)/iu,
      label: "hajnali működés / korai nyitás",
    },
    {
      pattern: /minden nap|mindennap|naponta|minden reggel/iu,
      evidence: /minden nap|mindennap|naponta|minden reggel/iu,
      label: "napi rendszeresség",
    },
    {
      pattern: /regisztrált (vendég|dolgozó|ügyfél)/iu,
      evidence: /regisztrált (vendég|dolgozó|ügyfél)/iu,
      label: "regisztrált ügyfelek",
    },
    {
      pattern: /díjnyertes|családi recept/iu,
      evidence: /díjnyertes|családi recept/iu,
      label: "díj vagy családi recept",
    },
  ];
  for (const rule of unsupported)
    if (rule.pattern.test(published) && !rule.evidence.test(facts))
      errors.push(
        `Nincs megadott tény ehhez: ${rule.label}. Töröld a "${published.match(rule.pattern)?.[0]}" fordulatot, vagy írj helyette szögletes zárójeles helykitöltőt.`,
      );
  if (
    /ínycsiklandó|feldobja a napod|energikus|varázslatos|páratlan|egyedülálló|legjobb választás|ne hagyd ki|ne maradj le|napod igazán jól kezdődjön/iu.test(
      published,
    )
  )
    errors.push("Kerüld a tiltott marketing-töltelékszavakat.");
  if (/reggelije[^.!?\n]{0,100}\bvár\b/iu.test(published))
    errors.push(
      "Természetellenes nyitómondat: ne a reggeli várjon. Fogalmazz a vállalkozás vagy a konkrét termék felől.",
    );
  if (
    /(?<![\p{L}])(?:sziasztok|tudtátok|nektek|kérhettek|indultok|gyertek|nézzetek)(?![\p{L}])/iu.test(
      published,
    ) &&
    /(?<![\p{L}])(?:te|téged|neked|indulsz|sietsz|kérheted)(?![\p{L}])/iu.test(published)
  )
    errors.push(
      "Ne keverd a te és ti megszólítást. Írd át végig egyes szám második személyre, kivéve ha a márkaprofil más megszólítást kér.",
    );
  const calls =
    published.match(
      /(?<![\p{L}])(?:látogass|gyere|írj|írd meg|foglalj|kérdezz|kóstold|nézd meg|vidd el|hozd magaddal|ugorj be|keresd fel|próbáld ki|kérj|válassz|oszd meg|ismerd meg|tudd meg|fedezd fel|mondd el|csatlakozz|rendelj|hívj|vásárolj|regisztrálj|jelentkezz|mentsd el|küldd el|vedd fel|látogasson|jöjjön|írjon|írja meg|foglaljon|kérdezzen|kóstolja|nézze meg|vigye el|hozza magával|ugorjon be|keresse fel|próbálja ki|kérjen|válasszon|ossza meg|ismerje meg|tudja meg|fedezze fel|mondja el|csatlakozzon|rendeljen|hívjon|vásároljon|regisztráljon|jelentkezzen|mentse el|küldje el|vegye fel)(?![\p{L}])/giu,
    ) ?? [];
  if (calls.length > 1)
    errors.push(
      `Több CTA szerepel: ${calls.join(", ")}. Csak egyetlen felhívás maradjon a végén. A többit alakítsd kijelentéssé vagy töröld. Kérdés-posztnál az Írd meg kommentben! lehet az egyetlen CTA; akkor ne legyen mellette Látogass el hozzánk!`,
    );
  const conversationalQuestion =
    platform === "facebook" && /\?\s*(?:#[\p{L}\p{N}_]+\s*)*$/u.test(published.trim());
  if (
    /^(magyar|hu(?:$|[-_])|hungarian)/i.test(language) &&
    calls.length === 0 &&
    !conversationalQuestion
  )
    errors.push(
      "Hiányzik a konkrét CTA. A végén egyetlen felhívás legyen: például Látogass el!, Írd meg kommentben!, Foglalj most! vagy Mentsd el, ha erre jársz! A Mentésre ajánljuk fordulat helyett írj közvetlen felhívást: Mentsd el!.",
    );
  return errors;
}

export const FACTUAL_CONTENT_RULES = `Csak a bemenetben megadott tényekre építs. A profilban vagy briefben hiányzó, a poszthoz szükséges adat helyére írj szögletes zárójeles helykitöltőt, például [cím], [nyitvatartás], [ár], [terméknév]. Nem szükséges hiányzó adatot ne erőltess a szövegbe. Ne találj ki korai nyitást, regisztrált vendégeket, kedvezményt, díjat, receptúrát, ügyfélvéleményt vagy eseményt. A márkahang példái stílusminták, nem igazolt üzleti tények.
Természetes, beszélt magyar nyelven írj, a márka hangnemével. A profil nyelvét kövesd, más nyelvű profilnál azon a nyelven írj. Alapértelmezés szerint végig egyes szám második személyben szólíts meg (te), a profil kifejezett megszólítását tiszteletben tartva. Ne keverd a te/ti formát.
Kerüld: ínycsiklandó, feldobja a napod, energikus, varázslatos, páratlan, egyedülálló, legjobb választás, ne hagyd ki, ne maradj le.
Erős első sor, rövid bekezdések, egy gondolat soronként. Pontosan egy konkrét CTA a végén; ne írj második felhívást, a bevezetőben se legyen másik felszólítás.  Az ellenőrzési megjegyzések külön ellenorizendo mezőbe kerüljenek, ne a publikálható szövegbe. Csak ténylegesen hiányzó adatot vagy bizonytalan üzleti állítást sorolj fel; hangnemet, hashtaghasználatot, saját szabálykövetésedet ne listázd ellenőrzési feladatként.
Instagram: önálló, rövid, erős nyitósor; utána tömör, vizuális történet, 1–3 emoji, 4–6 releváns hashtag. A CTA lehet mentés vagy megosztás, ha illik a célhoz. Facebook: beszélgetős helyi megszólítás, több kontextus, a végén egy konkrét felhívás VAGY egyetlen megválaszolható kérdés (pl. Te mit kérsz reggelire?), legfeljebb 1–2 hashtag. Ne írd át pusztán emojikkal ugyanazt a szöveget: a két platform nyitósora, felépítése és lezárása is különbözzön. A megadott kampánycélt és kötelező CTA-t tartsd meg, az alapértelmezett CTA-stílus nem kötelező szó szerinti mondat.
Google Business: tömör, tényszerű, hashtag nélkül. TikTok/YouTube: videóötlet 3–5 jelenetben, hanggal és felirattal. LinkedIn: tárgyszerű, a szakmai közönséghez igazítva. A hashtageket a kimeneti séma szerinti mezőben add meg.
Ne írj olyat, hogy a reggeli vár, vagy hogy a napod igazán jól kezdődjön. A vállalkozás nevében lehet várunk, a terméket pedig konkrétan nevezd meg, kizárólag a kapott terméklistából. Ne pótold a hiányzó terméknevet kitalált kínálattal. A mentett címet és nyitvatartást pontosan idézd, ne fogalmazd át, ne egészítsd ki. Ha nem szükségesek a poszthoz, kihagyhatók; hiányuk nem indokol automatikusan helykitöltőt minden posztban.
A megadott termékek/szolgáltatások listáját ne bővítsd: például a kenyér és péksütemény nem jelenti azt, hogy kávét, eszpresszót, teasüteményt vagy konkrét kenyérfajtát is árulnak. Ne állíts hagyományt, minőségi elsőbbséget, kézműves technológiát, ha nem szerepel a tényekben. A vizuális ötlet javaslat, ne szivárogjon át a szövegbe bizonyított tényként.
Egyetlen felhívás: a poszt törzsében kijelentések vagy kérdések legyenek, ne felszólítások. Például a "Válassz nálunk reggelit! Látogass el hozzánk!" két CTA, helyette "Nálunk elvitelre kérhető a reggeli. Látogass el hozzánk!".
Ha a brief kifejezetten kér címet vagy nyitvatartást, a kért adatokat tedd a szövegbe, a hiányzó értéket [cím] / [nyitvatartás] helykitöltővel. A hiányzó adat puszta felsorolása az ellenorizendo mezőben nem helyettesíti a helykitöltőt.`;
