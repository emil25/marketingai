// Fictional, editorially reviewed examples. Do not describe these as live AI results.
export const LANDING_DEMOS = [
  {
    id: "bakery",
    emoji: "🥐",
    label: "landing.hero.profession.bakery",
    brand: "Példa Pékség",
    idea: "Mutasd be a kenyerünket és a kakaós csigánkat Csíkszeredában. Kérdezd meg, melyiket választanák reggelire.",
    text: {
      hu: "Kenyér vagy kakaós csiga? Mi kerül nálad a reggelizőasztalra?\n\nA Példa Pékségben mindkettőt megtalálod Csíkszeredában.\n\nÍrd meg kommentben, te melyiket választanád!\n\n#pékség #Csíkszereda",
      ro: "Pâine caldă sau melc cu cacao? Ce alegi pentru micul dejun de azi? La Brutăria Exemplu din Miercurea Ciuc le găsești pe amândouă, proaspăt scoase din cuptor. Scrie-ne în comentarii preferatul tău! #brutărie #MiercureaCiuc",
    },
  },
  {
    id: "auto-service",
    emoji: "🔧",
    label: "landing.hero.profession.autoService",
    brand: "Példa Autószerviz",
    idea: "Szólj az autósoknak Székelyudvarhelyen, hogy jövő héttől indul a téli gumicsere, foglaljanak időpontot telefonon.",
    text: {
      hu: "Itt a hűvös reggelek ideje! 🚗 Jövő héttől indul nálunk a téli gumicsere Székelyudvarhelyen. Ne várd meg az első havazást és a sorban állást – foglalj időpontot még ma telefonon a [telefonszám] számon! #autószerviz #gumicsere #Székelyudvarhely",
      ro: "Diminețile devin tot mai reci! 🚗 De săptămâna viitoare începem schimbul de anvelope de iarnă în Odorheiu Secuiesc. Evită aglomerația și programează-te din timp la telefon: [număr telefon]! #serviceauto #anvelope #OdorheiuSecuiesc",
    },
  },
  {
    id: "beauty-salon",
    emoji: "💇‍♀️",
    label: "landing.hero.profession.beautySalon",
    brand: "Példa Szépségszalon",
    idea: "Péntek délután 3-ra felszabadult egy hajvágás és szárítás időpont Sepsiszentgyörgyön, írjanak üzenetet.",
    text: {
      hu: "Last minute szabad időpont! ✨ Péntek délután 15:00-ra felszabadult egy hely hajvágásra és szárításra Sepsiszentgyörgyön. Ha szeretnéd felfrissíteni a frizurád a hétvégére, írj nekünk üzenetet! #fodrászat #szépségszalon #Sepsiszentgyörgy",
      ro: "Loc liber last-minute! ✨ Vineri la ora 15:00 s-a eliberat un loc pentru tuns și coafat în Sfântu Gheorghe. Dacă vrei un look proaspăt pentru weekend, lasă-ne un mesaj privat! #coafor #salonfrumusete #SfantuGheorghe",
    },
  },
] as const;

export const LANDING_SOCIAL_POSTS = [
  {
    id: "bakery-instagram",
    network: "instagram",
    brand: "Példa Pékség",
    art: "bakery",
    artTitle: "Kenyér vagy kakaós csiga?",
    artSubtitle: "Te melyiket választanád?",
    caption: "Mi kerül nálad a reggelizőasztalra?",
    hashtags: "#pékség #Csíkszereda",
  },
  {
    id: "auto-service-facebook",
    network: "facebook",
    brand: "Példa Autószerviz",
    art: "auto",
    artTitle: "Készülj a hűvös reggelekre",
    artSubtitle: "Téli gumicsere · Székelyudvarhely",
    caption: "Jövő héttől indul a téli gumicsere. Időpontért írj nekünk!",
    hashtags: "#autószerviz #gumicsere",
  },
  {
    id: "beauty-instagram",
    network: "instagram",
    brand: "Példa Szépségszalon",
    art: "beauty",
    artTitle: "Friss frizura a hétvégére",
    artSubtitle: "Hajvágás és szárítás",
    caption: "Péntek délutánra felszabadult egy időpont Sepsiszentgyörgyön.",
    hashtags: "#fodrászat #Sepsiszentgyörgy",
  },
  {
    id: "guesthouse-facebook",
    network: "facebook",
    brand: "Példa Panzió",
    art: "guesthouse",
    artTitle: "Egy kis nyugalom a Hargitán",
    artSubtitle: "Te hogyan töltenél egy hétvégét?",
    caption: "Képzelj el egy lassabb hétvégét, a saját tempódban.",
    hashtags: "#pihenés #Hargita",
  },
] as const;

export const LANDING_EXAMPLE = {
  brand: LANDING_DEMOS[0].brand,
  idea: LANDING_DEMOS[0].idea,
  text: LANDING_DEMOS[0].text.hu,
};
