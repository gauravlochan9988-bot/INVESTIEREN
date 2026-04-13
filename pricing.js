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
const STRIPE_PAYMENT_LINK_URL = "https://buy.stripe.com/00w9AS43G9V73c1aa08Zq00";
const RISK_DISCLAIMER_STORAGE_KEY = "investieren:riskDisclaimerAccepted:v1";
const LOCAL_API_HOSTS = new Set(["127.0.0.1", "localhost"]);
const SUPABASE_JS_CDN = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js";
let riskDisclaimerResolver = null;
let riskDisclaimerScrolledToEnd = false;

function hasAcceptedRiskDisclaimer() {
  try {
    return window.localStorage.getItem(RISK_DISCLAIMER_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function setRiskDisclaimerAccepted(value) {
  try {
    if (value) {
      window.localStorage.setItem(RISK_DISCLAIMER_STORAGE_KEY, "1");
      return;
    }
    window.localStorage.removeItem(RISK_DISCLAIMER_STORAGE_KEY);
  } catch {
    // ignore
  }
}

function syncRiskDisclaimerAcceptState() {
  const checkbox = document.getElementById("riskDisclaimerCheckbox");
  const acceptButton = document.getElementById("riskDisclaimerAcceptButton");
  if (!acceptButton) {
    return;
  }
  acceptButton.disabled = !(checkbox?.checked && riskDisclaimerScrolledToEnd);
}

function hasScrolledToBottom(node) {
  if (!node) {
    return false;
  }
  return node.scrollTop + node.clientHeight >= node.scrollHeight - 2;
}

function syncRiskDisclaimerScrollState() {
  const scrollBox = document.getElementById("riskDisclaimerScrollBox");
  riskDisclaimerScrolledToEnd = hasScrolledToBottom(scrollBox);
  syncRiskDisclaimerAcceptState();
}

function showRiskDisclaimerModal() {
  const overlay = document.getElementById("riskDisclaimerOverlay");
  const checkbox = document.getElementById("riskDisclaimerCheckbox");
  const scrollBox = document.getElementById("riskDisclaimerScrollBox");
  if (!overlay) {
    return;
  }
  if (checkbox) {
    checkbox.checked = false;
  }
  if (scrollBox) {
    scrollBox.scrollTop = 0;
  }
  riskDisclaimerScrolledToEnd = false;
  window.requestAnimationFrame(() => {
    syncRiskDisclaimerScrollState();
  });
  syncRiskDisclaimerAcceptState();
  overlay.classList.remove("hidden");
  overlay.hidden = false;
}

function hideRiskDisclaimerModal() {
  const overlay = document.getElementById("riskDisclaimerOverlay");
  if (!overlay) {
    return;
  }
  overlay.classList.add("hidden");
  overlay.hidden = true;
}

async function ensureRiskDisclaimerAccepted() {
  if (hasAcceptedRiskDisclaimer()) {
    return true;
  }
  const overlay = document.getElementById("riskDisclaimerOverlay");
  if (!overlay) {
    return true;
  }
  showRiskDisclaimerModal();
  return new Promise((resolve) => {
    riskDisclaimerResolver = resolve;
  });
}

function resolveApiBaseUrl() {
  if (LOCAL_API_HOSTS.has(window.location.hostname)) {
    return `${window.location.protocol}//${window.location.host}`;
  }
  return DEPLOYED_API_ORIGIN;
}

async function pricingApi(path, options = {}) {
  const response = await fetch(`${resolveApiBaseUrl()}${path}`, {
    headers: {
      Accept: "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const payload = await response.json();
      const rawDetail = payload?.detail || payload?.error || message;
      message =
        typeof rawDetail === "object" && rawDetail !== null
          ? String(rawDetail.message || rawDetail.detail || message)
          : String(rawDetail);
    } catch {
      // ignore json parse errors
    }
    throw new Error(message);
  }

  return response.json();
}

async function ensureSupabaseFrontendLoaded() {
  if (window.supabase?.createClient) {
    return window.supabase;
  }
  const scriptId = "supabase-js-sdk-pricing";
  const existing = document.getElementById(scriptId);
  if (existing) {
    await new Promise((resolve, reject) => {
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Supabase failed to load.")),
        { once: true },
      );
    });
    return window.supabase;
  }
  const script = document.createElement("script");
  script.id = scriptId;
  script.async = true;
  script.crossOrigin = "anonymous";
  script.src = SUPABASE_JS_CDN;
  await new Promise((resolve, reject) => {
    script.addEventListener("load", resolve, { once: true });
    script.addEventListener("error", () => reject(new Error("Supabase failed to load.")), { once: true });
    document.head.appendChild(script);
  });
  return window.supabase;
}

async function initializePricing() {
  const button = document.getElementById("pricingCheckoutButton");
  const status = document.getElementById("pricingStatus");
  const emailWrap = document.getElementById("pricingEmailWrap");
  const emailInput = document.getElementById("pricingCheckoutEmail");
  let authToken = "";
  const riskCheckbox = document.getElementById("riskDisclaimerCheckbox");
  const riskAcceptButton = document.getElementById("riskDisclaimerAcceptButton");
  const riskScrollBox = document.getElementById("riskDisclaimerScrollBox");

  riskScrollBox?.addEventListener("scroll", () => {
    syncRiskDisclaimerScrollState();
  });

  riskCheckbox?.addEventListener("change", () => {
    syncRiskDisclaimerAcceptState();
  });

  riskAcceptButton?.addEventListener("click", () => {
    if (!riskCheckbox?.checked) {
      syncRiskDisclaimerAcceptState();
      return;
    }
    setRiskDisclaimerAccepted(true);
    hideRiskDisclaimerModal();
    const resolver = riskDisclaimerResolver;
    riskDisclaimerResolver = null;
    resolver?.(true);
  });

  try {
    try {
      const config = await pricingApi("/api/auth/config");
      if (config?.enabled && config.provider === "supabase") {
        const supabase = await ensureSupabaseFrontendLoaded();
        const client = supabase.createClient(config.supabase_url, config.supabase_anon_key, {
          auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" },
        });
        const {
          data: { session },
          error,
        } = await client.auth.getSession();
        if (!error && session?.access_token) {
          authToken = session.access_token;
        }
      }
    } catch (authError) {
      console.warn("[pricing] auth init skipped", authError);
    }

    const isAuthenticated = Boolean(authToken);
    if (emailWrap) {
      emailWrap.hidden = true;
    }

    button?.addEventListener("click", async () => {
      const acceptedRisk = await ensureRiskDisclaimerAccepted();
      if (!acceptedRisk) {
        return;
      }
      const url = String(STRIPE_PAYMENT_LINK_URL || "").trim();
      if (!url) {
        status.textContent = "Checkout is unavailable.";
        return;
      }
      button.disabled = true;
      status.textContent = "Redirecting to Stripe Checkout…";
      window.location.assign(url);
    });

    status.textContent = isAuthenticated
      ? "You are upgrading the currently signed-in account."
      : "Please sign in first to start a safe account-linked upgrade.";
  } catch (error) {
    console.error("[pricing] init failed", error);
    status.textContent = error.message || "Pricing is unavailable.";
  }
}

void initializePricing();
