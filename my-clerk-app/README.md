# Investieren Frontend

Next.js App Router frontend for Investieren, deployed on **Vercel**. API calls go to the **Railway** backend.

## Environment

Create `.env.local` with:

```bash
RAILWAY_API_URL=https://investieren-production.up.railway.app
NEXT_PUBLIC_RAILWAY_API_URL=https://investieren-production.up.railway.app
```

If your production frontend URL changes, set `FRONTEND_ORIGIN` (or the equivalent your backend expects) on Railway so CORS and callbacks stay correct.

## Run

Immer im Ordner **`my-clerk-app`** (nicht nur im Repo-Root — dort liegt kein Next.js-Projekt):

```bash
cd my-clerk-app
npm install
npm run dev
```

Im Browser: **http://127.0.0.1:3000** (oder **http://localhost:3000** — beides sollte gehen). Dann Zugangscode eingeben und `/dashboard` öffnen.

Falls der Dev-Server komisch hängt, alternativ: `npm run dev:webpack` (Webpack statt Turbopack).

### Wenn du die Website nicht siehst (lokal)

1. Terminal: läuft `npm run dev` **ohne** rote Fehler? Fenster offen lassen.
2. Exakt diese URL testen: **http://127.0.0.1:3000**
3. Wenn der Terminal etwas von **Port 3001** (o. Ä.) schreibt — **diese** URL nutzen.
4. Hart neu laden: **Cmd+Shift+R** (Mac) bzw. Strg+Shift+R.
5. Im Ordner **`my-clerk-app`** installieren und starten (siehe oben).

### Vercel: Seite leer oder Build schlägt fehl

Das Next.js-Projekt liegt unter **`my-clerk-app`**, nicht im Repo-Root. Im Vercel-Projekt unter **Settings → General → Root Directory** **`my-clerk-app`** eintragen und neu deployen. Ohne diese Einstellung findet Vercel oft kein gültiges Next.js-Setup.

## Access

- **Home:** access code form (client-side check against a fixed code in `components/access-code-form.tsx`, or wire it to your API).
- **`/api/admin-access`:** proxies to Railway `POST /api/auth/access-code` and sets an httpOnly session cookie when the backend accepts the code.
- **`/dashboard`:** gated in the browser via `localStorage` after unlock (not a substitute for server auth on sensitive data).
