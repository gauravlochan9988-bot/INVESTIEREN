const DEPLOYED_API_ORIGIN = "https://investieren-production.up.railway.app";
const LOCAL_API_HOSTS = new Set(["127.0.0.1", "localhost"]);
const SUPABASE_JS_CDN = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js";

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
      emailWrap.hidden = isAuthenticated;
    }

    button?.addEventListener("click", async () => {
      try {
        button.disabled = true;
        status.textContent = "Redirecting to Stripe Checkout…";
        let session = null;
        if (isAuthenticated) {
          session = await pricingApi("/api/billing/checkout", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${authToken}`,
            },
            body: JSON.stringify({}),
          });
        } else {
          const email = String(emailInput?.value || "").trim().toLowerCase();
          if (!email || !email.includes("@")) {
            throw new Error("Please enter a valid email to continue checkout.");
          }
          session = await pricingApi("/api/billing/checkout-public", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ email }),
          });
        }
        if (!session?.url) {
          throw new Error("Checkout is unavailable.");
        }
        window.location.href = session.url;
      } catch (error) {
        button.disabled = false;
        status.textContent = error.message || "Checkout failed.";
      }
    });

    status.textContent = isAuthenticated
      ? "Secure payment via Stripe Checkout."
      : "Checkout works without login. Use the same email when creating your account.";
  } catch (error) {
    console.error("[pricing] init failed", error);
    status.textContent = error.message || "Pricing is unavailable.";
  }
}

void initializePricing();
