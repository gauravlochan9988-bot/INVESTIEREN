if (window.location.protocol === "file:") {
  window.location.replace("http://127.0.0.1:8000/");
}

const DEPLOYED_API_ORIGIN = "https://investieren-api.onrender.com";
const LOCAL_API_HOSTS = new Set(["127.0.0.1", "localhost"]);
const AUTH_PASSWORD = "9988";
const STORAGE_KEYS = {
  authenticated: "investieren:authenticated",
  selectedSymbol: "investieren:selectedSymbol",
};

const state = {
  selectedSymbol: window.sessionStorage.getItem(STORAGE_KEYS.selectedSymbol) || "AAPL",
  watchlist: [],
  tvReady: typeof window.TradingView !== "undefined",
  activeRequest: 0,
};

const elements = {
  authOverlay: document.getElementById("authOverlay"),
  authForm: document.getElementById("authForm"),
  authPassword: document.getElementById("authPassword"),
  authError: document.getElementById("authError"),
  authCancelButton: document.getElementById("authCancelButton"),
  appShell: document.getElementById("appShell"),
  backendStatus: document.getElementById("backendStatus"),
  errorBanner: document.getElementById("errorBanner"),
  logoutButton: document.getElementById("logoutButton"),
  refreshButton: document.getElementById("refreshButton"),
  brandHomeButton: document.getElementById("brandHomeButton"),
  searchForm: document.getElementById("searchForm"),
  searchInput: document.getElementById("searchInput"),
  watchlistMeta: document.getElementById("watchlistMeta"),
  watchlistBody: document.getElementById("watchlistBody"),
  selectedSymbolName: document.getElementById("selectedSymbolName"),
  selectedCompanyName: document.getElementById("selectedCompanyName"),
  changeBadge: document.getElementById("changeBadge"),
  metricPrice: document.getElementById("metricPrice"),
  metricHigh: document.getElementById("metricHigh"),
  metricLow: document.getElementById("metricLow"),
  metricOpen: document.getElementById("metricOpen"),
  metricPrevClose: document.getElementById("metricPrevClose"),
  chartSymbolBadge: document.getElementById("chartSymbolBadge"),
  tradingviewChart: document.getElementById("tradingviewChart"),
  companyLogo: document.getElementById("companyLogo"),
  companyHeadline: document.getElementById("companyHeadline"),
  companyExchange: document.getElementById("companyExchange"),
  companyDetails: document.getElementById("companyDetails"),
  newsList: document.getElementById("newsList"),
  newsMeta: document.getElementById("newsMeta"),
};

function resolveApiBaseUrl() {
  if (LOCAL_API_HOSTS.has(window.location.hostname)) {
    return `${window.location.protocol}//${window.location.host}`;
  }
  return DEPLOYED_API_ORIGIN;
}

function buildApiUrl(path) {
  return `${resolveApiBaseUrl()}${path}`;
}

function currency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function compactNumber(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "--";
  }
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(Number(value));
}

function percent(value) {
  const numeric = Number(value || 0);
  return `${numeric >= 0 ? "+" : ""}${numeric.toFixed(2)}%`;
}

function setBackendStatus(message, tone = "loading") {
  const palette = {
    loading: "border-white/10 bg-slate-950/60 text-slate-300",
    ok: "border-emerald-400/20 bg-emerald-400/10 text-emerald-200",
    error: "border-rose-400/20 bg-rose-400/10 text-rose-200",
  };
  elements.backendStatus.textContent = message;
  elements.backendStatus.className = `rounded-full border px-4 py-2 text-xs font-medium ${palette[tone] || palette.loading}`;
}

function showError(message) {
  elements.errorBanner.textContent = message;
  elements.errorBanner.hidden = false;
}

function clearError() {
  elements.errorBanner.hidden = true;
  elements.errorBanner.textContent = "";
}

function setAuthenticated(value) {
  if (value) {
    window.sessionStorage.setItem(STORAGE_KEYS.authenticated, "1");
    return;
  }
  window.sessionStorage.removeItem(STORAGE_KEYS.authenticated);
}

function isAuthenticated() {
  return window.sessionStorage.getItem(STORAGE_KEYS.authenticated) === "1";
}

function persistSelectedSymbol(symbol) {
  state.selectedSymbol = symbol;
  window.sessionStorage.setItem(STORAGE_KEYS.selectedSymbol, symbol);
}

function showAppShell() {
  elements.authOverlay.hidden = true;
  elements.appShell.hidden = false;
}

function showLoginOverlay() {
  elements.appShell.hidden = true;
  elements.authOverlay.hidden = false;
  elements.authError.hidden = true;
  elements.authForm.reset();
}

async function api(path, options = {}) {
  const url = buildApiUrl(path);
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  let payload = null;
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    payload = await response.json();
  } else {
    payload = await response.text();
  }

  if (!response.ok) {
    const detail = payload?.error || payload?.detail || payload || "Request failed.";
    console.error("[frontend] API failure", { path, status: response.status, detail });
    throw new Error(String(detail));
  }

  console.log("[frontend] API ok", { path, status: response.status });
  return payload;
}

async function loadBackendHealth() {
  try {
    const payload = await api("/api/health");
    setBackendStatus(`Backend ${payload.status} · ${payload.environment}`, "ok");
  } catch (error) {
    setBackendStatus("Backend unavailable", "error");
    throw error;
  }
}

function renderLoadingWatchlist() {
  elements.watchlistBody.innerHTML = `
    <div class="space-y-3">
      ${Array.from({ length: 5 })
        .map(
          () => `
            <div class="animate-pulse rounded-2xl border border-white/10 bg-slate-950/50 p-4">
              <div class="h-4 w-20 rounded bg-white/10"></div>
              <div class="mt-3 h-6 w-28 rounded bg-white/10"></div>
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderWatchlist(items) {
  elements.watchlistMeta.textContent = `${items.length} symbols`;
  elements.watchlistBody.innerHTML = "";

  items.forEach((item) => {
    const tone = item.change_percent >= 0 ? "text-emerald-300" : "text-rose-300";
    const active = item.symbol === state.selectedSymbol;
    const card = document.createElement("button");
    card.type = "button";
    card.dataset.symbol = item.symbol;
    card.className = [
      "w-full rounded-2xl border p-4 text-left transition",
      active
        ? "border-cyan-300/40 bg-cyan-300/10 shadow-lg shadow-cyan-500/10"
        : "border-white/10 bg-slate-950/50 hover:bg-slate-900",
    ].join(" ");
    card.innerHTML = `
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class="text-sm font-semibold tracking-tight">${item.symbol}</p>
          <p class="mt-1 text-xs text-slate-400">${item.name}</p>
        </div>
        <div class="text-right">
          <p class="text-sm font-semibold">${currency(item.price)}</p>
          <p class="mt-1 text-xs font-medium ${tone}">${percent(item.change_percent)}</p>
        </div>
      </div>
    `;
    card.addEventListener("click", () => {
      loadSymbol(item.symbol);
    });
    elements.watchlistBody.appendChild(card);
  });
}

function renderCompanyDetails(overview) {
  const rows = [
    ["Exchange", overview.exchange || "--"],
    ["Industry", overview.finnhub_industry || "--"],
    ["IPO", overview.ipo || "--"],
    ["Market Cap", overview.market_capitalization ? `${compactNumber(overview.market_capitalization)} B` : "--"],
    ["Shares Out", overview.share_outstanding ? compactNumber(overview.share_outstanding) : "--"],
  ];

  elements.companyDetails.innerHTML = rows
    .map(
      ([label, value]) => `
        <div class="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3">
          <dt class="text-sm text-slate-400">${label}</dt>
          <dd class="text-sm font-medium text-white">${value}</dd>
        </div>
      `,
    )
    .join("");
}

function renderNews(newsItems) {
  elements.newsList.innerHTML = "";

  if (!newsItems.length) {
    elements.newsList.innerHTML = `
      <div class="rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-4 text-sm text-slate-400">
        No recent company news available.
      </div>
    `;
    return;
  }

  newsItems.forEach((item) => {
    const article = document.createElement("a");
    article.href = item.url;
    article.target = "_blank";
    article.rel = "noreferrer";
    article.className =
      "block rounded-2xl border border-white/10 bg-slate-950/45 p-4 transition hover:border-cyan-300/30 hover:bg-slate-900";
    article.innerHTML = `
      <p class="text-sm font-semibold leading-6 text-white">${item.headline}</p>
      <p class="mt-2 line-clamp-3 text-sm leading-6 text-slate-400">${item.summary || "Open the article to read more."}</p>
      <div class="mt-3 flex items-center justify-between text-xs text-slate-500">
        <span>${item.source || "Finnhub"}</span>
        <span>${new Date(item.published_at).toLocaleDateString()}</span>
      </div>
    `;
    elements.newsList.appendChild(article);
  });
}

function renderOverview(overview) {
  elements.selectedSymbolName.textContent = overview.symbol;
  elements.selectedCompanyName.textContent = overview.name;
  elements.chartSymbolBadge.textContent = overview.symbol;
  elements.metricPrice.textContent = currency(overview.price);
  elements.metricHigh.textContent = currency(overview.high);
  elements.metricLow.textContent = currency(overview.low);
  elements.metricOpen.textContent = currency(overview.open);
  elements.metricPrevClose.textContent = currency(overview.previous_close);

  const positive = overview.change_percent >= 0;
  elements.changeBadge.textContent = percent(overview.change_percent);
  elements.changeBadge.className = [
    "inline-flex w-fit rounded-full px-4 py-2 text-sm font-semibold",
    positive ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300",
  ].join(" ");

  elements.companyHeadline.textContent = overview.name;
  elements.companyExchange.textContent = overview.exchange || "Exchange unavailable";

  if (overview.logo) {
    elements.companyLogo.src = overview.logo;
    elements.companyLogo.alt = `${overview.name} logo`;
    elements.companyLogo.classList.remove("hidden");
  } else {
    elements.companyLogo.classList.add("hidden");
    elements.companyLogo.removeAttribute("src");
  }

  renderCompanyDetails(overview);
}

function toTradingViewSymbol(symbol) {
  const plain = symbol.toUpperCase();
  const mapping = {
    AAPL: "NASDAQ:AAPL",
    MSFT: "NASDAQ:MSFT",
    NVDA: "NASDAQ:NVDA",
    AMZN: "NASDAQ:AMZN",
    META: "NASDAQ:META",
    TSLA: "NASDAQ:TSLA",
  };
  return mapping[plain] || plain;
}

function renderTradingView(symbol) {
  elements.tradingviewChart.innerHTML = '<div class="tv-loader">Loading TradingView chart...</div>';

  if (!window.TradingView || typeof window.TradingView.widget !== "function") {
    elements.tradingviewChart.innerHTML =
      '<div class="tv-loader">TradingView widget failed to load.</div>';
    return;
  }

  elements.tradingviewChart.innerHTML = "";
  // TradingView expects the container element to exist in the DOM before init.
  new window.TradingView.widget({
    autosize: true,
    symbol: toTradingViewSymbol(symbol),
    interval: "D",
    timezone: "Etc/UTC",
    theme: "dark",
    style: "1",
    locale: "en",
    allow_symbol_change: false,
    hide_top_toolbar: false,
    container_id: "tradingviewChart",
  });
}

async function loadWatchlist(forceRefresh = false) {
  renderLoadingWatchlist();
  elements.watchlistMeta.textContent = "Syncing Finnhub...";
  const suffix = forceRefresh ? "?refresh=1" : "";
  const items = await api(`/api/dashboard/watchlist${suffix}`);
  state.watchlist = items;
  renderWatchlist(items);
  return items;
}

async function loadSymbol(symbol, forceRefresh = false) {
  const requestId = ++state.activeRequest;
  const normalized = symbol.trim().toUpperCase();
  persistSelectedSymbol(normalized);
  clearError();
  renderWatchlist(state.watchlist);
  elements.newsMeta.textContent = "Loading latest headlines...";

  try {
    const suffix = forceRefresh ? "?refresh=1" : "";
    const [overview, news] = await Promise.all([
      api(`/api/dashboard/symbol/${encodeURIComponent(normalized)}${suffix}`),
      api(`/api/dashboard/news/${encodeURIComponent(normalized)}${suffix}`),
    ]);

    if (requestId !== state.activeRequest) {
      return;
    }

    renderOverview(overview);
    renderNews(news);
    elements.newsMeta.textContent = `${news.length} stories`;
    renderTradingView(normalized);
    renderWatchlist(state.watchlist);
  } catch (error) {
    if (requestId !== state.activeRequest) {
      return;
    }
    showError(error.message || "Failed to load symbol data.");
    elements.newsMeta.textContent = "Unavailable";
  }
}

async function bootDashboard(forceRefresh = false) {
  clearError();
  try {
    setBackendStatus("Connecting backend...", "loading");
    await loadBackendHealth();
    const watchlist = await loadWatchlist(forceRefresh);
    const fallback = watchlist.find((item) => item.symbol === state.selectedSymbol)?.symbol || watchlist[0]?.symbol;
    if (fallback) {
      await loadSymbol(fallback, forceRefresh);
    }
  } catch (error) {
    showError(error.message || "Dashboard could not load.");
    setBackendStatus("Backend unavailable", "error");
  }
}

function bindAuth() {
  elements.authCancelButton.addEventListener("click", () => {
    elements.authForm.reset();
    elements.authError.hidden = true;
    elements.authPassword.focus();
  });

  elements.authPassword.addEventListener("input", () => {
    elements.authError.hidden = true;
  });

  elements.authForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (elements.authPassword.value.trim() !== AUTH_PASSWORD) {
      elements.authError.hidden = false;
      elements.authPassword.select();
      return;
    }

    setAuthenticated(true);
    showAppShell();
    await bootDashboard();
  });
}

function bindApp() {
  elements.logoutButton.addEventListener("click", () => {
    setAuthenticated(false);
    showLoginOverlay();
  });

  elements.refreshButton.addEventListener("click", async () => {
    await bootDashboard(true);
  });

  elements.brandHomeButton.addEventListener("click", async () => {
    if (state.watchlist.length) {
      await loadSymbol(state.watchlist[0].symbol);
    }
  });

  elements.searchForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const symbol = elements.searchInput.value.trim();
    if (!symbol) {
      showError("Enter a stock symbol like AAPL or MSFT.");
      return;
    }
    await loadSymbol(symbol, true);
  });
}

bindAuth();
bindApp();

if (isAuthenticated()) {
  showAppShell();
  bootDashboard();
} else {
  showLoginOverlay();
}
