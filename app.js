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
  favoriteSymbols: "investieren:favoriteSymbols",
  cachedWatchlist: "investieren:cachedWatchlist",
  cachedOverview: "investieren:cachedOverview",
  cachedAnalysis: "investieren:cachedAnalysis",
  cachedAlerts: "investieren:cachedAlerts",
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
  latestNews: [],
  favoriteSymbols: new Set(),
  alertsRetryId: null,
  alertsRetryAttempt: 0,
  chartRenderId: null,
  chartRetryAttempt: 0,
  chartRequestId: 0,
  chartInView: false,
  pendingChart: null,
  chartObserver: null,
  strategySnapshots: {},
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
  alertsSection: document.getElementById("alertsSection"),
  alertsMeta: document.getElementById("alertsMeta"),
  alertsList: document.getElementById("alertsList"),
  strategyButtons: Array.from(document.querySelectorAll(".strategy-button")),
  logoutButton: document.getElementById("logoutButton"),
  refreshButton: document.getElementById("refreshButton"),
  brandHomeButton: document.getElementById("brandHomeButton"),
  searchForm: document.getElementById("searchForm"),
  searchInput: document.getElementById("searchInput"),
  searchSuggestions: document.getElementById("searchSuggestions"),
  watchlistMeta: document.getElementById("watchlistMeta"),
  watchlistBody: document.getElementById("watchlistBody"),
  watchlistSection: document.getElementById("watchlistSection"),
  favoritesMeta: document.getElementById("favoritesMeta"),
  favoritesBody: document.getElementById("favoritesBody"),
  selectedSymbolSection: document.getElementById("selectedSymbolSection"),
  tradeDecisionSection: document.getElementById("tradeDecisionSection"),
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
  confidenceBarFill: document.getElementById("confidenceBarFill"),
  confidenceHint: document.getElementById("confidenceHint"),
  analysisSummary: document.getElementById("analysisSummary"),
  selectedStrategyBadge: document.getElementById("selectedStrategyBadge"),
  mobileStrategyCards: document.getElementById("mobileStrategyCards"),
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
  chartSection: document.getElementById("chartSection"),
  chartSymbolBadge: document.getElementById("chartSymbolBadge"),
  tradingviewChart: document.getElementById("tradingviewChart"),
  companyLogo: document.getElementById("companyLogo"),
  companyHeadline: document.getElementById("companyHeadline"),
  companyExchange: document.getElementById("companyExchange"),
  companyDetails: document.getElementById("companyDetails"),
  companySection: document.getElementById("companySection"),
  mobileQuickActions: document.getElementById("mobileQuickActions"),
  mobileFavoriteButton: document.getElementById("mobileFavoriteButton"),
  mobileAlertButton: document.getElementById("mobileAlertButton"),
  mobilePortfolioButton: document.getElementById("mobilePortfolioButton"),
  portfolioSheet: document.getElementById("portfolioSheet"),
  portfolioSheetBackdrop: document.getElementById("portfolioSheetBackdrop"),
  portfolioSheetClose: document.getElementById("portfolioSheetClose"),
  portfolioSheetSummary: document.getElementById("portfolioSheetSummary"),
  portfolioSheetPositions: document.getElementById("portfolioSheetPositions"),
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

function scheduleLowPriorityTask(task, delayMs = 0) {
  const runTask = () => {
    window.setTimeout(task, delayMs);
  };

  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(runTask, { timeout: Math.max(500, delayMs) });
    return;
  }

  window.setTimeout(task, delayMs);
}

function delay(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function isReadOnlyApiRequest(path, options = {}) {
  const method = (options.method || "GET").toUpperCase();
  return method === "GET" && String(path || "").startsWith("/api/");
}

function shouldFallbackToDeployedApi(path, options = {}, baseUrl) {
  return (
    LOCAL_API_HOSTS.has(window.location.hostname) &&
    baseUrl !== DEPLOYED_API_ORIGIN &&
    !options.skipDeployedFallback &&
    isReadOnlyApiRequest(path, options)
  );
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

function isMobileViewport() {
  return window.matchMedia("(max-width: 768px)").matches;
}

function renderSkeleton(element, className) {
  element.innerHTML = `<span class="mobile-skeleton ${className}"></span>`;
}

function setConfidenceBar(confidence, quality = "") {
  if (!elements.confidenceBarFill) {
    return;
  }
  const numeric = Math.max(0, Math.min(100, Number(confidence || 0)));
  const qualityTone =
    quality === "FULL"
      ? "confidence-fill-full"
      : quality === "PARTIAL"
      ? "confidence-fill-partial"
      : "confidence-fill-no-data";
  elements.confidenceBarFill.className = `h-full rounded-full transition-[width] duration-300 ease-out ${qualityTone}`;
  elements.confidenceBarFill.style.width = `${numeric}%`;
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
      card: "rounded-[28px] p-5 signal-buy-card",
      text: "signal-buy-text",
    };
  }
  if (label === "SELL") {
    return {
      card: "rounded-[28px] p-5 signal-sell-card",
      text: "signal-sell-text",
    };
  }
  return {
    card: "rounded-[28px] p-5 signal-hold-card",
    text: "signal-hold-text",
  };
}

function toneClassForRisk(risk) {
  if (risk === "LOW") {
    return "tone-buy";
  }
  if (risk === "HIGH") {
    return "tone-sell";
  }
  return "tone-hold";
}

function confidenceToneClass(confidence) {
  const numeric = Number(confidence || 0);
  if (numeric >= 75) {
    return "tone-buy";
  }
  if (numeric >= 55) {
    return "tone-primary";
  }
  if (numeric >= 40) {
    return "tone-hold";
  }
  return "tone-sell";
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

function dataQualityInfo(analysis) {
  if (!analysis) {
    return {
      label: "--",
      tone: "text-slate-200",
      reason: "No data quality available.",
    };
  }

  const value = analysis.data_quality || (analysis.no_data ? "NO_DATA" : "--");
  const presentation =
    value === "FULL"
      ? {
          label: "Full Data",
          tone: "tone-primary",
        }
      : value === "PARTIAL"
        ? {
            label: "Limited Data",
            tone: "tone-hold",
          }
        : value === "NO_DATA"
          ? {
              label: "No Data",
              tone: "tone-muted",
            }
          : {
              label: "--",
              tone: "tone-muted",
            };

  return {
    label: presentation.label,
    tone: presentation.tone,
    reason:
      analysis.data_quality_reason ||
      analysis.no_data_reason ||
      "No data quality note available.",
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
    loading: "status-loading",
    ok: "status-ok",
    warning: "status-warning",
    error: "status-error",
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
          <div class="min-w-0">
            <p class="text-sm font-semibold text-white">${item.symbol}</p>
            <p class="mt-1 text-xs text-slate-400">${item.name}</p>
          </div>
          <span class="ml-3 shrink-0 text-xs uppercase tracking-[0.24em] text-slate-500">Open</span>
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
  setConfidenceBar(0, "NO_DATA");
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

  if (isMobileViewport()) {
    renderSkeleton(elements.recommendationValue, "h-8 w-36");
    renderSkeleton(elements.confidenceValue, "h-7 w-20");
    renderSkeleton(elements.confidenceHint, "h-4 w-28");
    elements.analysisSummary.innerHTML = `
      <span class="mobile-skeleton h-4 w-full"></span>
      <span class="mobile-skeleton mt-2 h-4 w-10/12"></span>
    `;
    renderSkeleton(elements.noTradeReason, "h-4 w-full");
    renderSkeleton(elements.coverageReason, "h-4 w-24");
    renderSkeleton(elements.entryReason, "h-4 w-28");
    renderSkeleton(elements.exitReason, "h-4 w-28");
    renderSkeleton(elements.positionSizeReason, "h-4 w-24");
    renderSkeleton(elements.stopLossReason, "h-4 w-32");
    elements.warningsList.innerHTML = `
      <span class="mobile-skeleton h-8 w-24 rounded-full"></span>
      <span class="mobile-skeleton h-8 w-28 rounded-full"></span>
      <span class="mobile-skeleton h-8 w-20 rounded-full"></span>
    `;
  }
  renderMobileStrategyCardsLoading(symbol);
}

function alertToneClasses(tone) {
  if (tone === "bullish") {
    return {
      card: "border-emerald-400/20 bg-emerald-500/10",
      badge: "border border-emerald-400/20 bg-emerald-400/15 text-emerald-200",
    };
  }
  if (tone === "bearish") {
    return {
      card: "border-rose-400/20 bg-rose-500/10",
      badge: "border border-rose-400/20 bg-rose-400/15 text-rose-200",
    };
  }
  return {
    card: "border-white/10 bg-slate-950/60",
    badge: "border border-white/10 bg-white/5 text-slate-200",
  };
}

function renderAlertsLoading() {
  elements.alertsMeta.textContent = "Scanning watchlist...";
  elements.alertsList.innerHTML = Array.from({ length: 3 })
    .map(
      () => `
        <article class="animate-pulse rounded-2xl border border-white/10 bg-slate-950/60 p-4">
          <div class="h-4 w-24 rounded bg-white/10"></div>
          <div class="mt-3 h-6 w-40 rounded bg-white/10"></div>
          <div class="mt-3 h-4 w-full rounded bg-white/10"></div>
        </article>
      `,
    )
    .join("");
}

function renderAlerts(alerts) {
  state.alertsRetryAttempt = 0;
  window.clearTimeout(state.alertsRetryId);
  writeCachedJson(STORAGE_KEYS.cachedAlerts, alerts);
  elements.alertsMeta.textContent = `${alerts.length} live alerts`;

  if (!alerts.length) {
    elements.alertsList.innerHTML = `
      <article class="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
        <p class="text-sm font-semibold text-white">No strong alerts right now</p>
        <p class="mt-2 text-sm leading-6 text-slate-400">The app is watching your watchlist for BUY, SELL and RSI trigger events.</p>
      </article>
    `;
    return;
  }

  elements.alertsList.innerHTML = alerts
    .map((alert) => {
      const tone = alertToneClasses(alert.tone);
      return `
        <article class="rounded-2xl border p-4 ${tone.card}">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="text-sm font-semibold text-white">${alert.title}</p>
              <p class="mt-2 text-sm leading-6 text-slate-300">${alert.message}</p>
            </div>
            <span class="shrink-0 rounded-full px-3 py-2 text-[11px] font-semibold ${tone.badge}">
              ${STRATEGY_LABELS[alert.strategy] || titleCase(alert.strategy)}
            </span>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderAlertsWarning(message) {
  elements.alertsMeta.textContent = message;
  elements.alertsList.innerHTML = `
    <article class="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4">
      <p class="text-sm font-semibold text-white">Alerts are warming up</p>
      <p class="mt-2 text-sm leading-6 text-slate-300">The backend is still syncing signals. Try again in a moment.</p>
    </article>
  `;
}

function queueAlertsRetry(forceRefresh = false, delayMs = 2500) {
  const nextAttempt = state.alertsRetryAttempt + 1;
  if (nextAttempt > 5) {
    elements.alertsMeta.textContent = "Tap refresh to retry alerts";
    return;
  }
  state.alertsRetryAttempt = nextAttempt;
  window.clearTimeout(state.alertsRetryId);
  state.alertsRetryId = window.setTimeout(() => {
    loadAlerts(forceRefresh).catch((error) => {
      console.error("[frontend] alerts retry failed", error);
      renderAlertsWarning(`Retrying alerts... (${state.alertsRetryAttempt}/5)`);
      queueAlertsRetry(forceRefresh, Math.min(delayMs * 1.6, 8000));
    });
  }, delayMs);
}

function renderAnalysis(analysis) {
  state.latestAnalysis = analysis;
  if (analysis?.symbol) {
    state.strategySnapshots[analysis.symbol] = {
      ...(state.strategySnapshots[analysis.symbol] || {}),
      [analysis.strategy || state.selectedStrategy]: analysis,
    };
  }
  const strategy = analysis?.strategy || state.selectedStrategy;
  elements.selectedStrategyBadge.textContent = STRATEGY_LABELS[strategy] || titleCase(strategy);
  if (analysis && !analysis.no_data) {
    writeCachedJson(STORAGE_KEYS.cachedAnalysis, analysis);
  }

  if (!analysis || analysis.no_data) {
    const reason = analysis?.no_data_reason || "No live market data available.";
    const noDataQuality = dataQualityInfo(analysis);
    elements.recommendationCard.className = "rounded-[28px] border border-rose-400/25 bg-rose-500/10 p-5";
    elements.recommendationValue.className = "text-5xl font-black tracking-[-0.05em] text-rose-200";
    elements.recommendationValue.textContent = "NO DATA";
    elements.confidenceValue.className = "mt-2 text-2xl font-semibold text-slate-200";
    elements.confidenceValue.textContent = "--";
    setConfidenceBar(0, "NO_DATA");
    elements.confidenceHint.textContent = "No confidence without data";
    elements.analysisSummary.textContent = reason;
    elements.analysisGeneratedAt.textContent = "No analysis";
    elements.biasValue.textContent = "neutral setup";
    elements.noTradeReason.textContent = reason;
    elements.riskValue.className = "mt-3 text-2xl font-semibold text-slate-200";
    elements.riskValue.textContent = "--";
    elements.timeframeValue.textContent = "--";
    elements.coverageValue.className = `mt-3 text-2xl font-semibold ${noDataQuality.tone}`;
    elements.coverageValue.textContent = noDataQuality.label;
    elements.coverageReason.textContent = noDataQuality.reason;
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
    renderMobileStrategyCards();
    syncMobileFavoriteButton();
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
  setConfidenceBar(analysis.confidence, analysis.data_quality);
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
  const dataQuality = dataQualityInfo(analysis);
  elements.coverageValue.className = `mt-3 text-2xl font-semibold ${dataQuality.tone}`;
  elements.coverageValue.textContent = dataQuality.label;
  elements.coverageReason.textContent = dataQuality.reason;
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
  renderMobileStrategyCards();
  syncMobileFavoriteButton();
}

function strategyToneClasses(label) {
  if (label === "BUY") {
    return "signal-buy-card";
  }
  if (label === "SELL") {
    return "signal-sell-card";
  }
  return "signal-hold-card";
}

function renderMobileStrategyCardsLoading(symbol) {
  if (!elements.mobileStrategyCards) {
    return;
  }
  elements.mobileStrategyCards.innerHTML = Object.entries(STRATEGY_LABELS)
    .map(
      ([key, label]) => `
        <button type="button" class="mobile-strategy-card mobile-only rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-left" data-mobile-strategy="${key}">
          <div class="flex items-center justify-between gap-3">
            <p class="text-sm font-semibold text-white">${label}</p>
            <span class="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-slate-300">Loading</span>
          </div>
          <div class="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10"><div class="mobile-skeleton h-full w-1/2 rounded-full"></div></div>
          <p class="mt-3 text-sm text-slate-400">Checking ${label} setup for ${symbol}...</p>
        </button>
      `,
    )
    .join("");
  bindMobileStrategyCards();
}

function renderMobileStrategyCards() {
  if (!elements.mobileStrategyCards || !isMobileViewport()) {
    return;
  }
  const snapshots = state.strategySnapshots[state.selectedSymbol] || {};
  elements.mobileStrategyCards.innerHTML = Object.entries(STRATEGY_LABELS)
    .map(([key, label]) => {
      const analysis = snapshots[key];
      const current = key === state.selectedStrategy;
      const recommendation = recommendationLabel(analysis || { no_data: true });
      const confidence = analysis?.no_data ? "--" : `${Math.round(Number(analysis?.confidence || 0))}%`;
      const reason =
        analysis?.reason ||
        (analysis?.no_data ? analysis.no_data_reason : `Loading ${label} analysis...`);
      const tone = strategyToneClasses(recommendation);
      const active = current ? "ring-1 ring-teal-400/35 shadow-lg shadow-teal-500/10" : "";
      return `
        <button type="button" class="mobile-strategy-card mobile-only rounded-2xl border p-4 text-left ${tone} ${active}" data-mobile-strategy="${key}">
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="text-sm font-semibold text-white">${label}</p>
              <p class="mt-2 text-xl font-black tracking-[-0.03em]">${recommendation}</p>
            </div>
            <div class="text-right">
              <p class="text-[11px] font-medium uppercase tracking-[0.2em] opacity-70">Confidence</p>
              <p class="mt-2 text-base font-semibold text-white">${confidence}</p>
            </div>
          </div>
          <p class="mt-3 line-clamp-2 text-sm leading-6 text-slate-200/90">${reason}</p>
        </button>
      `;
    })
    .join("");
  bindMobileStrategyCards();
}

function bindMobileStrategyCards() {
  elements.mobileStrategyCards?.querySelectorAll("[data-mobile-strategy]").forEach((card) => {
    card.addEventListener("click", async () => {
      const nextStrategy = card.dataset.mobileStrategy;
      if (!nextStrategy || nextStrategy === state.selectedStrategy) {
        return;
      }
      persistSelectedStrategy(nextStrategy);
      renderStrategyButtons();
      await loadSymbol(state.selectedSymbol, true);
    });
  });
}

function syncMobileFavoriteButton() {
  if (!elements.mobileFavoriteButton) {
    return;
  }
  const active = isFavoriteSymbol(state.selectedSymbol);
  elements.mobileFavoriteButton.innerHTML = `
    <span class="text-lg">${active ? "★" : "☆"}</span>
    <span>${active ? "Saved" : "Favorite"}</span>
  `;
  elements.mobileFavoriteButton.classList.toggle("mobile-quick-action-active", active);
}

function showPortfolioSheetLoading() {
  elements.portfolioSheetSummary.innerHTML = `
    <div class="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
      <div class="mobile-skeleton h-4 w-24"></div>
      <div class="mt-3 mobile-skeleton h-8 w-32"></div>
    </div>
  `;
  elements.portfolioSheetPositions.innerHTML = `
    <div class="rounded-2xl border border-white/10 bg-slate-900/70 p-4"><div class="mobile-skeleton h-4 w-full"></div><div class="mt-3 mobile-skeleton h-4 w-10/12"></div></div>
  `;
}

function renderPortfolioSheet(portfolio) {
  const pnlTone = Number(portfolio.total_pnl || 0) >= 0 ? "text-emerald-300" : "text-rose-300";
  elements.portfolioSheetSummary.innerHTML = `
    <article class="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
      <p class="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">Market value</p>
      <p class="mt-3 text-3xl font-semibold text-white">${currency(portfolio.market_value || 0)}</p>
      <p class="mt-2 text-sm ${pnlTone}">${percent(portfolio.total_pnl_percent || 0)} · ${currency(portfolio.total_pnl || 0)}</p>
    </article>
  `;
  if (!portfolio.positions?.length) {
    elements.portfolioSheetPositions.innerHTML = `
      <article class="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
        <p class="text-sm font-semibold text-white">No positions yet</p>
        <p class="mt-2 text-sm leading-6 text-slate-400">Add portfolio positions later to track allocation and PnL here.</p>
      </article>
    `;
    return;
  }
  elements.portfolioSheetPositions.innerHTML = portfolio.positions
    .map((position) => {
      const allocation = portfolio.market_value ? ((position.market_value / portfolio.market_value) * 100).toFixed(1) : "0.0";
      const tone = Number(position.pnl || 0) >= 0 ? "text-emerald-300" : "text-rose-300";
      return `
        <article class="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
          <div class="flex items-center justify-between gap-3">
            <div>
              <p class="text-sm font-semibold text-white">${position.symbol}</p>
              <p class="mt-1 text-xs text-slate-400">${allocation}% allocation</p>
            </div>
            <p class="text-sm font-semibold ${tone}">${currency(position.pnl || 0)}</p>
          </div>
          <div class="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div><p class="text-slate-500">Value</p><p class="mt-1 font-medium text-white">${currency(position.market_value || 0)}</p></div>
            <div><p class="text-slate-500">Entry</p><p class="mt-1 font-medium text-white">${currency(position.average_price || 0)}</p></div>
          </div>
        </article>
      `;
    })
    .join("");
}

function openPortfolioSheet() {
  if (!elements.portfolioSheet || !elements.portfolioSheetBackdrop) {
    return;
  }
  elements.portfolioSheetBackdrop.classList.remove("hidden");
  elements.portfolioSheet.classList.remove("hidden");
  showPortfolioSheetLoading();
  api("/api/portfolio", { timeoutMs: 18000, retryCount: 1 })
    .then(renderPortfolioSheet)
    .catch((error) => {
      elements.portfolioSheetPositions.innerHTML = `
        <article class="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4">
          <p class="text-sm font-semibold text-white">Portfolio unavailable</p>
          <p class="mt-2 text-sm leading-6 text-slate-300">${error.message || "Portfolio data could not load right now."}</p>
        </article>
      `;
    });
}

function closePortfolioSheet() {
  elements.portfolioSheetBackdrop?.classList.add("hidden");
  elements.portfolioSheet?.classList.add("hidden");
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

function readFavoriteSymbols() {
  const raw = readCachedJson(STORAGE_KEYS.favoriteSymbols);
  if (!Array.isArray(raw)) {
    return new Set();
  }
  return new Set(raw.filter((value) => typeof value === "string").map((value) => value.toUpperCase()));
}

function persistFavoriteSymbols() {
  writeCachedJson(STORAGE_KEYS.favoriteSymbols, Array.from(state.favoriteSymbols));
}

function isFavoriteSymbol(symbol) {
  return state.favoriteSymbols.has(String(symbol || "").toUpperCase());
}

function toggleFavorite(symbol) {
  const normalized = String(symbol || "").trim().toUpperCase();
  if (!normalized) {
    return;
  }
  if (state.favoriteSymbols.has(normalized)) {
    state.favoriteSymbols.delete(normalized);
  } else {
    state.favoriteSymbols.add(normalized);
  }
  persistFavoriteSymbols();
  renderWatchlist(state.watchlist);
  renderFavorites();
  syncMobileFavoriteButton();
}

function renderFavoriteButton(symbol) {
  const active = isFavoriteSymbol(symbol);
  const label = active ? "Remove favorite" : "Add favorite";
  const classes = active
    ? "favorite-button favorite-active rounded-full border border-amber-300/30 bg-amber-300/12 px-3 py-2 text-amber-200"
    : "favorite-button rounded-full border border-white/10 bg-white/5 px-3 py-2 text-slate-300";
  return `<button type="button" class="${classes}" data-favorite-symbol="${symbol}" aria-label="${label}">${active ? "★" : "☆"}</button>`;
}

function bindFavoriteButtons(scope = document) {
  scope.querySelectorAll("[data-favorite-symbol]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleFavorite(button.dataset.favoriteSymbol);
    });
  });
}

function renderFavorites() {
  const favoriteItems = state.watchlist.filter((item) => isFavoriteSymbol(item.symbol));
  elements.favoritesMeta.textContent = `${favoriteItems.length} saved`;

  if (!favoriteItems.length) {
    elements.favoritesBody.innerHTML = `
      <article class="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
        <p class="text-sm font-semibold text-white">No favorites yet</p>
        <p class="mt-2 text-sm leading-6 text-slate-400">Use the star button on a stock to pin it here.</p>
      </article>
    `;
    return;
  }

  elements.favoritesBody.innerHTML = favoriteItems
    .map((item) => {
      const tone = item.change_percent >= 0 ? "text-emerald-300" : "text-rose-300";
      return `
        <button
          type="button"
          class="favorite-card w-full rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-left transition hover:bg-slate-900/90"
          data-symbol="${item.symbol}"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="text-sm font-semibold text-white">${item.symbol}</p>
              <p class="mt-1 truncate text-xs text-slate-400">${item.name}</p>
            </div>
            ${renderFavoriteButton(item.symbol)}
          </div>
          <div class="mt-4 flex items-center justify-between gap-3">
            <p class="text-sm font-semibold text-white">${currency(item.price)}</p>
            <p class="text-xs font-medium ${tone}">${percent(item.change_percent)}</p>
          </div>
        </button>
      `;
    })
    .join("");

  elements.favoritesBody.querySelectorAll(".favorite-card").forEach((card) => {
    card.addEventListener("click", () => {
      loadSymbol(card.dataset.symbol);
    });
  });
  bindFavoriteButtons(elements.favoritesBody);
}

function hydrateDashboardFromCache() {
  const cachedWatchlist = readCachedJson(STORAGE_KEYS.cachedWatchlist);
  const cachedOverview = readCachedJson(STORAGE_KEYS.cachedOverview);
  const cachedAnalysis = readCachedJson(STORAGE_KEYS.cachedAnalysis);
  const cachedAlerts = readCachedJson(STORAGE_KEYS.cachedAlerts);
  state.favoriteSymbols = readFavoriteSymbols();

  if (Array.isArray(cachedWatchlist) && cachedWatchlist.length) {
    state.watchlist = cachedWatchlist;
    elements.watchlistMeta.textContent = `${cachedWatchlist.length} symbols`;
    renderWatchlist(cachedWatchlist);
    renderFavorites();
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

  if (Array.isArray(cachedAlerts) && cachedAlerts.length) {
    renderAlerts(cachedAlerts);
  }
}

function renderStrategyButtons() {
  elements.strategyButtons.forEach((button) => {
    const active = button.dataset.strategy === state.selectedStrategy;
    button.className = [
      "strategy-button rounded-xl px-3 py-2 text-xs font-semibold transition",
      active ? "strategy-button-active" : "strategy-button-idle",
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
  elements.mobileQuickActions?.classList.remove("hidden");
}

function showLoginOverlay() {
  elements.appShell.classList.add("hidden");
  elements.appShell.hidden = true;
  elements.authOverlay.classList.remove("hidden");
  elements.authOverlay.hidden = false;
  elements.mobileQuickActions?.classList.add("hidden");
  closePortfolioSheet();
  elements.authError.hidden = true;
  elements.authForm.reset();
}

async function api(path, options = {}) {
  const baseUrl = options.baseUrlOverride || resolveApiBaseUrl();
  const url = `${baseUrl}${path}`;
  const timeoutMs = options.timeoutMs ?? 15000;
  const retryCount = options.retryCount ?? 0;
  const retryDelayMs = options.retryDelayMs ?? 1200;
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
    const canRetry = retryCount > 0 && (!options.method || options.method === "GET");
    if (error.name === "AbortError") {
      console.error("[frontend] API timeout", { path, timeoutMs });
      if (shouldFallbackToDeployedApi(path, options, baseUrl)) {
        console.warn("[frontend] local API timed out, retrying against deployed backend", { path });
        return api(path, {
          ...options,
          baseUrlOverride: DEPLOYED_API_ORIGIN,
          skipDeployedFallback: true,
          retryCount: Math.max(retryCount, 1),
          timeoutMs: Math.round(timeoutMs * 1.25),
        });
      }
      if (canRetry) {
        await new Promise((resolve) => window.setTimeout(resolve, retryDelayMs));
        return api(path, {
          ...options,
          baseUrlOverride: baseUrl,
          timeoutMs: Math.round(timeoutMs * 1.5),
          retryCount: retryCount - 1,
        });
      }
      throw new Error("Request timed out.");
    }
    console.error("[frontend] API network error", { path, error: error.message });
    if (shouldFallbackToDeployedApi(path, options, baseUrl)) {
      console.warn("[frontend] local API failed, retrying against deployed backend", { path, error: error.message });
      return api(path, {
        ...options,
        baseUrlOverride: DEPLOYED_API_ORIGIN,
        skipDeployedFallback: true,
        retryCount: Math.max(retryCount, 1),
        timeoutMs: Math.round(timeoutMs * 1.25),
      });
    }
    if (canRetry) {
      await new Promise((resolve) => window.setTimeout(resolve, retryDelayMs));
      return api(path, {
        ...options,
        baseUrlOverride: baseUrl,
        timeoutMs: Math.round(timeoutMs * 1.25),
        retryCount: retryCount - 1,
      });
    }
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
    if (shouldFallbackToDeployedApi(path, options, baseUrl)) {
      console.warn("[frontend] local API returned error, retrying against deployed backend", {
        path,
        status: response.status,
      });
      return api(path, {
        ...options,
        baseUrlOverride: DEPLOYED_API_ORIGIN,
        skipDeployedFallback: true,
        retryCount: Math.max(retryCount, 1),
        timeoutMs: Math.round(timeoutMs * 1.2),
      });
    }
    throw new Error(String(detail));
  }

  console.log("[frontend] API ok", { path, status: response.status });
  return payload;
}

async function loadBackendHealth() {
  try {
    const payload = await api("/api/health", {
      timeoutMs: 20000,
      retryCount: 1,
    });
    const database = payload?.database || {};
    if (database.fallback_active) {
      setBackendStatus("Connected · DB fallback", "warning");
      return;
    }
    if (database.backend === "supabase") {
      setBackendStatus("Connected · Supabase", "ok");
      return;
    }
    if (database.backend === "postgres") {
      setBackendStatus("Connected · Postgres", "ok");
      return;
    }
    setBackendStatus("Connected", "ok");
  } catch (error) {
    setBackendStatus("Backend offline", "error");
    throw error;
  }
}

async function loadAlerts(forceRefresh = false) {
  const cachedAlerts = readCachedJson(STORAGE_KEYS.cachedAlerts);
  if (forceRefresh || !Array.isArray(cachedAlerts) || !cachedAlerts.length) {
    renderAlertsLoading();
  } else {
    elements.alertsMeta.textContent = "Refreshing alerts...";
  }
  const params = new URLSearchParams({
    strategy: state.selectedStrategy,
    limit: "6",
  });
  if (forceRefresh) {
    params.set("refresh", "1");
  }
  const alerts = await api(`/api/alerts?${params.toString()}`, {
    timeoutMs: 22000,
    retryCount: 2,
  });
  renderAlerts(alerts);
  return alerts;
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
          <div class="mb-3 flex justify-end">
            ${renderFavoriteButton(item.symbol)}
          </div>
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
  bindFavoriteButtons(elements.watchlistBody);
  renderFavorites();
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

function queueTradingViewRender(symbol, exchange = "") {
  const requestId = ++state.chartRequestId;
  window.clearTimeout(state.chartRenderId);
  state.pendingChart = { symbol, exchange, requestId };
  if (isMobileViewport() && !state.chartInView) {
    showTradingViewLoader("Chart loads when you scroll.");
    return;
  }
  const hasRenderedChart = Boolean(elements.tradingviewChart.querySelector("iframe"));
  if (!hasRenderedChart || state.tvWidgetSymbol !== toTradingViewSymbol(symbol, exchange)) {
    showTradingViewLoader();
  }
  state.chartRenderId = window.setTimeout(() => {
    renderTradingView(symbol, exchange, requestId);
  }, 120);
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
  queueTradingViewRender(overview.symbol, overview.exchange);
}

function renderOverviewFallback(symbol) {
  elements.selectedSymbolName.textContent = symbol;
  elements.selectedCompanyName.textContent = "Live overview unavailable";
  elements.chartSymbolBadge.textContent = symbol;
  elements.changeBadge.textContent = "--";
  elements.changeBadge.className =
    "inline-flex w-fit rounded-full bg-white/5 px-4 py-2 text-sm font-semibold text-slate-300";
  elements.metricPrice.textContent = "$--";
  elements.metricHigh.textContent = "$--";
  elements.metricLow.textContent = "$--";
  elements.metricOpen.textContent = "$--";
  elements.metricPrevClose.textContent = "$--";
  elements.companyHeadline.textContent = symbol;
  elements.companyExchange.textContent = "Exchange unavailable";
  elements.companyLogo.classList.add("hidden");
  elements.companyLogo.removeAttribute("src");
  renderCompanyDetails({
    exchange: "--",
    finnhub_industry: "--",
    ipo: "--",
    market_capitalization: null,
    share_outstanding: null,
  });
  queueTradingViewRender(symbol);
}

function toTradingViewSymbol(symbol, exchange = "") {
  const plain = symbol.toUpperCase();
  const normalizedExchange = String(exchange || "").toUpperCase();
  const normalizedPlain = plain.replace(/-/g, ".");
  const mapping = {
    AAPL: "NASDAQ:AAPL",
    MSFT: "NASDAQ:MSFT",
    NVDA: "NASDAQ:NVDA",
    AMZN: "NASDAQ:AMZN",
    META: "NASDAQ:META",
    TSLA: "NASDAQ:TSLA",
  };
  if (mapping[plain]) {
    return mapping[plain];
  }

  const suffixMappings = [
    [".NS", "NSE"],
    [".DE", "XETR"],
    [".PA", "EPA"],
    [".AS", "EURONEXT"],
    [".SW", "SIX"],
    [".L", "LSE"],
  ];

  for (const [suffix, market] of suffixMappings) {
    if (plain.endsWith(suffix)) {
      return `${market}:${normalizedPlain.slice(0, -suffix.length)}`;
    }
  }

  if (normalizedExchange.includes("NASDAQ")) {
    return `NASDAQ:${normalizedPlain}`;
  }
  if (normalizedExchange.includes("NEW YORK STOCK EXCHANGE") || normalizedExchange === "NYSE") {
    return `NYSE:${normalizedPlain}`;
  }
  if (
    normalizedExchange.includes("ARCA") ||
    normalizedExchange.includes("AMEX") ||
    normalizedExchange.includes("BATS")
  ) {
    return `AMEX:${normalizedPlain}`;
  }

  return normalizedPlain;
}

function ensureTradingView() {
  if (window.TradingView && typeof window.TradingView.widget === "function") {
    state.tvReady = true;
    state.tvScriptPromise = null;
    return Promise.resolve(window.TradingView);
  }

  if (state.tvScriptPromise) {
    return state.tvScriptPromise;
  }

  state.tvScriptPromise = new Promise((resolve, reject) => {
    const cleanupFailedScript = () => {
      document
        .querySelectorAll('script[src="https://s3.tradingview.com/tv.js"]')
        .forEach((node) => node.remove());
      state.tvScriptPromise = null;
      state.tvReady = false;
    };

    const onLoad = () => {
      state.tvReady = true;
      state.tvScriptPromise = null;
      resolve(window.TradingView);
    };

    const onError = () => {
      cleanupFailedScript();
      reject(new Error("TradingView widget failed to load."));
    };

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

function initChartObserver() {
  if (!elements.chartSection || !("IntersectionObserver" in window)) {
    state.chartInView = !isMobileViewport();
    return;
  }
  if (state.chartObserver) {
    state.chartObserver.disconnect();
  }
  state.chartObserver = new IntersectionObserver(
    (entries) => {
      const visible = entries.some((entry) => entry.isIntersecting);
      state.chartInView = visible || !isMobileViewport();
      if (state.chartInView && state.pendingChart) {
        const { symbol, exchange, requestId } = state.pendingChart;
        window.clearTimeout(state.chartRenderId);
        state.chartRenderId = window.setTimeout(() => {
          renderTradingView(symbol, exchange, requestId);
        }, 80);
      }
    },
    { rootMargin: "180px 0px" },
  );
  state.chartObserver.observe(elements.chartSection);
}

function handleViewportFeatures() {
  state.chartInView = !isMobileViewport();
  if (isMobileViewport()) {
    initChartObserver();
  } else if (state.pendingChart) {
    const { symbol, exchange, requestId } = state.pendingChart;
    window.clearTimeout(state.chartRenderId);
    state.chartRenderId = window.setTimeout(() => renderTradingView(symbol, exchange, requestId), 80);
  }
  syncMobileFavoriteButton();
  renderMobileStrategyCards();
}

async function renderTradingView(symbol, exchange = "", requestId = state.chartRequestId) {
  const tvSymbol = toTradingViewSymbol(symbol, exchange);
  const hasRenderedChart = Boolean(elements.tradingviewChart.querySelector("iframe"));

  if (requestId !== state.chartRequestId) {
    return;
  }

  if (state.tvWidgetSymbol === tvSymbol && hasRenderedChart) {
    return;
  }

  showTradingViewLoader();

  try {
    await ensureTradingView();
  } catch (error) {
    if (requestId !== state.chartRequestId) {
      return;
    }
    state.chartRetryAttempt += 1;
    showTradingViewLoader(
      state.chartRetryAttempt <= 2
        ? "Retrying TradingView chart..."
        : "TradingView widget failed to load."
    );
    if (state.chartRetryAttempt <= 2) {
      window.clearTimeout(state.chartRenderId);
      state.chartRenderId = window.setTimeout(() => {
        renderTradingView(symbol, exchange);
      }, 1200 * state.chartRetryAttempt);
    }
    return;
  }

  if (requestId !== state.chartRequestId) {
    return;
  }

  state.chartRetryAttempt = 0;
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
  const items = await api(`/api/dashboard/watchlist${suffix}`, {
    timeoutMs: 25000,
    retryCount: 1,
  });
  state.watchlist = items;
  writeCachedJson(STORAGE_KEYS.cachedWatchlist, items);
  renderWatchlist(items);
  return items;
}

async function loadSymbol(symbol, forceRefresh = false) {
  const requestId = ++state.activeRequest;
  const normalized = symbol.trim().toUpperCase();
  persistSelectedSymbol(normalized);
  state.strategySnapshots[normalized] = {};
  clearError();
  renderWatchlist(state.watchlist);
  renderAnalysisLoading(normalized);
  queueTradingViewRender(normalized);

  try {
    const analysisParams = new URLSearchParams({ strategy: state.selectedStrategy });
    if (forceRefresh) {
      analysisParams.set("refresh", "1");
    }
    const overviewSuffix = forceRefresh ? "?refresh=1" : "";
    const newsPromise = api(`/api/dashboard/news/${encodeURIComponent(normalized)}${overviewSuffix}`, {
      timeoutMs: 18000,
      retryCount: 1,
    })
      .then((payload) => {
        if (requestId === state.activeRequest) {
          state.latestNews = payload;
        }
      })
      .catch((error) => {
        console.error("[frontend] news load failed", error);
        if (requestId === state.activeRequest) {
          state.latestNews = [];
        }
      });

    const overviewResult = await Promise.allSettled([
      api(`/api/dashboard/symbol/${encodeURIComponent(normalized)}${overviewSuffix}`, {
        timeoutMs: 22000,
        retryCount: 1,
      }),
    ]).then((results) => results[0]);

    if (requestId !== state.activeRequest) {
      return;
    }

    if (overviewResult.status === "fulfilled") {
      renderOverview(overviewResult.value);
    } else {
      console.error("[frontend] overview load failed", overviewResult.reason);
      renderOverviewFallback(normalized);
    }

    renderWatchlist(state.watchlist);

    await delay(650);

    if (requestId !== state.activeRequest) {
      return;
    }

    const analysisResult = await Promise.allSettled([
      api(`/api/analysis/${encodeURIComponent(normalized)}?${analysisParams.toString()}`, {
        timeoutMs: 30000,
        retryCount: 1,
      }),
    ]).then((results) => results[0]);

    if (requestId !== state.activeRequest) {
      return;
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

    if (isMobileViewport()) {
      scheduleLowPriorityTask(() => {
        loadStrategySnapshots(normalized, forceRefresh).catch((error) => {
          console.error("[frontend] mobile strategy snapshot load failed", error);
        });
      }, 120);
    }

    void newsPromise;

    if (overviewResult.status === "rejected") {
      showError("Live overview is unavailable for this symbol right now.");
    }
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

async function loadStrategySnapshots(symbol, forceRefresh = false) {
  const strategies = Object.keys(STRATEGY_LABELS);
  const existing = state.strategySnapshots[symbol] || {};
  const params = new URLSearchParams();
  if (forceRefresh) {
    params.set("refresh", "1");
  }
  await Promise.all(
    strategies.map(async (strategy) => {
      if (!forceRefresh && existing[strategy]) {
        return;
      }
      const query = new URLSearchParams(params);
      query.set("strategy", strategy);
      const analysis = await api(`/api/analysis/${encodeURIComponent(symbol)}?${query.toString()}`, {
        timeoutMs: 22000,
        retryCount: 1,
      });
      state.strategySnapshots[symbol] = {
        ...(state.strategySnapshots[symbol] || {}),
        [strategy]: analysis,
      };
    }),
  );
  if (symbol === state.selectedSymbol) {
    renderMobileStrategyCards();
  }
}

async function bootDashboard(forceRefresh = false) {
  clearError();
  if (!forceRefresh) {
    hydrateDashboardFromCache();
  }
  renderAlertsLoading();
  try {
    setBackendStatus("Connecting backend...", "loading");
    loadBackendHealth().catch((error) => {
      console.error("[frontend] health load failed", error);
    });

    const [watchlistResult, symbolResult] = await Promise.allSettled([
      loadWatchlist(forceRefresh),
      loadSymbol(state.selectedSymbol, forceRefresh),
    ]);

    scheduleLowPriorityTask(() => {
      loadAlerts(forceRefresh).catch((error) => {
        console.error("[frontend] alerts load failed", error);
        const cachedAlerts = readCachedJson(STORAGE_KEYS.cachedAlerts);
        if (Array.isArray(cachedAlerts) && cachedAlerts.length) {
          renderAlerts(cachedAlerts);
          elements.alertsMeta.textContent = "Showing cached alerts";
        } else {
          renderAlertsWarning("Retrying alerts...");
        }
        queueAlertsRetry(forceRefresh);
      });
    }, 180);

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
        showError(symbolResult.reason?.message || "Selected symbol could not load yet.");
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

function bindApp() {
  renderStrategyButtons();
  handleViewportFeatures();

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

  elements.mobileFavoriteButton?.addEventListener("click", () => {
    toggleFavorite(state.selectedSymbol);
    syncMobileFavoriteButton();
  });

  elements.mobileAlertButton?.addEventListener("click", () => {
    elements.alertsSection?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  elements.mobilePortfolioButton?.addEventListener("click", () => {
    openPortfolioSheet();
  });

  elements.portfolioSheetClose?.addEventListener("click", closePortfolioSheet);
  elements.portfolioSheetBackdrop?.addEventListener("click", closePortfolioSheet);

  elements.strategyButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      const nextStrategy = button.dataset.strategy;
      if (!nextStrategy || nextStrategy === state.selectedStrategy) {
        return;
      }
      persistSelectedStrategy(nextStrategy);
      renderStrategyButtons();
      if (isAuthenticated()) {
        loadAlerts(true).catch((error) => {
          console.error("[frontend] alerts refresh failed", error);
          const cachedAlerts = readCachedJson(STORAGE_KEYS.cachedAlerts);
          if (Array.isArray(cachedAlerts) && cachedAlerts.length) {
            renderAlerts(cachedAlerts);
            elements.alertsMeta.textContent = "Showing cached alerts";
          } else {
            renderAlertsWarning("Retrying alerts...");
          }
          queueAlertsRetry(true);
        });
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

  window.addEventListener("resize", () => {
    handleViewportFeatures();
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
