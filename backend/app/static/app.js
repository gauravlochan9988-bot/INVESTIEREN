const state = {
  stocks: [],
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
};

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
};

const elements = {
  analysisPanel: document.querySelector(".analysis-panel"),
  watchlistBody: document.getElementById("watchlistBody"),
  watchlistMeta: document.getElementById("watchlistMeta"),
  refreshStocks: document.getElementById("refreshStocks"),
  searchInput: document.getElementById("searchInput"),
  searchSuggestions: document.getElementById("searchSuggestions"),
  statusMessage: document.getElementById("statusMessage"),
  errorBanner: document.getElementById("errorBanner"),
  loadingState: document.getElementById("loadingState"),
  analysisTitle: document.getElementById("analysisTitle"),
  analysisBadge: document.getElementById("analysisBadge"),
  analysisSummary: document.getElementById("analysisSummary"),
  noTradeBanner: document.getElementById("noTradeBanner"),
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
  probabilityUpBar: document.getElementById("probabilityUpBar"),
  probabilityDownBar: document.getElementById("probabilityDownBar"),
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

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });

  if (!response.ok) {
    let detail = `Request failed with status ${response.status}`;
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

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("toast-visible");
  clearTimeout(state.toastTimer);
  state.toastTimer = window.setTimeout(() => {
    elements.toast.classList.remove("toast-visible");
  }, 2400);
}

function setStatus(message) {
  elements.statusMessage.textContent = message;
}

function setLoading(active, message = "Loading analysis...") {
  elements.loadingState.hidden = !active;
  elements.analysisPanel.classList.toggle("analysis-loading", active);
  if (active) {
    elements.loadingState.innerHTML = `<span class="loading-spinner" aria-hidden="true"></span><span>${message}</span>`;
    setStatus(message);
  } else {
    setStatus("Ready");
  }
}

function showError(message) {
  elements.errorBanner.hidden = false;
  elements.errorBanner.textContent = message;
  setStatus("Error");
}

function clearError() {
  elements.errorBanner.hidden = true;
  elements.errorBanner.textContent = "";
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
  return "signal-badge signal-badge-muted";
}

function recommendationToneClass(recommendation) {
  if (recommendation === "BUY") return "tone-positive";
  if (recommendation === "SELL") return "tone-negative";
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

function searchMatches() {
  const query = normalizedSearchQuery();
  if (!query) {
    return state.stocks;
  }
  return state.stocks.filter((stock) => stockMatchesQuery(stock, query));
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

function localSearchResults(limit = 6) {
  const query = normalizedSearchQuery();
  if (!query) {
    return [];
  }

  return state.stocks
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

async function loadSearchSuggestions() {
  const query = state.searchQuery.trim();
  if (!query) {
    state.searchResults = [];
    state.searchStatus = "idle";
    renderSearchSuggestions();
    return;
  }

  const cacheKey = query.toLowerCase();
  if (state.searchCache.has(cacheKey)) {
    state.searchResults = state.searchCache.get(cacheKey);
    state.searchStatus = "ready";
    renderSearchSuggestions();
    return;
  }

  const requestId = ++state.searchRequestId;
  state.searchStatus = "loading";
  renderSearchSuggestions();
  try {
    const results = await api(`/api/search?q=${encodeURIComponent(query)}&limit=6`);
    if (requestId !== state.searchRequestId) {
      return;
    }
    results.forEach((result) => rememberSymbolMeta(result.symbol, result.name));
    state.searchCache.set(cacheKey, results);
    state.searchResults = results;
    state.searchStatus = "ready";
    renderSearchSuggestions();
  } catch (error) {
    if (requestId !== state.searchRequestId) {
      return;
    }
    state.searchResults = [];
    state.searchStatus = "ready";
    renderSearchSuggestions();
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
    return;
  }
  renderSearchSuggestions();
  state.searchTimer = window.setTimeout(() => {
    loadSearchSuggestions();
  }, 180);
}

function topSearchResult() {
  return suggestionMatches(1)[0] || null;
}

function renderWatchlist() {
  elements.watchlistBody.innerHTML = "";
  elements.symbolInput.innerHTML = "";

  if (!state.stocks.length) {
    elements.watchlistBody.innerHTML = `<div class="watchlist-empty">No stocks available.</div>`;
    return;
  }

  const updatedAt = new Date(state.stocks[0].updated_at).toLocaleString();
  elements.watchlistMeta.textContent = `Updated ${updatedAt}`;

  state.stocks.forEach((stock) => {
    rememberSymbolMeta(stock.symbol, stock.name);
    const option = document.createElement("option");
    option.value = stock.symbol;
    option.textContent = `${stock.symbol} · ${stock.name}`;
    elements.symbolInput.appendChild(option);
  });

  const matches = searchMatches();
  matches.forEach((stock) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = `watchlist-item ${state.selectedSymbol === stock.symbol ? "watchlist-item-active" : ""}`;
    item.dataset.analyze = stock.symbol;
    item.innerHTML = `
      <div class="watchlist-item-left">
        <span class="trend-dot ${stock.change_percent >= 0 ? "trend-dot-up" : "trend-dot-down"}"></span>
        <div>
          <strong>${stock.symbol}</strong>
          <span>${stock.name}</span>
        </div>
      </div>
      <div class="watchlist-item-right">
        <strong>${currency(stock.price)}</strong>
        <span class="${stock.change_percent >= 0 ? "tone-positive" : "tone-negative"}">${percent(stock.change_percent)}</span>
      </div>
    `;
    elements.watchlistBody.appendChild(item);
  });

  if (!matches.length) {
    elements.watchlistBody.innerHTML = `<div class="watchlist-empty">No match for your search.</div>`;
  }

  if (!elements.symbolInput.value && state.stocks[0]) {
    elements.symbolInput.value = state.stocks[0].symbol;
  }
}

function renderSelectedQuote(symbol) {
  const stock = quoteForSymbol(symbol);
  if (!stock) {
    elements.selectedPriceValue.textContent = "--";
    elements.selectedPriceLabel.textContent = "Select a stock to load price and context";
    elements.selectedChangeValue.textContent = "Select a stock to start analysis";
    elements.selectedChangeValue.className = "hero-subline";
    return;
  }

  elements.selectedPriceValue.textContent = currency(stock.price);
  elements.selectedPriceLabel.textContent = `${stock.name} · ${stock.volume.toLocaleString()} volume`;
  elements.selectedChangeValue.textContent = `${stock.name} · ${percent(stock.change_percent)} today`;
  elements.selectedChangeValue.className = `hero-subline ${stock.change_percent >= 0 ? "tone-positive" : "tone-negative"}`;
}

function renderWarnings(warnings) {
  elements.warningsList.innerHTML = "";
  if (!warnings.length) {
    elements.warningsList.innerHTML = `<span class="warning-empty">No active warnings.</span>`;
    return;
  }

  warnings.forEach((warning) => {
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
  state.selectedSymbol = null;
  state.selectedAnalysis = null;
  state.selectedQuote = null;
  elements.searchInput.value = "";
  state.searchQuery = "";
  state.searchResults = [];

  elements.analysisTitle.textContent = "Search for a stock to start analysis";
  elements.analysisBadge.className = "signal-badge signal-badge-muted";
  elements.analysisBadge.textContent = "Decision view";
  elements.analysisSummary.textContent = "Search for a stock to start analysis.";
  elements.recommendationValue.textContent = "--";
  elements.recommendationValue.className = "decision-recommendation";
  elements.riskValue.textContent = "Risk: --";
  elements.riskValue.className = "decision-risk";
  elements.confidenceValue.textContent = "--";
  elements.confidenceBar.style.width = "0%";
  elements.confidenceNote.textContent = "Confidence appears after analysis.";
  elements.probabilityUpValue.textContent = "--";
  elements.probabilityDownValue.textContent = "--";
  elements.probabilityUpBar.style.width = "0%";
  elements.probabilityDownBar.style.width = "0%";
  elements.noTradeBanner.hidden = true;
  elements.noTradeReason.textContent = "Waiting for a cleaner setup.";

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
  renderWatchlist();
  closeSuggestions();
  animateAnalysisPanel();
}

function renderDecisionBlock(analysis) {
  elements.entrySignalValue.textContent = analysis.entry_signal ? "YES" : "NO";
  elements.exitSignalValue.textContent = analysis.exit_signal ? "YES" : "NO";
  elements.entrySignalValue.className = `decision-value ${booleanToneClass(analysis.entry_signal)}`;
  elements.exitSignalValue.className = `decision-value ${booleanToneClass(analysis.exit_signal, true)}`;
  elements.entryReasonValue.textContent = analysis.no_trade ? analysis.no_trade_reason : analysis.entry_reason;
  elements.exitReasonValue.textContent = analysis.exit_reason;
}

function renderStrategyBlock(analysis) {
  elements.positionSizeValue.textContent = `${analysis.position_size_percent.toFixed(1)}%`;
  elements.positionSizeValue.className = analysis.position_size_percent > 0 ? "tone-positive" : "tone-neutral";
  elements.positionSizeReason.textContent = analysis.no_trade ? analysis.no_trade_reason : analysis.position_size_reason;
  elements.stopLossValue.textContent = currency(analysis.stop_loss_level);
  elements.stopLossReason.textContent = analysis.stop_loss_reason;
  elements.timeframeValue.textContent = timeframeLabel(analysis.timeframe);
}

function renderAnalysis(analysis) {
  const stock = quoteForSymbol(analysis.symbol);
  const name = stock?.name || "Selected asset";
  const warnings = analysis.warnings || [];

  state.selectedAnalysis = analysis;
  elements.analysisTitle.textContent = `${analysis.symbol} · ${name}`;
  elements.analysisBadge.className = recommendationBadgeClass(analysis.recommendation);
  elements.analysisBadge.textContent = analysis.recommendation;
  elements.analysisSummary.textContent = analysis.summary;
  elements.recommendationValue.textContent = analysis.recommendation;
  elements.recommendationValue.className = `decision-recommendation ${recommendationToneClass(analysis.recommendation)}`;
  elements.riskValue.textContent = `Risk: ${analysis.risk_level}`;
  elements.riskValue.className = `decision-risk ${riskToneClass(analysis.risk_level)}`;
  elements.confidenceValue.textContent = roundedPercent(analysis.confidence);
  elements.confidenceBar.style.width = `${Math.round(analysis.confidence * 100)}%`;
  elements.confidenceNote.textContent = analysis.no_trade
    ? `No-trade bias · ${roundedPercent(analysis.probability_up)} up · ${roundedPercent(analysis.probability_down)} down`
    : `${roundedPercent(analysis.probability_up)} up · ${roundedPercent(analysis.probability_down)} down${warnings.length ? ` · ${warnings.length} warnings` : ""}`;
  elements.probabilityUpValue.textContent = roundedPercent(analysis.probability_up);
  elements.probabilityDownValue.textContent = roundedPercent(analysis.probability_down);
  elements.probabilityUpBar.style.width = `${Math.round(analysis.probability_up * 100)}%`;
  elements.probabilityDownBar.style.width = `${Math.round(analysis.probability_down * 100)}%`;

  elements.noTradeBanner.hidden = !analysis.no_trade;
  if (analysis.no_trade) {
    elements.noTradeReason.textContent = analysis.no_trade_reason;
  }

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

async function loadStocks() {
  state.stocks = await api("/api/stocks");
  renderWatchlist();
  renderSearchSuggestions();
}

async function loadPortfolio() {
  const snapshot = await api("/api/portfolio");
  renderPortfolio(snapshot);
}

async function loadHistory(symbol) {
  const cacheKey = `${symbol}:1mo`;
  if (state.historyCache.has(cacheKey)) {
    return state.historyCache.get(cacheKey);
  }
  const history = await api(`/api/stocks/${symbol}/history?range=1mo`);
  state.historyCache.set(cacheKey, history);
  return history;
}

async function analyze(symbol) {
  clearError();
  closeSuggestions();
  setLoading(true, `Loading ${symbol} analysis...`);

  try {
    const [analysis, history] = await Promise.all([
      api("/api/analyze", {
        method: "POST",
        body: JSON.stringify({ symbol }),
      }),
      loadHistory(symbol),
    ]);

    state.selectedSymbol = symbol;
    state.selectedQuote = quoteForSymbol(symbol) || quoteFromHistory(symbol, history.points);
    persistSelectedSymbol(symbol);
    elements.searchInput.value = `${symbol}`;
    state.searchQuery = elements.searchInput.value;
    state.searchResults = [];
    renderAnalysis(analysis);
    renderChart(history.points);
  } catch (error) {
    persistSelectedSymbol(null);
    showError(error.message);
    showToast(error.message);
  } finally {
    setLoading(false);
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
  elements.refreshStocks.addEventListener("click", async () => {
    clearError();
    try {
      setStatus("Refreshing...");
      state.historyCache.clear();
      state.searchCache.clear();
      await loadStocks();
      await loadPortfolio();
      if (state.selectedSymbol) {
        await analyze(state.selectedSymbol);
      }
      showToast("Dashboard refreshed.");
    } catch (error) {
      showError(error.message);
      showToast(error.message);
    } finally {
      setStatus("Ready");
    }
  });

  elements.searchInput.addEventListener("input", (event) => {
    state.searchQuery = event.target.value;
    scheduleSearchSuggestions();
    renderWatchlist();
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
    if (!bestMatch) {
      return;
    }
    await analyze(bestMatch.symbol);
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

async function init() {
  resetForm();
  bindEvents();

  try {
    setStatus("Booting...");
    await loadStocks();
    await loadPortfolio();
    const persistedSymbol = readPersistedSymbol();
    if (persistedSymbol) {
      await analyze(persistedSymbol);
    } else if (state.stocks[0]) {
      renderHomeState();
    } else {
      setStatus("No stocks available");
    }
  } catch (error) {
    persistSelectedSymbol(null);
    showError(error.message);
    showToast(error.message);
    renderHomeState();
  } finally {
    setStatus(state.selectedSymbol ? "Ready" : elements.statusMessage.textContent);
  }
}

init();
