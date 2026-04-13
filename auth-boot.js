(() => {
  try {
    if (window.localStorage.getItem("investieren:authenticated") === "1") {
      document.documentElement.classList.add("auth-session-hint");
    }
  } catch {
    // ignore
  }
})();
