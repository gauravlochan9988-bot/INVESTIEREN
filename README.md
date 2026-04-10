# Investieren MVP

FastAPI + static frontend for a trading dashboard with Finnhub market data and TradingView charts.

## Platform target state
- Frontend: Vercel (static files only)
- Backend API: Railway (FastAPI only)
- Database: Neon Postgres
- No mixed backend hosting

## What is included
- Live watchlist and symbol snapshots via `Finnhub`
- Embedded `TradingView` chart widget
- Tailwind-based dashboard frontend
- FastAPI backend for auth, analysis, watchlist, favorites, smart alerts, billing, and cron endpoints

## Project structure
- `index.html`, `app.js`, `styles.css`, `pricing.html`, `pricing.js`: frontend shipped to Vercel
- `backend/app`: FastAPI routes, services, schemas, repositories, models
- `backend/tests`: API and service tests

## Local setup
1. Copy `.env.example` to `.env` and set required secrets.
2. Create a virtual environment and install dependencies:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements-dev.txt
```

3. Start the app from repo root:

```bash
uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8003
```

4. Open [http://127.0.0.1:8003](http://127.0.0.1:8003).

## Vercel frontend deployment
- Vercel serves only static frontend files.
- Frontend API target is the Railway backend:
  - `https://investieren-production.up.railway.app`
- Do not expose backend secrets on Vercel.

## Railway backend deployment
- App entrypoint:
  - `backend.app.main:app`
- Start command:

```bash
uvicorn backend.app.main:app --host 0.0.0.0 --port ${PORT}
```

- Healthcheck endpoint:
  - `GET /api/health`
- Internal cron endpoints (secured with `X-Cron-Secret`):
  - `POST /api/internal/cron/favorite-signals`
  - `POST /api/internal/cron/user-alerts`

### Railway scheduled jobs
- Configure scheduled calls inside Railway (or an external scheduler) to hit:
  - `https://investieren-production.up.railway.app/api/internal/cron/favorite-signals`
  - `https://investieren-production.up.railway.app/api/internal/cron/user-alerts`
- Always include header:

```bash
X-Cron-Secret: $CRON_SECRET
```

## Neon database
- Set `DATABASE_URL` to Neon Postgres:

```bash
DATABASE_URL=postgresql+psycopg2://USER:PASSWORD@ep-xxxxxx.eu-central-1.aws.neon.tech/neondb?sslmode=require
```

- Keep `sslmode=require` enabled.
- App health exposes DB backend/mode in `GET /api/health`.

## Environment variables (backend)
- `DATABASE_URL`
- `APP_ENV`
- `DEBUG`
- `FINNHUB_API_KEY`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `CLERK_PUBLISHABLE_KEY`
- `CLERK_FAPI` (or `CLERK_FRONTEND_API_URL`)
- `CLERK_SECRET_KEY` (required if `CLERK_JWT_KEY` is not set)
- `CLERK_JWT_KEY` (optional; only required for networkless verification)
- `CLERK_AUTHORIZED_PARTIES` (comma-separated origins, optional override)
- `FRONTEND_ORIGIN`
- `CORS_ALLOW_ORIGINS` (comma-separated, optional)
- `OWNER_AUTH_SUBJECTS` (comma-separated Clerk `sub` values with owner access)
- `CRON_SECRET`

## API overview
- `GET /api/health`
- `GET /api/dashboard/watchlist`
- `GET /api/dashboard/symbol/{symbol}`
- `GET /api/dashboard/news/{symbol}`
- `GET /api/analysis/{symbol}`
- `GET/POST /api/favorites`
- `GET /api/alerts`

## Notes
- This app is a market dashboard, not an execution platform.
- Finnhub free plans are rate-limited; backend uses caching to reduce external calls.
