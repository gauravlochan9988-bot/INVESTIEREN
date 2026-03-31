if (window.location.protocol === "file:") {
  window.location.replace("http://127.0.0.1:8000/");
}

const DEPLOYED_API_ORIGIN = "https://investieren-api.onrender.com";
const LOCAL_API_HOSTS = new Set(["127.0.0.1", "localhost"]);
const AUTH_PASSWORD = "9988";
const STORAGE_KEYS = {
  authenticated: "investieren:authenticated",
  selectedSymbol: "investieren:selectedSymbol",
  selectedStrategy: "investieren:selectedStrategy",
  cachedWatchlist: "investieren:cachedWatchlist",
  cachedOverview: "investieren:cachedOverview",
  cachedAnalysis: "investieren:cachedAnalysis",
};

const STRATEGY_LABELS = {
  simple: "Simple",
  ai: "AI",
  hedgefund: "Hedgefund",
};

const state = {
  selectedSymbol: window.sessionStorage.getItem(STORAGE_KEYS.selectedSymbol) || "AAPL",
  selectedStrategy: window.sessionStorage.getItem(STORAGE_KEYS.selectedStrategy) || "hedgefund",
  watchlist: [],
  tvReady: typeof window.TradingView !== "undefined",
  tvScriptPromise: null,
  tvWidgetSymbol: null,
  searchResults: [],
  searchRequestId: 0,
  searchDebounceId: null,
  activeRequest: 0,
  latestAnalysis: null,
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
  strategyButtons: Array.from(document.querySelectorAll(".strategy-button")),
  logoutButton: document.getElementById("logoutButton"),
  refreshButton: document.getElementById("refreshButton"),
  brandHomeButton: document.getElementById("brandHomeButton"),
  searchForm: document.getElementById("searchForm"),
  searchInput: document.getElementById("searchInput"),
  searchSuggestions: document.getElementById("searchSuggestions"),
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
  recommendationCard: document.getElementById("recommendationCard"),
  recommendationValue: document.getElementById("recommendationValue"),
  confidenceValue: document.getElementById("confidenceValue"),
  confidenceHint: document.getElementById("confidenceHint"),
  analysisSummary: document.getElementById("analysisSummary"),
  selectedStrategyBadge: document.getElementById("selectedStrategyBadge"),
  analysisGeneratedAt: document.getElementById("analysisGeneratedAt"),
  biasValue: document.getElementById("biasValue"),
  noTradeReason: document.getElementById("noTradeReason"),
  riskValue: document.getElementById("riskValue"),
  timeframeValue: document.getElementById("timeframeValue"),
  coverageValue: document.getElementById("coverageValue"),
  coverageReason: document.getElementById("coverageReason"),
  entryValue: document.getElementById("entryValue"),
  entryReason: document.getElementById("entryReason"),
  exitValue: document.getElementById("exitValue"),
  exitReason: document.getElementById("exitReason"),
  positionSizeValue: document.getElementById("positionSizeValue"),
  positionSizeReason: document.getElementById("positionSizeReason"),
  stopLossValue: document.getElementById("stopLossValue"),
  stopLossReason: document.getElementById("stopLossReason"),
  warningsList: document.getElementById("warningsList"),
  chartSymbolBadge: document.getElementById("chartSymbolBadge"),
  tradingviewChart: document.getElementById("tradingviewChart"),
  companyLogo: document.getElementById("companyLogo"),
  companyHeadline: document.getElementById("companyHeadline"),
  companyExchange: document.getElementById("companyExchange"),
  companyDetails: document.getElementById("companyDetails"),
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

function sentenceCase(value) {
  if (!value) {
    return "--";
  }
  return String(value).replace(/_/g, " ");
}

function titleCase(value) {
  return sentenceCase(value).replace(/\b\w/g, (char) => char.toUpperCase());
}

function biasLabel(analysis) {
  if (!analysis || analysis.no_data) {
    return "neutral setup";
  }
  const score = Number(analysis.score || 0);
  const strategy = analysis.strategy || state.selectedStrategy;
  const strongThreshold = strategy === "simple" ? 3 : 55;
  const weakThreshold = strategy === "simple" ? 1 : 0;
  if (score >= strongThreshold) {
    return "strong bullish bias";
  }
  if (score > weakThreshold) {
    return "weak bullish bias";
  }
  if (score <= -strongThreshold) {
    return "strong bearish bias";
  }
  if (score < -weakThreshold) {
    return "weak bearish bias";
  }
  return "neutral setup";
}

function recommendationLabel(analysis) {
  if (!analysis || analysis.no_data) {
    return "NO DATA";
  }
  if (analysis.no_trade) {
    return "NO TRADE";
  }
  return analysis.recommendation || "HOLD";
}

function recommendationPalette(label) {
  if (label === "BUY") {
    return {
      card: "rounded-[28px] border border-emerald-400/25 bg-emerald-500/10 p-5",
      text: "text-emerald-300",
    };
  }
  if (label === "SELL") {
    return {
      card: "rounded-[28px] border border-rose-400/25 bg-rose-500/10 p-5",
      text: "text-rose-300",
    };
  }
  return {
    card: "rounded-[28px] border border-amber-400/25 bg-amber-500/10 p-5",
    text: "text-amber-300",
  };
}

function toneClassForRisk(risk) {
  if (risk === "LOW") {
    return "text-emerald-300";
  }
  if (risk === "HIGH") {
    return "text-rose-300";
  }
  return "text-amber-300";
}

function confidenceToneClass(confidence) {
  const numeric = Number(confidence || 0);
  if (numeric >= 75) {
    return "text-emerald-300";
  }
  if (numeric >= 55) {
    return "text-cyan-200";
  }
  if (numeric >= 40) {
    return "text-amber-300";
  }
  return "text-rose-300";
}

function confidenceHint(analysis) {
  if (!analysis || analysis.no_data || analysis.confidence === null || analysis.confidence === undefined) {
    return "Waiting for signal strength";
  }
  const confidence = Number(analysis.confidence || 0);
  if (confidence >= 75) {
    return "Strong signal alignment";
  }
  if (confidence >= 55) {
    return "Good confirmation";
  }
  if (confidence >= 40) {
    return "Mixed but tradable";
  }
  return "Low conviction";
}

function scoreInfo(analysis) {
  if (!analysis || analysis.no_data || analysis.score === null || analysis.score === undefined) {
    return {
      label: "--",
      tone: "text-slate-200",
      reason: analysis?.no_data_reason || "No score available.",
    };
  }

  const score = Number(analysis.score || 0);
  const label = `${score > 0 ? "+" : ""}${score}`;
  const tone =
    score >= 35
      ? "text-emerald-300"
      : score <= -35
        ? "text-rose-300"
        : "text-amber-300";

  return {
    label,
    tone,
    reason: `Confidence ${Math.round(Number(analysis.confidence || 0))}/100`,
  };
}

function yesNoLabel(flag) {
  return flag ? "YES" : "NO";
}

function sizeBucket(percentValue) {
  if (percentValue === null || percentValue === undefined) {
    return "--";
  }
  const numeric = Number(percentValue);
  if (numeric <= 0) {
    return "No position";
  }
  if (numeric <= 5) {
    return `Small · ${numeric.toFixed(1)}%`;
  }
  if (numeric <= 15) {
    return `Medium · ${numeric.toFixed(1)}%`;
  }
  return `Large · ${numeric.toFixed(1)}%`;
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

function hideSearchSuggestions() {
  elements.searchSuggestions.classList.add("hidden");
  elements.searchSuggestions.innerHTML = "";
  state.searchResults = [];
}

function renderSearchSuggestions(results, query) {
  state.searchResults = results;

  if (!query.trim()) {
    hideSearchSuggestions();
    return;
  }

  if (!results.length) {
    elements.searchSuggestions.innerHTML = `
      <div class="rounded-2xl px-4 py-4 text-sm text-slate-400">
        No stocks found for "${query}".
      </div>
    `;
    elements.searchSuggestions.classList.remove("hidden");
    return;
  }

  elements.searchSuggestions.innerHTML = results
    .map(
      (item) => `
        <button
          type="button"
          class="search-suggestion flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left transition hover:bg-white/5"
          data-symbol="${item.symbol}"
        >
          <div>
            <p class="text-sm font-semibold text-white">${item.symbol}</p>
            <p class="mt-1 text-xs text-slate-400">${item.name}</p>
          </div>
          <span class="text-xs uppercase tracking-[0.24em] text-slate-500">Open</span>
        </button>
      `,
    )
    .join("");
  elements.searchSuggestions.classList.remove("hidden");

  elements.searchSuggestions.querySelectorAll(".search-suggestion").forEach((button) => {
    button.addEventListener("click", async () => {
      const symbol = button.dataset.symbol;
      elements.searchInput.value = symbol;
      hideSearchSuggestions();
      await loadSymbol(symbol, true);
    });
  });
}

async function searchSymbols(query) {
  const trimmed = query.trim();
  const requestId = ++state.searchRequestId;

  if (!trimmed) {
    hideSearchSuggestions();
    return;
  }

  try {
    const results = await api(`/api/search?q=${encodeURIComponent(trimmed)}&limit=8`, {
      timeoutMs: 10000,
    });
    if (requestId !== state.searchRequestId) {
      return;
    }
    renderSearchSuggestions(results, trimmed);
  } catch (error) {
    if (requestId !== state.searchRequestId) {
      return;
    }
    elements.searchSuggestions.innerHTML = `
      <div class="rounded-2xl px-4 py-4 text-sm text-rose-300">
        Search is unavailable right now.
      </div>
    `;
    elements.searchSuggestions.classList.remove("hidden");
  }
}

function looksLikeTicker(value) {
  return /^[A-Za-z.\-]{1,10}$/.test(value.trim());
}

async function resolveSearchSelection(query) {
  const trimmed = query.trim();
  if (!trimmed) {
    return null;
  }

  if (looksLikeTicker(trimmed)) {
    return trimmed.toUpperCase();
  }

  if (state.searchResults.length) {
    return state.searchResults[0].symbol;
  }

  const results = await api(`/api/search?q=${encodeURIComponent(trimmed)}&limit=1`, {
    timeoutMs: 10000,
  });
  return results[0]?.symbol || null;
}

function renderAnalysisLoading(symbol) {
  state.latestAnalysis = null;
  elements.recommendationCard.className = "rounded-[28px] border border-white/10 bg-slate-950/70 p-5";
  elements.recommendationValue.className = "text-5xl font-black tracking-[-0.05em] text-white";
  elements.recommendationValue.textContent = "LOADING";
  elements.confidenceValue.className = "mt-2 text-2xl font-semibold text-white";
  elements.confidenceValue.textContent = "--";
  elements.confidenceHint.textContent = "Reading market context";
  elements.analysisSummary.textContent = `Building ${STRATEGY_LABELS[state.selectedStrategy]} analysis for ${symbol}...`;
  elements.selectedStrategyBadge.textContent = STRATEGY_LABELS[state.selectedStrategy];
  elements.analysisGeneratedAt.textContent = "Running analysis";
  elements.biasValue.textContent = "neutral setup";
  elements.noTradeReason.textContent = "Analysis is loading.";
  elements.riskValue.className = "mt-3 text-2xl font-semibold text-white";
  elements.riskValue.textContent = "--";
  elements.timeframeValue.textContent = "--";
  elements.coverageValue.className = "mt-3 text-2xl font-semibold text-white";
  elements.coverageValue.textContent = "--";
  elements.coverageReason.textContent = "Waiting for analysis.";
  elements.entryValue.textContent = "--";
  elements.entryReason.textContent = "Analysis is loading.";
  elements.exitValue.textContent = "--";
  elements.exitReason.textContent = "Analysis is loading.";
  elements.positionSizeValue.textContent = "--";
  elements.positionSizeReason.textContent = "Analysis is loading.";
  elements.stopLossValue.textContent = "--";
  elements.stopLossReason.textContent = "Analysis is loading.";
  elements.warningsList.innerHTML =
    '<span class="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-400">Loading analysis</span>';
}

function renderAnalysis(analysis) {
  state.latestAnalysis = analysis;
  const strategy = analysis?.strategy || state.selectedStrategy;
  elements.selectedStrategyBadge.textContent = STRATEGY_LABELS[strategy] || titleCase(strategy);
  if (analysis && !analysis.no_data) {
    writeCachedJson(STORAGE_KEYS.cachedAnalysis, analysis);
  }

  if (!analysis || analysis.no_data) {
    const reason = analysis?.no_data_reason || "No live market data available.";
    elements.recommendationCard.className = "rounded-[28px] border border-rose-400/25 bg-rose-500/10 p-5";
    elements.recommendationValue.className = "text-5xl font-black tracking-[-0.05em] text-rose-200";
    elements.recommendationValue.textContent = "NO DATA";
    elements.confidenceValue.className = "mt-2 text-2xl font-semibold text-slate-200";
    elements.confidenceValue.textContent = "--";
    elements.confidenceHint.textContent = "No confidence without data";
    elements.analysisSummary.textContent = reason;
    elements.analysisGeneratedAt.textContent = "No analysis";
    elements.biasValue.textContent = "neutral setup";
    elements.noTradeReason.textContent = reason;
    elements.riskValue.className = "mt-3 text-2xl font-semibold text-slate-200";
    elements.riskValue.textContent = "--";
    elements.timeframeValue.textContent = "--";
    elements.coverageValue.className = "mt-3 text-2xl font-semibold text-slate-200";
    elements.coverageValue.textContent = "--";
    elements.coverageReason.textContent = reason;
    elements.entryValue.textContent = "NO";
    elements.entryReason.textContent = reason;
    elements.exitValue.textContent = "NO";
    elements.exitReason.textContent = "No trade action available.";
    elements.positionSizeValue.textContent = "No position";
    elements.positionSizeReason.textContent = "Data is missing.";
    elements.stopLossValue.textContent = "--";
    elements.stopLossReason.textContent = "No stop loss without data.";
    elements.warningsList.innerHTML =
      '<span class="rounded-full border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-200">No live data</span>';
    return;
  }

  const label = recommendationLabel(analysis);
  const palette = recommendationPalette(label);
  const warnings = (analysis.warnings || []).slice(0, 3);

  elements.recommendationCard.className = palette.card;
  elements.recommendationValue.className = `text-5xl font-black tracking-[-0.05em] ${palette.text}`;
  elements.recommendationValue.textContent = label;
  elements.confidenceValue.className = `mt-2 text-2xl font-semibold ${confidenceToneClass(analysis.confidence)}`;
  elements.confidenceValue.textContent = `${Math.round(Number(analysis.confidence || 0))}%`;
  elements.confidenceHint.textContent = confidenceHint(analysis);
  elements.analysisSummary.textContent = analysis.reason || analysis.summary || "No summary available.";
  elements.analysisGeneratedAt.textContent = analysis.generated_at
    ? `Updated ${new Date(analysis.generated_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
    : "Analysis ready";
  elements.biasValue.textContent = biasLabel(analysis);
  elements.noTradeReason.textContent =
    analysis.reason || analysis.no_trade_reason || analysis.summary || "Backend analysis loaded.";
  elements.riskValue.className = `mt-3 text-2xl font-semibold ${toneClassForRisk(analysis.risk_level)}`;
  elements.riskValue.textContent = analysis.risk_level || "--";
  elements.timeframeValue.textContent = titleCase(analysis.timeframe);
  const score = scoreInfo(analysis);
  elements.coverageValue.className = `mt-3 text-2xl font-semibold ${score.tone}`;
  elements.coverageValue.textContent = score.label;
  elements.coverageReason.textContent = score.reason;
  elements.entryValue.className = `mt-3 text-2xl font-semibold ${analysis.entry_signal ? "text-emerald-300" : "text-slate-200"}`;
  elements.entryValue.textContent = yesNoLabel(analysis.entry_signal);
  elements.entryReason.textContent = analysis.entry_reason || "No entry guidance.";
  elements.exitValue.className = `mt-3 text-2xl font-semibold ${analysis.exit_signal ? "text-rose-300" : "text-slate-200"}`;
  elements.exitValue.textContent = yesNoLabel(analysis.exit_signal);
  elements.exitReason.textContent = analysis.exit_reason || "No exit guidance.";
  elements.positionSizeValue.textContent = sizeBucket(analysis.position_size_percent);
  elements.positionSizeReason.textContent = analysis.position_size_reason || "No sizing guidance.";
  elements.stopLossValue.textContent = analysis.stop_loss_level ? currency(analysis.stop_loss_level) : "--";
  elements.stopLossReason.textContent = analysis.stop_loss_reason || "No stop loss guidance.";
  elements.warningsList.innerHTML = warnings.length
    ? warnings
        .map((warning) => {
          const tone = /negative|high|weak|unclear|drawdown|overbought|headwind|pressure|strong/i.test(warning)
            ? "border-amber-400/20 bg-amber-500/10 text-amber-200"
            : "border-white/10 bg-white/5 text-slate-300";
          return `<span class="rounded-full border px-3 py-2 text-xs font-medium ${tone}">${warning}</span>`;
        })
        .join("")
    : '<span class="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-200">No urgent warnings</span>';
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

function persistSelectedStrategy(strategy) {
  state.selectedStrategy = strategy;
  window.sessionStorage.setItem(STORAGE_KEYS.selectedStrategy, strategy);
}

function readCachedJson(key) {
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCachedJson(key, value) {
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore cache failures so live requests keep working.
  }
}

function hydrateDashboardFromCache() {
  const cachedWatchlist = readCachedJson(STORAGE_KEYS.cachedWatchlist);
  const cachedOverview = readCachedJson(STORAGE_KEYS.cachedOverview);
  const cachedAnalysis = readCachedJson(STORAGE_KEYS.cachedAnalysis);

  if (Array.isArray(cachedWatchlist) && cachedWatchlist.length) {
    state.watchlist = cachedWatchlist;
    elements.watchlistMeta.textContent = `${cachedWatchlist.length} symbols`;
    renderWatchlist(cachedWatchlist);
  }

  if (cachedOverview && cachedOverview.symbol === state.selectedSymbol) {
    renderOverview(cachedOverview);
  }

  if (
    cachedAnalysis &&
    cachedAnalysis.symbol === state.selectedSymbol &&
    cachedAnalysis.strategy === state.selectedStrategy
  ) {
    renderAnalysis(cachedAnalysis);
  }
}

function renderStrategyButtons() {
  elements.strategyButtons.forEach((button) => {
    const active = button.dataset.strategy === state.selectedStrategy;
    button.className = [
      "strategy-button rounded-xl px-3 py-2 text-xs font-semibold transition",
      active
        ? "border border-cyan-300/30 bg-cyan-300/15 text-cyan-100 shadow-lg shadow-cyan-500/10"
        : "border border-transparent text-slate-300 hover:border-white/10 hover:bg-white/5",
    ].join(" ");
  });
  if (elements.selectedStrategyBadge) {
    elements.selectedStrategyBadge.textContent = STRATEGY_LABELS[state.selectedStrategy];
  }
}

function showAppShell() {
  elements.authOverlay.classList.add("hidden");
  elements.authOverlay.hidden = true;
  elements.appShell.classList.remove("hidden");
  elements.appShell.hidden = false;
}

function showLoginOverlay() {
  elements.appShell.classList.add("hidden");
  elements.appShell.hidden = true;
  elements.authOverlay.classList.remove("hidden");
  elements.authOverlay.hidden = false;
  elements.authError.hidden = true;
  elements.authForm.reset();
}

async function api(path, options = {}) {
  const url = buildApiUrl(path);
  const timeoutMs = options.timeoutMs ?? 15000;
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  let response;
  try {
    response = await fetch(url, {
      cache: "no-store",
      ...options,
      headers,
      signal: controller.signal,
    });
  } catch (error) {
    if (error.name === "AbortError") {
      console.error("[frontend] API timeout", { path, timeoutMs });
      throw new Error("Request timed out.");
    }
    console.error("[frontend] API network error", { path, error: error.message });
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }

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
    setBackendStatus("Connected", "ok");
  } catch (error) {
    setBackendStatus("Backend offline", "error");
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
      "w-full rounded-3xl border p-4 text-left transition",
      active
        ? "border-cyan-300/40 bg-cyan-300/10 shadow-lg shadow-cyan-500/10"
        : "border-white/10 bg-slate-950/50 hover:bg-slate-900/90",
    ].join(" ");
    card.innerHTML = `
      <div class="flex items-start justify-between gap-4">
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-3">
            <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-sm font-bold text-white/90">
              ${item.symbol.slice(0, 2)}
            </div>
            <div class="min-w-0">
              <p class="truncate text-sm font-semibold tracking-tight">${item.symbol}</p>
              <p class="mt-1 truncate text-xs text-slate-400">${item.name}</p>
            </div>
          </div>
          <div class="mt-4 flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-slate-500">
            <span>Live Quote</span>
            <span class="h-1 w-1 rounded-full bg-slate-600"></span>
            <span>${active ? "Selected" : "Watchlist"}</span>
          </div>
        </div>
        <div class="shrink-0 text-right">
          <p class="text-sm font-semibold text-white">${currency(item.price)}</p>
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
  writeCachedJson(STORAGE_KEYS.cachedOverview, overview);
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

function ensureTradingView() {
  if (window.TradingView && typeof window.TradingView.widget === "function") {
    state.tvReady = true;
    return Promise.resolve(window.TradingView);
  }

  if (state.tvScriptPromise) {
    return state.tvScriptPromise;
  }

  const existingScript = document.querySelector('script[src="https://s3.tradingview.com/tv.js"]');

  state.tvScriptPromise = new Promise((resolve, reject) => {
    const onLoad = () => {
      state.tvReady = true;
      resolve(window.TradingView);
    };

    const onError = () => {
      reject(new Error("TradingView widget failed to load."));
    };

    if (existingScript) {
      existingScript.addEventListener("load", onLoad, { once: true });
      existingScript.addEventListener("error", onError, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/tv.js";
    script.async = true;
    script.onload = onLoad;
    script.onerror = onError;
    document.head.appendChild(script);
  });

  return state.tvScriptPromise;
}

function showTradingViewLoader(message = "Loading TradingView chart...") {
  elements.tradingviewChart.innerHTML = `<div class="tv-loader">${message}</div>`;
}

async function renderTradingView(symbol) {
  const tvSymbol = toTradingViewSymbol(symbol);

  if (state.tvWidgetSymbol === tvSymbol && elements.tradingviewChart.childElementCount > 0) {
    return;
  }

  showTradingViewLoader();

  try {
    await ensureTradingView();
  } catch (error) {
    showTradingViewLoader("TradingView widget failed to load.");
    return;
  }

  state.tvWidgetSymbol = tvSymbol;
  elements.tradingviewChart.innerHTML = "";
  new window.TradingView.widget({
    autosize: true,
    symbol: tvSymbol,
    interval: "D",
    timezone: "Etc/UTC",
    theme: "dark",
    style: "1",
    locale: "en",
    allow_symbol_change: false,
    hide_top_toolbar: true,
    hide_side_toolbar: true,
    withdateranges: false,
    details: false,
    hotlist: false,
    calendar: false,
    save_image: false,
    studies: [],
    toolbar_bg: "#020617",
    container_id: "tradingviewChart",
  });
}

async function loadWatchlist(forceRefresh = false) {
  renderLoadingWatchlist();
  elements.watchlistMeta.textContent = "Syncing Finnhub...";
  const suffix = forceRefresh ? "?refresh=1" : "";
  const items = await api(`/api/dashboard/watchlist${suffix}`);
  state.watchlist = items;
  writeCachedJson(STORAGE_KEYS.cachedWatchlist, items);
  renderWatchlist(items);
  return items;
}

async function loadSymbol(symbol, forceRefresh = false) {
  const requestId = ++state.activeRequest;
  const normalized = symbol.trim().toUpperCase();
  persistSelectedSymbol(normalized);
  clearError();
  renderWatchlist(state.watchlist);
  renderAnalysisLoading(normalized);
  renderTradingView(normalized);

  try {
    const analysisParams = new URLSearchParams({ strategy: state.selectedStrategy });
    if (forceRefresh) {
      analysisParams.set("refresh", "1");
    }
    const overviewSuffix = forceRefresh ? "?refresh=1" : "";
    const [overviewResult, analysisResult] = await Promise.allSettled([
      api(`/api/dashboard/symbol/${encodeURIComponent(normalized)}${overviewSuffix}`, { timeoutMs: 12000 }),
      api(`/api/analysis/${encodeURIComponent(normalized)}?${analysisParams.toString()}`, { timeoutMs: 18000 }),
    ]);

    if (requestId !== state.activeRequest) {
      return;
    }

    if (overviewResult.status === "fulfilled") {
      renderOverview(overviewResult.value);
    } else {
      throw overviewResult.reason;
    }

    if (analysisResult.status === "fulfilled") {
      renderAnalysis(analysisResult.value);
    } else {
      renderAnalysis({
        no_data: true,
        no_data_reason:
          analysisResult.reason?.name === "AbortError"
            ? "Analysis timed out."
            : analysisResult.reason?.message || "Analysis unavailable.",
      });
    }

    renderWatchlist(state.watchlist);
  } catch (error) {
    if (requestId !== state.activeRequest) {
      return;
    }
    showError(error.message || "Failed to load symbol data.");
    renderAnalysis({
      no_data: true,
      no_data_reason: error.message || "Analysis unavailable.",
    });
  }
}

async function bootDashboard(forceRefresh = false) {
  clearError();
  if (!forceRefresh) {
    hydrateDashboardFromCache();
  }
  try {
    setBackendStatus("Connecting backend...", "loading");
    const [healthResult, watchlistResult, symbolResult] = await Promise.allSettled([
      loadBackendHealth(),
      loadWatchlist(forceRefresh),
      loadSymbol(state.selectedSymbol, forceRefresh),
    ]);

    if (healthResult.status === "rejected") {
      throw healthResult.reason;
    }
    if (watchlistResult.status === "rejected") {
      throw watchlistResult.reason;
    }

    const watchlist = watchlistResult.value;
    const fallback =
      watchlist.find((item) => item.symbol === state.selectedSymbol)?.symbol || watchlist[0]?.symbol;
    if (fallback) {
      if (fallback !== state.selectedSymbol) {
        await loadSymbol(fallback, forceRefresh);
      } else if (symbolResult.status === "rejected") {
        throw symbolResult.reason;
      }
    }
  } catch (error) {
    showError(error.message || "Dashboard could not load.");
    setBackendStatus("Backend offline", "error");
  }
}

function bindAuth() {
  if (elements.authCancelButton) {
    elements.authCancelButton.addEventListener("click", () => {
      elements.authForm.reset();
      elements.authError.hidden = true;
      elements.authPassword.focus();
    });
  }

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

ensureTradingView().catch(() => {
  state.tvReady = false;
});

function bindApp() {
  renderStrategyButtons();

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

  elements.strategyButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      const nextStrategy = button.dataset.strategy;
      if (!nextStrategy || nextStrategy === state.selectedStrategy) {
        return;
      }
      persistSelectedStrategy(nextStrategy);
      renderStrategyButtons();
      if (isAuthenticated()) {
        await loadSymbol(state.selectedSymbol, true);
      }
    });
  });

  elements.searchForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const query = elements.searchInput.value.trim();
    if (!query) {
      showError("Enter a stock symbol like AAPL or MSFT.");
      return;
    }
    try {
      const symbol = await resolveSearchSelection(query);
      if (!symbol) {
        showError(`No stock found for "${query}".`);
        return;
      }
      elements.searchInput.value = symbol;
      hideSearchSuggestions();
      await loadSymbol(symbol, true);
    } catch (error) {
      showError(error.message || "Search failed.");
    }
  });

  elements.searchInput.addEventListener("input", () => {
    const query = elements.searchInput.value;
    window.clearTimeout(state.searchDebounceId);
    state.searchDebounceId = window.setTimeout(() => {
      searchSymbols(query);
    }, 220);
  });

  elements.searchInput.addEventListener("focus", () => {
    if (elements.searchInput.value.trim()) {
      searchSymbols(elements.searchInput.value);
    }
  });

  document.addEventListener("click", (event) => {
    if (
      event.target !== elements.searchInput &&
      !elements.searchSuggestions.contains(event.target)
    ) {
      hideSearchSuggestions();
    }
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
