const DEPLOYED_API_ORIGIN = "https://investieren-production.up.railway.app";
const LOCAL_API_HOSTS = new Set(["127.0.0.1", "localhost"]);
const LOCAL_API_PORT = "8003";
const AUTHENTICATED_STORAGE_KEY = "investieren:authenticated";

const statusNode = document.getElementById("callbackStatus");
const errorNode = document.getElementById("callbackError");

function setStatus(message) {
  if (statusNode) {
    statusNode.textContent = message;
  }
}

function setError(message) {
  if (errorNode) {
    errorNode.textContent = message;
    errorNode.hidden = false;
  }
}

function formatAuthCallbackError(error) {
  const rawMessage =
    String(error?.errors?.[0]?.longMessage || error?.errors?.[0]?.message || error?.message || "").trim() ||
    "Login callback failed.";
  const lower = rawMessage.toLowerCase();
  if (lower.includes("captcha")) {
    return "CAPTCHA could not load. Disable blockers/extensions and retry.";
  }
  return rawMessage;
}

function resolveApiBaseUrl() {
  const protocol = window.location.protocol || "https:";
  const hostname = window.location.hostname || "";
  if (LOCAL_API_HOSTS.has(hostname)) {
    return `${protocol}//${hostname}:${LOCAL_API_PORT}`;
  }
  return DEPLOYED_API_ORIGIN;
}

function resolveReturnUrl() {
  const fallback = `${window.location.origin}/`;
  const raw = new URLSearchParams(window.location.search).get("return_to");
  if (!raw) {
    return fallback;
  }
  try {
    const candidate = new URL(raw, window.location.origin);
    if (candidate.origin !== window.location.origin) {
      return fallback;
    }
    return candidate.toString();
  } catch {
    return fallback;
  }
}

async function loadAuthConfig() {
  const response = await fetch(`${resolveApiBaseUrl()}/api/auth/config`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error("Auth config request failed.");
  }
  const payload = await response.json();
  if (!payload?.enabled || payload?.provider !== "clerk") {
    throw new Error("Clerk auth is not enabled.");
  }
  if (!payload.publishable_key || !payload.frontend_api_url) {
    throw new Error("Missing Clerk frontend config.");
  }
  return payload;
}

async function ensureClerkLoaded(config) {
  if (window.Clerk) {
    return window.Clerk;
  }
  const script = document.createElement("script");
  script.async = true;
  script.crossOrigin = "anonymous";
  script.dataset.clerkPublishableKey = config.publishable_key;
  script.src = `${String(config.frontend_api_url).replace(/\/+$/, "")}/npm/@clerk/clerk-js@5/dist/clerk.browser.js`;
  document.head.appendChild(script);
  await new Promise((resolve, reject) => {
    script.addEventListener("load", resolve, { once: true });
    script.addEventListener("error", () => reject(new Error("Failed to load Clerk frontend SDK.")), {
      once: true,
    });
  });
  return window.Clerk;
}

async function finalizeAuthSession(clerk, returnTo) {
  if (typeof clerk.handleRedirectCallback === "function") {
    const result = await clerk.handleRedirectCallback({
      signInForceRedirectUrl: returnTo,
      signUpForceRedirectUrl: returnTo,
    });
    const sessionId =
      result?.createdSessionId || result?.sessionId || result?.session?.id || "";
    if (sessionId && typeof clerk.setActive === "function") {
      await clerk.setActive({ session: sessionId });
    }
  }

  if (!clerk.session) {
    throw new Error("No active Clerk session after callback.");
  }
  const token = await clerk.session.getToken();
  if (!token) {
    throw new Error("Missing session token after callback.");
  }
  await fetch(`${resolveApiBaseUrl()}/api/auth/me`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  }).then(async (response) => {
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || "Failed to load auth user.");
    }
    return response.json();
  });

  window.localStorage.setItem(AUTHENTICATED_STORAGE_KEY, "1");
}

async function bootstrapCallback() {
  const returnTo = resolveReturnUrl();
  try {
    setStatus("Loading secure session...");
    const config = await loadAuthConfig();
    const clerk = await ensureClerkLoaded(config);
    await clerk.load();
    setStatus("Finalizing sign in...");
    await finalizeAuthSession(clerk, returnTo);
    setStatus("Redirecting...");
    window.location.replace(returnTo);
  } catch (error) {
    const debug = {
      message: error?.message || null,
      clerkErrors: error?.errors || null,
      name: error?.name || null,
      stack: error?.stack || null,
    };
    console.error("[frontend] auth callback failed", debug);
    window.localStorage.removeItem(AUTHENTICATED_STORAGE_KEY);
    setError(formatAuthCallbackError(error));
  }
}

void bootstrapCallback();
