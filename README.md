# Investieren MVP

FastAPI + static frontend for a modern trading dashboard with Finnhub market data, TradingView charts, and a simple Tailwind UI.

## What is included
- Live watchlist and symbol snapshots via `Finnhub`
- Embedded `TradingView` chart widget
- Tailwind-based trading dashboard frontend
- FastAPI backend that proxies Finnhub so the API key stays server-side
- Optional legacy analysis/portfolio routes from the earlier MVP

## Dashboard stack
- `Finnhub` provides quote, profile, and company news data
- `TradingView` renders the live chart widget
- `Tailwind` handles the main UI layout and styling
- The password gate is frontend-only and currently uses `9988`

## Project structure
- `index.html`, `app.js`, `styles.css`: root frontend shipped to Vercel
- `backend/app`: FastAPI routes, services, schemas, and legacy portfolio/analysis logic
- `backend/tests`: smoke, API, and service tests

## Local setup
1. Copy `.env.example` to `.env` and set `FINNHUB_API_KEY`.
2. Create a virtual environment and install dependencies:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements-dev.txt
```

3. Start the application:

```bash
uvicorn app.main:app --reload
```

4. Open [http://127.0.0.1:8000](http://127.0.0.1:8000).

## Vercel deployment
- Vercel should serve only the root frontend files
- The backend stays on Render
- The frontend reads its API base from `app.js` and calls:
  - `https://investieren-backend-cxvw.onrender.com`
- Keep `FINNHUB_API_KEY` on Render only, not on Vercel

## Render deployment
- The FastAPI app object is available at both:
  - `backend.app:app`
  - `backend.app.main:app`
- Recommended Render start command:

```bash
uvicorn backend.app:app --host 0.0.0.0 --port 10000
```

- Equivalent explicit command:

```bash
uvicorn backend.app.main:app --host 0.0.0.0 --port 10000
```

## API overview
- `GET /api/health`
- `GET /api/dashboard/watchlist`
- `GET /api/dashboard/symbol/{symbol}`
- `GET /api/dashboard/news/{symbol}`

## Notes
- This app is a market dashboard, not an execution platform.
- Finnhub free plans are rate-limited, so the backend caches watchlist results briefly.
- The legacy analysis and portfolio code is still in the repo, but the main UI now focuses on quotes, chart, and news.
