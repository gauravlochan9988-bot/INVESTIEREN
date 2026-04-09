"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const ACCESS_STORAGE_KEY = "gq_trading_access";

export function DashboardClient() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  // Run once on mount only — including `router` in deps can retrigger the effect
  // and leave the page stuck on "Checking access..." while navigation replays.
  useEffect(() => {
    const hasAccess = window.localStorage.getItem(ACCESS_STORAGE_KEY) === "granted";

    if (!hasAccess) {
      window.location.replace("/");
      return;
    }

    setReady(true);
  }, []);

  function handleLogout() {
    window.localStorage.removeItem(ACCESS_STORAGE_KEY);
    router.replace("/");
  }

  if (!ready) {
    return (
      <main className="dashboard-page">
        <section className="dashboard-loading">Checking access...</section>
      </main>
    );
  }

  return (
    <main className="dashboard-page">
      <section className="dashboard-shell-simple">
        <div className="dashboard-topbar">
          <div>
            <p className="dashboard-kicker">Protected workspace</p>
            <h1 className="dashboard-title">GQ Trading Dashboard</h1>
          </div>
          <button type="button" className="dashboard-logout" onClick={handleLogout}>
            Logout
          </button>
        </div>

        <section className="trade-card">
          <p className="card-kicker">Trade Decision</p>
          <div className="trade-card-row">
            <div>
              <p className="trade-card-value">BUY</p>
              <p className="trade-card-copy">AI momentum and market structure are aligned.</p>
            </div>
            <span className="trade-badge">Live</span>
          </div>
        </section>

        <section className="dashboard-grid-simple">
          <article className="simple-panel">
            <p className="card-kicker">Chart</p>
            <div className="placeholder-box placeholder-chart">Chart placeholder</div>
          </article>

          <article className="simple-panel">
            <p className="card-kicker">Watchlist</p>
            <div className="placeholder-list">
              <div className="placeholder-row">
                <span>NVDA</span>
                <span>+2.4%</span>
              </div>
              <div className="placeholder-row">
                <span>AAPL</span>
                <span>+1.1%</span>
              </div>
              <div className="placeholder-row">
                <span>TSLA</span>
                <span>-0.8%</span>
              </div>
            </div>
          </article>

          <article className="simple-panel simple-panel-wide">
            <p className="card-kicker">Alerts</p>
            <div className="placeholder-list">
              <div className="placeholder-row">
                <span>EUR/USD breakout detected</span>
                <span>Now</span>
              </div>
              <div className="placeholder-row">
                <span>Nasdaq momentum confirmed</span>
                <span>5m</span>
              </div>
              <div className="placeholder-row">
                <span>Risk level elevated on crypto basket</span>
                <span>12m</span>
              </div>
            </div>
          </article>
        </section>
      </section>
    </main>
  );
}
