const DEPLOYED_API_ORIGIN = "https://investieren-production.up.railway.app";
const LOCAL_API_HOSTS = new Set(["127.0.0.1", "localhost"]);

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
      message = payload?.detail || payload?.error || message;
    } catch {
      // ignore json parse errors
    }
    throw new Error(message);
  }

  return response.json();
}

async function ensureClerkFrontendLoaded(config) {
  if (window.Clerk) {
    return window.Clerk;
  }

  const scriptId = "clerk-js-sdk";
  const existing = document.getElementById(scriptId);
  if (existing) {
    await new Promise((resolve, reject) => {
      existing.addEventListener("load", resolve, { once: true });
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
    script.addEventListener("load", resolve, { once: true });
    script.addEventListener("error", () => reject(new Error("Clerk failed to load.")), { once: true });
    document.head.appendChild(script);
  });

  return window.Clerk;
}

async function syncSubscription(clerk, config) {
  const token = await clerk.session?.getToken();
  const active = Boolean(await clerk.session?.checkAuthorization?.({ plan: config.plan_slug || "pro" }));

  await pricingApi("/api/billing/sync", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      active,
      status: active ? "active" : "inactive",
      plan_name: config.plan_name || "Investieren Pro Monthly",
      amount_cents: Number(config.plan_amount_cents || 999),
      currency: config.plan_currency || "usd",
      interval: config.plan_interval || "month",
    }),
  });
}

async function initializePricing() {
  const mount = document.getElementById("pricingClerkMount");
  const status = document.getElementById("pricingStatus");

  try {
    const config = await pricingApi("/api/auth/config");
    if (!config?.enabled || config.provider !== "clerk") {
      throw new Error("Clerk auth is not configured.");
    }

    const clerk = await ensureClerkFrontendLoaded(config);
    await clerk.load();

    if (!clerk.user || !clerk.session) {
      window.location.replace("/");
      return;
    }

    clerk.mountPricingTable(mount, {
      for: "user",
      newSubscriptionRedirectUrl: `${window.location.origin}/?pricing=success`,
    });

    await syncSubscription(clerk, config);
    status.textContent = "Choose your plan in Clerk Billing.";
  } catch (error) {
    console.error("[pricing] init failed", error);
    status.textContent = error.message || "Pricing is unavailable.";
  }
}

void initializePricing();
