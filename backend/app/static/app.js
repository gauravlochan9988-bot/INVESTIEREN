const state = {
  stocks: [],
  universe: [],
  portfolio: [],
  selectedSymbol: null,
  selectedAnalysis: null,
  selectedQuote: null,
  searchQuery: "",
  searchResults: [],
  symbolDirectory: new Map(),
  searchCache: new Map(),
  searchTimer: null,
  searchRequestId: 0,
  searchStatus: "idle",
  historyCache: new Map(),
  toastTimer: null,
  activeAnalysisId: 0,
  analysisAbortController: null,
};

const ANALYSIS_TIMEOUT_MS = 5000;
const LOADING_ERROR_MESSAGE = "Data loading failed";
const AUTH_PASSWORD = "9988";

const KNOWN_SEARCH_HINTS = {
  "s&p": [
    { symbol: "SPY", name: "SPDR S&P 500 ETF Trust" },
    { symbol: "VOO", name: "Vanguard S&P 500 ETF" },
    { symbol: "IVV", name: "iShares Core S&P 500 ETF" },
  ],
  nasdaq: [{ symbol: "QQQ", name: "Invesco QQQ Trust" }],
  dow: [{ symbol: "DIA", name: "SPDR Dow Jones Industrial Average ETF Trust" }],
  "core etf": [
    { symbol: "IVV", name: "iShares Core S&P 500 ETF" },
    { symbol: "VTI", name: "Vanguard Total Stock Market ETF" },
  ],
};

const STORAGE_KEYS = {
  selectedSymbol: "investieren:selectedSymbol",
  authenticated: "investieren:authenticated",
};

const elements = {
  appShell: document.getElementById("appShell"),
  authOverlay: document.getElementById("authOverlay"),
  authForm: document.getElementById("authForm"),
  authPassword: document.getElementById("authPassword"),
  authError: document.getElementById("authError"),
  analysisPanel: document.querySelector(".analysis-panel"),
  watchlistBody: document.getElementById("watchlistBody"),
  watchlistMeta: document.getElementById("watchlistMeta"),
  refreshStocks: document.getElementById("refreshStocks"),
  logoutButton: document.getElementById("logoutButton"),
  brandHomeButton: document.getElementById("brandHomeButton"),
  searchInput: document.getElementById("searchInput"),
  searchSuggestions: document.getElementById("searchSuggestions"),
  errorBanner: document.getElementById("errorBanner"),
  loadingState: document.getElementById("loadingState"),
  homeStateCard: document.getElementById("homeStateCard"),
  analysisTitle: document.getElementById("analysisTitle"),
  analysisBadge: document.getElementById("analysisBadge"),
  decisionPanel: document.getElementById("decisionPanel"),
  actionPanel: document.getElementById("actionPanel"),
  chartPanel: document.getElementById("chartPanel"),
  signalsPanel: document.getElementById("signalsPanel"),
  contextSection: document.getElementById("contextSection"),
  analysisSummary: document.getElementById("analysisSummary"),
  noTradeBanner: document.getElementById("noTradeBanner"),
  noTradeTitle: document.getElementById("noTradeTitle"),
  noTradeReason: document.getElementById("noTradeReason"),
  recommendationValue: document.getElementById("recommendationValue"),
  confidenceValue: document.getElementById("confidenceValue"),
  confidenceBar: document.getElementById("confidenceBar"),
  confidenceNote: document.getElementById("confidenceNote"),
  riskValue: document.getElementById("riskValue"),
  selectedPriceValue: document.getElementById("selectedPriceValue"),
  selectedPriceLabel: document.getElementById("selectedPriceLabel"),
  selectedChangeValue: document.getElementById("selectedChangeValue"),
  probabilityUpValue: document.getElementById("probabilityUpValue"),
  probabilityDownValue: document.getElementById("probabilityDownValue"),
  biasSupportText: document.getElementById("biasSupportText"),
  biasStateText: document.getElementById("biasStateText"),
  entrySignalValue: document.getElementById("entrySignalValue"),
  entryReasonValue: document.getElementById("entryReasonValue"),
  exitSignalValue: document.getElementById("exitSignalValue"),
  exitReasonValue: document.getElementById("exitReasonValue"),
  positionSizeValue: document.getElementById("positionSizeValue"),
  positionSizeReason: document.getElementById("positionSizeReason"),
  stopLossValue: document.getElementById("stopLossValue"),
  stopLossReason: document.getElementById("stopLossReason"),
  timeframeValue: document.getElementById("timeframeValue"),
  macroTrendValue: document.getElementById("macroTrendValue"),
  ratesValue: document.getElementById("ratesValue"),
  usdValue: document.getElementById("usdValue"),
  macroScoreValue: document.getElementById("macroScoreValue"),
  warningsList: document.getElementById("warningsList"),
  signalsGrid: document.getElementById("signalsGrid"),
  chartSymbol: document.getElementById("chartSymbol"),
  historyChart: document.getElementById("historyChart"),
  symbolInput: document.getElementById("symbolInput"),
  positionForm: document.getElementById("positionForm"),
  positionId: document.getElementById("positionId"),
  quantityInput: document.getElementById("quantityInput"),
  priceInput: document.getElementById("priceInput"),
  openedAtInput: document.getElementById("openedAtInput"),
  saveButton: document.getElementById("saveButton"),
  cancelEditButton: document.getElementById("cancelEditButton"),
  portfolioBody: document.getElementById("portfolioBody"),
  costBasisValue: document.getElementById("costBasisValue"),
  marketValueValue: document.getElementById("marketValueValue"),
  portfolioMarketValueValue: document.getElementById("portfolioMarketValueValue"),
  pnlValue: document.getElementById("pnlValue"),
  toast: document.getElementById("toast"),
};

let appBooted = false;

class RequestTimeoutError extends Error {
  constructor(message) {
    super(message);
    this.name = "RequestTimeoutError";
  }
}

async function api(path, options = {}) {
  const {
    timeoutMs = 5000,
    timeoutMessage = LOADING_ERROR_MESSAGE,
    signal: externalSignal,
    headers,
    ...fetchOptions
  } = options;
  const controller = new AbortController();
  let didTimeout = false;
  let didAbortExternally = false;
  const onAbort = () => {
    didAbortExternally = true;
    controller.abort(externalSignal?.reason || "aborted");
  };
  if (externalSignal) {
    if (externalSignal.aborted) {
      onAbort();
    } else {
      externalSignal.addEventListener("abort", onAbort, { once: true });
    }
  }
  const timeoutId = window.setTimeout(() => {
    didTimeout = true;
    controller.abort("timeout");
  }, timeoutMs);

  let response;
  try {
    response = await fetch(path, {
      headers: { "Content-Type": "application/json", ...(headers || {}) },
      cache: "no-store",
      ...fetchOptions,
      signal: controller.signal,
    });
  } catch (error) {
    window.clearTimeout(timeoutId);
    if (externalSignal) {
      externalSignal.removeEventListener("abort", onAbort);
    }
    if (didTimeout) {
      throw new RequestTimeoutError(timeoutMessage);
    }
    if (didAbortExternally || error.name === "AbortError") {
      throw error;
    }
    throw new Error(LOADING_ERROR_MESSAGE);
  }

  window.clearTimeout(timeoutId);
  if (externalSignal) {
    externalSignal.removeEventListener("abort", onAbort);
  }

  if (!response.ok) {
    let detail = `Request failed with status ${response.status}`;
    if (response.status >= 500) {
      detail = LOADING_ERROR_MESSAGE;
    }
    try {
      const payload = await response.json();
      detail = payload.error || payload.detail || detail;
    } catch (error) {
      // Keep fallback message.
    }
    throw new Error(detail);
  }

  if (response.status === 204) {
    return null;
  }
  return response.json();
}

function currency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value ?? 0);
}

function percent(value) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function roundedPercent(value) {
  return `${Math.round((value ?? 0) * 100)}%`;
}

function isNoDataMessage(message) {
  const normalized = `${message || ""}`.toLowerCase();
  return (
    normalized.includes("no live market data available")
    || normalized.includes("provider is currently unavailable")
    || normalized.includes("symbol not supported")
    || normalized.includes("not found")
    || normalized.includes("timeout")
  );
}

function classifyDataIssue(message) {
  const normalized = `${message || ""}`.toLowerCase();
  if (normalized.includes("timeout") || normalized.includes("zu lange")) {
    return {
      title: "No live market data available",
      reason: "Timeout: the live data request took too long.",
    };
  }
  if (normalized.includes("provider") || normalized.includes("unavailable")) {
    return {
      title: "No live market data available",
      reason: "Provider unavailable: live data could not be loaded.",
    };
  }
  if (
    normalized.includes("symbol not supported")
    || normalized.includes("not found")
    || normalized.includes("unsupported")
  ) {
    return {
      title: "No live market data available",
      reason: "Symbol not supported or no live feed available for this ticker.",
    };
  }
  return {
    title: "No live market data available",
    reason: "The data source did not return a usable live response.",
  };
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("toast-visible");
  clearTimeout(state.toastTimer);
  state.toastTimer = window.setTimeout(() => {
    elements.toast.classList.remove("toast-visible");
  }, 2400);
}

function withRefresh(path, forceRefresh = false) {
  if (!forceRefresh) {
    return path;
  }
  return `${path}${path.includes("?") ? "&" : "?"}refresh=1`;
}

function isAuthenticated() {
  try {
    return window.sessionStorage.getItem(STORAGE_KEYS.authenticated) === "1";
  } catch (error) {
    return false;
  }
}

function setAuthenticated(value) {
  try {
    if (value) {
      window.sessionStorage.setItem(STORAGE_KEYS.authenticated, "1");
      return;
    }
    window.sessionStorage.removeItem(STORAGE_KEYS.authenticated);
  } catch (error) {
    // Ignore storage failures.
  }
}

function showLoginOverlay() {
  elements.appShell.hidden = true;
  elements.authOverlay.hidden = false;
  elements.authForm.reset();
  elements.authError.hidden = true;
  window.requestAnimationFrame(() => {
    elements.authPassword.focus();
  });
}

function showAppShell() {
  elements.authOverlay.hidden = true;
  elements.appShell.hidden = false;
  elements.authError.hidden = true;
}

function logoutToLogin() {
  if (state.analysisAbortController) {
    state.analysisAbortController.abort();
    state.analysisAbortController = null;
  }
  setAuthenticated(false);
  setLoading(false);
  clearError();
  renderHomeState();
  showLoginOverlay();
}

function noTradeCopy(reason) {
  const normalizedReason = `${reason || ""}`.trim();
  const lowered = normalizedReason.toLowerCase();

  if (!normalizedReason) {
    return {
      title: "NO TRADE",
      reason: "Market conditions are unclear right now.",
    };
  }

  if (lowered.includes("probability edge")) {
    return {
      title: "NO TRADE",
      reason: "There is not enough edge right now to justify a clean entry.",
    };
  }

  if (lowered.includes("conflicting")) {
    return {
      title: "NO TRADE",
      reason: "Key signals are pointing in different directions.",
    };
  }

  if (lowered.includes("volatility")) {
    return {
      title: "NO TRADE",
      reason: "Volatility is high while the trend still looks weak.",
    };
  }

  if (lowered.includes("risk is high")) {
    return {
      title: "NO TRADE",
      reason: "Risk is too high for the current setup quality.",
    };
  }

  if (lowered.includes("no clean trend")) {
    return {
      title: "NO TRADE",
      reason: "There is no clean trend to build on right now.",
    };
  }

  if (lowered.includes("broader market backdrop")) {
    return {
      title: "NO TRADE",
      reason: "The broader market backdrop is not supportive enough.",
    };
  }

  return {
    title: "NO TRADE",
    reason: normalizedReason,
  };
}

function displayRecommendation(analysis) {
  if (!analysis) {
    return "--";
  }
  const warnings = analysis.warnings || [];
  const unclearSetup = warnings.includes("Setup Unclear")
    || warnings.includes("No Clear Trend")
    || warnings.includes("Too Many Conflicting Signals");
  if (
    analysis.no_data
    || analysis.no_trade
    || unclearSetup
    || analysis.risk_level === "HIGH"
    || analysis.recommendation === "HOLD"
    || (analysis.confidence ?? 0) < 0.5
  ) {
    return "NO TRADE";
  }
  return analysis.recommendation;
}

function marketBiasLabel(analysis) {
  const edge = (analysis?.probability_up ?? 0.5) - 0.5;
  const absoluteEdge = Math.abs(edge);

  if (absoluteEdge < 0.06) return "neutral setup";
  if (edge >= 0.18) return "strong bullish bias";
  if (edge >= 0.1) return "bullish bias";
  if (edge > 0) return "weak bullish bias";
  if (edge <= -0.18) return "strong bearish bias";
  if (edge <= -0.1) return "bearish bias";
  return "weak bearish bias";
}

function convictionLabel(confidence) {
  if ((confidence ?? 0) >= 0.75) return "high conviction";
  if ((confidence ?? 0) >= 0.55) return "moderate conviction";
  return "low conviction";
}

function setupStateLabel(analysis) {
  if (analysis.no_data) return "blocked";
  if (displayRecommendation(analysis) === "NO TRADE") return "no trade";
  if (analysis.entry_signal) return "actionable";
  if (analysis.exit_signal) return "defensive";
  return "watch";
}

function biasToneClass(label) {
  if (`${label || ""}`.includes("bullish")) return "tone-positive";
  if (`${label || ""}`.includes("bearish")) return "tone-negative";
  return "tone-neutral";
}

function setupStateToneClass(label) {
  if (label === "actionable") return "tone-positive";
  if (label === "blocked" || label === "defensive") return "tone-negative";
  return "tone-neutral";
}

function biasLabel(probability, direction = "up") {
  const value = Number(probability ?? 0.5);
  const edge = direction === "down" ? value - 0.5 : value - 0.5;
  const absoluteEdge = Math.abs(edge);

  if (absoluteEdge < 0.06) {
    return "neutral setup";
  }
  if (direction === "up") {
    if (value >= 0.68) return "strong bullish bias";
    if (value >= 0.6) return "bullish bias";
    return "weak bullish bias";
  }
  if (value >= 0.68) return "strong bearish bias";
  if (value >= 0.6) return "bearish bias";
  return "weak bearish bias";
}

function prioritizedWarnings(warnings) {
  const priorityMap = new Map([
    ["No Live Market Data", 0],
    ["Negative News", 1],
    ["Overall Market Weak", 2],
    ["Macro Headwind", 3],
    ["High Volatility", 4],
    ["Too Many Conflicting Signals", 5],
    ["Setup Unclear", 6],
    ["Trend Weak", 7],
    ["No Clear Trend", 8],
    ["Overbought", 9],
  ]);

  return [...(warnings || [])]
    .sort((left, right) => {
      const leftPriority = priorityMap.get(left) ?? 50;
      const rightPriority = priorityMap.get(right) ?? 50;
      return leftPriority - rightPriority;
    })
    .slice(0, 3);
}

function setStatus(message, tone = "idle") {
  elements.refreshStocks.dataset.status = tone;
  elements.refreshStocks.title = message;
  elements.refreshStocks.setAttribute("aria-label", message);
  elements.refreshStocks.classList.toggle("is-error", tone === "error");
}

function setLoading(active, message = "Loading analysis...") {
  elements.loadingState.hidden = !active;
  elements.analysisPanel.classList.toggle("analysis-loading", active);
  elements.refreshStocks.setAttribute("aria-busy", active ? "true" : "false");
  if (active) {
    elements.loadingState.innerHTML = `<span class="loading-spinner" aria-hidden="true"></span><span>${message}</span>`;
    setStatus(message, "busy");
    elements.refreshStocks.classList.add("is-spinning");
  } else {
    elements.refreshStocks.classList.remove("is-spinning");
    if (elements.errorBanner.hidden) {
      setStatus(
        state.selectedSymbol ? "Analyze selected stock again" : "Refresh dashboard data",
        "idle",
      );
    }
  }
}

function showError(message) {
  elements.errorBanner.hidden = false;
  elements.errorBanner.textContent = message;
  elements.refreshStocks.classList.remove("is-spinning");
  setStatus(message, "error");
}

function clearError() {
  elements.errorBanner.hidden = true;
  elements.errorBanner.textContent = "";
  if (elements.loadingState.hidden) {
    setStatus(
      state.selectedSymbol ? "Analyze selected stock again" : "Refresh dashboard data",
      "idle",
    );
  }
}

function resetForm() {
  elements.positionId.value = "";
  elements.positionForm.reset();
  elements.saveButton.textContent = "Add position";
  elements.cancelEditButton.hidden = true;
  elements.openedAtInput.value = new Date().toISOString().slice(0, 10);
}

function recommendationBadgeClass(recommendation) {
  if (recommendation === "BUY") return "signal-badge signal-badge-buy";
  if (recommendation === "SELL") return "signal-badge signal-badge-sell";
  if (recommendation === "HOLD") return "signal-badge signal-badge-hold";
  if (recommendation === "NO TRADE") return "signal-badge signal-badge-no-trade";
  return "signal-badge signal-badge-muted";
}

function recommendationToneClass(recommendation) {
  if (recommendation === "BUY") return "tone-positive";
  if (recommendation === "SELL") return "tone-negative";
  if (recommendation === "NO TRADE") return "tone-neutral";
  return "tone-neutral";
}

function riskToneClass(riskLevel) {
  if (riskLevel === "LOW") return "tone-positive";
  if (riskLevel === "HIGH") return "tone-negative";
  return "tone-neutral";
}

function booleanToneClass(active, negativeBias = false) {
  if (active && !negativeBias) return "tone-positive";
  if (active && negativeBias) return "tone-negative";
  return "tone-neutral";
}

function signalPillClass(status) {
  if (status === "BULLISH") return "pill pill-bullish";
  if (status === "BEARISH") return "pill pill-bearish";
  return "pill pill-neutral";
}

function quoteForSymbol(symbol) {
  return (
    state.stocks.find((stock) => stock.symbol === symbol) ||
    (state.selectedQuote?.symbol === symbol ? state.selectedQuote : null)
  );
}

function normalizedSearchQuery() {
  return state.searchQuery.trim().toLowerCase();
}

function stockMatchesQuery(stock, query) {
  return (
    stock.symbol.toLowerCase().includes(query) ||
    stock.name.toLowerCase().includes(query)
  );
}

function directSymbolCandidate() {
  const candidate = state.searchQuery.trim().toUpperCase();
  if (!candidate) {
    return null;
  }
  return candidate.length >= 2 && /^[A-Z][A-Z0-9.-]{0,14}$/.test(candidate) ? candidate : null;
}

function formatSignalValue(signal) {
  if (signal.name === "RSI") {
    return signal.value.toFixed(1);
  }
  if (signal.name === "News Sentiment") {
    return signal.value.toFixed(2);
  }
  return `${signal.value.toFixed(2)}%`;
}

function timeframeLabel(timeframe) {
  if (timeframe === "short_term") return "Short term";
  if (timeframe === "mid_term") return "Mid term";
  return "Unclear";
}

function prettyWord(value) {
  if (!value) return "--";
  return value.replaceAll("_", " ");
}

function warningToneClass(warning) {
  if (warning.includes("Negative") || warning.includes("High") || warning.includes("Headwind")) {
    return "warning-badge warning-badge-negative";
  }
  if (warning.includes("Unclear") || warning.includes("Conflicting") || warning.includes("Weak")) {
    return "warning-badge warning-badge-neutral";
  }
  return "warning-badge warning-badge-muted";
}

function signalListFromPayload(signals) {
  return Object.values(signals || {}).filter(Boolean);
}

function knownSymbols() {
  const merged = [];
  const seen = new Set();

  const pushSymbol = (symbol, name) => {
    const normalizedSymbol = `${symbol || ""}`.trim().toUpperCase();
    const normalizedName = `${name || ""}`.trim() || normalizedSymbol;
    if (!normalizedSymbol || seen.has(normalizedSymbol)) {
      return;
    }
    seen.add(normalizedSymbol);
    merged.push({ symbol: normalizedSymbol, name: normalizedName });
  };

  state.stocks.forEach((stock) => pushSymbol(stock.symbol, stock.name));
  state.universe.forEach((stock) => pushSymbol(stock.symbol, stock.name));
  state.searchResults.forEach((stock) => pushSymbol(stock.symbol, stock.name));
  state.portfolio.forEach((position) =>
    pushSymbol(position.symbol, state.symbolDirectory.get(position.symbol) || position.symbol),
  );

  if (state.selectedQuote) {
    pushSymbol(
      state.selectedQuote.symbol,
      state.symbolDirectory.get(state.selectedQuote.symbol) || state.selectedQuote.name,
    );
  }
  if (state.selectedSymbol) {
    pushSymbol(state.selectedSymbol, state.symbolDirectory.get(state.selectedSymbol) || state.selectedSymbol);
  }

  [...state.symbolDirectory.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .forEach(([symbol, name]) => pushSymbol(symbol, name));

  return merged;
}

function renderSymbolOptions() {
  const currentValue = elements.symbolInput.value || state.selectedSymbol || "";
  const symbols = knownSymbols();
  elements.symbolInput.innerHTML = "";

  symbols.forEach((stock) => {
    const option = document.createElement("option");
    option.value = stock.symbol;
    option.textContent = `${stock.symbol} · ${stock.name}`;
    elements.symbolInput.appendChild(option);
  });

  if (currentValue && symbols.some((stock) => stock.symbol === currentValue)) {
    elements.symbolInput.value = currentValue;
    return;
  }

  if (state.selectedSymbol && symbols.some((stock) => stock.symbol === state.selectedSymbol)) {
    elements.symbolInput.value = state.selectedSymbol;
    return;
  }

  if (symbols[0]) {
    elements.symbolInput.value = symbols[0].symbol;
  }
}

function localSearchResults(limit = 6) {
  const query = normalizedSearchQuery();
  if (!query) {
    return [];
  }

  return knownSymbols()
    .filter((stock) => stockMatchesQuery(stock, query))
    .slice(0, limit);
}

function suggestionMatches(limit = 6) {
  const merged = [];
  const seen = new Set();

  [...localSearchResults(limit), ...state.searchResults].forEach((stock) => {
    if (!stock?.symbol || seen.has(stock.symbol) || merged.length >= limit) {
      return;
    }
    seen.add(stock.symbol);
    merged.push(stock);
  });

  return merged;
}

function watchlistEntries(limit = 16) {
  const query = normalizedSearchQuery();
  if (!query) {
    const trackedSymbols = new Set(state.stocks.map((stock) => stock.symbol));
    const trackedEntries = state.stocks.map((stock) => ({
      symbol: stock.symbol,
      name: stock.name,
    }));
    const otherEntries = state.universe.filter((stock) => !trackedSymbols.has(stock.symbol));
    return [...trackedEntries, ...otherEntries].slice(0, limit);
  }

  const merged = [];
  const seen = new Set();
  const push = (stock) => {
    if (!stock?.symbol || seen.has(stock.symbol) || merged.length >= limit) {
      return;
    }
    seen.add(stock.symbol);
    merged.push(stock);
  };

  suggestionMatches(limit).forEach(push);
  localSearchResults(limit).forEach(push);
  state.universe.filter((stock) => stockMatchesQuery(stock, query)).forEach(push);

  return merged;
}

function fallbackSuggestions(limit = 3) {
  const query = normalizedSearchQuery();
  if (!query) {
    return [];
  }

  const hints = [];
  const seen = new Set();
  Object.entries(KNOWN_SEARCH_HINTS).forEach(([key, items]) => {
    if (!query.includes(key)) {
      return;
    }
    items.forEach((item) => {
      if (seen.has(item.symbol) || hints.length >= limit) {
        return;
      }
      seen.add(item.symbol);
      hints.push(item);
    });
  });
  return hints;
}

function renderSearchSuggestions() {
  const matches = suggestionMatches();
  elements.searchSuggestions.innerHTML = "";
  const query = normalizedSearchQuery();
  const directSymbol = directSymbolCandidate();

  if (!query) {
    elements.searchSuggestions.hidden = true;
    return;
  }

  if (matches.length) {
    elements.searchSuggestions.hidden = false;
    matches.forEach((stock) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = `suggestion-item ${state.selectedSymbol === stock.symbol ? "suggestion-item-active" : ""}`;
      item.dataset.analyze = stock.symbol;
      item.innerHTML = `
        <div>
          <strong>${stock.symbol}</strong>
          <span>${stock.name}</span>
        </div>
      `;
      elements.searchSuggestions.appendChild(item);
    });

    if (directSymbol && !matches.some((stock) => stock.symbol === directSymbol)) {
      const directItem = document.createElement("button");
      directItem.type = "button";
      directItem.className = "suggestion-item suggestion-item-hint";
      directItem.dataset.analyze = directSymbol;
      directItem.innerHTML = `
        <div>
          <strong>${directSymbol}</strong>
          <span>Direct symbol lookup</span>
        </div>
      `;
      elements.searchSuggestions.appendChild(directItem);
    }
    return;
  }

  if (state.searchStatus === "loading") {
    elements.searchSuggestions.hidden = false;
    elements.searchSuggestions.innerHTML = `<div class="suggestion-empty">Searching...</div>`;
    return;
  }

  const hints = fallbackSuggestions();
  elements.searchSuggestions.hidden = false;
  elements.searchSuggestions.innerHTML = `<div class="suggestion-empty">No results</div>`;

  if (directSymbol) {
    const directItem = document.createElement("button");
    directItem.type = "button";
    directItem.className = "suggestion-item suggestion-item-hint";
    directItem.dataset.analyze = directSymbol;
    directItem.innerHTML = `
      <div>
        <strong>${directSymbol}</strong>
        <span>Analyze this symbol directly</span>
      </div>
    `;
    elements.searchSuggestions.appendChild(directItem);
  }

  hints.forEach((stock) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = `suggestion-item suggestion-item-hint ${state.selectedSymbol === stock.symbol ? "suggestion-item-active" : ""}`;
    item.dataset.analyze = stock.symbol;
    item.innerHTML = `
      <div>
        <strong>${stock.symbol}</strong>
        <span>${stock.name}</span>
      </div>
    `;
    elements.searchSuggestions.appendChild(item);
  });
}

function closeSuggestions() {
  elements.searchSuggestions.hidden = true;
}

function persistSelectedSymbol(symbol) {
  try {
    if (symbol) {
      window.localStorage.setItem(STORAGE_KEYS.selectedSymbol, symbol);
      return;
    }
    window.localStorage.removeItem(STORAGE_KEYS.selectedSymbol);
  } catch (error) {
    // Ignore storage failures.
  }
}

function setAnalysisSectionsVisible(isVisible) {
  elements.decisionPanel.hidden = !isVisible;
  elements.actionPanel.hidden = !isVisible;
  elements.chartPanel.hidden = !isVisible;
  elements.signalsPanel.hidden = !isVisible;
  elements.contextSection.hidden = !isVisible;
}

function readPersistedSymbol() {
  try {
    return window.localStorage.getItem(STORAGE_KEYS.selectedSymbol);
  } catch (error) {
    return null;
  }
}

function animateAnalysisPanel() {
  elements.analysisPanel.classList.remove("analysis-ready");
  window.requestAnimationFrame(() => {
    elements.analysisPanel.classList.add("analysis-ready");
  });
}

function renderLoadingState(symbol) {
  state.selectedSymbol = symbol;
  state.selectedAnalysis = null;
  state.selectedQuote = null;
  state.searchQuery = "";
  state.searchResults = [];
  state.searchStatus = "idle";
  elements.searchInput.value = symbol;
  elements.homeStateCard.hidden = true;
  elements.noTradeBanner.hidden = true;
  elements.analysisPanel.classList.remove("analysis-panel-home");
  elements.analysisTitle.textContent = symbol;
  elements.analysisBadge.hidden = true;
  elements.analysisSummary.textContent = "";
  elements.selectedChangeValue.textContent = "Loading...";
  elements.selectedChangeValue.className = "hero-subline tone-neutral";
  setAnalysisSectionsVisible(false);
  renderSearchSuggestions();
  renderWatchlist();
}

function rememberSymbolMeta(symbol, name) {
  const normalizedSymbol = `${symbol || ""}`.trim().toUpperCase();
  const normalizedName = `${name || ""}`.trim();
  if (!normalizedSymbol || !normalizedName) {
    return;
  }
  state.symbolDirectory.set(normalizedSymbol, normalizedName);
}

function quoteFromHistory(symbol, points) {
  if (!points?.length) {
    return null;
  }
  const latest = points[points.length - 1];
  const previous = points[points.length - 2] || latest;
  const previousClose = previous?.close || latest.close;
  const changePercent = previousClose ? ((latest.close - previousClose) / previousClose) * 100 : 0;
  return {
    symbol,
    name: state.symbolDirectory.get(symbol) || symbol,
    price: latest.close,
    change_percent: roundTo(changePercent, 2),
    volume: 0,
    updated_at: latest.date,
  };
}

function roundTo(value, digits) {
  return Number(value.toFixed(digits));
}

function formatWatchlistTimestamp(value) {
  if (!value) {
    return null;
  }
  return new Date(value).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function loadSearchSuggestions() {
  const query = state.searchQuery.trim();
  if (!query || query.length < 2) {
    state.searchResults = [];
    state.searchStatus = "idle";
    renderSearchSuggestions();
    renderSymbolOptions();
    renderWatchlist();
    return;
  }

  const cacheKey = query.toLowerCase();
  if (state.searchCache.has(cacheKey)) {
    state.searchResults = state.searchCache.get(cacheKey);
    state.searchStatus = "ready";
    renderSearchSuggestions();
    renderSymbolOptions();
    renderWatchlist();
    return;
  }

  const requestId = ++state.searchRequestId;
  state.searchStatus = "loading";
  renderSearchSuggestions();
  renderWatchlist();
  try {
    const results = await api(`/api/search?q=${encodeURIComponent(query)}&limit=12`);
    if (requestId !== state.searchRequestId) {
      return;
    }
    results.forEach((result) => rememberSymbolMeta(result.symbol, result.name));
    state.searchCache.set(cacheKey, results);
    state.searchResults = results;
    state.searchStatus = "ready";
    renderSearchSuggestions();
    renderSymbolOptions();
    renderWatchlist();
  } catch (error) {
    if (requestId !== state.searchRequestId) {
      return;
    }
    state.searchResults = [];
    state.searchStatus = "ready";
    renderSearchSuggestions();
    renderSymbolOptions();
    renderWatchlist();
  }
}

function scheduleSearchSuggestions() {
  clearTimeout(state.searchTimer);
  const query = state.searchQuery.trim();
  if (!query) {
    state.searchResults = [];
    state.searchRequestId += 1;
    state.searchStatus = "idle";
    renderSearchSuggestions();
    renderSymbolOptions();
    renderWatchlist();
    return;
  }

  if (query.length < 2) {
    state.searchResults = [];
    state.searchRequestId += 1;
    state.searchStatus = "idle";
    renderSearchSuggestions();
    renderSymbolOptions();
    renderWatchlist();
    return;
  }

  renderSearchSuggestions();
  renderWatchlist();
  state.searchTimer = window.setTimeout(() => {
    loadSearchSuggestions();
  }, 180);
}

function topSearchResult() {
  return suggestionMatches(1)[0] || null;
}

async function loadUniverse() {
  const universe = await api("/api/search/universe");
  state.universe = universe;
  universe.forEach((stock) => rememberSymbolMeta(stock.symbol, stock.name));
  renderSymbolOptions();
  renderWatchlist();
}

function renderWatchlist() {
  elements.watchlistBody.innerHTML = "";

  if (!state.stocks.length && !state.universe.length) {
    elements.watchlistBody.innerHTML = `<div class="watchlist-empty">No stocks available.</div>`;
    renderSymbolOptions();
    return;
  }

  const updatedAt = state.stocks[0] ? formatWatchlistTimestamp(state.stocks[0].updated_at) : null;
  const query = normalizedSearchQuery();
  const entries = watchlistEntries(12);
  if (query) {
    const statusLabel = state.searchStatus === "loading" ? "Searching..." : `${entries.length} shown`;
    elements.watchlistMeta.textContent = `Search · ${statusLabel}`;
  } else {
    const liveLabel = updatedAt
      ? `${state.stocks.length} live · ${updatedAt}`
      : "No live market data available";
    elements.watchlistMeta.textContent = `${entries.length} focus names · ${liveLabel}`;
  }

  state.stocks.forEach((stock) => {
    rememberSymbolMeta(stock.symbol, stock.name);
  });

  entries.forEach((stock) => {
    const liveQuote = quoteForSymbol(stock.symbol);
    const isTracked = Boolean(liveQuote);
    const item = document.createElement("button");
    item.type = "button";
    item.className = `watchlist-item ${state.selectedSymbol === stock.symbol ? "watchlist-item-active" : ""}`;
    item.dataset.analyze = stock.symbol;
    item.innerHTML = `
      <div class="watchlist-item-left">
        <span class="trend-dot ${
          !isTracked
            ? "trend-dot-neutral"
            : liveQuote.change_percent >= 0
              ? "trend-dot-up"
              : "trend-dot-down"
        }"></span>
        <div>
          <strong>${stock.symbol}</strong>
          <span>${stock.name}</span>
        </div>
      </div>
      <div class="watchlist-item-right">
        <strong>${isTracked ? currency(liveQuote.price) : "--"}</strong>
        <span class="${
          !isTracked ? "tone-neutral" : liveQuote.change_percent >= 0 ? "tone-positive" : "tone-negative"
        }">${isTracked ? percent(liveQuote.change_percent) : "Search result"}</span>
      </div>
    `;
    elements.watchlistBody.appendChild(item);
  });

  if (!entries.length) {
    elements.watchlistBody.innerHTML =
      `<div class="watchlist-empty">${state.searchStatus === "loading" ? "Searching symbols..." : "No symbols found for your search."}</div>`;
  }

  renderSymbolOptions();
}

function renderSelectedQuote(symbol) {
  const stock = quoteForSymbol(symbol);
  if (!stock) {
    elements.selectedPriceValue.textContent = "--";
    elements.selectedPriceValue.className = "decision-fact-value";
    elements.selectedPriceLabel.textContent = "Select a stock to load price and context";
    elements.selectedChangeValue.textContent = "Select a stock to start analysis";
    elements.selectedChangeValue.className = "hero-subline";
    return;
  }

  elements.selectedPriceValue.textContent = currency(stock.price);
  elements.selectedPriceValue.className = `decision-fact-value ${stock.change_percent >= 0 ? "tone-positive" : "tone-negative"}`;
  elements.selectedPriceLabel.textContent = stock.volume
    ? `${stock.name} · ${stock.volume.toLocaleString()} volume`
    : `${stock.name} · Live price from chart history`;
  elements.selectedChangeValue.textContent = `${stock.name} · ${percent(stock.change_percent)} today`;
  elements.selectedChangeValue.className = `hero-subline ${stock.change_percent >= 0 ? "tone-positive" : "tone-negative"}`;
}

function renderWarnings(warnings) {
  const limitedWarnings = prioritizedWarnings(warnings);
  elements.warningsList.innerHTML = "";
  if (!limitedWarnings.length) {
    elements.warningsList.innerHTML = `<span class="warning-empty">No key warnings right now.</span>`;
    return;
  }

  limitedWarnings.forEach((warning) => {
    const badge = document.createElement("span");
    badge.className = warningToneClass(warning);
    badge.textContent = warning;
    elements.warningsList.appendChild(badge);
  });
}

function renderMacro(macro) {
  elements.macroTrendValue.textContent = prettyWord(macro?.market_trend || "--");
  elements.ratesValue.textContent = prettyWord(macro?.interest_rate_effect || "--");
  elements.usdValue.textContent = prettyWord(macro?.usd_strength || "--");
  elements.macroScoreValue.textContent = macro ? `${macro.macro_score >= 0 ? "+" : ""}${macro.macro_score}` : "--";

  elements.macroTrendValue.className = macro?.market_trend === "bullish"
    ? "tone-positive"
    : macro?.market_trend === "bearish"
    ? "tone-negative"
    : "tone-neutral";
  elements.ratesValue.className = macro?.interest_rate_effect === "positive"
    ? "tone-positive"
    : macro?.interest_rate_effect === "negative"
    ? "tone-negative"
    : "tone-neutral";
  elements.usdValue.className = macro?.usd_strength === "weak"
    ? "tone-positive"
    : macro?.usd_strength === "strong"
    ? "tone-negative"
    : "tone-neutral";
  elements.macroScoreValue.className = macro?.macro_score > 0
    ? "tone-positive"
    : macro?.macro_score < 0
    ? "tone-negative"
    : "tone-neutral";
}

function renderSignals(signals) {
  elements.signalsGrid.innerHTML = "";

  signals.forEach((signal) => {
    const card = document.createElement("article");
    card.className = "signal-card";
    card.innerHTML = `
      <div class="status-row">
        <h3>${signal.name}</h3>
        <span class="${signalPillClass(signal.status)}">${signal.status}</span>
      </div>
      <strong>${formatSignalValue(signal)}</strong>
      <p>${signal.note}</p>
    `;
    elements.signalsGrid.appendChild(card);
  });
}

function createPath(values, width, height, padding, min, range) {
  const step = (width - padding * 2) / Math.max(values.length - 1, 1);
  return values
    .map((value, index) => {
      if (value === null || value === undefined) {
        return null;
      }
      const x = padding + index * step;
      const y = height - padding - ((value - min) / range) * (height - padding * 2);
      return [x, y];
    })
    .filter(Boolean);
}

function rollingAverage(values, windowSize) {
  return values.map((value, index) => {
    if (index < windowSize - 1) {
      return null;
    }
    const window = values.slice(index - windowSize + 1, index + 1);
    const total = window.reduce((sum, item) => sum + item, 0);
    return total / window.length;
  });
}

function drawPolyline(svg, points, className) {
  if (!points.length) {
    return;
  }
  const line = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
  line.setAttribute("fill", "none");
  line.setAttribute("class", className);
  line.setAttribute("points", points.map(([x, y]) => `${x},${y}`).join(" "));
  svg.appendChild(line);
}

function renderChart(points) {
  const svg = elements.historyChart;
  svg.innerHTML = "";

  if (!points.length) {
    const empty = document.createElementNS("http://www.w3.org/2000/svg", "text");
    empty.setAttribute("x", "50%");
    empty.setAttribute("y", "50%");
    empty.setAttribute("text-anchor", "middle");
    empty.setAttribute("fill", "rgba(144, 163, 181, 0.8)");
    empty.setAttribute("font-size", "15");
    empty.textContent = "No live chart data";
    svg.appendChild(empty);
    return;
  }

  const width = 720;
  const height = 280;
  const padding = 24;
  const values = points.map((point) => point.close);
  const sma20 = rollingAverage(values, 20);
  const sma50 = rollingAverage(values, 50);
  const min = Math.min(...values, ...sma20.filter(Boolean), ...sma50.filter(Boolean));
  const max = Math.max(...values, ...sma20.filter(Boolean), ...sma50.filter(Boolean));
  const range = max - min || 1;

  for (let row = 0; row < 4; row += 1) {
    const guide = document.createElementNS("http://www.w3.org/2000/svg", "line");
    const y = padding + ((height - padding * 2) / 3) * row;
    guide.setAttribute("x1", String(padding));
    guide.setAttribute("x2", String(width - padding));
    guide.setAttribute("y1", String(y));
    guide.setAttribute("y2", String(y));
    guide.setAttribute("stroke", "rgba(255,255,255,0.08)");
    guide.setAttribute("stroke-dasharray", "6 10");
    svg.appendChild(guide);
  }

  const pricePath = createPath(values, width, height, padding, min, range);
  const sma20Path = createPath(sma20, width, height, padding, min, range);
  const sma50Path = createPath(sma50, width, height, padding, min, range);

  const area = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
  const areaPoints = [[padding, height - padding], ...pricePath, [width - padding, height - padding]];
  area.setAttribute("fill", "rgba(31, 196, 126, 0.08)");
  area.setAttribute("points", areaPoints.map(([x, y]) => `${x},${y}`).join(" "));
  svg.appendChild(area);

  drawPolyline(svg, sma50Path, "chart-line chart-line-sma50");
  drawPolyline(svg, sma20Path, "chart-line chart-line-sma20");
  drawPolyline(svg, pricePath, "chart-line chart-line-price");

  const latest = pricePath[pricePath.length - 1];
  if (latest) {
    const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    dot.setAttribute("cx", String(latest[0]));
    dot.setAttribute("cy", String(latest[1]));
    dot.setAttribute("r", "5");
    dot.setAttribute("fill", "#1fc47e");
    dot.setAttribute("stroke", "rgba(5, 12, 10, 0.9)");
    dot.setAttribute("stroke-width", "2");
    svg.appendChild(dot);
  }
}

function renderHomeState() {
  if (state.analysisAbortController) {
    state.analysisAbortController.abort();
    state.analysisAbortController = null;
  }
  state.selectedSymbol = null;
  state.selectedAnalysis = null;
  state.selectedQuote = null;
  elements.searchInput.value = "";
  state.searchQuery = "";
  state.searchResults = [];
  state.searchStatus = "idle";
  state.searchRequestId += 1;
  window.clearTimeout(state.searchTimer);

  elements.analysisTitle.textContent = "Select a stock to start analysis";
  elements.analysisBadge.className = "signal-badge signal-badge-muted";
  elements.analysisBadge.textContent = "";
  elements.analysisBadge.hidden = true;
  elements.analysisSummary.textContent = "";
  elements.homeStateCard.hidden = false;
  elements.analysisPanel.classList.add("analysis-panel-home");
  setAnalysisSectionsVisible(false);
  elements.selectedChangeValue.textContent = "Search all available stocks and ETFs to load live analysis.";
  elements.selectedChangeValue.className = "hero-subline";
  elements.recommendationValue.textContent = "--";
  elements.recommendationValue.className = "decision-recommendation decision-recommendation-empty";
  elements.riskValue.textContent = "Risk: --";
  elements.riskValue.className = "decision-risk";
  elements.confidenceValue.textContent = "WAITING";
  elements.confidenceBar.style.width = "0%";
  elements.confidenceNote.textContent = "Live analysis appears after you pick a stock.";
  elements.probabilityUpValue.textContent = "--";
  elements.probabilityDownValue.textContent = "--";
  elements.probabilityUpValue.className = "tone-neutral";
  elements.probabilityDownValue.className = "tone-neutral";
  elements.biasSupportText.textContent = "Directional context appears after analysis.";
  elements.biasStateText.textContent = "No stock selected.";
  elements.noTradeBanner.hidden = true;
  elements.noTradeTitle.textContent = "NO TRADE";
  elements.noTradeReason.textContent = "Market conditions are unclear right now.";

  renderSelectedQuote(null);
  elements.entrySignalValue.textContent = "--";
  elements.entrySignalValue.className = "decision-value";
  elements.entryReasonValue.textContent = "Select a stock to evaluate a possible entry.";
  elements.exitSignalValue.textContent = "--";
  elements.exitSignalValue.className = "decision-value";
  elements.exitReasonValue.textContent = "Exit logic appears after analysis.";
  elements.positionSizeValue.textContent = "--";
  elements.positionSizeValue.className = "";
  elements.positionSizeReason.textContent = "Position guidance appears after analysis.";
  elements.stopLossValue.textContent = "--";
  elements.stopLossReason.textContent = "Stop level appears after analysis.";
  elements.timeframeValue.textContent = "--";

  renderWarnings([]);
  renderMacro(null);
  renderSignals([]);
  elements.chartSymbol.textContent = "--";
  renderChart([]);
  persistSelectedSymbol(null);
  setLoading(false);
  clearError();
  setStatus("Refresh dashboard data", "idle");
  renderWatchlist();
  closeSuggestions();
  animateAnalysisPanel();
}

function renderUnavailableAnalysisState(symbol, message) {
  const issue = classifyDataIssue(message);
  state.selectedSymbol = symbol;
  state.selectedAnalysis = null;
  state.selectedQuote = null;
  persistSelectedSymbol(symbol);
  clearError();
  closeSuggestions();
  elements.homeStateCard.hidden = true;
  elements.analysisPanel.classList.remove("analysis-panel-home");
  setAnalysisSectionsVisible(false);
  elements.analysisTitle.textContent = `${symbol} · No live data`;
  elements.analysisBadge.className = "signal-badge signal-badge-muted";
  elements.analysisBadge.textContent = "NO DATA";
  elements.analysisBadge.hidden = true;
  elements.analysisSummary.textContent = issue.reason;
  elements.recommendationValue.textContent = "NO TRADE";
  elements.recommendationValue.className = "decision-recommendation tone-neutral";
  elements.riskValue.textContent = "Analysis blocked";
  elements.riskValue.className = "decision-risk";
  elements.confidenceValue.textContent = "UNAVAILABLE";
  elements.confidenceBar.style.width = "0%";
  elements.confidenceNote.textContent = "No analysis without live market data.";
  elements.probabilityUpValue.textContent = "data unavailable";
  elements.probabilityDownValue.textContent = "analysis paused";
  elements.probabilityUpValue.className = "tone-neutral";
  elements.probabilityDownValue.className = "tone-neutral";
  elements.biasSupportText.textContent = issue.reason;
  elements.biasStateText.textContent = "No chart or analysis is shown without live market data.";
  elements.noTradeBanner.hidden = false;
  elements.noTradeTitle.textContent = issue.title;
  elements.noTradeReason.textContent = issue.reason;
  elements.selectedChangeValue.textContent = issue.reason;
  elements.selectedChangeValue.className = "hero-subline tone-neutral";
  elements.selectedPriceValue.textContent = "--";
  elements.selectedPriceValue.className = "decision-fact-value";
  elements.selectedPriceLabel.textContent = issue.title;
  elements.entrySignalValue.textContent = "BLOCKED";
  elements.entrySignalValue.className = "decision-value tone-neutral";
  elements.entryReasonValue.textContent = issue.reason;
  elements.exitSignalValue.textContent = "BLOCKED";
  elements.exitSignalValue.className = "decision-value tone-neutral";
  elements.exitReasonValue.textContent = issue.reason;
  elements.positionSizeValue.textContent = "BLOCKED";
  elements.positionSizeValue.className = "tone-neutral";
  elements.positionSizeReason.textContent = issue.reason;
  elements.stopLossValue.textContent = "--";
  elements.stopLossReason.textContent = issue.reason;
  elements.timeframeValue.textContent = "--";
  renderWarnings([]);
  renderMacro(null);
  renderSignals([]);
  elements.chartSymbol.textContent = symbol;
  renderChart([]);
  elements.searchInput.value = symbol;
  state.searchQuery = "";
  state.searchResults = [];
  state.searchStatus = "idle";
  renderSearchSuggestions();
  renderWatchlist();
  animateAnalysisPanel();
}

function renderDecisionBlock(analysis) {
  const noTradeReason = noTradeCopy(analysis.no_trade_reason).reason;
  elements.entrySignalValue.textContent = analysis.entry_signal ? "YES" : "NO";
  elements.exitSignalValue.textContent = analysis.exit_signal ? "YES" : "NO";
  elements.entrySignalValue.className = `decision-value ${booleanToneClass(analysis.entry_signal)}`;
  elements.exitSignalValue.className = `decision-value ${booleanToneClass(analysis.exit_signal, true)}`;
  elements.entryReasonValue.textContent = analysis.no_trade ? noTradeReason : analysis.entry_reason;
  elements.exitReasonValue.textContent = analysis.exit_reason;
}

function renderStrategyBlock(analysis) {
  const noTradeReason = noTradeCopy(analysis.no_trade_reason).reason;
  elements.positionSizeValue.textContent = `${analysis.position_size_percent.toFixed(1)}%`;
  elements.positionSizeValue.className = analysis.position_size_percent > 0 ? "tone-positive" : "tone-neutral";
  elements.positionSizeReason.textContent = analysis.no_trade ? noTradeReason : analysis.position_size_reason;
  elements.stopLossValue.textContent = currency(analysis.stop_loss_level);
  elements.stopLossReason.textContent = analysis.stop_loss_reason;
  elements.timeframeValue.textContent = timeframeLabel(analysis.timeframe);
}

function renderAnalysis(analysis) {
  if (analysis.no_data) {
    renderUnavailableAnalysisState(
      analysis.symbol,
      analysis.no_data_reason || analysis.summary || "No live market data available.",
    );
    return;
  }

  const stock = quoteForSymbol(analysis.symbol);
  const name = stock?.name || "Selected asset";
  const warnings = prioritizedWarnings(analysis.warnings || []);
  const recommendationLabel = displayRecommendation(analysis);
  const showNoTrade = recommendationLabel === "NO TRADE";
  const marketBias = marketBiasLabel(analysis);
  const conviction = convictionLabel(analysis.confidence);
  const setupState = setupStateLabel(analysis);

  state.selectedAnalysis = analysis;
  elements.homeStateCard.hidden = true;
  elements.analysisPanel.classList.remove("analysis-panel-home");
  setAnalysisSectionsVisible(true);
  elements.analysisTitle.textContent = `${analysis.symbol} · ${name}`;
  elements.analysisBadge.className = recommendationBadgeClass(recommendationLabel);
  elements.analysisBadge.textContent = recommendationLabel;
  elements.analysisBadge.hidden = true;
  elements.analysisSummary.textContent = analysis.summary;
  elements.recommendationValue.textContent = recommendationLabel;
  elements.recommendationValue.className = `decision-recommendation ${recommendationToneClass(recommendationLabel)}`;
  elements.riskValue.textContent = `Risk: ${analysis.risk_level}`;
  elements.riskValue.className = `decision-risk ${riskToneClass(analysis.risk_level)}`;
  elements.confidenceValue.textContent = conviction.toUpperCase();
  elements.confidenceBar.style.width = "0%";
  elements.confidenceNote.textContent = showNoTrade
    ? "Signals are mixed, so conviction stays limited."
    : "Conviction reflects alignment of live signals.";
  elements.probabilityUpValue.textContent = marketBias.toUpperCase();
  elements.probabilityDownValue.textContent = setupState.toUpperCase();
  elements.probabilityUpValue.className = biasToneClass(marketBias);
  elements.probabilityDownValue.className = setupStateToneClass(setupState);
  elements.biasSupportText.textContent = showNoTrade
    ? "The market bias is visible, but not strong enough for a clean trade."
    : `Current live bias looks ${marketBias}.`;
  elements.biasStateText.textContent = showNoTrade
    ? "Stand aside until trend, risk and live data align."
    : setupState === "actionable"
      ? "The setup is clear enough to monitor for execution."
      : setupState === "defensive"
        ? "Risk control matters more than a fresh entry here."
        : "Wait for clearer confirmation before acting.";

  elements.noTradeBanner.hidden = true;

  renderSelectedQuote(analysis.symbol);
  renderDecisionBlock(analysis);
  renderStrategyBlock(analysis);
  renderMacro(analysis.macro);
  renderWarnings(warnings);
  renderSignals(signalListFromPayload(analysis.signals));
  elements.chartSymbol.textContent = analysis.symbol;
  renderWatchlist();
  animateAnalysisPanel();
}

function renderPortfolio(snapshot) {
  state.portfolio = snapshot.positions;
  elements.portfolioBody.innerHTML = "";
  elements.costBasisValue.textContent = currency(snapshot.cost_basis);
  elements.marketValueValue.textContent = currency(snapshot.market_value);
  elements.portfolioMarketValueValue.textContent = currency(snapshot.market_value);
  elements.pnlValue.textContent = `${currency(snapshot.total_pnl)} (${percent(snapshot.total_pnl_percent)})`;
  elements.pnlValue.className = snapshot.total_pnl >= 0 ? "tone-positive" : "tone-negative";
  renderSymbolOptions();

  if (!snapshot.positions.length) {
    elements.portfolioBody.innerHTML = `
      <article class="position-card">
        <strong>No positions yet</strong>
        <p>Add your first manual position to start the demo portfolio.</p>
      </article>
    `;
    return;
  }

  snapshot.positions.forEach((position) => {
    const card = document.createElement("article");
    card.className = "position-card";
    card.innerHTML = `
      <div class="position-card-top">
        <div>
          <strong>${position.symbol}</strong>
          <p>${position.quantity} shares · opened ${position.opened_at}</p>
        </div>
        <span class="${position.pnl >= 0 ? "tone-positive" : "tone-negative"}">${percent(position.pnl_percent)}</span>
      </div>
      <div class="position-meta">
        <p>Average ${currency(position.average_price)} · Current ${currency(position.current_price)}</p>
        <p>Value ${currency(position.market_value)} · P/L ${currency(position.pnl)}</p>
      </div>
      <div class="row-actions">
        <button class="row-button" data-edit="${position.id}" type="button">Edit</button>
        <button class="row-button" data-delete="${position.id}" type="button">Delete</button>
      </div>
    `;
    elements.portfolioBody.appendChild(card);
  });
}

function renderPortfolioUnavailable(message) {
  state.portfolio = [];
  elements.costBasisValue.textContent = "--";
  elements.marketValueValue.textContent = "--";
  elements.portfolioMarketValueValue.textContent = "--";
  elements.pnlValue.textContent = "--";
  elements.pnlValue.className = "";
  elements.portfolioBody.innerHTML = `
    <article class="position-card">
      <strong>Portfolio unavailable</strong>
      <p>${message}</p>
    </article>
  `;
  renderSymbolOptions();
}

async function loadStocks(forceRefresh = false) {
  state.stocks = await api(withRefresh("/api/stocks", forceRefresh), {
    timeoutMessage: LOADING_ERROR_MESSAGE,
  });
  renderWatchlist();
  renderSearchSuggestions();
}

async function loadPortfolio(forceRefresh = false) {
  const snapshot = await api(withRefresh("/api/portfolio", forceRefresh), {
    timeoutMessage: LOADING_ERROR_MESSAGE,
  });
  renderPortfolio(snapshot);
}

async function loadHistory(symbol, forceRefresh = false, signal = null) {
  const cacheKey = `${symbol}:1mo`;
  if (!forceRefresh && state.historyCache.has(cacheKey)) {
    return state.historyCache.get(cacheKey);
  }
  const history = await api(withRefresh(`/api/stocks/${symbol}/history?range=1mo`, forceRefresh), {
    timeoutMs: ANALYSIS_TIMEOUT_MS,
    timeoutMessage: LOADING_ERROR_MESSAGE,
    signal,
  });
  state.historyCache.set(cacheKey, history);
  return history;
}

async function loadDashboardPanels(forceRefresh = false) {
  const [stocksResult, portfolioResult] = await Promise.allSettled([
    loadStocks(forceRefresh),
    loadPortfolio(forceRefresh),
  ]);
  const errors = [];

  if (stocksResult.status === "rejected") {
    state.stocks = [];
    renderWatchlist();
    errors.push(stocksResult.reason?.message || "No live market data available.");
  }

  if (portfolioResult.status === "rejected") {
    const message = portfolioResult.reason?.message || "No live market data available.";
    renderPortfolioUnavailable(message);
    errors.push(message);
  }

  return errors;
}

async function analyze(symbol, { forceRefresh = false } = {}) {
  const analysisId = state.activeAnalysisId + 1;
  state.activeAnalysisId = analysisId;
  clearError();
  closeSuggestions();
  renderLoadingState(symbol);
  setLoading(true, "Loading...");

  if (state.analysisAbortController) {
    state.analysisAbortController.abort();
  }
  const controller = new AbortController();
  state.analysisAbortController = controller;

  try {
    const analysis = await api(withRefresh("/api/analyze", forceRefresh), {
      method: "POST",
      body: JSON.stringify({ symbol }),
      timeoutMs: ANALYSIS_TIMEOUT_MS,
      timeoutMessage: LOADING_ERROR_MESSAGE,
      signal: controller.signal,
    });

    if (analysisId !== state.activeAnalysisId) {
      return;
    }

    persistSelectedSymbol(symbol);
    elements.searchInput.value = `${symbol}`;
    state.searchQuery = "";
    state.searchResults = [];
    state.searchStatus = "idle";
    renderSearchSuggestions();
    renderSymbolOptions();

    if (analysis.no_data) {
      state.selectedQuote = quoteForSymbol(symbol) || null;
      renderAnalysis(analysis);
      return;
    }

    const history = await loadHistory(symbol, forceRefresh, controller.signal);
    if (analysisId !== state.activeAnalysisId) {
      return;
    }

    state.selectedQuote = quoteForSymbol(symbol) || quoteFromHistory(symbol, history.points);
    rememberSymbolMeta(
      symbol,
      state.symbolDirectory.get(symbol) || state.selectedQuote?.name || symbol,
    );
    renderAnalysis(analysis);
    renderChart(history.points);
  } catch (error) {
    if (error.name === "AbortError") {
      return;
    }
    const message =
      error instanceof RequestTimeoutError
        ? "Timeout: live market data request took too long."
        : error.message || LOADING_ERROR_MESSAGE;
    if (isNoDataMessage(message)) {
      renderUnavailableAnalysisState(symbol, message);
    } else if (!state.selectedSymbol) {
      renderHomeState();
    }
    showError(message);
    showToast(message);
  } finally {
    if (analysisId === state.activeAnalysisId) {
      state.analysisAbortController = null;
      setLoading(false);
    }
  }
}

function enterEditMode(positionId) {
  const position = state.portfolio.find((row) => row.id === positionId);
  if (!position) {
    return;
  }
  elements.positionId.value = String(position.id);
  elements.symbolInput.value = position.symbol;
  elements.quantityInput.value = position.quantity;
  elements.priceInput.value = position.average_price;
  elements.openedAtInput.value = position.opened_at;
  elements.saveButton.textContent = "Save changes";
  elements.cancelEditButton.hidden = false;
}

async function savePosition(event) {
  event.preventDefault();

  const payload = {
    symbol: elements.symbolInput.value,
    quantity: Number(elements.quantityInput.value),
    average_price: Number(elements.priceInput.value),
    opened_at: elements.openedAtInput.value,
  };

  const positionId = elements.positionId.value;
  if (positionId) {
    await api(`/api/portfolio/positions/${positionId}`, {
      method: "PATCH",
      body: JSON.stringify({
        quantity: payload.quantity,
        average_price: payload.average_price,
        opened_at: payload.opened_at,
      }),
    });
    showToast("Position updated.");
  } else {
    await api("/api/portfolio/positions", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    showToast("Position added.");
  }

  resetForm();
  await loadPortfolio();
}

async function deletePosition(positionId) {
  await api(`/api/portfolio/positions/${positionId}`, { method: "DELETE" });
  if (elements.positionId.value === String(positionId)) {
    resetForm();
  }
  showToast("Position removed.");
  await loadPortfolio();
}

function bindEvents() {
  elements.logoutButton.addEventListener("click", () => {
    logoutToLogin();
  });

  elements.refreshStocks.addEventListener("click", async () => {
    clearError();
    try {
      elements.refreshStocks.classList.add("is-spinning");
      setStatus("Refreshing dashboard data...", "busy");
      state.historyCache.clear();
      state.searchCache.clear();
      await loadUniverse();
      const refreshErrors = await loadDashboardPanels(true);
      if (state.selectedSymbol) {
        await analyze(state.selectedSymbol, { forceRefresh: true });
      }
      if (refreshErrors.length && elements.errorBanner.hidden) {
        showError(refreshErrors[0]);
      }
      showToast("Dashboard refreshed.");
    } catch (error) {
      const message = error.message || "Dashboard refresh failed. Please try again.";
      showError(message);
      showToast(message);
    } finally {
      elements.refreshStocks.classList.remove("is-spinning");
      if (elements.errorBanner.hidden) {
        setStatus(
          state.selectedSymbol ? "Analyze selected stock again" : "Refresh dashboard data",
          "idle",
        );
      }
    }
  });

  elements.brandHomeButton.addEventListener("click", () => {
    renderHomeState();
  });

  elements.searchInput.addEventListener("input", (event) => {
    state.searchQuery = event.target.value;
    scheduleSearchSuggestions();
  });

  elements.searchInput.addEventListener("keydown", async (event) => {
    if (event.key === "Escape") {
      closeSuggestions();
      return;
    }

    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    const bestMatch = topSearchResult();
    if (bestMatch) {
      await analyze(bestMatch.symbol);
      return;
    }

    const directSymbol = directSymbolCandidate();
    if (directSymbol) {
      await analyze(directSymbol);
    }
  });

  elements.searchInput.addEventListener("focus", () => {
    if (state.searchQuery.trim()) {
      scheduleSearchSuggestions();
    }
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".search-wrap")) {
      closeSuggestions();
    }
  });

  elements.searchSuggestions.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-analyze]");
    if (!button) {
      return;
    }
    await analyze(button.dataset.analyze);
  });

  elements.positionForm.addEventListener("submit", async (event) => {
    try {
      await savePosition(event);
    } catch (error) {
      showError(error.message);
      showToast(error.message);
    }
  });

  elements.cancelEditButton.addEventListener("click", () => resetForm());

  elements.watchlistBody.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-analyze]");
    if (!button) {
      return;
    }
    await analyze(button.dataset.analyze);
  });

  elements.portfolioBody.addEventListener("click", async (event) => {
    const editButton = event.target.closest("[data-edit]");
    if (editButton) {
      enterEditMode(Number(editButton.dataset.edit));
      return;
    }

    const deleteButton = event.target.closest("[data-delete]");
    if (!deleteButton) {
      return;
    }

    try {
      await deletePosition(Number(deleteButton.dataset.delete));
    } catch (error) {
      showError(error.message);
      showToast(error.message);
    }
  });
}

function bindAuth() {
  elements.authPassword.addEventListener("input", () => {
    elements.authError.hidden = true;
  });

  elements.authForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const password = elements.authPassword.value.trim();
    if (password !== AUTH_PASSWORD) {
      elements.authError.hidden = false;
      elements.authPassword.select();
      return;
    }

    setAuthenticated(true);
    showAppShell();
    if (!appBooted) {
      await init();
      return;
    }
    elements.authForm.reset();
    elements.authError.hidden = true;
  });
}

async function init() {
  if (appBooted) {
    return;
  }
  appBooted = true;
  resetForm();
  bindEvents();

  try {
    setStatus("Booting dashboard...", "busy");
    await loadUniverse();
    const startupErrors = await loadDashboardPanels();
    persistSelectedSymbol(null);
    renderHomeState();
    if (startupErrors.length && elements.errorBanner.hidden) {
      showError(startupErrors[0]);
    }
  } catch (error) {
    persistSelectedSymbol(null);
    showError(error.message);
    showToast(error.message);
    renderHomeState();
  } finally {
    if (elements.errorBanner.hidden) {
      setStatus(
        state.selectedSymbol ? "Analyze selected stock again" : "Refresh dashboard data",
        "idle",
      );
    }
  }
}

bindAuth();

if (isAuthenticated()) {
  showAppShell();
  init();
} else {
  showLoginOverlay();
}
