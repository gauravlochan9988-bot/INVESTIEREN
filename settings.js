"use strict";

function readMetaApiOrigin() {
  try {
    const el = document.querySelector('meta[name="investieren-api-origin"]');
    const raw = String(el?.getAttribute("content") || "").trim().replace(/\/$/, "");
    if (raw.startsWith("https://") || raw.startsWith("http://")) {
      return raw;
    }
  } catch (_) {
    // ignore
  }
  return "";
}

const DEPLOYED_API_ORIGIN = readMetaApiOrigin() || "https://investieren-production.up.railway.app";
const LOCAL_API_HOSTS = new Set(["127.0.0.1", "localhost"]);
const LOCAL_API_PORT = "8003";
const SUPABASE_JS_CDN = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js";
const STORAGE_KEYS = {
  selectedStrategy: "investieren:selectedStrategy",
  favoriteSymbols: "investieren:favoriteSymbols",
};
const SETTINGS_KEYS = {
  chartTimeframe: "investieren:settings:chartTimeframe",
  chartStyle: "investieren:settings:chartStyle",
  marketFocus: "investieren:settings:marketFocus",
  marketTimezone: "investieren:settings:marketTimezone",
  favoritesInput: "investieren:settings:favoritesInput",
  favoritesOnlyAlerts: "investieren:settings:favoritesOnlyAlerts",
  alertSensitivity: "investieren:settings:alertSensitivity",
  quietHours: "investieren:settings:quietHours",
  emailAlerts: "investieren:settings:emailAlerts",
  pushAlerts: "investieren:settings:pushAlerts",
  dailyDigest: "investieren:settings:dailyDigest",
  twoStep: "investieren:settings:twoStep",
  autoLogout: "investieren:settings:autoLogout",
  newDeviceNotify: "investieren:settings:newDeviceNotify",
  legalAnalytics: "investieren:settings:legalAnalytics",
  legalPersonalized: "investieren:settings:legalPersonalized",
};

const state = {
  auth: {
    provider: "",
    client: null,
    token: "",
    tokenFetchedAt: 0,
    user: null,
    subscription: null,
    preferences: null,
  },
};

function resolveApiBaseUrl() {
  const protocol = window.location.protocol || "https:";
  const hostname = window.location.hostname || "";
  if (LOCAL_API_HOSTS.has(hostname)) {
    return `${protocol}//${hostname}:${LOCAL_API_PORT}`;
  }
  return DEPLOYED_API_ORIGIN;
}

function showStatus(message, tone = "neutral") {
  const node = document.getElementById("settingsStatusMessage");
  if (!node) {
    return;
  }
  const text = String(message || "").trim();
  if (!text) {
    node.hidden = true;
    node.textContent = "";
    node.style.borderColor = "#d1d5db";
    return;
  }
  node.hidden = false;
  node.textContent = text;
  if (tone === "error") {
    node.style.borderColor = "#fecaca";
  } else if (tone === "success") {
    node.style.borderColor = "#86efac";
  } else {
    node.style.borderColor = "#d1d5db";
  }
}

async function fetchAuthConfig() {
  const endpoint = `${resolveApiBaseUrl()}/api/auth/config`;
  const response = await fetch(endpoint, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  if (response.ok) {
    const payload = await response.json();
    if (payload?.enabled && String(payload.provider || "").toLowerCase() === "supabase") {
      return payload;
    }
  }
  throw new Error("Auth config unavailable.");
}

async function ensureSupabaseLoaded() {
  if (window.supabase?.createClient) {
    return window.supabase;
  }
  const scriptId = "supabase-js-sdk-settings";
  const existing = document.getElementById(scriptId);
  if (existing) {
    await new Promise((resolve, reject) => {
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener("error", () => reject(new Error("Failed to load Supabase SDK.")), {
        once: true,
      });
    });
    return window.supabase;
  }
  const script = document.createElement("script");
  script.id = scriptId;
  script.async = true;
  script.crossOrigin = "anonymous";
  script.src = SUPABASE_JS_CDN;
  document.head.appendChild(script);
  await new Promise((resolve, reject) => {
    script.addEventListener("load", resolve, { once: true });
    script.addEventListener("error", () => reject(new Error("Failed to load Supabase SDK.")), {
      once: true,
    });
  });
  return window.supabase;
}

async function ensureAuthClient() {
  if (state.auth.client) {
    return state.auth.client;
  }
  const config = await fetchAuthConfig();
  if (!config?.enabled) {
    throw new Error("Auth is disabled.");
  }
  state.auth.provider = String(config.provider || "").toLowerCase();
  if (state.auth.provider !== "supabase") {
    throw new Error("Supabase auth is not enabled.");
  }
  const supabase = await ensureSupabaseLoaded();
  const client = supabase.createClient(config.supabase_url, config.supabase_anon_key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" },
  });
  const {
    data: { session },
    error,
  } = await client.auth.getSession();
  if (error || !session) {
    throw new Error("Please login first from your dashboard.");
  }
  state.auth.client = {
    provider: "supabase",
    sdk: client,
    session: {
      getToken: async () => session.access_token || "",
    },
  };
  return state.auth.client;
}

async function getAccessToken(forceRefresh = false) {
  if (!forceRefresh && state.auth.token && Date.now() - state.auth.tokenFetchedAt < 55_000) {
    return state.auth.token;
  }
  const client = await ensureAuthClient();
  let token = "";
  if (client.provider === "supabase") {
    const {
      data: { session },
      error,
    } = await client.sdk.auth.getSession();
    if (error || !session?.access_token) {
      throw new Error("Could not load auth token.");
    }
    token = session.access_token;
  } else {
    token = await client.session?.getToken();
  }
  if (!token) {
    throw new Error("Could not load auth token.");
  }
  state.auth.token = token;
  state.auth.tokenFetchedAt = Date.now();
  return token;
}

async function api(path, options = {}) {
  const token = await getAccessToken(Boolean(options.forceRefreshAuth));
  const response = await fetch(`${resolveApiBaseUrl()}${path}`, {
    method: options.method || "GET",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
    body: options.body,
  });
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await response.json() : await response.text();
  if (!response.ok) {
    const rawDetail = payload?.detail || payload?.error || payload || "Request failed.";
    const detail =
      typeof rawDetail === "object" && rawDetail !== null
        ? String(rawDetail.message || rawDetail.detail || "Request failed.")
        : String(rawDetail);
    throw new Error(detail);
  }
  return payload;
}

function planBadgeClass(plan, role) {
  if (role === "owner") {
    return "plan-chip plan-chip-owner";
  }
  if (plan === "pro") {
    return "plan-chip plan-chip-pro";
  }
  return "plan-chip plan-chip-free";
}

function planBadgeLabel(plan, role) {
  if (role === "owner") {
    return "OWNER PLAN";
  }
  if (plan === "pro") {
    return "PRO PLAN";
  }
  return "FREE PLAN";
}

function formatPriceFromSubscription(subscription) {
  const amount = Number(subscription?.amount_cents || 0);
  const currency = String(subscription?.currency || "eur").toUpperCase();
  const interval = String(subscription?.interval || "month");
  if (!amount) {
    return "EUR 0.00 / month";
  }
  return `${currency} ${(amount / 100).toFixed(2)} / ${interval}`;
}

function normalizeFavoriteSymbols(value) {
  return Array.from(
    new Set(
      String(value || "")
        .split(",")
        .map((item) => item.trim().toUpperCase())
        .filter(Boolean),
    ),
  ).join(", ");
}

function parseStoredFavorites(raw) {
  const value = String(raw || "").trim();
  if (!value) {
    return "";
  }
  if (value.startsWith("[") && value.endsWith("]")) {
    try {
      const list = JSON.parse(value);
      if (Array.isArray(list)) {
        return normalizeFavoriteSymbols(list.join(","));
      }
    } catch {
      return normalizeFavoriteSymbols(value);
    }
  }
  return normalizeFavoriteSymbols(value);
}

function setToggleState(button, value) {
  if (!button) {
    return;
  }
  const isOn = Boolean(value);
  button.classList.toggle("is-on", isOn);
  button.textContent = isOn ? "On" : "Off";
  button.setAttribute("aria-pressed", isOn ? "true" : "false");
}

function toggleButtonState(button) {
  if (!button) {
    return false;
  }
  const next = !button.classList.contains("is-on");
  setToggleState(button, next);
  return next;
}

function readBoolSetting(key, defaultValue) {
  const raw = window.localStorage.getItem(key);
  if (raw == null) {
    return defaultValue;
  }
  return raw === "1";
}

function writeBoolSetting(key, value) {
  window.localStorage.setItem(key, value ? "1" : "0");
}

function applyUserState() {
  const user = state.auth.user || {};
  const subscription = state.auth.subscription || {};
  const badge = document.getElementById("currentPlanBadge");
  if (badge) {
    badge.className = planBadgeClass(user.plan, user.role);
    badge.textContent = planBadgeLabel(user.plan, user.role);
  }

  const displayName = document.getElementById("profileDisplayName");
  const username = document.getElementById("profileUsername");
  const email = document.getElementById("profileEmail");
  if (displayName) {
    displayName.value = user.name || "";
  }
  if (username) {
    username.value = user.name || "";
  }
  if (email) {
    email.value = user.email || "";
  }

  const billingName = document.getElementById("billingName");
  const billingPlanName = document.getElementById("billingPlanName");
  const billingPlanPrice = document.getElementById("billingPlanPrice");
  const billingPlanStatus = document.getElementById("billingPlanStatus");
  const billingPlanRenewal = document.getElementById("billingPlanRenewal");
  const billingContract = document.getElementById("billingContract");
  if (billingName) {
    billingName.textContent = user.name || user.email || "GQ Trading Member";
  }
  if (billingPlanName) {
    billingPlanName.textContent = subscription.plan_name || (user.plan === "pro" ? "Investieren Pro Monthly" : "Free Plan");
  }
  if (billingPlanPrice) {
    billingPlanPrice.textContent = formatPriceFromSubscription(subscription);
  }
  if (billingPlanStatus) {
    billingPlanStatus.textContent = subscription.status || (user.plan === "pro" ? "active" : "inactive");
  }
  if (billingPlanRenewal) {
    billingPlanRenewal.textContent = subscription.active ? "Auto renewal active" : "Not scheduled";
  }
  if (billingContract) {
    billingContract.textContent = user.plan === "pro" ? "Monthly, cancellable anytime" : "Free tier contract";
  }
}

function applyStoredPreferencesFallback() {
  const selectedStrategy =
    window.sessionStorage.getItem(STORAGE_KEYS.selectedStrategy) || "simple";
  const strategyRadio = document.querySelector(`input[name="strategy"][value="${selectedStrategy}"]`);
  if (strategyRadio) {
    strategyRadio.checked = true;
  }

  const timeframe = document.getElementById("tradingTimeframe");
  const chartStyle = document.getElementById("tradingChartStyle");
  const marketFocus = document.getElementById("tradingMarketFocus");
  const marketTimezone = document.getElementById("tradingMarketTimezone");
  const sensitivity = document.getElementById("notificationsSensitivity");
  const quietHours = document.getElementById("notificationsQuietHours");
  const favoritesInput = document.getElementById("tradingFavoritesInput");

  if (timeframe) {
    timeframe.value = window.localStorage.getItem(SETTINGS_KEYS.chartTimeframe) || timeframe.value;
  }
  if (chartStyle) {
    chartStyle.value = window.localStorage.getItem(SETTINGS_KEYS.chartStyle) || chartStyle.value;
  }
  if (marketFocus) {
    marketFocus.value = window.localStorage.getItem(SETTINGS_KEYS.marketFocus) || marketFocus.value;
  }
  if (marketTimezone) {
    marketTimezone.value = window.localStorage.getItem(SETTINGS_KEYS.marketTimezone) || marketTimezone.value;
  }
  if (sensitivity) {
    sensitivity.value = window.localStorage.getItem(SETTINGS_KEYS.alertSensitivity) || sensitivity.value;
  }
  if (quietHours) {
    quietHours.value = window.localStorage.getItem(SETTINGS_KEYS.quietHours) || "";
  }

  const existingFavorites =
    window.localStorage.getItem(SETTINGS_KEYS.favoritesInput) ||
    parseStoredFavorites(window.localStorage.getItem(STORAGE_KEYS.favoriteSymbols) || "");
  if (favoritesInput) {
    favoritesInput.value = existingFavorites;
  }

  setToggleState(document.getElementById("notificationsEmailToggle"), readBoolSetting(SETTINGS_KEYS.emailAlerts, true));
  setToggleState(document.getElementById("notificationsPushToggle"), readBoolSetting(SETTINGS_KEYS.pushAlerts, true));
  setToggleState(document.getElementById("notificationsDigestToggle"), readBoolSetting(SETTINGS_KEYS.dailyDigest, false));
  setToggleState(document.getElementById("securityTwoStepToggle"), readBoolSetting(SETTINGS_KEYS.twoStep, true));
  setToggleState(document.getElementById("securityAutoLogoutToggle"), readBoolSetting(SETTINGS_KEYS.autoLogout, true));
  setToggleState(document.getElementById("securityNewDeviceToggle"), readBoolSetting(SETTINGS_KEYS.newDeviceNotify, true));
  setToggleState(document.getElementById("tradingFavoritesOnlyToggle"), readBoolSetting(SETTINGS_KEYS.favoritesOnlyAlerts, false));
  setToggleState(document.getElementById("legalAnalyticsToggle"), readBoolSetting(SETTINGS_KEYS.legalAnalytics, true));
  setToggleState(document.getElementById("legalPersonalizedToggle"), readBoolSetting(SETTINGS_KEYS.legalPersonalized, true));
}

function applyRemotePreferences(preferences) {
  const data = preferences || {};
  state.auth.preferences = data;
  const selectedStrategy = String(data.default_strategy || "simple").toLowerCase();
  const strategyRadio = document.querySelector(`input[name="strategy"][value="${selectedStrategy}"]`);
  if (strategyRadio) {
    strategyRadio.checked = true;
  }

  const profileLanguage = document.getElementById("profileLanguage");
  const timeframe = document.getElementById("tradingTimeframe");
  const chartStyle = document.getElementById("tradingChartStyle");
  const marketFocus = document.getElementById("tradingMarketFocus");
  const marketTimezone = document.getElementById("tradingMarketTimezone");
  const sensitivity = document.getElementById("notificationsSensitivity");
  const quietHours = document.getElementById("notificationsQuietHours");
  const favoritesInput = document.getElementById("tradingFavoritesInput");

  if (profileLanguage && data.profile_language) {
    profileLanguage.value = data.profile_language;
  }
  if (timeframe && data.chart_timeframe) {
    timeframe.value = data.chart_timeframe;
  }
  if (chartStyle && data.chart_style) {
    chartStyle.value = data.chart_style;
  }
  if (marketFocus && data.market_focus) {
    marketFocus.value = data.market_focus;
  }
  if (marketTimezone && data.market_timezone) {
    marketTimezone.value = data.market_timezone;
  }
  if (sensitivity && data.alert_sensitivity) {
    sensitivity.value = data.alert_sensitivity;
  }
  if (quietHours) {
    quietHours.value = data.quiet_hours || "";
  }
  if (favoritesInput) {
    favoritesInput.value = normalizeFavoriteSymbols((data.favorite_symbols || []).join(", "));
  }

  setToggleState(document.getElementById("notificationsEmailToggle"), Boolean(data.email_alerts));
  setToggleState(document.getElementById("notificationsPushToggle"), Boolean(data.push_alerts));
  setToggleState(document.getElementById("notificationsDigestToggle"), Boolean(data.daily_digest));
  setToggleState(document.getElementById("securityTwoStepToggle"), Boolean(data.two_step_required));
  setToggleState(document.getElementById("securityAutoLogoutToggle"), Boolean(data.auto_logout_enabled));
  setToggleState(document.getElementById("securityNewDeviceToggle"), Boolean(data.new_device_notify));
  setToggleState(
    document.getElementById("tradingFavoritesOnlyToggle"),
    Boolean(data.favorites_only_alerts),
  );
  setToggleState(document.getElementById("legalAnalyticsToggle"), Boolean(data.legal_analytics));
  setToggleState(document.getElementById("legalPersonalizedToggle"), Boolean(data.legal_personalized));
}

async function loadRemoteState() {
  const user = await api("/api/auth/me", { forceRefreshAuth: true });
  state.auth.user = user;
  try {
    state.auth.subscription = await api("/api/billing/subscription");
  } catch {
    state.auth.subscription = null;
  }
  try {
    const preferences = await api("/api/settings/me");
    applyRemotePreferences(preferences);
  } catch {
    state.auth.preferences = null;
  }
  applyUserState();
}

async function saveProfile() {
  const displayName = String(document.getElementById("profileDisplayName")?.value || "").trim();
  if (displayName.length < 3) {
    throw new Error("Display name must have at least 3 characters.");
  }
  const updated = await api("/api/auth/me", {
    method: "PATCH",
    body: JSON.stringify({ name: displayName }),
  });
  state.auth.user = updated;
}

function collectPreferencePayload() {
  const selectedStrategy = String(
    document.querySelector('input[name="strategy"]:checked')?.value || "simple",
  ).toLowerCase();
  const currentPlan = String(state.auth.user?.plan || "free").toLowerCase();
  const currentRole = String(state.auth.user?.role || "user").toLowerCase();
  const canUsePremium = currentPlan === "pro" || currentRole === "owner";
  const finalStrategy =
    !canUsePremium && (selectedStrategy === "ai" || selectedStrategy === "hedgefund")
      ? "simple"
      : selectedStrategy;
  const profileLanguage = document.getElementById("profileLanguage")?.value || "English";
  const chartTimeframe = document.getElementById("tradingTimeframe")?.value || "1D";
  const chartStyle = document.getElementById("tradingChartStyle")?.value || "Candles";
  const marketFocus = document.getElementById("tradingMarketFocus")?.value || "US + Europe";
  const marketTimezone = document.getElementById("tradingMarketTimezone")?.value || "Europe/Berlin";
  const sensitivity = document.getElementById("notificationsSensitivity")?.value || "Balanced";
  const quietHours = document.getElementById("notificationsQuietHours")?.value || "";
  const favoritesInput = normalizeFavoriteSymbols(
    document.getElementById("tradingFavoritesInput")?.value || "",
  );
  const favoriteSymbols = favoritesInput
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  const payload = {
    profile_language: profileLanguage,
    default_strategy: finalStrategy,
    chart_timeframe: chartTimeframe,
    chart_style: chartStyle,
    market_focus: marketFocus,
    market_timezone: marketTimezone,
    favorite_symbols: favoriteSymbols,
    favorites_only_alerts: document.getElementById("tradingFavoritesOnlyToggle")?.classList.contains("is-on"),
    alert_sensitivity: sensitivity,
    quiet_hours: quietHours,
    email_alerts: document.getElementById("notificationsEmailToggle")?.classList.contains("is-on"),
    push_alerts: document.getElementById("notificationsPushToggle")?.classList.contains("is-on"),
    daily_digest: document.getElementById("notificationsDigestToggle")?.classList.contains("is-on"),
    two_step_required: document.getElementById("securityTwoStepToggle")?.classList.contains("is-on"),
    auto_logout_enabled: document.getElementById("securityAutoLogoutToggle")?.classList.contains("is-on"),
    new_device_notify: document.getElementById("securityNewDeviceToggle")?.classList.contains("is-on"),
    legal_analytics: document.getElementById("legalAnalyticsToggle")?.classList.contains("is-on"),
    legal_personalized: document.getElementById("legalPersonalizedToggle")?.classList.contains("is-on"),
  };
  return { payload, selectedStrategy, finalStrategy, favoritesInput, favoriteSymbols };
}

function persistLocalCompatibility(preferenceSnapshot) {
  const { payload, finalStrategy, favoritesInput, favoriteSymbols } = preferenceSnapshot;
  window.sessionStorage.setItem(STORAGE_KEYS.selectedStrategy, finalStrategy);

  window.localStorage.setItem(SETTINGS_KEYS.chartTimeframe, payload.chart_timeframe);
  window.localStorage.setItem(SETTINGS_KEYS.chartStyle, payload.chart_style);
  window.localStorage.setItem(SETTINGS_KEYS.marketFocus, payload.market_focus);
  window.localStorage.setItem(SETTINGS_KEYS.marketTimezone, payload.market_timezone);
  window.localStorage.setItem(SETTINGS_KEYS.alertSensitivity, payload.alert_sensitivity);
  window.localStorage.setItem(SETTINGS_KEYS.quietHours, payload.quiet_hours);
  window.localStorage.setItem(SETTINGS_KEYS.favoritesInput, favoritesInput);
  window.localStorage.setItem(STORAGE_KEYS.favoriteSymbols, JSON.stringify(favoriteSymbols));

  writeBoolSetting(SETTINGS_KEYS.emailAlerts, payload.email_alerts);
  writeBoolSetting(SETTINGS_KEYS.pushAlerts, payload.push_alerts);
  writeBoolSetting(SETTINGS_KEYS.dailyDigest, payload.daily_digest);
  writeBoolSetting(SETTINGS_KEYS.twoStep, payload.two_step_required);
  writeBoolSetting(SETTINGS_KEYS.autoLogout, payload.auto_logout_enabled);
  writeBoolSetting(SETTINGS_KEYS.newDeviceNotify, payload.new_device_notify);
  writeBoolSetting(SETTINGS_KEYS.favoritesOnlyAlerts, payload.favorites_only_alerts);
  writeBoolSetting(SETTINGS_KEYS.legalAnalytics, payload.legal_analytics);
  writeBoolSetting(SETTINGS_KEYS.legalPersonalized, payload.legal_personalized);
}

async function savePreferences() {
  const snapshot = collectPreferencePayload();
  const saved = await api("/api/settings/me", {
    method: "PATCH",
    body: JSON.stringify(snapshot.payload),
  });
  applyRemotePreferences(saved);
  persistLocalCompatibility({
    ...snapshot,
    payload: {
      ...snapshot.payload,
      default_strategy: saved.default_strategy || snapshot.payload.default_strategy,
    },
    finalStrategy: saved.default_strategy || snapshot.finalStrategy,
    favoritesInput: normalizeFavoriteSymbols((saved.favorite_symbols || []).join(", ")),
    favoriteSymbols: saved.favorite_symbols || snapshot.favoriteSymbols,
  });
  if (snapshot.finalStrategy !== snapshot.selectedStrategy) {
    showStatus("Free plan detected. Default strategy was reset to Simple.", "neutral");
  }
}

function bindToggle(buttonId) {
  const button = document.getElementById(buttonId);
  if (!button) {
    return;
  }
  button.addEventListener("click", () => {
    toggleButtonState(button);
  });
}

function bindActions() {
  const saveButton = document.getElementById("saveSettingsButton");
  saveButton?.addEventListener("click", async () => {
    try {
      showStatus("Saving settings...");
      saveButton.disabled = true;
      await saveProfile();
      await savePreferences();
      applyUserState();
      showStatus("Settings saved successfully.", "success");
    } catch (error) {
      showStatus(error?.message || "Could not save settings.", "error");
    } finally {
      saveButton.disabled = false;
    }
  });

  const managePlanButton = document.getElementById("managePlanButton");
  managePlanButton?.addEventListener("click", async () => {
    try {
      showStatus("Opening checkout session...");
      const checkout = await api("/api/billing/checkout", {
        method: "POST",
        body: JSON.stringify({}),
      });
      if (!checkout?.url) {
        throw new Error("Billing portal is unavailable right now.");
      }
      window.location.href = checkout.url;
    } catch (error) {
      showStatus(error?.message || "Could not open billing checkout.", "error");
    }
  });

  const cancelSubscriptionButton = document.getElementById("cancelSubscriptionButton");
  cancelSubscriptionButton?.addEventListener("click", () => {
    showStatus(
      "Automatic cancel endpoint is not enabled yet. Use Manage plan or support to cancel immediately.",
      "neutral",
    );
  });

  const deleteAccountButton = document.getElementById("deleteAccountButton");
  deleteAccountButton?.addEventListener("click", () => {
    showStatus(
      "Delete account is protected. Contact support to complete verified account deletion.",
      "neutral",
    );
  });

  [
    "notificationsEmailToggle",
    "notificationsPushToggle",
    "notificationsDigestToggle",
    "securityTwoStepToggle",
    "securityAutoLogoutToggle",
    "securityNewDeviceToggle",
    "tradingFavoritesOnlyToggle",
    "legalAnalyticsToggle",
    "legalPersonalizedToggle",
  ].forEach(bindToggle);
}

function setActiveSectionNav() {
  const sections = Array.from(document.querySelectorAll(".settings-section"));
  const navItems = Array.from(document.querySelectorAll("[data-settings-nav]"));
  if (!sections.length || !navItems.length) {
    return;
  }

  const byId = new Map(
    navItems
      .map((item) => {
        const href = String(item.getAttribute("href") || "");
        const id = href.startsWith("#") ? href.slice(1) : "";
        return [id, item];
      })
      .filter(([id]) => id),
  );

  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

      if (!visible || !visible.target?.id) {
        return;
      }

      navItems.forEach((item) => item.classList.remove("is-active"));
      byId.get(visible.target.id)?.classList.add("is-active");
    },
    {
      root: null,
      rootMargin: "-20% 0px -60% 0px",
      threshold: [0.15, 0.35, 0.6],
    },
  );

  sections.forEach((section) => observer.observe(section));
  const first = navItems[0];
  first?.classList.add("is-active");
}

function bindMobileSectionJump() {
  const select = document.getElementById("settingsSectionSelect");
  if (!select) {
    return;
  }
  select.addEventListener("change", () => {
    const sectionId = String(select.value || "").trim();
    if (!sectionId) {
      return;
    }
    const section = document.getElementById(sectionId);
    if (!section) {
      return;
    }
    section.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function bootstrapSettingsPage() {
  setActiveSectionNav();
  bindMobileSectionJump();
  bindActions();
  applyStoredPreferencesFallback();
  void (async () => {
    try {
      await loadRemoteState();
      showStatus("Account data synced.", "success");
    } catch (error) {
      showStatus(error?.message || "Login required. Please sign in from dashboard first.", "error");
    }
  })();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrapSettingsPage, { once: true });
} else {
  bootstrapSettingsPage();
}
