const CALLBACK_ERROR = document.getElementById("callbackError");

const AUTH_CONFIG_ENDPOINT = "/api/auth/config";
const AUTH_ME_ENDPOINT = "/api/auth/me";
const AUTHENTICATED_KEY = "investieren:authenticated";

function setError(message) {
  if (!CALLBACK_ERROR) {
    return;
  }
  CALLBACK_ERROR.textContent = message;
  CALLBACK_ERROR.hidden = false;
}

function readPublishableKeyFromDom() {
  const meta = document.querySelector('meta[name="clerk-publishable-key"]');
  return meta?.getAttribute("content") || "";
}

function deriveFrontendApiUrl(publishableKey) {
  if (!publishableKey || !publishableKey.startsWith("pk_")) {
    return "";
  }
  const parts = publishableKey.split("_");
  const domain = parts.slice(2).join("_");
  if (!domain) {
    return "";
  }
  return `https://${domain}.clerk.accounts.dev`;
}

async function fetchAuthConfig() {
  try {
    const response = await fetch(AUTH_CONFIG_ENDPOINT);
    if (!response.ok) {
      throw new Error("Auth config unavailable");
    }
    return await response.json();
  } catch {
    return {};
  }
}

async function ensureClerkLoaded(config) {
  if (window.Clerk) {
    return window.Clerk;
  }
  const publishableKey = config.publishable_key || readPublishableKeyFromDom();
  const frontendApiUrl =
    config.frontend_api_url || deriveFrontendApiUrl(publishableKey);
  if (!publishableKey || !frontendApiUrl) {
    throw new Error("Clerk config missing");
  }
  const script = document.createElement("script");
  script.async = true;
  script.crossOrigin = "anonymous";
  script.dataset.clerkPublishableKey = publishableKey;
  script.src = `${frontendApiUrl.replace(/\/+$/, "")}/npm/@clerk/clerk-js@5/dist/clerk.browser.js`;
  document.head.appendChild(script);
  await new Promise((resolve, reject) => {
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener("error", () => reject(new Error("Clerk failed to load")), { once: true });
  });
  return window.Clerk;
}

async function completeCallback() {
  const config = await fetchAuthConfig();
  const clerk = await ensureClerkLoaded(config);
  await clerk.load();

  if (typeof clerk.handleRedirectCallback === "function") {
    const result = await clerk.handleRedirectCallback({
      signInForceRedirectUrl: `${window.location.origin}/`,
      signUpForceRedirectUrl: `${window.location.origin}/`,
    });
    const sessionId =
      result?.createdSessionId || result?.sessionId || result?.session?.id || "";
    if (sessionId && typeof clerk.setActive === "function") {
      await clerk.setActive({ session: sessionId });
    }
  }

  if (clerk.session) {
    const token = await clerk.session.getToken();
    if (token) {
      await fetch(AUTH_ME_ENDPOINT, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      window.localStorage.setItem(AUTHENTICATED_KEY, "1");
    }
  }

  window.location.replace("/");
}

completeCallback().catch((error) => {
  console.error("[auth-callback] failed", error);
  setError("Login failed. Please try again.");
});
