# AI Business OS 2.0 — Vercel verzió

Ez a projekt feltöltésre kész: Vite + React frontend és egy Vercel serverless
függvény (`api/claude.js`), ami biztonságosan, a szerveren tartja az Anthropic
API-kulcsot.

## Mi kell hozzá?

1. Ingyenes fiók: https://github.com és https://vercel.com
2. Anthropic API-kulcs: https://console.anthropic.com → **API Keys** → Create Key
   (az API használata fizetős, kis összegű feltöltés kell hozzá)

## Feltöltés lépésről lépésre

### 1. Kód feltöltése GitHubra

- GitHubon hozz létre egy új (üres) repository-t, pl. `ai-business-os`
- A gépeden, ebben a mappában:

```bash
git init
git add .
git commit -m "AI Business OS 2.0"
git branch -M main
git remote add origin https://github.com/FELHASZNALONEV/ai-business-os.git
git push -u origin main
```

### 2. Deploy Vercelre

- https://vercel.com → **Add New → Project** → válaszd ki a repót
- A Vercel automatikusan felismeri, hogy Vite projekt — semmit nem kell átállítani
- **Deploy** előtt (vagy után a Settings-ben): **Settings → Environment Variables**
  - Name: `ANTHROPIC_API_KEY`
  - Value: a saját kulcsod (sk-ant-...)
  - Environment: Production + Preview
- Deploy → kapsz egy `https://valami.vercel.app` címet — kész!

> Ha a kulcsot a deploy UTÁN adtad hozzá, nyomj egy **Redeploy**-t
> (Deployments → ⋯ → Redeploy), különben a függvény még nem látja.

### 3. Kipróbálás helyben (opcionális)

```bash
npm install
npm install -g vercel
vercel dev
```

A `vercel dev` futtatja az `api/claude.js` függvényt is helyben.
(A sima `npm run dev` csak a frontendet indítja — abban az AI-hívások nem működnek,
mert nincs mögötte az API-proxy.)

Helyi teszthez hozz létre egy `.env` fájlt:

```
ANTHROPIC_API_KEY=sk-ant-...
```

## Fontos tudnivalók

- **Az API-kulcs soha nem kerül a böngészőbe** — a frontend a saját
  `/api/claude` végpontot hívja, a kulcsot csak a szerver látja.
- Minden AI-generálás valódi API-hívás, azaz **pénzbe kerül** (tipikusan
  néhány cent / hívás). A `max_tokens` 2000-re van korlátozva a proxyban.
- A nyilvános oldaladon bárki tudja hívni az AI-funkciókat — élesítés előtt
  érdemes bejelentkezést és rate-limitet tenni elé (pl. Clerk/Auth.js + Upstash).
- A dashboard számai, CRM-adatok, naptár: demó adatok. Valós integrációkhoz
  (Meta, Google, Stripe) külön backend-fejlesztés kell.

## Szerkezet

```
├── api/claude.js      ← serverless proxy az Anthropic API-hoz
├── src/App.jsx        ← a teljes alkalmazás (UI + logika)
├── src/main.jsx       ← React belépési pont
├── index.html
├── vite.config.js
└── package.json
```
