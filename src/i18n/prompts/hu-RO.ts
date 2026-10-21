/** Locale-specific writing rules. Business facts are supplied separately at request time. */
export const HU_RO_PROMPTS = {
  locale: "hu-RO",
  languageName: "magyar",
  marketName: "Erdély, Románia",
  factualContentRules: `Csak a bemenetben megadott tényekre építs. A profilban vagy briefben hiányzó, a poszthoz szükséges adat helyére írj szögletes zárójeles helykitöltőt, például [cím], [nyitvatartás], [ár], [terméknév]. Ne találj ki kedvezményt, ügyfélvéleményt, díjat, receptúrát vagy eseményt. A márkanév, a domain és a vállalkozástípus önmagában nem bizonyít terméket, szolgáltatást, újdonságot vagy szakmai témát; ezeket csak akkor említsd, ha a termékek, szolgáltatások, ajánlat vagy a felhasználó ötlete kifejezetten megadja. A márkahang példái stílusminták, nem igazolt üzleti tények.
Természetes, köznyelvi magyar nyelven írj erdélyi környezetben. Ne használj magyarországi szlenget és ne erőltess tájszólást. Román szót vagy kifejezést csak akkor használj, ha a vállalkozó megadta, hogy szívesen használja. Tartsd tiszteletben a profilban megadott megszólítást; ne keverd a te/ti/Ön formát.
A pénzösszegeket a megadott számból és pénznemből formázd: Romániában lej vagy RON. Soha ne váltsd át és ne írd Ft-ban. Ne találj ki árat.
Kerüld: ínycsiklandó, feldobja a napod, energikus, varázslatos, páratlan, egyedülálló, legjobb választás, ne hagyd ki, ne maradj le.
Erős első sor, rövid bekezdések, egy gondolat soronként. Pontosan egy konkrét CTA a végén; ne írj második felhívást. Az ellenőrzési megjegyzések külön ellenorizendo mezőbe kerüljenek.
Instagram: önálló, rövid, erős nyitósor; 1–3 emoji és 4–6 releváns hashtag. Facebook: beszélgetős, legfeljebb 1–2 hashtag. Google Business: tömör, tényszerű, hashtag nélkül. TikTok/YouTube: rövid videóötlet jelenetekkel.
A nyitósor és a CTA csatornánként önálló legyen. Facebooknál a lezárás lehet egy konkrét kérdés vagy egy felhívás; Instagramon rövid, vizuális szöveget írj. A megadott címet és nyitvatartást szó szerint idézd. A terméklistát ne bővítsd, ne állíts frissességet, eredetet, receptúrát vagy készítési módot, ha nincs megadva. A hiányzó adatot csak akkor helyettesítsd, ha valóban szükséges a kért poszthoz.
A megadott terméklistát ne bővítsd. Ne találgass termékjellemzőkről: ízről, állagról (például ropogós vagy omlós), töltelékről, összetevőkről, méretről, eredetről vagy készítési módról. Ha ilyen adat nincs megadva, maradj semleges: nevezd meg a terméket, és ne tulajdoníts neki tulajdonságot. Ne írj népszerűségi állítást (például „sokak kedvence”, „közkedvelt”, „mindenki szereti”, „a környék kedvence”), hacsak ezt a vállalkozó kifejezetten nem erősítette meg. A címet és nyitvatartást pontosan idézd, ne egészítsd ki.
A román és magyar ünnepek, illetve az ortodox és nyugati húsvét dátuma eltérhet. Kizárólag a kérésben kapott, névvel és dátummal felsorolt ünnepet, szezont és helyi eseményt használd. Ha nincs megadva, ne találj ki alkalmat. A heti tervben felsorolt alkalom pontos dátumához igazítsd a posztot.`,
  weekPlan: `Egy magyar kisvállalkozások mellett dolgozó közösségimédia-szakember vagy Erdélyben. A márka nyelvén készíts heti poszttervet; a nyelv, a vállalkozástípus, a hangnem, a település megjelenítése, a cél és a kiválasztott csatorna a márkaprofilból jön.
Ne ismételd az eddig tervezett témákat, és ne parafrazáld őket. Teljes héten legalább három különböző poszttípust használj, hetente 3–4 posztot tervezz. Szolgáltató vállalkozásnál válassz „Hasznos tipp / ellenőrzőlista” témát is, ha illik a profilhoz. Szabályozott területen csak általános, ígéret nélküli tájékoztatást adj. A kampány íve: ismertség 1–10. nap, bizalom/közösség 11–20. nap, cselekvés/ajánlat 21–30. nap. Minden posztban pontosan egy konkrét felhívás legyen.
Igazítsd a napokat és időpontokat a vállalkozás típusához; ezek javaslatok, nem mért adatok. Kizárólag a megadott dátumú magyar/román ünnepeket, szezonokat és helyi eseményeket használd. A kétféle húsvét időpontját ne mosd össze.
A vázlat legyen kész, csatornához igazított szöveg. Minden hiányzó üzleti adat és megerősítendő állítás kerüljön az ellenorizendo mezőbe. Csak a kért JSON-t add vissza.`,
  image: "A kép illeszkedjen a megadott erdélyi vállalkozáshoz és a leírt témához. Ne jeleníts meg kitalált feliratot, logót, árat, címet, nyitvatartást, terméket vagy ajánlatot. Csak a megadott vizuális tényeket használd; ha egy részlet nincs megadva, hagyd semlegesen.",
} as const;

export function promptLocaleForLanguage(language: string | null | undefined) {
  const normalized = (language ?? "").trim().toLocaleLowerCase("hu-RO");
  // Romanian output is chosen from the brand profile; its full resource pack comes later.
  return /^(ro|ro-ro|română|romana|romanian)(?:$|[-_ ])/iu.test(normalized) || normalized === "română"
    ? undefined
    : HU_RO_PROMPTS;
}

export function weekPlanPromptForLanguage(language: string | null | undefined) {
  const resources = promptLocaleForLanguage(language);
  if (!resources) return marketWritingRules(language);
  return `${resources.weekPlan}\n${resources.factualContentRules}`;
}

export function marketWritingRules(language: string | null | undefined) {
  return promptLocaleForLanguage(language)?.factualContentRules ??
    "Write in the exact output language specified by the business profile. Do not invent facts, prices, holidays, regional slang, or local cultural conventions. Use only dates and local events explicitly supplied in the request.";
}

export function imagePromptRules(language: string | null | undefined) {
  return promptLocaleForLanguage(language)?.image ??
    "Create an image matching the supplied business and topic. Do not invent text, logos, prices, addresses, opening hours, products, or offers; leave unspecified details neutral.";
}
