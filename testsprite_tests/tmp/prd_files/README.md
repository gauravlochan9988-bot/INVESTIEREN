# Investieren MVP

FastAPI MVP for an educational investing dashboard with a fixed US large-cap watchlist, explainable BUY/HOLD/SELL signals, and a manual demo portfolio.

## What is included
- Live stock watchlist data via `yfinance`
- Rule-based analysis using `SMA20`, `SMA50`, `RSI14`, 5-day momentum, and 30-day volatility
- Macro and market context using `SPY` trend, configurable rates effect, and a USD proxy
- Optional OpenAI explanation layer using `gpt-5.4`, with deterministic fallback
- Single-user demo portfolio stored in PostgreSQL
- Static frontend served directly by FastAPI

## Analysis model
- The app is a personal decision-support tool, not an automated trading system.
- Transparent score mapping:
  - `+1` Trend: price above `SMA50`
  - `+1` SMA crossover: `SMA20 > SMA50`
  - `+1` RSI: below `70`
  - `+1` Momentum: 5-day momentum is positive
  - `-1` Volatility: 30-day volatility is high
- Recommendation mapping:
  - `Score >= 3` -> `BUY`
  - `Score 1-2` -> `HOLD`
  - `Score <= 0` -> `SELL`
- The recommendation is a probability-based technical view, not a guarantee.
- Macro context is folded into confidence, risk, entry strictness, and position sizing.
- External events can still invalidate the setup quickly.

## Project structure
- `backend/app`: API, services, schemas, SQLAlchemy models, and static UI
- `backend/alembic`: migration config and initial schema migration
- `backend/tests`: unit, service, API, and UI smoke tests
- `docker-compose.yml`: local PostgreSQL service

## Local setup
1. Copy `.env.example` to `.env`.
2. Start PostgreSQL:

```bash
docker compose up -d
```

3. Create a virtual environment and install dependencies:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements-dev.txt
```

4. Apply the database migration:

```bash
cd backend
alembic upgrade head
```

5. Start the application:

```bash
uvicorn app.main:app --reload
```

6. Open [http://127.0.0.1:8000](http://127.0.0.1:8000).

## API overview
- `GET /api/health`
- `GET /api/stocks`
- `GET /api/stocks/{symbol}/history?range=1mo`
- `POST /api/analyze`
- `GET /api/portfolio`
- `POST /api/portfolio/positions`
- `PATCH /api/portfolio/positions/{id}`
- `DELETE /api/portfolio/positions/{id}`

## Macro context config
- `MACRO_CACHE_TTL_SECONDS`: cache lifetime for macro data, default `900`
- `MACRO_MARKET_SYMBOL`: market proxy, default `SPY`
- `MACRO_USD_SYMBOL`: USD proxy, default `UUP`
- `MACRO_INTEREST_RATE_EFFECT`: simple placeholder `positive | neutral | negative`

## Notes
- This MVP is educational only and does not place trades.
- Auth and real broker connectivity are intentionally out of scope for v1.
- OpenAI is optional: if `OPENAI_API_KEY` is empty, summaries stay fully deterministic.
