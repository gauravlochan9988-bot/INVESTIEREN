if (window.location.protocol === "file:") {
  window.location.replace("http://127.0.0.1:8000/");
}

const DEPLOYED_API_ORIGIN = "https://investieren-production.up.railway.app";
const LOCAL_API_HOSTS = new Set(["127.0.0.1", "localhost"]);
const AUTH_TOKEN_CACHE_MS = 45 * 1000;
const DEFAULT_CLERK_PLAN = {
  slug: "pro",
  name: "Investieren Pro Monthly",
  amountCents: 499,
  currency: "eur",
  interval: "month",
};
const STORAGE_KEYS = {
  authenticated: "investieren:authenticated",
  adminSession: "investieren:adminSession",
  selectedSymbol: "investieren:selectedSymbol",
  selectedStrategy: "investieren:selectedStrategy",
  favoriteSymbols: "investieren:favoriteSymbols",
  chartCompareSymbol: "investieren:chartCompareSymbol",
  cachedWatchlist: "investieren:cachedWatchlist",
  cachedOverview: "investieren:cachedOverview",
  cachedAnalysis: "investieren:cachedAnalysis",
  cachedAlerts: "investieren:cachedAlerts",
  cachedLearningStats: "investieren:cachedLearningStats",
};

const STRATEGY_LABELS = {
  simple: "Simple",
  ai: "AI",
  hedgefund: "Hedgefund",
};

const MAX_SIDEBAR_SLOTS = 10;
const OPPORTUNITY_LIMIT = 3;
const DEFAULT_SIDEBAR_ITEMS = [
  { symbol: "AAPL", name: "Apple Inc" },
  { symbol: "MSFT", name: "Microsoft" },
  { symbol: "NVDA", name: "NVIDIA" },
  { symbol: "AMZN", name: "Amazon" },
  { symbol: "META", name: "Meta" },
  { symbol: "TSLA", name: "Tesla" },
  { symbol: "GOOGL", name: "Alphabet" },
  { symbol: "AMD", name: "AMD" },
  { symbol: "NFLX", name: "Netflix" },
  { symbol: "SPY", name: "SPDR S&P 500 ETF" },
];

const state = {
  selectedSymbol: window.sessionStorage.getItem(STORAGE_KEYS.selectedSymbol) || "AAPL",
  selectedStrategy: window.sessionStorage.getItem(STORAGE_KEYS.selectedStrategy) || "hedgefund",
  compareSymbol: window.sessionStorage.getItem(STORAGE_KEYS.chartCompareSymbol) || "",
  watchlist: [],
  tvReady: typeof window.TradingView !== "undefined",
  tvScriptPromise: null,
  tvWidgetSymbol: null,
  searchResults: [],
  searchResultsQuery: "",
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
  mobileChartPrimed: false,
  chartInteractionEnabled: false,
  pendingChart: null,
  chartObserver: null,
  strategySnapshots: {},
  suppressStrategyClick: false,
  latestOverview: null,
  learningStats: null,
  opportunities: [],
  auth: {
    enabled: false,
    ready: false,
    config: null,
    client: null,
    view: "login",
    showManagedAuth: false,
    showAdminAccess: false,
    accessToken: "",
    tokenFetchedAt: 0,
    currentUser: null,
    subscription: null,
    adminSession: window.sessionStorage.getItem(STORAGE_KEYS.adminSession) || "",
  },
};

const elements = {
  authOverlay: document.getElementById("authOverlay"),
  paywallOverlay: document.getElementById("paywallOverlay"),
  paywallUpgradeButton: document.getElementById("paywallUpgradeButton"),
  paywallLogoutButton: document.getElementById("paywallLogoutButton"),
  paywallMessage: document.getElementById("paywallMessage"),
  authManagedPanel: document.getElementById("authManagedPanel"),
  authClerkPanel: document.getElementById("authClerkPanel"),
  authClerkMount: document.getElementById("authClerkMount"),
  authForm: document.getElementById("authForm"),
  authGoogleButton: document.getElementById("authGoogleButton"),
  authAppleButton: document.getElementById("authAppleButton"),
  authEmailButton: document.getElementById("authEmailButton"),
  authAdminToggleButton: document.getElementById("authAdminToggleButton"),
  authLoading: document.getElementById("authLoading"),
  authPassword: document.getElementById("authPassword"),
  authError: document.getElementById("authError"),
  authCancelButton: document.getElementById("authCancelButton"),
  appShell: document.getElementById("appShell"),
  backendStatus: document.getElementById("backendStatus"),
  errorBanner: document.getElementById("errorBanner"),
  limitedAccessBanner: document.getElementById("limitedAccessBanner"),
  limitedAccessMessage: document.getElementById("limitedAccessMessage"),
  limitedAccessUpgradeButton: document.getElementById("limitedAccessUpgradeButton"),
  alertsSection: document.getElementById("alertsSection"),
  alertsMeta: document.getElementById("alertsMeta"),
  alertsList: document.getElementById("alertsList"),
  opportunitySection: document.getElementById("opportunitySection"),
  opportunityMeta: document.getElementById("opportunityMeta"),
  opportunityList: document.getElementById("opportunityList"),
  strategyToggle: document.getElementById("strategyToggle"),
  strategyToggleThumb: document.getElementById("strategyToggleThumb"),
  strategyButtons: Array.from(document.querySelectorAll(".strategy-button")),
  subscribeButton: document.getElementById("subscribeButton"),
  logoutButton: document.getElementById("logoutButton"),
  refreshButton: document.getElementById("refreshButton"),
  brandHomeButton: document.getElementById("brandHomeButton"),
  searchForm: document.getElementById("searchForm"),
  searchInput: document.getElementById("searchInput"),
  searchSuggestions: document.getElementById("searchSuggestions"),
  watchlistMeta: document.getElementById("watchlistMeta"),
  watchlistBody: document.getElementById("watchlistBody"),
  watchlistSection: document.getElementById("watchlistSection"),
  decisionRail: document.getElementById("decisionRail"),
  favoritesMeta: document.getElementById("favoritesMeta"),
  favoritesBody: document.getElementById("favoritesBody"),
  selectedSymbolSection: document.getElementById("selectedSymbolSection"),
  tradeDecisionSection: document.getElementById("tradeDecisionSection"),
  selectedSymbolName: document.getElementById("selectedSymbolName"),
  selectedCompanyName: document.getElementById("selectedCompanyName"),
  changeBadge: document.getElementById("changeBadge"),
  selectedFavoriteButton: document.getElementById("selectedFavoriteButton"),
  metricPrice: document.getElementById("metricPrice"),
  metricHigh: document.getElementById("metricHigh"),
  metricLow: document.getElementById("metricLow"),
  metricOpen: document.getElementById("metricOpen"),
  metricPrevClose: document.getElementById("metricPrevClose"),
  recommendationCard: document.getElementById("recommendationCard"),
  recommendationIcon: document.getElementById("recommendationIcon"),
  recommendationValue: document.getElementById("recommendationValue"),
  signalQualityBadge: document.getElementById("signalQualityBadge"),
  conflictBadge: document.getElementById("conflictBadge"),
  confidenceValue: document.getElementById("confidenceValue"),
  confidenceBarFill: document.getElementById("confidenceBarFill"),
  confidenceHint: document.getElementById("confidenceHint"),
  analysisSummary: document.getElementById("analysisSummary"),
  mobileConfidenceValue: document.getElementById("mobileConfidenceValue"),
  mobileConfidenceBarFill: document.getElementById("mobileConfidenceBarFill"),
  mobileConfidenceHint: document.getElementById("mobileConfidenceHint"),
  mobileAnalysisSummary: document.getElementById("mobileAnalysisSummary"),
  selectedStrategyBadge: document.getElementById("selectedStrategyBadge"),
  mobileStrategyCards: document.getElementById("mobileStrategyCards"),
  analysisGeneratedAt: document.getElementById("analysisGeneratedAt"),
  biasValue: document.getElementById("biasValue"),
  noTradeReason: document.getElementById("noTradeReason"),
  mobileBiasValue: document.getElementById("mobileBiasValue"),
  mobileNoTradeReason: document.getElementById("mobileNoTradeReason"),
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
  tradingviewChartFrame: document.getElementById("tradingviewChartFrame"),
  chartSymbolBadge: document.getElementById("chartSymbolBadge"),
  chartCompareForm: document.getElementById("chartCompareForm"),
  chartCompareInput: document.getElementById("chartCompareInput"),
  chartCompareSubmit: document.getElementById("chartCompareSubmit"),
  chartCompareClear: document.getElementById("chartCompareClear"),
  chartCompareLegend: document.getElementById("chartCompareLegend"),
  tradingviewChart: document.getElementById("tradingviewChart"),
  chartInteractionGuard: document.getElementById("chartInteractionGuard"),
  companyLogo: document.getElementById("companyLogo"),
  companyHeadline: document.getElementById("companyHeadline"),
  companyExchange: document.getElementById("companyExchange"),
  companyDetails: document.getElementById("companyDetails"),
  companySection: document.getElementById("companySection"),
  learningSection: document.getElementById("learningSection"),
  learningMeta: document.getElementById("learningMeta"),
  learningList: document.getElementById("learningList"),
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

function currentUserKey() {
  return state.auth.currentUser?.auth_subject || "default";
}

function renderAuthMode() {
  const managedEnabled = Boolean(state.auth.enabled);
  if (elements.authManagedPanel) {
    elements.authManagedPanel.hidden = !managedEnabled;
  }
  if (elements.authClerkPanel) {
    elements.authClerkPanel.hidden = !managedEnabled || !state.auth.showManagedAuth;
  }
  if (elements.authForm) {
    elements.authForm.hidden = !state.auth.showAdminAccess;
  }
}

function setAuthLoading(loading, message = "Redirecting…") {
  if (!elements.authLoading) {
    return;
  }
  elements.authLoading.hidden = !loading;
  elements.authLoading.textContent = message;
}

function setAuthError(message = "") {
  if (!elements.authError) {
    return;
  }
  if (!message) {
    elements.authError.hidden = true;
    return;
  }
  elements.authError.textContent = message;
  elements.authError.hidden = false;
}

async function fetchAuthConfig() {
  const config = await api("/api/auth/config", {
    timeoutMs: 12000,
    retryCount: 1,
    skipAuth: true,
  });
  state.auth.config = config;
  state.auth.enabled = Boolean(
    config?.enabled && config.provider === "clerk" && config.publishable_key && config.frontend_api_url,
  );
  renderAuthMode();
  return config;
}

async function ensureClerkFrontendLoaded(config) {
  if (window.Clerk) {
    return window.Clerk;
  }

  const scriptId = "clerk-js-sdk";
  const existing = document.getElementById(scriptId);
  if (existing) {
    if (window.Clerk) {
      return window.Clerk;
    }
    await new Promise((resolve, reject) => {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Clerk failed to load.")), { once: true });
    });
    return window.Clerk;
  }

  const frontendApi = String(config.frontend_api_url || "").replace(/\/+$/, "");
  const script = document.createElement("script");
  script.id = scriptId;
  script.async = true;
  script.crossOrigin = "anonymous";
  script.dataset.clerkPublishableKey = config.publishable_key;
  script.src = `${frontendApi}/npm/@clerk/clerk-js@5/dist/clerk.browser.js`;

  await new Promise((resolve, reject) => {
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener("error", () => reject(new Error("Clerk failed to load.")), { once: true });
    document.head.appendChild(script);
  });

  return window.Clerk;
}

function renderManagedAuthView(mode = "login") {
  if (!state.auth.enabled || !state.auth.client || !elements.authClerkMount) {
    return;
  }

  state.auth.view = mode === "signup" ? "signup" : "login";
  state.auth.showManagedAuth = true;
  state.auth.showAdminAccess = false;
  renderAuthMode();

  try {
    state.auth.client.unmountSignIn?.(elements.authClerkMount);
    state.auth.client.unmountSignUp?.(elements.authClerkMount);
  } catch (error) {
    console.debug("[frontend] auth unmount skipped", error);
  }
  elements.authClerkMount.innerHTML = "";

  const sharedOptions = {
    path: window.location.pathname,
    forceRedirectUrl: `${window.location.origin}${window.location.pathname}`,
  };

  if (state.auth.view === "signup") {
    state.auth.client.mountSignUp(elements.authClerkMount, sharedOptions);
    return;
  }

  state.auth.client.mountSignIn(elements.authClerkMount, sharedOptions);
}

async function getAccessToken(forceRefresh = false) {
  if (!state.auth.enabled || !state.auth.client) {
    return "";
  }

  if (
    !forceRefresh &&
    state.auth.accessToken &&
    Date.now() - state.auth.tokenFetchedAt < AUTH_TOKEN_CACHE_MS
  ) {
    return state.auth.accessToken;
  }

  try {
    const token = await state.auth.client.session?.getToken();
    state.auth.accessToken = token;
    state.auth.tokenFetchedAt = Date.now();
    return token;
  } catch (error) {
    console.error("[frontend] silent token refresh failed", error);
    state.auth.accessToken = "";
    state.auth.tokenFetchedAt = 0;
    return "";
  }
}

async function syncAuthenticatedUser(forceRefresh = false) {
  if (!state.auth.enabled) {
    return null;
  }

  const token = await getAccessToken(forceRefresh);
  if (!token) {
    throw new Error("Auth session unavailable.");
  }

  const user = await api("/api/auth/me", {
    timeoutMs: 12000,
    retryCount: 1,
    skipAuth: true,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  state.auth.currentUser = user;
  return user;
}

function renderSubscriptionButton() {
  if (!elements.subscribeButton) {
    return;
  }

  if (hasActiveSubscription()) {
    elements.subscribeButton.textContent = state.auth.subscription?.active ? "Pro Active" : "Full Access";
    elements.subscribeButton.disabled = true;
    elements.subscribeButton.className =
      "action-secondary rounded-2xl border border-emerald-400/25 bg-emerald-400/12 px-4 py-3 text-sm font-semibold text-emerald-200 opacity-90 xl:min-w-[132px]";
    return;
  }

  elements.subscribeButton.disabled = !state.auth.enabled || !isAuthenticated();
  elements.subscribeButton.textContent = "Unlock €4.99";
  elements.subscribeButton.className =
    "action-secondary rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-400/15 xl:min-w-[132px]";
}

function managedPlanConfig() {
  const config = state.auth.config || {};
  return {
    slug: config.plan_slug || DEFAULT_CLERK_PLAN.slug,
    name: config.plan_name || DEFAULT_CLERK_PLAN.name,
    amountCents: Number(config.plan_amount_cents || DEFAULT_CLERK_PLAN.amountCents),
    currency: config.plan_currency || DEFAULT_CLERK_PLAN.currency,
    interval: config.plan_interval || DEFAULT_CLERK_PLAN.interval,
  };
}

function hasActiveSubscription() {
  return Boolean(state.auth.subscription?.active || state.auth.adminSession);
}

function setAdminSessionToken(token = "") {
  state.auth.adminSession = String(token || "").trim();
  if (state.auth.adminSession) {
    window.sessionStorage.setItem(STORAGE_KEYS.adminSession, state.auth.adminSession);
    return;
  }
  window.sessionStorage.removeItem(STORAGE_KEYS.adminSession);
}

function isPricingPage() {
  return window.location.pathname === "/pricing.html" || window.location.pathname.endsWith("/pricing.html");
}

function redirectToPricingPage() {
  if (isPricingPage()) {
    return;
  }
  hidePaywall();
  window.location.replace("/pricing.html");
}

function showPaywall(message = "Subscribe to access live signals, alerts and watchlists.") {
  elements.authOverlay.classList.add("hidden");
  elements.authOverlay.hidden = true;
  elements.appShell.classList.add("hidden");
  elements.appShell.hidden = true;
  elements.mobileQuickActions?.classList.add("hidden");
  elements.paywallOverlay?.classList.remove("hidden");
  elements.paywallOverlay.hidden = false;
  if (elements.paywallMessage) {
    elements.paywallMessage.textContent = message;
  }
}

function hidePaywall() {
  elements.paywallOverlay?.classList.add("hidden");
  elements.paywallOverlay.hidden = true;
}

function syncLimitedAccessBanner() {
  const shouldShow = Boolean(state.auth.enabled && isAuthenticated() && !hasActiveSubscription());
  if (!elements.limitedAccessBanner) {
    return;
  }
  if (shouldShow) {
    elements.limitedAccessBanner.classList.remove("hidden");
    elements.limitedAccessBanner.classList.add("flex");
    elements.limitedAccessBanner.hidden = false;
    if (elements.limitedAccessMessage) {
      elements.limitedAccessMessage.textContent = "You can explore the dashboard. Unlock live signals and alerts for full access.";
    }
    return;
  }
  elements.limitedAccessBanner.classList.add("hidden");
  elements.limitedAccessBanner.classList.remove("flex");
  elements.limitedAccessBanner.hidden = true;
}

async function loadSubscriptionStatus() {
  if (state.auth.adminSession && !state.auth.currentUser) {
    state.auth.subscription = {
      active: true,
      status: "admin",
      amount_cents: 0,
      currency: "eur",
      interval: "month",
    };
    renderSubscriptionButton();
    syncLimitedAccessBanner();
    return state.auth.subscription;
  }
  if (!state.auth.enabled || !isAuthenticated()) {
    state.auth.subscription = null;
    renderSubscriptionButton();
    syncLimitedAccessBanner();
    return null;
  }

  try {
    const subscription = await api("/api/billing/subscription", {
      timeoutMs: 12000,
      retryCount: 1,
    });
    state.auth.subscription = subscription;
  } catch (error) {
    console.error("[frontend] subscription status load failed", error);
    state.auth.subscription = null;
  }
  renderSubscriptionButton();
  syncLimitedAccessBanner();
  return state.auth.subscription;
}

async function startCheckout() {
  window.location.href = "/pricing.html";
}

async function handleBillingRedirectState() {
  const params = new URLSearchParams(window.location.search);
  const checkoutState = params.get("checkout");
  const sessionId = params.get("session_id");
  if (!checkoutState) {
    return;
  }

  try {
    if (checkoutState === "success" && sessionId && isAuthenticated()) {
      await api(`/api/billing/checkout-session/${encodeURIComponent(sessionId)}`, {
        timeoutMs: 15000,
        retryCount: 0,
      });
      await loadSubscriptionStatus();
      setBackendStatus("Subscription active", "ok");
    } else if (checkoutState === "cancel") {
      setBackendStatus("Checkout canceled", "warning");
    }
  } catch (error) {
    showError(error.message || "Subscription sync failed.");
  } finally {
    params.delete("checkout");
    params.delete("session_id");
    const nextQuery = params.toString();
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}`;
    window.history.replaceState({}, document.title, nextUrl);
  }
}

async function initializeManagedAuth() {
  const config = await fetchAuthConfig();
  if (!state.auth.enabled) {
    state.auth.ready = true;
    renderSubscriptionButton();
    return false;
  }

  if (!config.publishable_key || !config.frontend_api_url) {
    state.auth.ready = true;
    state.auth.enabled = false;
    renderAuthMode();
    setAuthError("Managed login is unavailable.");
    return false;
  }

  const clerk = await ensureClerkFrontendLoaded(config);
  if (!clerk?.load) {
    throw new Error("Clerk SDK is unavailable.");
  }
  await clerk.load();
  state.auth.client = clerk;

  if (typeof state.auth.client.addListener === "function") {
    state.auth.client.addListener(async ({ user, session }) => {
      if (!user || !session) {
        setAuthenticated(false);
        state.auth.subscription = null;
        renderSubscriptionButton();
        if (state.auth.adminSession) {
          showAppShell();
          void bootDashboard();
          return;
        }
        showLoginOverlay();
        return;
      }

      try {
        await syncAuthenticatedUser(true);
        await loadSubscriptionStatus();
        if (hasActiveSubscription()) {
          showAppShell();
          void bootDashboard();
          return;
        }
        showPaywall("Subscribe to access live signals, alerts and watchlists.");
      } catch (error) {
        console.error("[frontend] clerk session sync failed", error);
        setAuthError("Session sync failed.");
      }
    });
  }

  state.auth.showManagedAuth = false;
  state.auth.showAdminAccess = false;
  renderAuthMode();

  if (state.auth.client.user && state.auth.client.session) {
    await syncAuthenticatedUser(true);
    await loadSubscriptionStatus();
  }

  state.auth.ready = true;
  renderSubscriptionButton();
  return isAuthenticated();
}

async function loginWithManagedProvider(mode = "login") {
  if (!state.auth.enabled || !state.auth.client) {
    setAuthError("Managed login is not configured.");
    return;
  }

  setAuthError("");
  try {
    renderManagedAuthView(mode);
  } catch (error) {
    console.error("[frontend] auth view switch failed", error);
    setAuthError("Login failed. Try again.");
  }
}

async function continueWithOAuth(strategy) {
  if (!state.auth.enabled || !state.auth.client) {
    setAuthError("Managed login is not configured.");
    return;
  }

  setAuthError("");
  setAuthLoading(true);

  try {
    const redirectUrl = `${window.location.origin}${window.location.pathname}`;
    const signIn = state.auth.client.client?.signIn;

    if (signIn?.authenticateWithRedirect) {
      await signIn.authenticateWithRedirect({
        strategy,
        redirectUrl,
        redirectUrlComplete: redirectUrl,
      });
      return;
    }

    if (typeof state.auth.client.redirectToSignIn === "function") {
      await state.auth.client.redirectToSignIn({
        forceRedirectUrl: redirectUrl,
      });
      return;
    }
  } catch (error) {
    console.error("[frontend] oauth redirect failed", error);
  }

  setAuthLoading(false);
  await loginWithManagedProvider("login");
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

function isValidMarketPrice(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0;
}

function displayMarketPrice(value) {
  return isValidMarketPrice(value) ? currency(value) : "No Data";
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

function formatMarketCap(value) {
  const numeric = Number(value);
  if (!numeric || Number.isNaN(numeric)) {
    return "--";
  }
  if (numeric >= 1e12) {
    return `${(numeric / 1e12).toFixed(2)}T`;
  }
  if (numeric >= 1e9) {
    return `${(numeric / 1e9).toFixed(2)}B`;
  }
  if (numeric >= 1e6) {
    return `${(numeric / 1e6).toFixed(2)}M`;
  }
  return numeric.toString();
}

function percent(value) {
  const numeric = Number(value || 0);
  return `${numeric >= 0 ? "+" : ""}${numeric.toFixed(2)}%`;
}

function ratioPercent(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "--";
  }
  return `${Math.round(numeric * 100)}%`;
}

function signedCurrency(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "--";
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
    signDisplay: "always",
  }).format(numeric);
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

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function toIsoDate(value) {
  return String(value || "").slice(0, 10);
}

function formatChartDateLabel(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "--";
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
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
  const numeric = normalizeConfidencePercent(confidence);
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
    return "balanced signal";
  }
  const score = Number(analysis.score || 0);
  const strategy = analysis.strategy || state.selectedStrategy;
  const strongThreshold = strategy === "simple" ? 3 : 55;
  const weakThreshold = strategy === "simple" ? 1 : 0;
  if (score >= strongThreshold) {
    return "strong bullish signal";
  }
  if (score > weakThreshold) {
    return "light bullish signal";
  }
  if (score <= -strongThreshold) {
    return "strong bearish signal";
  }
  if (score < -weakThreshold) {
    return "light bearish signal";
  }
  return "balanced signal";
}

function normalizeConfidencePercent(confidence) {
  const raw = Number(confidence || 0);
  if (!Number.isFinite(raw)) {
    return 0;
  }
  const normalized = raw <= 1 ? raw * 100 : raw;
  return Math.max(0, Math.min(100, normalized));
}

function recommendationLabel(analysis) {
  if (!analysis || analysis.no_data) {
    return "NO DATA";
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

function recommendationIcon(label) {
  if (label === "BUY") {
    return "▲";
  }
  if (label === "SELL") {
    return "▼";
  }
  if (label === "NO DATA") {
    return "⊘";
  }
  return "●";
}

function trimDecisionText(text, maxLength = 120) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (!clean) {
    return "No summary available.";
  }
  if (clean.length <= maxLength) {
    return clean;
  }
  const clipped = clean.slice(0, maxLength);
  const breakpoint = clipped.lastIndexOf(" ");
  const safe = breakpoint > 72 ? clipped.slice(0, breakpoint) : clipped;
  return `${safe.trim()}...`;
}

function hasMixedSignals(analysis) {
  if (!analysis || analysis.no_data) {
    return false;
  }
  const warnings = Array.isArray(analysis.warnings) ? analysis.warnings.join(" ") : "";
  const combined = `${analysis.reason || ""} ${analysis.summary || ""} ${analysis.no_trade_reason || ""} ${warnings}`;
  return /mixed|conflict|unclear|not clean/i.test(combined);
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
  const numeric = normalizeConfidencePercent(confidence);
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
    return "⚠️ Waiting";
  }
  if (analysis.signal_quality === "PARTIAL") {
    return hasMixedSignals(analysis) ? "⚠️ Mixed" : "⚠️ Partial";
  }
  const confidence = normalizeConfidencePercent(analysis.confidence);
  if (analysis.no_trade) {
    return "⚠️ No trade";
  }
  if (confidence >= 75) {
    return "📈 Strong";
  }
  if (confidence >= 55) {
    return "📈 Good";
  }
  if (confidence >= 40) {
    return "⚠️ Mixed";
  }
  return "📉 Weak";
}

function dataQualityInfo(analysis) {
  if (!analysis) {
    return {
      label: "No Data",
      tone: "tone-muted",
      reason: "No data.",
    };
  }

  const normalizedQuality = String(analysis.data_quality || "").toUpperCase();
  const hasSignals = Boolean(analysis.signals);
  const value =
    normalizedQuality === "FULL" || normalizedQuality === "PARTIAL" || normalizedQuality === "NO_DATA"
      ? normalizedQuality
      : analysis.no_data
        ? "NO_DATA"
        : hasSignals
          ? "PARTIAL"
          : "NO_DATA";
  const presentation =
    value === "FULL"
      ? {
          label: "Full Data",
          tone: "tone-primary",
        }
      : value === "PARTIAL"
        ? {
            label: "Partial Data",
            tone: "tone-hold",
          }
        : {
            label: "No Data",
            tone: "tone-muted",
          };

  return {
    label: presentation.label,
    tone: presentation.tone,
    reason:
      analysis.data_quality_reason ||
      analysis.no_data_reason ||
      "No note.",
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

function learningMetricTone(value, options = {}) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "text-slate-200";
  }
  if (options.invert) {
    if (numeric <= 0) {
      return "text-slate-200";
    }
    return "text-rose-300";
  }
  if (numeric > 0) {
    return "text-emerald-300";
  }
  if (numeric < 0) {
    return "text-rose-300";
  }
  return "text-slate-200";
}

function learningStatus(profile) {
  if (!profile) {
    return {
      label: "Waiting",
      tone: "text-slate-400",
      badge: "border-white/10 bg-white/5 text-slate-300",
    };
  }
  if (profile.eligible) {
    return {
      label: "On",
      tone: "text-emerald-300",
      badge: "border-emerald-400/20 bg-emerald-500/10 text-emerald-200",
    };
  }
  if (profile.trade_count > 0) {
    return {
      label: `${profile.trade_count}/${profile.min_trades_required} trades`,
      tone: "text-amber-300",
      badge: "border-amber-400/20 bg-amber-500/10 text-amber-200",
    };
  }
  return {
      label: "No trades",
    tone: "text-slate-400",
    badge: "border-white/10 bg-white/5 text-slate-300",
  };
}

function emptyLearningResponse() {
  return {
    version: "performance-learning-v1",
    strategies: [],
  };
}

function sortLearningStrategies(strategies) {
  const order = Object.keys(STRATEGY_LABELS);
  return [...(Array.isArray(strategies) ? strategies : [])].sort(
    (left, right) => order.indexOf(left.strategy) - order.indexOf(right.strategy),
  );
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
  state.searchResultsQuery = "";
}

function renderSearchSuggestions(results, query) {
  state.searchResults = results;
  state.searchResultsQuery = query.trim().toLowerCase();

  if (!query.trim()) {
    hideSearchSuggestions();
    return;
  }

  if (!results.length) {
    elements.searchSuggestions.innerHTML = `
      <div class="rounded-2xl px-4 py-4 text-sm text-slate-400">
        No match.
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
        ⚠️ Search off.
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

  if (state.searchResults.length && state.searchResultsQuery === trimmed.toLowerCase()) {
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
  elements.recommendationValue.className = "text-5xl font-black tracking-[-0.06em] text-white xl:text-6xl";
  elements.recommendationIcon.className = "signal-icon tone-muted";
  elements.recommendationIcon.textContent = "◌";
  elements.recommendationValue.textContent = "LOADING";
  elements.signalQualityBadge.hidden = true;
  elements.conflictBadge.hidden = true;
  elements.confidenceValue.className = "mt-2 text-2xl font-semibold text-white";
  elements.confidenceValue.textContent = "--";
  setConfidenceBar(0, "NO_DATA");
  elements.confidenceHint.textContent = "⚠️ Scanning";
  elements.analysisSummary.textContent = trimDecisionText(
    `${STRATEGY_LABELS[state.selectedStrategy]} scan: ${symbol}`,
    110,
  );
  elements.selectedStrategyBadge.textContent = STRATEGY_LABELS[state.selectedStrategy];
  elements.analysisGeneratedAt.textContent = "Running";
  elements.biasValue.textContent = "Balanced";
  elements.noTradeReason.textContent = "Waiting.";
  if (elements.mobileConfidenceValue) {
    elements.mobileConfidenceValue.className = "mt-2 text-2xl font-semibold text-white";
    elements.mobileConfidenceValue.textContent = "--";
  }
  if (elements.mobileConfidenceBarFill) {
    elements.mobileConfidenceBarFill.className = "h-full rounded-full transition-[width] duration-300 ease-out confidence-fill-no-data";
    elements.mobileConfidenceBarFill.style.width = "0%";
  }
  if (elements.mobileConfidenceHint) {
    elements.mobileConfidenceHint.textContent = "⚠️ Scanning";
  }
  if (elements.mobileAnalysisSummary) {
    elements.mobileAnalysisSummary.textContent = trimDecisionText(
      `${STRATEGY_LABELS[state.selectedStrategy]} scan: ${symbol}`,
      110,
    );
  }
  if (elements.mobileBiasValue) {
    elements.mobileBiasValue.textContent = "Balanced";
  }
  if (elements.mobileNoTradeReason) {
    elements.mobileNoTradeReason.textContent = "Waiting.";
  }
  elements.riskValue.className = "mt-3 text-2xl font-semibold text-white";
  elements.riskValue.textContent = "--";
  elements.timeframeValue.textContent = "--";
  elements.coverageValue.className = "mt-3 text-2xl font-semibold text-white";
  elements.coverageValue.textContent = "No Data";
  elements.coverageReason.textContent = "Waiting.";
  elements.entryValue.textContent = "--";
  elements.entryReason.textContent = "Waiting.";
  elements.exitValue.textContent = "--";
  elements.exitReason.textContent = "Waiting.";
  elements.positionSizeValue.textContent = "--";
  elements.positionSizeReason.textContent = "Waiting.";
  elements.stopLossValue.textContent = "--";
  elements.stopLossReason.textContent = "Waiting.";
  elements.warningsList.innerHTML =
    '<span class="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-400">Loading</span>';

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
    renderSkeleton(elements.mobileConfidenceValue, "h-7 w-20");
    renderSkeleton(elements.mobileConfidenceHint, "h-4 w-28");
    elements.mobileAnalysisSummary.innerHTML = `
      <span class="mobile-skeleton h-4 w-full"></span>
      <span class="mobile-skeleton mt-2 h-4 w-10/12"></span>
    `;
    renderSkeleton(elements.mobileNoTradeReason, "h-4 w-full");
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
  elements.alertsMeta.textContent = "Scanning...";
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
  requestAnimationFrame(syncCompanySectionAlignment);
}

function renderAlerts(alerts) {
  state.alertsRetryAttempt = 0;
  window.clearTimeout(state.alertsRetryId);
  writeCachedJson(STORAGE_KEYS.cachedAlerts, alerts);
  elements.alertsMeta.textContent = `${alerts.length} live alerts`;

  if (!alerts.length) {
    elements.alertsList.innerHTML = `
      <article class="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
        <p class="text-sm font-semibold text-white">No alerts</p>
        <p class="mt-2 text-sm leading-6 text-slate-400">⚠️ Nothing strong.</p>
      </article>
    `;
    requestAnimationFrame(syncCompanySectionAlignment);
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
  requestAnimationFrame(syncCompanySectionAlignment);
}

function renderAlertsWarning(message) {
  elements.alertsMeta.textContent = message;
  elements.alertsList.innerHTML = `
    <article class="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4">
      <p class="text-sm font-semibold text-white">Alerts warming</p>
      <p class="mt-2 text-sm leading-6 text-slate-300">⚠️ Retry soon.</p>
    </article>
  `;
  requestAnimationFrame(syncCompanySectionAlignment);
}

function opportunityToneClass(recommendation) {
  if (recommendation === "BUY") {
    return "opportunity-buy";
  }
  if (recommendation === "SELL") {
    return "opportunity-sell";
  }
  return "opportunity-hold";
}

function opportunityMetricLabel(entry) {
  return `${entry.symbol} · ${entry.recommendation} · ${Math.round(entry.confidence)}%`;
}

function opportunityStrength(entry) {
  const recommendationBoost =
    entry.recommendation === "BUY" || entry.recommendation === "SELL"
      ? 1.15
      : entry.score !== 0
        ? 0.55
        : 0.15;
  const directionalWeight = Math.abs(entry.score) * 1.35;
  return directionalWeight + entry.confidence / 100 + recommendationBoost;
}

function sortOpportunityDirection(entries, direction) {
  const sign = direction === "BUY" ? 1 : -1;
  return [...entries].sort((left, right) => {
    const leftExplicit = left.recommendation === direction ? 1 : 0;
    const rightExplicit = right.recommendation === direction ? 1 : 0;
    const leftDirectional = (left.score || 0) * sign;
    const rightDirectional = (right.score || 0) * sign;
    return (
      rightExplicit - leftExplicit ||
      rightDirectional - leftDirectional ||
      opportunityStrength(right) - opportunityStrength(left) ||
      right.confidence - left.confidence
    );
  });
}

function renderOpportunityLoading() {
  if (!elements.opportunityList || !elements.opportunityMeta) {
    return;
  }
  elements.opportunityMeta.textContent = "Ranking...";
  elements.opportunityList.innerHTML = Array.from({ length: 3 })
    .map(
      () => `
        <article class="animate-pulse rounded-2xl border border-white/10 bg-slate-950/60 p-4">
          <div class="h-4 w-24 rounded bg-white/10"></div>
          <div class="mt-3 h-16 rounded-2xl bg-white/10"></div>
        </article>
      `,
    )
    .join("");
}

function buildOpportunitySection(title, tone, entries, emptyMessage) {
  if (!entries.length) {
    return `
      <article class="opportunity-group">
        <div class="opportunity-group-head">
          <p class="opportunity-group-title">${title}</p>
        </div>
        <div class="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-4 text-sm leading-6 text-slate-400">
          No setups.
          <span class="block mt-1 text-xs text-slate-500">${emptyMessage}</span>
        </div>
      </article>
    `;
  }

  return `
    <article class="opportunity-group">
      <div class="opportunity-group-head">
        <p class="opportunity-group-title">${title}</p>
      </div>
      <div class="space-y-2.5">
        ${entries
          .map(
            (entry, index) => `
              <button
                type="button"
                class="opportunity-card ${opportunityToneClass(entry.recommendation)} ${entry.symbol === state.selectedSymbol ? "opportunity-card-current" : ""} ${index === 0 ? "opportunity-card-strongest" : ""}"
                data-symbol="${entry.symbol}"
                aria-pressed="${entry.symbol === state.selectedSymbol ? "true" : "false"}"
              >
                <div class="min-w-0">
                  <div class="flex items-center justify-between gap-3">
                    <p class="truncate text-sm font-semibold text-white">${entry.symbol}</p>
                    <span class="opportunity-pill">${index === 0 ? `Top ${entry.recommendation}` : entry.recommendation}</span>
                  </div>
                  <p class="mt-1 truncate text-xs text-slate-400">${entry.name}</p>
                </div>
                <div class="text-right">
                  <p class="text-sm font-semibold text-white">${Math.round(entry.confidence)}%</p>
                  <p class="mt-1 text-[11px] uppercase tracking-[0.18em] text-slate-500">Score ${entry.scoreLabel}</p>
                </div>
              </button>
            `,
          )
          .join("")}
      </div>
    </article>
  `;
}

function uniqueOpportunityEntries(entries) {
  const seen = new Set();
  return entries.filter((entry) => {
    if (!entry?.symbol || seen.has(entry.symbol)) {
      return false;
    }
    seen.add(entry.symbol);
    return true;
  });
}

function opportunityBuyCandidates(entries) {
  const directional = entries.filter(
    (entry) => entry.recommendation === "BUY" || entry.score > 0 || entry.rank > 0.35 || entry.confidence >= 38,
  );
  const fallback = sortOpportunityDirection(entries, "BUY");
  return uniqueOpportunityEntries(sortOpportunityDirection(directional.length ? directional : fallback, "BUY")).slice(
    0,
    OPPORTUNITY_LIMIT,
  );
}

function opportunitySellCandidates(entries) {
  const directional = entries.filter(
    (entry) => entry.recommendation === "SELL" || entry.score < 0 || entry.rank < -0.35 || entry.confidence >= 38,
  );
  const fallback = sortOpportunityDirection(entries, "SELL");
  return uniqueOpportunityEntries(sortOpportunityDirection(directional.length ? directional : fallback, "SELL")).slice(
    0,
    OPPORTUNITY_LIMIT,
  );
}

function opportunityConfidenceCandidates(entries, excludedSymbols = new Set()) {
  const primary = entries
    .filter((entry) => !excludedSymbols.has(entry.symbol) && entry.confidence >= 60)
    .sort((left, right) => opportunityStrength(right) - opportunityStrength(left) || right.confidence - left.confidence);

  const fallback = entries
    .filter((entry) => !excludedSymbols.has(entry.symbol))
    .sort((left, right) => opportunityStrength(right) - opportunityStrength(left) || right.confidence - left.confidence);

  return uniqueOpportunityEntries(primary.length ? primary : fallback).slice(0, OPPORTUNITY_LIMIT);
}

function buildFallbackOpportunityEntries(symbols, watchlistMap) {
  return symbols
    .map((symbol, index) => {
      const item = watchlistMap.get(symbol);
      if (!item) {
        return null;
      }
      const change = Number(item.change_percent);
      const score = Number.isFinite(change) ? Math.max(-1, Math.min(1, change / 2)) : 0;
      const confidence = Number.isFinite(change) ? Math.max(28, Math.min(62, Math.abs(change) * 8 + 28)) : 32;
      const recommendation = score > 0 ? "BUY" : score < 0 ? "SELL" : index === 0 ? "BUY" : "HOLD";
      return {
        symbol,
        name: item.name || symbol,
        recommendation,
        score,
        scoreLabel: score > 0 ? "+1" : score < 0 ? "-1" : "0",
        confidence,
        dataQuality: item.no_data ? "NO_DATA" : item.stale ? "PARTIAL" : "FULL",
        rank: score + confidence / 115,
      };
    })
    .filter(Boolean)
    .sort((left, right) => opportunityStrength(right) - opportunityStrength(left));
}

function renderOpportunityPanel(entries) {
  if (!elements.opportunityList || !elements.opportunityMeta) {
    return;
  }
  state.opportunities = entries;
  const fullCount = entries.filter((entry) => entry.dataQuality === "FULL").length;
  elements.opportunityMeta.textContent = `${entries.length} ranked · ${fullCount} full data`;
  const strongest = [...entries].sort((left, right) => opportunityStrength(right) - opportunityStrength(left))[0] || null;

  let topBuy = opportunityBuyCandidates(entries);
  let topSell = opportunitySellCandidates(entries);
  if (!topBuy.length && entries.length) {
    topBuy = [sortOpportunityDirection(entries, "BUY")[0]].filter(Boolean);
  }
  if (!topSell.length && entries.length) {
    topSell = [sortOpportunityDirection(entries, "SELL")[0]].filter(Boolean);
  }
  if (!topBuy.length && !topSell.length && entries.length) {
    const best = [...entries].sort((left, right) => opportunityStrength(right) - opportunityStrength(left))[0];
    if (best) {
      if ((best.score || 0) >= 0) {
        topBuy = [best];
      } else {
        topSell = [best];
      }
    }
  }
  const excludedSymbols = new Set([...topBuy, ...topSell].map((entry) => entry.symbol));
  let highConfidence = opportunityConfidenceCandidates(entries, excludedSymbols);

  if (!topBuy.length && strongest) {
    topBuy = [strongest];
  }
  if (!topSell.length && strongest) {
    topSell = [strongest];
  }
  if (!highConfidence.length && strongest) {
    highConfidence = [strongest];
  }

  elements.opportunityList.innerHTML = [
    buildOpportunitySection("📈 Top BUY", "BUY", topBuy, "Best long."),
    buildOpportunitySection("📉 Top SELL", "SELL", topSell, "Best short."),
    buildOpportunitySection("⚠️ High confidence", "HOLD", highConfidence, "Clearest setup."),
  ].join("");

  elements.opportunityList.querySelectorAll(".opportunity-card").forEach((button) => {
    button.addEventListener("click", async () => {
      const symbol = button.dataset.symbol;
      if (!symbol) {
        return;
      }
      await loadSymbol(symbol, true);
    });
  });
}

function renderOpportunityWarning(message) {
  if (!elements.opportunityList || !elements.opportunityMeta) {
    return;
  }
  elements.opportunityMeta.textContent = message;
  elements.opportunityList.innerHTML = `
    <article class="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4">
      <p class="text-sm font-semibold text-white">Panel warming</p>
      <p class="mt-2 text-sm leading-6 text-slate-300">⚠️ Ranking setups.</p>
    </article>
  `;
}

async function loadOpportunities(forceRefresh = false) {
  if (!elements.opportunityList || !elements.opportunityMeta) {
    return [];
  }
  renderOpportunityLoading();
  const symbols = Array.from(
    new Set(
      [state.selectedSymbol, ...state.watchlist.map((item) => item.symbol)]
        .map((symbol) => normalizeTickerSymbol(symbol))
        .filter(Boolean),
    ),
  ).slice(0, Math.max(MAX_SIDEBAR_SLOTS, 10));

  if (!symbols.length) {
    renderOpportunityWarning("No symbols");
    return [];
  }

  const params = new URLSearchParams({ strategy: state.selectedStrategy });
  if (forceRefresh) {
    params.set("refresh", "1");
  }

  const responses = await Promise.allSettled(
    symbols.map((symbol) =>
      api(`/api/analysis/${encodeURIComponent(symbol)}?${params.toString()}`, {
        timeoutMs: 22000,
        retryCount: 1,
      }).then((analysis) => ({ symbol, analysis })),
    ),
  );

  const watchlistMap = new Map(state.watchlist.map((item) => [normalizeTickerSymbol(item.symbol), item]));
  let entries = responses
    .filter((result) => result.status === "fulfilled")
    .map((result) => result.value)
    .filter(({ analysis }) => analysis && !analysis.no_data)
    .map(({ symbol, analysis }) => {
      const confidence = normalizeConfidencePercent(analysis.confidence);
      const score = Number(analysis.score || 0);
      const dataQuality = String(analysis.data_quality || "NO_DATA").toUpperCase();
      const watchlistItem = watchlistMap.get(symbol);
      const recommendation = analysis.recommendation || "HOLD";
      const directionalBias =
        recommendation === "BUY"
          ? 1.25
          : recommendation === "SELL"
            ? -1.25
            : score > 0
              ? 0.5
              : score < 0
                ? -0.5
                : 0;
      return {
        symbol,
        name: watchlistItem?.name || analysis.name || symbol,
        recommendation,
        score,
        scoreLabel: score >= 0 ? `+${score}` : `${score}`,
        confidence,
        dataQuality,
        rank: score + directionalBias + confidence / 115,
      };
    })
    .filter((entry) => entry.dataQuality === "FULL" || entry.dataQuality === "PARTIAL");

  if (!entries.length) {
    entries = buildFallbackOpportunityEntries(symbols, watchlistMap)
      .filter((entry) => entry.dataQuality === "FULL" || entry.dataQuality === "PARTIAL")
      .slice(0, OPPORTUNITY_LIMIT);
  }

  if (!entries.length) {
    const strongestFallback = buildFallbackOpportunityEntries(symbols, watchlistMap).slice(0, 1);
    if (strongestFallback.length) {
      entries = strongestFallback;
    } else {
      renderOpportunityWarning("No ranked opportunities yet");
      return [];
    }
  }

  renderOpportunityPanel(entries);
  return entries;
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

function renderLearningStatsLoading() {
  if (!elements.learningList || !elements.learningMeta) {
    return;
  }
  elements.learningMeta.textContent = "Loading";
  elements.learningMeta.className =
    "rounded-full border border-white/10 bg-slate-950/60 px-4 py-2 text-xs font-medium text-slate-400";
  elements.learningList.innerHTML = Array.from({ length: 3 })
    .map(
      () => `
        <article class="animate-pulse rounded-2xl border border-white/10 bg-slate-950/60 p-4">
          <div class="h-4 w-28 rounded bg-white/10"></div>
          <div class="mt-3 h-3 w-20 rounded bg-white/10"></div>
          <div class="mt-4 grid grid-cols-2 gap-3">
            <div class="h-14 rounded-2xl bg-white/10"></div>
            <div class="h-14 rounded-2xl bg-white/10"></div>
            <div class="h-14 rounded-2xl bg-white/10"></div>
            <div class="h-14 rounded-2xl bg-white/10"></div>
          </div>
        </article>
      `,
    )
    .join("");
}

function renderLearningStatsError(message) {
  if (!elements.learningList || !elements.learningMeta) {
    return;
  }
  elements.learningMeta.textContent = "Learning offline";
  elements.learningMeta.className =
    "rounded-full border border-amber-400/20 bg-amber-500/10 px-4 py-2 text-xs font-medium text-amber-200";
  elements.learningList.innerHTML = `
    <article class="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4">
      <p class="text-sm font-semibold text-white">Learning offline</p>
      <p class="mt-2 text-sm leading-6 text-slate-300">${message || "⚠️ Try again."}</p>
    </article>
  `;
}

function renderLearningStats(response = emptyLearningResponse()) {
  if (!elements.learningList || !elements.learningMeta) {
    return;
  }
  state.learningStats = response;
  writeCachedJson(STORAGE_KEYS.cachedLearningStats, response);
  const strategies = sortLearningStrategies(response.strategies);
  const selectedProfile =
    strategies.find((item) => item.strategy === state.selectedStrategy) || null;
  const selectedStatus = learningStatus(selectedProfile);
  elements.learningMeta.textContent = selectedProfile
    ? `${STRATEGY_LABELS[state.selectedStrategy]} · ${selectedStatus.label}`
    : "No stats";
  elements.learningMeta.className = `rounded-full border px-4 py-2 text-xs font-medium ${
    selectedProfile?.eligible
      ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
      : selectedProfile
        ? "border-amber-400/20 bg-amber-500/10 text-amber-200"
        : "border-white/10 bg-slate-950/60 text-slate-400"
  }`;

  if (!strategies.length) {
    elements.learningList.innerHTML = `
      <article class="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
        <p class="text-sm font-semibold text-white">No closed trades</p>
        <p class="mt-2 text-sm leading-6 text-slate-400">Stats appear later.</p>
      </article>
    `;
    return;
  }

  elements.learningList.innerHTML = strategies
    .map((profile) => {
      const active = profile.strategy === state.selectedStrategy;
      const status = learningStatus(profile);
      const avgPnlTone = learningMetricTone(profile.average_profit_loss);
      const drawdownTone = learningMetricTone(profile.drawdown, { invert: true });
      const winRateTone =
        profile.win_rate >= 0.55
          ? "text-emerald-300"
          : profile.win_rate > 0 && profile.win_rate <= 0.45
            ? "text-rose-300"
            : "text-slate-200";
      return `
        <article class="rounded-2xl border p-4 ${
          active
            ? "border-cyan-300/30 bg-cyan-300/10 shadow-lg shadow-cyan-500/10"
            : "border-white/10 bg-slate-950/60"
        }">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <p class="text-sm font-semibold text-white">${STRATEGY_LABELS[profile.strategy] || titleCase(profile.strategy)}</p>
                ${
                  active
                    ? '<span class="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-200">Selected</span>'
                    : ""
                }
              </div>
              <p class="mt-2 text-xs ${status.tone}">${status.label}</p>
            </div>
            <span class="rounded-full border px-3 py-2 text-[11px] font-semibold ${status.badge}">
              ${profile.trade_count} trades
            </span>
          </div>

          <div class="mt-4 grid grid-cols-2 gap-3">
            <div class="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
              <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">Win rate</p>
              <p class="mt-2 text-lg font-semibold ${winRateTone}">${ratioPercent(profile.win_rate)}</p>
            </div>
            <div class="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
              <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">Avg P/L</p>
              <p class="mt-2 text-lg font-semibold ${avgPnlTone}">${signedCurrency(profile.average_profit_loss)}</p>
            </div>
            <div class="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
              <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">Drawdown</p>
              <p class="mt-2 text-lg font-semibold ${drawdownTone}">${currency(profile.drawdown || 0)}</p>
            </div>
            <div class="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
              <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">Version</p>
              <p class="mt-2 text-sm font-semibold text-slate-200">${profile.learning_version || response.version || "--"}</p>
            </div>
          </div>

          <p class="mt-4 text-sm leading-6 text-slate-400">${profile.note || "No note."}</p>
        </article>
      `;
    })
    .join("");
}

function mergeLearningInsight(analysis) {
  if (!analysis?.learning) {
    return;
  }
  const current = state.learningStats || emptyLearningResponse();
  const strategies = sortLearningStrategies(current.strategies);
  const nextProfile = {
    strategy: analysis.strategy || state.selectedStrategy,
    learning_version: analysis.learning.version,
    trade_count: analysis.learning.trade_count,
    eligible: analysis.learning.active,
    min_trades_required: analysis.learning.min_trades_required,
    win_rate: analysis.learning.win_rate,
    average_profit_loss: analysis.learning.average_profit_loss,
    average_profit: analysis.learning.average_profit,
    average_loss: analysis.learning.average_loss,
    drawdown: analysis.learning.drawdown,
    confidence_bias: analysis.learning.confidence_bias,
    directional_bias: analysis.learning.directional_bias,
    weak_signal_multiplier: analysis.learning.weak_signal_multiplier,
    note: analysis.learning.note,
  };
  const nextStrategies = strategies.filter((item) => item.strategy !== nextProfile.strategy);
  nextStrategies.push(nextProfile);
  renderLearningStats({
    version: analysis.learning.version,
    strategies: sortLearningStrategies(nextStrategies),
  });
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
  mergeLearningInsight(analysis);

  if (!analysis || analysis.no_data) {
    const reason = analysis?.no_data_reason || "No live market data available.";
    const noDataQuality = dataQualityInfo(analysis);
    elements.recommendationCard.className = "rounded-[28px] border border-rose-400/25 bg-rose-500/10 p-5";
    elements.recommendationIcon.className = "signal-icon tone-sell";
    elements.recommendationIcon.textContent = recommendationIcon("NO DATA");
    elements.recommendationValue.className = "text-5xl font-black tracking-[-0.06em] text-rose-200 xl:text-6xl";
    elements.recommendationValue.textContent = "NO DATA";
    elements.signalQualityBadge.hidden = true;
    elements.conflictBadge.hidden = true;
    elements.confidenceValue.className = "mt-2 text-2xl font-semibold text-slate-200";
    elements.confidenceValue.textContent = "--";
    setConfidenceBar(0, "NO_DATA");
    elements.confidenceHint.textContent = "⚠️ No data";
    elements.analysisSummary.textContent = trimDecisionText(reason, 110);
    elements.analysisGeneratedAt.textContent = "No signal";
    elements.biasValue.textContent = "Balanced";
    elements.noTradeReason.textContent = reason;
    if (elements.mobileConfidenceValue) {
      elements.mobileConfidenceValue.className = "mt-2 text-2xl font-semibold text-slate-200";
      elements.mobileConfidenceValue.textContent = "--";
    }
    if (elements.mobileConfidenceBarFill) {
      elements.mobileConfidenceBarFill.className = "h-full rounded-full transition-[width] duration-300 ease-out confidence-fill-no-data";
      elements.mobileConfidenceBarFill.style.width = "0%";
    }
    if (elements.mobileConfidenceHint) {
      elements.mobileConfidenceHint.textContent = "⚠️ No data";
    }
    if (elements.mobileAnalysisSummary) {
      elements.mobileAnalysisSummary.textContent = trimDecisionText(reason, 110);
    }
    if (elements.mobileBiasValue) {
      elements.mobileBiasValue.textContent = "Balanced";
    }
    if (elements.mobileNoTradeReason) {
      elements.mobileNoTradeReason.textContent = reason;
    }
    elements.riskValue.className = "mt-3 text-2xl font-semibold text-slate-200";
    elements.riskValue.textContent = "--";
    elements.timeframeValue.textContent = "--";
    elements.coverageValue.className = `mt-3 text-2xl font-semibold ${noDataQuality.tone}`;
    elements.coverageValue.textContent = noDataQuality.label;
    elements.coverageReason.textContent = noDataQuality.reason;
    elements.entryValue.textContent = "NO";
    elements.entryReason.textContent = reason;
    elements.exitValue.textContent = "NO";
    elements.exitReason.textContent = "No action.";
    elements.positionSizeValue.textContent = "Flat";
    elements.positionSizeReason.textContent = "No data.";
    elements.stopLossValue.textContent = "--";
    elements.stopLossReason.textContent = "No stop.";
    elements.warningsList.innerHTML =
      '<span class="rounded-full border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-200">No live data</span>';
    renderMobileStrategyCards();
    syncMobileFavoriteButton();
    return;
  }

  const label = recommendationLabel(analysis);
  const palette = recommendationPalette(label);
  const warnings = (analysis.warnings || []).slice(0, 3);
  const confidencePercent = normalizeConfidencePercent(analysis.confidence);
  const noTradeHint = analysis.no_trade_reason || "Low confidence / no trade zone";
  const mixedSignals = hasMixedSignals(analysis);

  elements.recommendationCard.className = `${palette.card}${analysis.signal_quality === "PARTIAL" ? " signal-partial-card" : ""}`;
  elements.recommendationIcon.className = `signal-icon ${palette.text}`;
  elements.recommendationIcon.textContent = recommendationIcon(label);
  elements.recommendationValue.className = `text-5xl font-black tracking-[-0.06em] ${palette.text} xl:text-6xl`;
  elements.recommendationValue.textContent = label;
  elements.signalQualityBadge.hidden = analysis.signal_quality !== "PARTIAL";
  elements.conflictBadge.hidden = !mixedSignals;
  elements.confidenceValue.className = `mt-2 text-2xl font-semibold ${confidenceToneClass(analysis.confidence)}`;
  elements.confidenceValue.textContent = `${Math.round(confidencePercent)}%`;
  setConfidenceBar(analysis.confidence, analysis.data_quality);
  elements.confidenceHint.textContent = confidenceHint(analysis);
  elements.analysisSummary.textContent = trimDecisionText(
    analysis.reason || analysis.summary || "No summary available.",
    120,
  );
  elements.analysisGeneratedAt.textContent = analysis.generated_at
    ? `Updated ${new Date(analysis.generated_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
    : "Analysis ready";
  elements.biasValue.textContent = biasLabel(analysis);
  elements.noTradeReason.textContent = analysis.no_trade
    ? trimDecisionText(noTradeHint, 96)
    : mixedSignals
      ? "⚠️ Mixed."
      : "📈 Ready.";
  if (elements.mobileConfidenceValue) {
    elements.mobileConfidenceValue.className = `mt-2 text-2xl font-semibold ${confidenceToneClass(analysis.confidence)}`;
    elements.mobileConfidenceValue.textContent = `${Math.round(confidencePercent)}%`;
  }
  if (elements.mobileConfidenceBarFill) {
    elements.mobileConfidenceBarFill.className = elements.confidenceBarFill.className;
    elements.mobileConfidenceBarFill.style.width = elements.confidenceBarFill.style.width;
  }
  if (elements.mobileConfidenceHint) {
    elements.mobileConfidenceHint.textContent = confidenceHint(analysis);
  }
  if (elements.mobileAnalysisSummary) {
    elements.mobileAnalysisSummary.textContent = trimDecisionText(
      analysis.reason || analysis.summary || "No summary available.",
      120,
    );
  }
  if (elements.mobileBiasValue) {
    elements.mobileBiasValue.textContent = biasLabel(analysis);
  }
  if (elements.mobileNoTradeReason) {
    elements.mobileNoTradeReason.textContent = elements.noTradeReason.textContent;
  }
  elements.riskValue.className = `mt-3 text-2xl font-semibold ${toneClassForRisk(analysis.risk_level)}`;
  elements.riskValue.textContent = analysis.risk_level || "--";
  elements.timeframeValue.textContent = titleCase(analysis.timeframe);
  const dataQuality = dataQualityInfo(analysis);
  elements.coverageValue.className = `mt-3 text-2xl font-semibold ${dataQuality.tone}`;
  elements.coverageValue.textContent = dataQuality.label;
  elements.coverageReason.textContent = dataQuality.reason;
  elements.entryValue.className = `mt-3 text-2xl font-semibold ${analysis.entry_signal ? "text-emerald-300" : "text-slate-200"}`;
  elements.entryValue.textContent = yesNoLabel(analysis.entry_signal);
  elements.entryReason.textContent = analysis.entry_reason || "No entry.";
  elements.exitValue.className = `mt-3 text-2xl font-semibold ${analysis.exit_signal ? "text-rose-300" : "text-slate-200"}`;
  elements.exitValue.textContent = yesNoLabel(analysis.exit_signal);
  elements.exitReason.textContent = analysis.exit_reason || "No exit.";
  elements.positionSizeValue.textContent = sizeBucket(analysis.position_size_percent);
  elements.positionSizeReason.textContent = analysis.position_size_reason || "No size.";
  elements.stopLossValue.textContent = analysis.stop_loss_level ? currency(analysis.stop_loss_level) : "--";
  elements.stopLossReason.textContent = analysis.stop_loss_reason || "No stop.";
  elements.warningsList.innerHTML = warnings.length
    ? warnings
        .map((warning) => {
          const tone = /negative|high|weak|unclear|drawdown|overbought|headwind|pressure|strong/i.test(warning)
            ? "border-amber-400/20 bg-amber-500/10 text-amber-200"
            : "border-white/10 bg-white/5 text-slate-300";
          return `<span class="rounded-full border px-3 py-2 text-xs font-medium ${tone}">${warning}</span>`;
        })
        .join("")
    : '<span class="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-200">Clear</span>';
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
            <span class="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-slate-300">Scan</span>
          </div>
          <div class="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10"><div class="mobile-skeleton h-full w-1/2 rounded-full"></div></div>
          <p class="mt-3 text-sm text-slate-400">Checking ${symbol}</p>
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
      const confidence = analysis?.no_data
        ? "--"
        : `${Math.round(normalizeConfidencePercent(analysis?.confidence || 0))}%`;
      const reason =
        (analysis?.no_trade ? analysis.no_trade_reason : analysis?.reason) ||
        (analysis?.no_data ? analysis.no_data_reason : `Loading ${label}...`);
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

function syncSelectedFavoriteButton() {
  if (!elements.selectedFavoriteButton) {
    return;
  }
  const active = isFavoriteSymbol(state.selectedSymbol);
  elements.selectedFavoriteButton.textContent = active ? "★ Favorite" : "☆ Favorite";
  elements.selectedFavoriteButton.className = active
    ? "favorite-button favorite-active rounded-full border border-amber-300/30 bg-amber-300/12 px-4 py-2 text-sm font-semibold text-amber-200"
    : "favorite-button rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-300";
  elements.selectedFavoriteButton.setAttribute(
    "aria-label",
    active ? "Remove selected symbol from favorites" : "Add selected symbol to favorites",
  );
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
        <p class="text-sm font-semibold text-white">No positions</p>
        <p class="mt-2 text-sm leading-6 text-slate-400">Add later.</p>
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
          <p class="text-sm font-semibold text-white">Portfolio offline</p>
          <p class="mt-2 text-sm leading-6 text-slate-300">${error.message || "⚠️ Try again."}</p>
        </article>
      `;
    });
}

function closePortfolioSheet() {
  elements.portfolioSheetBackdrop?.classList.add("hidden");
  elements.portfolioSheet?.classList.add("hidden");
}

function setAuthenticated(value) {
  if (state.auth.enabled) {
    if (!value) {
      state.auth.currentUser = null;
      state.auth.accessToken = "";
      state.auth.tokenFetchedAt = 0;
      setAdminSessionToken("");
    }
    return;
  }
  if (value) {
    window.sessionStorage.setItem(STORAGE_KEYS.authenticated, "1");
    return;
  }
  window.sessionStorage.removeItem(STORAGE_KEYS.authenticated);
}

function isAuthenticated() {
  if (state.auth.enabled) {
    return Boolean(state.auth.currentUser || state.auth.adminSession);
  }
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

function buildSidebarItemFromOverview(overview) {
  return {
    symbol: overview.symbol,
    name: overview.name || overview.symbol,
    price: Number(overview.price || 0),
    change_percent: Number(overview.change_percent || 0),
  };
}

function upsertWatchlistItem(nextItem, options = {}) {
  if (!nextItem?.symbol) {
    return;
  }
  const symbol = String(nextItem.symbol).toUpperCase();
  const existingIndex = state.watchlist.findIndex((item) => item.symbol === symbol);
  if (existingIndex >= 0) {
    state.watchlist[existingIndex] = {
      ...state.watchlist[existingIndex],
      ...nextItem,
      symbol,
      userAdded: state.watchlist[existingIndex].userAdded || Boolean(options.userAdded),
    };
    return;
  }
  state.watchlist = [...state.watchlist, { ...nextItem, symbol, userAdded: Boolean(options.userAdded) }];
}

function getDefaultSidebarItems(itemBySymbol) {
  return DEFAULT_SIDEBAR_ITEMS.map((fallbackItem) => {
    const liveItem = itemBySymbol.get(fallbackItem.symbol);
    if (liveItem) {
      return {
        ...fallbackItem,
        ...liveItem,
        symbol: fallbackItem.symbol,
      };
    }
    return {
      ...fallbackItem,
      price: null,
      change_percent: null,
      placeholder: true,
    };
  });
}

function getVisibleWatchlistItems(items) {
  const normalizedItems = Array.isArray(items) ? items : [];
  const itemBySymbol = new Map(normalizedItems.map((item) => [item.symbol, item]));
  const favoriteItems = Array.from(state.favoriteSymbols)
    .map((symbol) => itemBySymbol.get(symbol) || getDefaultSidebarItems(itemBySymbol).find((item) => item.symbol === symbol))
    .filter(Boolean);
  const defaultItems = getDefaultSidebarItems(itemBySymbol).filter((item) => !state.favoriteSymbols.has(item.symbol));
  const adHocItems = normalizedItems.filter(
    (item) =>
      !state.favoriteSymbols.has(item.symbol) &&
      !item.userAdded &&
      !DEFAULT_SIDEBAR_ITEMS.some((defaultItem) => defaultItem.symbol === item.symbol),
  );
  return [...favoriteItems, ...defaultItems, ...adHocItems].slice(0, MAX_SIDEBAR_SLOTS);
}

async function loadFavoriteSymbolsFromBackend() {
  if (!isAuthenticated()) {
    return state.favoriteSymbols;
  }

  try {
    const params = new URLSearchParams({ user_key: currentUserKey() });
    const favorites = await api(`/api/favorites?${params.toString()}`, {
      timeoutMs: 12000,
      retryCount: 1,
    });
    state.favoriteSymbols = new Set(
      (Array.isArray(favorites) ? favorites : [])
        .map((entry) => String(entry?.symbol || "").trim().toUpperCase())
        .filter(Boolean),
    );
    persistFavoriteSymbols();
    renderWatchlist(state.watchlist);
    renderFavorites();
    syncMobileFavoriteButton();
    syncSelectedFavoriteButton();
  } catch (error) {
    console.error("[frontend] favorite sync failed", error);
  }

  return state.favoriteSymbols;
}

async function toggleFavorite(symbol) {
  const normalized = String(symbol || "").trim().toUpperCase();
  if (!normalized) {
    return;
  }
  const wasFavorite = state.favoriteSymbols.has(normalized);
  if (state.favoriteSymbols.has(normalized)) {
    state.favoriteSymbols.delete(normalized);
  } else {
    if (state.favoriteSymbols.size >= MAX_SIDEBAR_SLOTS) {
      showError("You can pin up to 10 favorites.");
      return;
    }
    if (state.latestOverview && state.latestOverview.symbol === normalized) {
      upsertWatchlistItem(buildSidebarItemFromOverview(state.latestOverview), { userAdded: true });
    }
    state.favoriteSymbols.add(normalized);
  }
  persistFavoriteSymbols();
  renderWatchlist(state.watchlist);
  renderFavorites();
  syncMobileFavoriteButton();
  syncSelectedFavoriteButton();

  if (!isAuthenticated()) {
    return;
  }

  try {
    if (wasFavorite) {
      await api(`/api/favorites/${encodeURIComponent(normalized)}?user_key=${encodeURIComponent(currentUserKey())}`, {
        method: "DELETE",
        timeoutMs: 12000,
        retryCount: 0,
      });
    } else {
      await api("/api/favorites", {
        method: "POST",
        timeoutMs: 12000,
        retryCount: 0,
        body: JSON.stringify({
          symbol: normalized,
          user_key: currentUserKey(),
        }),
      });
    }
  } catch (error) {
    console.error("[frontend] favorite update failed", error);
    if (wasFavorite) {
      state.favoriteSymbols.add(normalized);
    } else {
      state.favoriteSymbols.delete(normalized);
    }
    persistFavoriteSymbols();
    renderWatchlist(state.watchlist);
    renderFavorites();
    syncMobileFavoriteButton();
    syncSelectedFavoriteButton();
    showError(error.message || "Favorite could not update.");
  }
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
      void toggleFavorite(button.dataset.favoriteSymbol);
    });
  });
}

function renderFavorites() {
  const favoritesSection = document.getElementById("favoritesSection");
  if (favoritesSection) {
    favoritesSection.hidden = true;
  }
  const favoriteItems = state.watchlist.filter((item) => isFavoriteSymbol(item.symbol));
  elements.favoritesMeta.textContent = `${favoriteItems.length} saved`;

  if (!favoriteItems.length) {
    elements.favoritesBody.innerHTML = `
      <article class="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
        <p class="text-sm font-semibold text-white">No favorites</p>
        <p class="mt-2 text-sm leading-6 text-slate-400">☆ Star to pin.</p>
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
  const cachedLearningStats = readCachedJson(STORAGE_KEYS.cachedLearningStats);
  state.favoriteSymbols = readFavoriteSymbols();

  if (Array.isArray(cachedWatchlist) && cachedWatchlist.length) {
    state.watchlist = cachedWatchlist;
    elements.watchlistMeta.textContent = `${MAX_SIDEBAR_SLOTS}/${MAX_SIDEBAR_SLOTS} visible`;
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

  if (cachedLearningStats) {
    renderLearningStats(cachedLearningStats);
  }
}

async function loadLearningStats(forceRefresh = false) {
  const cachedLearningStats = readCachedJson(STORAGE_KEYS.cachedLearningStats);
  if (forceRefresh || !cachedLearningStats) {
    renderLearningStatsLoading();
  } else {
    renderLearningStats(cachedLearningStats);
    elements.learningMeta.textContent = "Refreshing";
    elements.learningMeta.className =
      "rounded-full border border-white/10 bg-slate-950/60 px-4 py-2 text-xs font-medium text-slate-400";
  }

  try {
    const response = await api("/api/analysis/performance", {
      timeoutMs: 18000,
      retryCount: 1,
    });
    renderLearningStats(response);
    return response;
  } catch (error) {
    if (cachedLearningStats) {
      renderLearningStats(cachedLearningStats);
      elements.learningMeta.textContent = "Cached";
      elements.learningMeta.className =
        "rounded-full border border-white/10 bg-slate-950/60 px-4 py-2 text-xs font-medium text-slate-400";
      return cachedLearningStats;
    }
    renderLearningStatsError(error.message || "⚠️ Load failed.");
    throw error;
  }
}

function renderStrategyButtons() {
  const activeIndex = Math.max(
    0,
    elements.strategyButtons.findIndex((button) => button.dataset.strategy === state.selectedStrategy),
  );
  if (elements.strategyToggle) {
    elements.strategyToggle.style.setProperty("--strategy-index", String(activeIndex));
  }
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
  hidePaywall();
  elements.appShell.classList.remove("hidden");
  elements.appShell.hidden = false;
  elements.mobileQuickActions?.classList.remove("hidden");
  syncLimitedAccessBanner();
}

function showLoginOverlay() {
  hidePaywall();
  elements.appShell.classList.add("hidden");
  elements.appShell.hidden = true;
  elements.limitedAccessBanner?.classList.add("hidden");
  elements.limitedAccessBanner?.classList.remove("flex");
  if (elements.limitedAccessBanner) {
    elements.limitedAccessBanner.hidden = true;
  }
  elements.authOverlay.classList.remove("hidden");
  elements.authOverlay.hidden = false;
  elements.mobileQuickActions?.classList.add("hidden");
  closePortfolioSheet();
  elements.authError.hidden = true;
  elements.authForm?.reset();
  state.auth.showManagedAuth = false;
  state.auth.showAdminAccess = false;
  renderAuthMode();
  if (state.auth.enabled) {
    setAuthLoading(false);
  }
}

async function api(path, options = {}) {
  const baseUrl = options.baseUrlOverride || resolveApiBaseUrl();
  const url = `${baseUrl}${path}`;
  const timeoutMs = options.timeoutMs ?? 15000;
  const retryCount = options.retryCount ?? 0;
  const retryDelayMs = options.retryDelayMs ?? 1200;
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  const authHeaders =
    !options.skipAuth && String(path || "").startsWith("/api/") && path !== "/api/auth/config"
      ? await (async () => {
          const token = await getAccessToken();
          const adminHeaders = state.auth.adminSession ? { "X-Admin-Session": state.auth.adminSession } : {};
          return token ? { Authorization: `Bearer ${token}`, ...adminHeaders } : adminHeaders;
        })()
      : {};

  const headers = {
    "Content-Type": "application/json",
    ...authHeaders,
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
    if (response.status === 402 && state.auth.enabled && isAuthenticated()) {
      showPaywall("Upgrade to unlock the dashboard.");
    }
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
    user_key: currentUserKey(),
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
    <div class="space-y-2">
      ${Array.from({ length: MAX_SIDEBAR_SLOTS })
        .map(
          () => `
            <div class="animate-pulse rounded-2xl border border-white/10 bg-slate-950/50 px-3 py-3">
              <div class="flex items-center gap-3">
                <div class="h-9 w-9 rounded-2xl bg-white/10"></div>
                <div class="min-w-0 flex-1">
                  <div class="h-3 w-16 rounded bg-white/10"></div>
                  <div class="mt-2 h-3 w-24 rounded bg-white/10"></div>
                </div>
                <div class="h-8 w-8 rounded-2xl bg-white/10"></div>
              </div>
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

function safeWatchlistPrice(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function safeWatchlistChange(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function renderWatchlist(items) {
  const visibleItems = getVisibleWatchlistItems(items);
  elements.watchlistMeta.textContent = `${visibleItems.length}/${MAX_SIDEBAR_SLOTS} visible`;
  elements.watchlistBody.innerHTML = "";

  if (!visibleItems.length) {
    elements.watchlistBody.innerHTML = `
      <div class="rounded-2xl border border-white/10 bg-slate-950/50 px-3 py-4">
        <div class="flex items-center gap-3">
          <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-xs font-bold text-white/90">
            ${String(state.selectedSymbol || "WL").slice(0, 2)}
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-center justify-between gap-3">
              <p class="truncate text-sm font-semibold tracking-tight text-white">${state.selectedSymbol || "Watchlist"}</p>
              <p class="text-xs font-medium text-slate-400">${percent(0)}</p>
            </div>
            <div class="mt-1 flex items-center justify-between gap-3">
              <p class="truncate text-[11px] text-slate-400">Market data syncing</p>
              <p class="text-sm font-semibold text-white">No Data</p>
            </div>
          </div>
        </div>
      </div>
    `;
    renderFavorites();
    return;
  }

  visibleItems.forEach((item) => {
    const changeValue = safeWatchlistChange(item.change_percent);
    const priceValue = safeWatchlistPrice(item.price);
    const stale = Boolean(item.stale);
    const tone = stale
      ? "text-amber-300"
      : changeValue >= 0
        ? "text-emerald-300"
        : "text-rose-300";
    const active = item.symbol === state.selectedSymbol;
    const card = document.createElement("button");
    card.type = "button";
    card.dataset.symbol = item.symbol;
    card.className = [
      "watchlist-slot w-full rounded-2xl border px-3 py-3 text-left transition",
      active
        ? "border-cyan-300/40 bg-cyan-300/10 shadow-lg shadow-cyan-500/10"
        : "border-white/10 bg-slate-950/50 hover:bg-slate-900/90",
    ].join(" ");
    card.innerHTML = `
      <div class="flex items-center gap-3">
        <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-xs font-bold text-white/90">
              ${item.symbol.slice(0, 2)}
        </div>
        <div class="min-w-0 flex-1">
          <div class="flex items-center justify-between gap-3">
            <p class="watchlist-symbol truncate text-sm font-semibold tracking-tight text-white">${item.symbol}</p>
            <p class="watchlist-change text-xs font-medium ${tone}">${percent(changeValue)}</p>
          </div>
            <div class="mt-1 flex items-center justify-between gap-3">
              <p class="watchlist-name truncate text-[11px] text-slate-400">${item.name}</p>
              <div class="flex items-center gap-2">
              ${stale ? '<span class="text-[10px] font-medium text-amber-300" title="Last known price">⚠️</span>' : ""}
              <p class="watchlist-price text-sm font-semibold text-white">${displayMarketPrice(priceValue)}</p>
            </div>
          </div>
        </div>
        <div class="shrink-0">
          ${renderFavoriteButton(item.symbol)}
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
    ["Market Cap", formatMarketCap(overview.market_capitalization)],
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

function normalizeTickerSymbol(value) {
  return String(value || "").trim().toUpperCase();
}

function updateChartCompareUi() {
  const primary = normalizeTickerSymbol(state.selectedSymbol);
  const compare = normalizeTickerSymbol(state.compareSymbol);
  elements.chartSymbolBadge.textContent = compare ? `${primary} VS ${compare}` : `CHART · ${primary}`;
  if (elements.chartCompareInput && document.activeElement !== elements.chartCompareInput) {
    elements.chartCompareInput.value = compare;
  }
  elements.chartCompareClear?.classList.toggle("hidden", !compare);
  if (!elements.chartCompareLegend) {
    return;
  }
  if (!compare) {
    elements.chartCompareLegend.classList.add("hidden");
    elements.chartCompareLegend.innerHTML = "";
    return;
  }
  elements.chartCompareLegend.innerHTML = `
    <span class="chart-compare-note">Normalized to 100%</span>
    <span class="chart-compare-pill">
      <span class="chart-compare-swatch" style="background:#22c55e"></span>
      ${escapeHtml(primary)}
    </span>
    <span class="chart-compare-pill">
      <span class="chart-compare-swatch" style="background:#ef4444"></span>
      ${escapeHtml(compare)}
    </span>
  `;
  elements.chartCompareLegend.classList.remove("hidden");
}

function setCompareSymbol(symbol = "") {
  const normalized = normalizeTickerSymbol(symbol);
  state.compareSymbol = normalized && normalized !== normalizeTickerSymbol(state.selectedSymbol) ? normalized : "";
  if (state.compareSymbol) {
    window.sessionStorage.setItem(STORAGE_KEYS.chartCompareSymbol, state.compareSymbol);
  } else {
    window.sessionStorage.removeItem(STORAGE_KEYS.chartCompareSymbol);
  }
  updateChartCompareUi();
}

async function fetchHistorySeries(symbol, rangeName = "6mo") {
  const history = await api(`/api/stocks/${encodeURIComponent(symbol)}/history?range=${encodeURIComponent(rangeName)}`, {
    timeoutMs: 18000,
    retryCount: 1,
  });
  return Array.isArray(history) ? history : [];
}

function buildNormalizedComparisonSeries(primaryHistory, compareHistory) {
  const primaryMap = new Map(
    primaryHistory
      .filter((point) => Number.isFinite(Number(point?.close)))
      .map((point) => [toIsoDate(point.date), Number(point.close)]),
  );
  const compareMap = new Map(
    compareHistory
      .filter((point) => Number.isFinite(Number(point?.close)))
      .map((point) => [toIsoDate(point.date), Number(point.close)]),
  );
  const sharedDates = [...primaryMap.keys()]
    .filter((date) => compareMap.has(date))
    .sort();

  if (sharedDates.length < 2) {
    return [];
  }

  const primaryStart = primaryMap.get(sharedDates[0]);
  const compareStart = compareMap.get(sharedDates[0]);
  if (!Number.isFinite(primaryStart) || !Number.isFinite(compareStart) || primaryStart <= 0 || compareStart <= 0) {
    return [];
  }

  return sharedDates.map((date) => ({
    date,
    primary: (primaryMap.get(date) / primaryStart) * 100,
    compare: (compareMap.get(date) / compareStart) * 100,
  }));
}

function buildSvgLinePath(points, getY, chartWidth, chartHeight, padding) {
  return points
    .map((point, index) => {
      const x = padding.left + (index / Math.max(points.length - 1, 1)) * chartWidth;
      const y = getY(point);
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function renderComparisonChartMarkup(primarySymbol, compareSymbol, points) {
  const width = 1200;
  const height = 540;
  const padding = { top: 24, right: 80, bottom: 42, left: 56 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const values = points.flatMap((point) => [point.primary, point.compare, 100]);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = maxValue - minValue || 1;
  const paddedMin = minValue - range * 0.12;
  const paddedMax = maxValue + range * 0.12;
  const getY = (value) =>
    padding.top + ((paddedMax - value) / Math.max(paddedMax - paddedMin, 1)) * chartHeight;

  const gridValues = Array.from({ length: 4 }, (_, index) => paddedMin + ((paddedMax - paddedMin) / 3) * index);
  const baselineY = getY(100);
  const primaryPath = buildSvgLinePath(points, (point) => getY(point.primary), chartWidth, chartHeight, padding);
  const comparePath = buildSvgLinePath(points, (point) => getY(point.compare), chartWidth, chartHeight, padding);
  const firstPoint = points[0];
  const middlePoint = points[Math.floor(points.length / 2)];
  const lastPoint = points[points.length - 1];
  const primaryLast = lastPoint.primary;
  const compareLast = lastPoint.compare;

  const endX = padding.left + chartWidth;
  const primaryEndY = getY(primaryLast);
  const compareEndY = getY(compareLast);

  return `
    <div class="comparison-chart-shell">
      <div class="comparison-chart-meta">
        <p class="comparison-chart-title">${escapeHtml(primarySymbol)} vs ${escapeHtml(compareSymbol)}</p>
        <p class="comparison-chart-range">6M normalized performance comparison</p>
      </div>
      <svg class="comparison-chart-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="${escapeHtml(primarySymbol)} and ${escapeHtml(compareSymbol)} comparison chart">
        ${gridValues
          .map((value) => {
            const y = getY(value);
            return `
              <line class="comparison-chart-grid" x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}"></line>
              <text class="comparison-chart-axis" x="${padding.left - 10}" y="${y + 4}" text-anchor="end">${value.toFixed(1)}%</text>
            `;
          })
          .join("")}
        <line class="comparison-chart-baseline" x1="${padding.left}" y1="${baselineY}" x2="${width - padding.right}" y2="${baselineY}"></line>
        <path class="comparison-chart-line-primary" d="${primaryPath}"></path>
        <path class="comparison-chart-line-secondary" d="${comparePath}"></path>
        <text class="comparison-chart-axis" x="${padding.left}" y="${height - 10}" text-anchor="start">${formatChartDateLabel(firstPoint.date)}</text>
        <text class="comparison-chart-axis" x="${padding.left + chartWidth / 2}" y="${height - 10}" text-anchor="middle">${formatChartDateLabel(middlePoint.date)}</text>
        <text class="comparison-chart-axis" x="${padding.left + chartWidth}" y="${height - 10}" text-anchor="end">${formatChartDateLabel(lastPoint.date)}</text>
        <text class="comparison-chart-end-label" x="${endX + 8}" y="${primaryEndY + 4}" text-anchor="start">${escapeHtml(primarySymbol)} ${primaryLast.toFixed(1)}%</text>
        <text class="comparison-chart-end-label" x="${endX + 8}" y="${compareEndY + 4}" text-anchor="start">${escapeHtml(compareSymbol)} ${compareLast.toFixed(1)}%</text>
      </svg>
    </div>
  `;
}

function queueTradingViewRender(symbol, exchange = "") {
  const requestId = ++state.chartRequestId;
  window.clearTimeout(state.chartRenderId);
  state.pendingChart = { symbol, exchange, requestId };
  if (!canRenderTradingViewNow()) {
    showTradingViewLoader(getDeferredChartMessage());
    return;
  }
  const compareKey = state.compareSymbol
    ? `compare:${normalizeTickerSymbol(symbol)}:${normalizeTickerSymbol(state.compareSymbol)}`
    : toTradingViewSymbol(symbol, exchange);
  const hasRenderedChart = Boolean(
    elements.tradingviewChart.querySelector("iframe") ||
      elements.tradingviewChart.querySelector(".comparison-chart-shell"),
  );
  if (!hasRenderedChart || state.tvWidgetSymbol !== compareKey) {
    showTradingViewLoader();
  }
  state.chartRenderId = window.setTimeout(() => {
    if (state.compareSymbol) {
      renderComparisonChart(symbol, state.compareSymbol, requestId);
      return;
    }
    renderTradingView(symbol, exchange, requestId);
  }, 120);
}

function renderOverview(overview) {
  state.latestOverview = overview;
  if (normalizeTickerSymbol(state.compareSymbol) === normalizeTickerSymbol(overview.symbol)) {
    setCompareSymbol("");
  }
  if (isFavoriteSymbol(overview.symbol) || state.watchlist.some((item) => item.symbol === overview.symbol)) {
    upsertWatchlistItem(buildSidebarItemFromOverview(overview));
  }
  elements.selectedSymbolName.textContent = overview.symbol;
  elements.selectedCompanyName.textContent = overview.name;
  elements.metricPrice.textContent = displayMarketPrice(overview.price);
  elements.metricHigh.textContent = displayMarketPrice(overview.high);
  elements.metricLow.textContent = displayMarketPrice(overview.low);
  elements.metricOpen.textContent = displayMarketPrice(overview.open);
  elements.metricPrevClose.textContent = displayMarketPrice(overview.previous_close);

  const hasPrice = isValidMarketPrice(overview.price);
  const positive = Number(overview.change_percent || 0) >= 0;
  elements.changeBadge.textContent = hasPrice
    ? `${overview.stale ? "⚠️ " : ""}${percent(overview.change_percent)}`
    : "No Data";
  elements.changeBadge.className = [
    "inline-flex w-fit rounded-full px-4 py-2 text-sm font-semibold",
    hasPrice
      ? positive
        ? "bg-emerald-500/15 text-emerald-300"
        : "bg-rose-500/15 text-rose-300"
      : "bg-white/5 text-slate-300",
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
  updateChartCompareUi();
  queueTradingViewRender(overview.symbol, overview.exchange);
  syncSelectedFavoriteButton();
  requestAnimationFrame(syncCompanySectionAlignment);
}

function renderOverviewFallback(symbol) {
  elements.selectedSymbolName.textContent = symbol;
  elements.selectedCompanyName.textContent = "Live overview unavailable";
  elements.changeBadge.textContent = "No Data";
  elements.changeBadge.className =
    "inline-flex w-fit rounded-full bg-white/5 px-4 py-2 text-sm font-semibold text-slate-300";
  elements.metricPrice.textContent = "No Data";
  elements.metricHigh.textContent = "No Data";
  elements.metricLow.textContent = "No Data";
  elements.metricOpen.textContent = "No Data";
  elements.metricPrevClose.textContent = "No Data";
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
  updateChartCompareUi();
  queueTradingViewRender(symbol);
  syncSelectedFavoriteButton();
  requestAnimationFrame(syncCompanySectionAlignment);
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

function setChartInteractionEnabled(enabled) {
  state.chartInteractionEnabled = Boolean(enabled);
  if (!elements.tradingviewChartFrame || !elements.chartInteractionGuard) {
    return;
  }
  elements.tradingviewChartFrame.classList.toggle("chart-locked", !enabled);
  elements.tradingviewChartFrame.classList.toggle("chart-interactive", enabled);
  elements.chartInteractionGuard.textContent = enabled
    ? "📈 Chart on"
    : "Tap chart";
}

function syncCompanySectionAlignment() {
  if (!elements.decisionRail || !elements.companySection || !elements.selectedSymbolSection) {
    return;
  }

  if (window.innerWidth < 1280) {
    elements.companySection.style.removeProperty("--company-align-offset");
    return;
  }

  const railTop = elements.decisionRail.getBoundingClientRect().top;
  const selectedTop = elements.selectedSymbolSection.getBoundingClientRect().top;
  const offset = Math.max(0, Math.round(selectedTop - railTop));
  elements.companySection.style.setProperty("--company-align-offset", `${offset}px`);
}

function renderQueuedChart(symbol, exchange, requestId) {
  if (state.compareSymbol) {
    renderComparisonChart(symbol, state.compareSymbol, requestId);
    return;
  }
  renderTradingView(symbol, exchange, requestId);
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
      if (state.pendingChart && canRenderTradingViewNow()) {
        const { symbol, exchange, requestId } = state.pendingChart;
        window.clearTimeout(state.chartRenderId);
        state.chartRenderId = window.setTimeout(() => {
          renderQueuedChart(symbol, exchange, requestId);
        }, 80);
      } else if (state.pendingChart && isMobileViewport()) {
        showTradingViewLoader(getDeferredChartMessage());
      }
    },
    { rootMargin: "48px 0px" },
  );
  state.chartObserver.observe(elements.chartSection);
}

function canRenderTradingViewNow() {
  return !isMobileViewport() || (state.chartInView && state.mobileChartPrimed);
}

function getDeferredChartMessage() {
  if (!isMobileViewport()) {
    return "Loading TradingView chart...";
  }
  if (!state.mobileChartPrimed) {
    return "Scroll to load chart.";
  }
  return "Chart loads when this section comes into view.";
}

function primeMobileChartLazyLoad() {
  if (!isMobileViewport()) {
    state.mobileChartPrimed = true;
    return;
  }
  if (state.mobileChartPrimed || window.scrollY < 24) {
    return;
  }
  state.mobileChartPrimed = true;
  if (state.pendingChart && state.chartInView) {
    const { symbol, exchange, requestId } = state.pendingChart;
    window.clearTimeout(state.chartRenderId);
    state.chartRenderId = window.setTimeout(() => {
      renderQueuedChart(symbol, exchange, requestId);
    }, 80);
  }
}

function handleViewportFeatures() {
  state.chartInView = !isMobileViewport();
  state.mobileChartPrimed = !isMobileViewport() || window.scrollY >= 24;
  setChartInteractionEnabled(false);
  if (isMobileViewport()) {
    initChartObserver();
    if (state.pendingChart) {
      showTradingViewLoader(getDeferredChartMessage());
    }
  } else if (state.pendingChart) {
    const { symbol, exchange, requestId } = state.pendingChart;
    window.clearTimeout(state.chartRenderId);
    state.chartRenderId = window.setTimeout(() => renderQueuedChart(symbol, exchange, requestId), 80);
  }
  syncMobileFavoriteButton();
  renderMobileStrategyCards();
  requestAnimationFrame(syncCompanySectionAlignment);
}

async function renderComparisonChart(symbol, compareSymbol, requestId = state.chartRequestId) {
  const primary = normalizeTickerSymbol(symbol);
  const secondary = normalizeTickerSymbol(compareSymbol);
  const compareKey = `compare:${primary}:${secondary}`;
  const hasRenderedChart = Boolean(elements.tradingviewChart.querySelector(".comparison-chart-shell"));

  if (requestId !== state.chartRequestId) {
    return;
  }

  if (state.tvWidgetSymbol === compareKey && hasRenderedChart) {
    return;
  }

  showTradingViewLoader(`Comparing ${primary} with ${secondary}...`);

  try {
    const [primaryHistory, compareHistory] = await Promise.all([
      fetchHistorySeries(primary, "6mo"),
      fetchHistorySeries(secondary, "6mo"),
    ]);

    if (requestId !== state.chartRequestId) {
      return;
    }

    const points = buildNormalizedComparisonSeries(primaryHistory, compareHistory);
    state.tvWidgetSymbol = compareKey;
    elements.tradingviewChart.innerHTML = points.length
      ? renderComparisonChartMarkup(primary, secondary, points)
      : `<div class="comparison-chart-empty">Comparison data is unavailable right now. Try another symbol or come back in a moment.</div>`;
    if (elements.chartInteractionGuard) {
      elements.chartInteractionGuard.hidden = true;
    }
    elements.tradingviewChartFrame?.classList.remove("chart-locked", "chart-interactive");
    state.chartInteractionEnabled = false;
  } catch (error) {
    if (requestId !== state.chartRequestId) {
      return;
    }
    showTradingViewLoader("Comparison chart failed to load.");
  }
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
        renderQueuedChart(symbol, exchange, requestId);
      }, 1200 * state.chartRetryAttempt);
    }
    return;
  }

  if (requestId !== state.chartRequestId) {
    return;
  }

  state.chartRetryAttempt = 0;
  state.tvWidgetSymbol = tvSymbol;
  if (elements.chartInteractionGuard) {
    elements.chartInteractionGuard.hidden = false;
  }
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
  setChartInteractionEnabled(false);
}

async function loadWatchlist(forceRefresh = false) {
  renderLoadingWatchlist();
  elements.watchlistMeta.textContent = `0/${MAX_SIDEBAR_SLOTS} visible`;
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
  if (normalizeTickerSymbol(state.compareSymbol) === normalized) {
    setCompareSymbol("");
  }
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
  if (state.auth.enabled && isAuthenticated() && !hasActiveSubscription()) {
    showPaywall("Subscribe to access live signals, alerts and watchlists.");
    return;
  }
  clearError();
  updateChartCompareUi();
  if (!forceRefresh) {
    hydrateDashboardFromCache();
  }
  renderAlertsLoading();
  try {
    setBackendStatus("Connecting backend...", "loading");
    loadBackendHealth().catch((error) => {
      console.error("[frontend] health load failed", error);
    });

    const [favoritesResult, watchlistResult, symbolResult] = await Promise.allSettled([
      loadFavoriteSymbolsFromBackend(),
      loadWatchlist(forceRefresh),
      loadSymbol(state.selectedSymbol, forceRefresh),
    ]);

    scheduleLowPriorityTask(() => {
      loadLearningStats(forceRefresh).catch((error) => {
        console.error("[frontend] learning stats load failed", error);
      });
    }, 120);

    scheduleLowPriorityTask(() => {
      loadSubscriptionStatus().catch((error) => {
        console.error("[frontend] subscription status load failed", error);
      });
    }, 140);

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

    scheduleLowPriorityTask(() => {
      loadOpportunities(forceRefresh).catch((error) => {
        console.error("[frontend] opportunity load failed", error);
        renderOpportunityWarning("Retrying opportunities...");
      });
    }, 220);

    if (favoritesResult.status === "rejected") {
      console.error("[frontend] favorite preload failed", favoritesResult.reason);
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
        showError(symbolResult.reason?.message || "Selected symbol could not load yet.");
      }
    }
  } catch (error) {
    showError(error.message || "Dashboard could not load.");
    setBackendStatus("Backend offline", "error");
  }
}

function bindAuth() {
  elements.authGoogleButton?.addEventListener("click", () => {
    void continueWithOAuth("oauth_google");
  });

  elements.authAppleButton?.addEventListener("click", () => {
    void continueWithOAuth("oauth_apple");
  });

  elements.authEmailButton?.addEventListener("click", () => {
    void loginWithManagedProvider("login");
  });

  elements.authAdminToggleButton?.addEventListener("click", () => {
    state.auth.showAdminAccess = !state.auth.showAdminAccess;
    if (state.auth.showAdminAccess) {
      state.auth.showManagedAuth = false;
      setAuthError("");
      renderAuthMode();
      window.setTimeout(() => elements.authPassword?.focus(), 0);
      return;
    }
    renderAuthMode();
  });

  elements.authPassword?.addEventListener("input", () => {
    setAuthError("");
  });

  elements.authForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const result = await api("/api/auth/access-code", {
        method: "POST",
        body: JSON.stringify({ code: elements.authPassword.value.trim() }),
      });
      setAuthError("");
      setAdminSessionToken(result.session_token || "");
      if (result.user) {
        state.auth.currentUser = result.user;
      }
      showAppShell();
      await loadSubscriptionStatus();
      await bootDashboard();
    } catch (error) {
      setAuthError(error.message || "Wrong password");
      elements.authPassword.select();
    }
  });
}

function bindApp() {
  renderStrategyButtons();
  handleViewportFeatures();

  const applyStrategy = async (nextStrategy) => {
    if (!nextStrategy || nextStrategy === state.selectedStrategy) {
      return;
    }
    persistSelectedStrategy(nextStrategy);
    renderStrategyButtons();
    if (state.learningStats) {
      renderLearningStats(state.learningStats);
    }
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
      loadOpportunities(true).catch((error) => {
        console.error("[frontend] opportunity refresh failed", error);
        renderOpportunityWarning("Retrying opportunities...");
      });
      await loadSymbol(state.selectedSymbol, true);
    }
  };

  elements.logoutButton.addEventListener("click", async () => {
    setAdminSessionToken("");
    if (state.auth.enabled && state.auth.client) {
      await state.auth.client.signOut();
      window.location.replace(window.location.pathname);
      return;
    }
    setAuthenticated(false);
    showLoginOverlay();
  });

  elements.subscribeButton?.addEventListener("click", () => {
    void startCheckout();
  });

  elements.limitedAccessUpgradeButton?.addEventListener("click", () => {
    void startCheckout();
  });

  elements.paywallUpgradeButton?.addEventListener("click", () => {
    void startCheckout();
  });

  elements.paywallLogoutButton?.addEventListener("click", async () => {
    setAdminSessionToken("");
    if (state.auth.enabled && state.auth.client) {
      await state.auth.client.signOut();
      window.location.replace(window.location.pathname);
      return;
    }
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
    void toggleFavorite(state.selectedSymbol);
    syncMobileFavoriteButton();
  });

  elements.selectedFavoriteButton?.addEventListener("click", () => {
    void toggleFavorite(state.selectedSymbol);
    syncSelectedFavoriteButton();
  });

  elements.chartInteractionGuard?.addEventListener("click", () => {
    setChartInteractionEnabled(true);
  });

  elements.tradingviewChartFrame?.addEventListener("mouseleave", () => {
    if (state.chartInteractionEnabled) {
      setChartInteractionEnabled(false);
    }
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.chartInteractionEnabled) {
      setChartInteractionEnabled(false);
    }
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
      await applyStrategy(button.dataset.strategy);
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

  elements.chartCompareForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const query = elements.chartCompareInput?.value.trim() || "";
    if (!query) {
      setCompareSymbol("");
      if (state.latestOverview) {
        queueTradingViewRender(state.latestOverview.symbol, state.latestOverview.exchange);
      } else {
        queueTradingViewRender(state.selectedSymbol);
      }
      return;
    }
    try {
      const symbol = await resolveSearchSelection(query);
      if (!symbol) {
        showError(`No stock found for "${query}".`);
        return;
      }
      if (normalizeTickerSymbol(symbol) === normalizeTickerSymbol(state.selectedSymbol)) {
        showError("Choose a different symbol for comparison.");
        return;
      }
      clearError();
      setCompareSymbol(symbol);
      const baseSymbol = state.latestOverview?.symbol || state.selectedSymbol;
      const baseExchange = state.latestOverview?.exchange || "";
      queueTradingViewRender(baseSymbol, baseExchange);
    } catch (error) {
      showError(error.message || "Compare search failed.");
    }
  });

  elements.chartCompareClear?.addEventListener("click", () => {
    clearError();
    setCompareSymbol("");
    const baseSymbol = state.latestOverview?.symbol || state.selectedSymbol;
    const baseExchange = state.latestOverview?.exchange || "";
    queueTradingViewRender(baseSymbol, baseExchange);
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

  window.addEventListener("scroll", () => {
    primeMobileChartLazyLoad();
  }, { passive: true });
}

async function initializeApp() {
  try {
    await initializeManagedAuth();
    await handleBillingRedirectState();
  } catch (error) {
    console.error("[frontend] auth init failed", error);
    state.auth.enabled = false;
    renderAuthMode();
    setAuthError("Login setup failed.");
  } finally {
    setAuthLoading(false);
  }

  bindAuth();
  bindApp();

  if (isAuthenticated()) {
    await loadSubscriptionStatus();
    if (hasActiveSubscription()) {
      showAppShell();
      void bootDashboard();
      return;
    }
    showPaywall("Subscribe to access live signals, alerts and watchlists.");
    return;
  }

  showLoginOverlay();
}

void initializeApp();
