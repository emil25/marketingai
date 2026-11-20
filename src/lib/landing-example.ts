// Fictional, editorially reviewed examples. Do not describe these as live AI results.
export const LANDING_DEMOS = [
  {
    id: "bakery",
    emoji: "🥐",
    label: "landing.hero.profession.bakery",
    brand: "Példa Pékség",
    idea: "Mutasd be a kenyerünket és a kakaós csigánkat Csíkszeredában. Kérdezd meg, melyiket választanák reggelire.",
    copy: {
      facebook: {
        hu: "Reggelire inkább kenyeret vagy kakaós csigát választanál? A Példa Pékségben mindkettőt megtalálod Csíkszeredában. Írd meg, te melyiket választanád! #pékség #Csíkszereda",
        ro: "La micul dejun ai alege pâine sau melc cu cacao? La Brutăria Exemplu le găsești pe amândouă în Miercurea Ciuc. Scrie-ne ce ai alege! #brutărie #MiercureaCiuc",
      },
      instagram: {
        hu: "Kenyér vagy kakaós csiga? 🥐\nTe melyiket választanád reggelire?\n#pékség #Csíkszereda #reggeli #kakaóscsiga",
        ro: "Pâine sau melc cu cacao? 🥐\nTu ce ai alege la micul dejun?\n#brutărie #MiercureaCiuc #micdejun #melccucacao",
      },
    },
  },
  {
    id: "auto-service",
    emoji: "🔧",
    label: "landing.hero.profession.autoService",
    brand: "Példa Autószerviz",
    idea: "Szólj az autósoknak Székelyudvarhelyen, hogy jövő héttől indul a téli gumicsere, foglaljanak időpontot telefonon.",
    copy: {
      facebook: {
        hu: "Jövő héttől indul a téli gumicsere Székelyudvarhelyen. Időpontot telefonon foglalhatsz: [telefonszám]. #autószerviz #Székelyudvarhely",
        ro: "De săptămâna viitoare începe schimbul anvelopelor de iarnă în Odorheiu Secuiesc. Pentru programare, sună la [număr de telefon]. #serviceauto #OdorheiuSecuiesc",
      },
      instagram: {
        hu: "Téli gumicsere jövő héttől 🚗\nIdőpontfoglalás telefonon: [telefonszám].\n#autószerviz #gumicsere #Székelyudvarhely #autó",
        ro: "Schimbul anvelopelor de iarnă începe săptămâna viitoare 🚗\nPentru programare: [număr de telefon].\n#serviceauto #anvelope #OdorheiuSecuiesc #masina",
      },
    },
  },
  {
    id: "beauty-salon",
    emoji: "💇‍♀️",
    label: "landing.hero.profession.beautySalon",
    brand: "Példa Szépségszalon",
    idea: "Péntek délután 3-ra felszabadult egy hajvágás és szárítás időpont Sepsiszentgyörgyön, írjanak üzenetet.",
    copy: {
      facebook: {
        hu: "Péntek délután 15 órára felszabadult egy időpont hajvágásra és szárításra Sepsiszentgyörgyön. Ha kéred, írj nekünk üzenetet! #fodrászat #Sepsiszentgyörgy",
        ro: "Vineri, la ora 15:00, este disponibil un loc pentru tuns și coafat în Sfântu Gheorghe. Dacă dorești programarea, scrie-ne un mesaj! #coafor #SfantuGheorghe",
      },
      instagram: {
        hu: "Szabad időpont pénteken 15:00-kor ✂️\nHajvágás és szárítás Sepsiszentgyörgyön.\nÍrj üzenetet, ha kéred! #fodrászat #Sepsiszentgyörgy #hajvágás #időpont",
        ro: "Loc liber vineri la ora 15:00 ✂️\nTuns și coafat în Sfântu Gheorghe.\nScrie-ne dacă dorești programarea! #coafor #SfantuGheorghe #tuns #programare",
      },
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
  text: LANDING_DEMOS[0].copy.facebook.hu,
};
