if (window.location.protocol === "file:") {
  window.location.replace("http://127.0.0.1:8003/");
}

if ("scrollRestoration" in window.history) {
  window.history.scrollRestoration = "manual";
}

window.scrollTo({ top: 0, left: 0, behavior: "auto" });

const DEPLOYED_API_ORIGIN = "https://investieren-production.up.railway.app";
const LOCAL_API_HOSTS = new Set(["127.0.0.1", "localhost"]);
/** Local FastAPI (uvicorn); static pages on other ports still call API here */
const LOCAL_API_PORT = "8003";
const AUTH_TOKEN_CACHE_MS = 45 * 1000;
const SIMPLE_ACCESS_CODE = "9988";
const BOOT_ANIMATION_FREEZE_MS = 900;
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const AUTH_RESEND_COOLDOWN_SECONDS = 30;

const I18N_STORAGE_KEY = "investieren:lang";
const I18N_DEFAULT = "auto";
const I18N_SUPPORTED = new Set(["de", "en"]);

const I18N = {
  de: {
    "auth.builtBy": "Entwickelt von Gaurav Lochan",
    "auth.privateAccess": "PRIVATER ZUGANG • FOUNDER SYSTEM",
    "auth.subtitle": "Echtzeit-Signale. KI-gestutzte Entscheidungen.",
    "auth.description":
      "Ein privates Trading-Terminal fur schnelle Marktanalysen, klare Ausfuhrungslogik und Signal-Monitoring mit hoher Ueberzeugung.",
    "auth.accessCodeLabel": "Zugangscode",
    "auth.accessCodePlaceholder": "Code eingeben",
    "auth.enterDashboard": "Zum Dashboard",
    "auth.viewSignals": "Signale",
    "auth.hint": "Nur fur autorisierte Nutzer. Verbindung ist verschlusselt.",
    "auth.purchaseKicker": "Noch keinen Code?",
    "auth.purchaseBody":
      "Pro-Zugang fur €4.99 pro Monat — sicher per Stripe. Nach dem Kauf mit deinem Zugangscode hier einloggen.",
    "auth.purchaseCta": "Zugang kaufen — €4.99 / Monat",
    "auth.purchaseCtaAria": "Zur Kaufseite fur Pro-Zugang und Zugangscode",
    "auth.purchaseNote": "Apple Pay und Google Pay im Checkout.",
    "auth.features.liveSignalsTitle": "Live-Signale",
    "auth.features.liveSignalsBody": "Konkrete Einstiegs- und Ausstiegssignale mit Echtzeit-Marktkontext.",
    "auth.features.aiTitle": "KI-Strategie-Engine",
    "auth.features.aiBody": "Modellgestutzte Entscheidungen fur schnelle Richtungsanalysen.",
    "auth.features.riskTitle": "Risikoanalyse",
    "auth.features.riskBody": "Klare Markteinschatzung vor Trades mit hoher Ueberzeugung.",
    "auth.system.liveSignals": "Live-Signale",
    "auth.system.strategyComparison": "Strategie-Vergleich",

    "paywall.kicker": "Pro-Zugang",
    "paywall.title": "Upgrade fur vollen Dashboard-Zugriff",
    "paywall.body": "Aktiviere Pro, um Live-Signale, Alerts und Watchlists zu nutzen.",
    "paywall.upgradeCta": "Upgrade €4.99 / Monat",
    "paywall.logout": "Abmelden",
    "paywall.note": "Apple Pay und Google Pay sind im Stripe-Checkout verfugbar.",

    "dashboard.homeAria": "Zur Dashboard-Startseite",
    "dashboard.privateSystem": "Privates System",
    "dashboard.searchPlaceholder": "Suchen",
    "dashboard.backendConnecting": "Backend wird verbunden...",
    "dashboard.subscribe": "Upgrade €4.99",
    "dashboard.refresh": "Aktualisieren",
    "dashboard.logout": "Abmelden",
    "dashboard.kickerLive": "LIVE",
    "dashboard.kickerStats": "STATS",
    "dashboard.kickerUpdated": "AKTUALISIERT",

    "errors.invalidCode": "Ungultiger Zugangscode.",
    "auth.loadingLogin": "Login wird geladen...",
    "paywall.defaultMessage": "Aktiviere Pro, um Live-Signale, Alerts und Watchlists zu nutzen.",
    "dashboard.tradingViewLoading": "TradingView-Chart wird geladen...",
    "dashboard.alertsRefreshing": "Alerts werden aktualisiert...",
    "dashboard.favoritesUpdateFailed": "Favorit konnte nicht aktualisiert werden.",
    "dashboard.selectedSymbolFailed": "Ausgewahltes Symbol konnte noch nicht geladen werden.",
    "dashboard.loading": "Laden",
    "dashboard.saved": "Gespeichert",
    "dashboard.favorite": "Favorit",
    "dashboard.refreshing": "Aktualisiere",
    "auth.title": "GQ Trading System",
    "auth.system.inside": "In deinem System",
    "auth.system.aiDecisions": "KI-basierte Entscheidungen",
    "auth.stat.winRate": "Trefferquote",
    "auth.stat.signals": "Signale",
    "auth.stat.accuracy": "Genauigkeit",
    "auth.miniGame.title": "GQ Pulse",
    "auth.miniGame.hint": "Tippe das leuchtende Feld",
    "auth.miniGame.aria": "Kurzes Reflexspiel: tippe das leuchtende Feld",
    "lang.de": "Deutsch",
    "lang.en": "English",
    "lang.switch": "Sprache",
    "dashboard.quickActionsAria": "Schnellaktionen",
    "dashboard.mobileFavoriteAria": "Favorit umschalten",
    "dashboard.mobileAlertsAria": "Alerts offnen",
    "dashboard.mobilePortfolioAria": "Depot offnen",
    "dashboard.depot": "Depot",
    "dashboard.mobileAlerts": "Alerts",
    "dashboard.strategyToggleAria": "Handelsstrategie",
    "strategy.simple": "Einfach",
    "strategy.ai": "KI",
    "strategy.hedgefund": "Hedgefonds",
    "limited.kicker": "Eingeschrankter Zugriff",
    "limited.body":
      "Du kannst das Dashboard ansehen. Aktiviere Live-Signale und Alerts fur vollen Zugriff.",
    "limited.unlock": "Freischalten €4.99",
    "watchlist.quotes": "Kurse",
    "watchlist.syncing": "Synchronisiere...",
    "watchlist.metaVisible": "{visible}/{max} sichtbar",
    "watchlist.marketSyncing": "Marktdaten werden synchronisiert...",
    "watchlist.noData": "Keine Daten",
    "watchlist.noDataHint": "Kein aktueller Kurs — Datenlieferant antwortet nicht oder Symbol unbekannt.",
    "watchlist.fallbackName": "Watchliste",
    "watchlist.stalePriceTitle": "Zuletzt bekannter Kurs",
    "watchlist.statusStale": "Verzögert",
    "watchlist.statusNoData": "Kein Kurs",
    "watchlist.statusFetchError": "Abruf fehlgeschlagen",
    "watchlist.emptyVisible": "Keine Einträge in der Liste.",
    "watchlist.fetchErrorBanner": "Watchlist konnte nicht geladen werden. Angezeigt werden ggf. zwischengespeicherte Kurse.",
    "watchlist.favoritesTitle": "Favoriten · Smart Alerts",
    "watchlist.favoritesHint":
      "Mit Stern speichern — wir überwachen das Symbol und benachrichtigen dich, sobald das Signal auf BUY oder SELL wechselt.",
    "search.noMatch": "Kein Treffer.",
    "search.open": "Offnen",
    "search.errorOff": "Suche nicht verfugbar.",
    "favorites.label": "Smart Alerts",
    "favorites.pinned": "Überwachte Favoriten",
    "favorites.meta": "0 gespeichert",
    "favorites.metaCount": "{n} gespeichert",
    "favorites.emptyTitle": "Keine Favoriten",
    "favorites.emptyBody":
      "Stern setzen: Das Symbol wird überwacht. Bei Wechsel auf BUY oder SELL erscheint ein Alert in der Liste.",
    "symbol.selected": "Ausgewahlt",
    "symbol.favoriteAria": "Symbol speichern und Smart Alerts für BUY/SELL-Wechsel aktivieren",
    "symbol.favoriteRemoveAria": "Symbol entfernen und Smart Alerts beenden",
    "symbol.favoriteButton": "Favorit",
    "metric.price": "Preis",
    "metric.dayHigh": "Tageshoch",
    "metric.dayLow": "Tagestief",
    "metric.open": "Eroffnung",
    "metric.prevClose": "Vortag Schluss",
    "decision.mainLabel": "HAUPTENTSCHEIDUNG",
    "decision.setupTitle": "Aktuelles Setup",
    "decision.signalActive": "SIGNAL AKTIV",
    "decision.waiting": "Warten",
    "decision.recommendation": "Empfehlung",
    "decision.mainDecision": "Hauptentscheidung",
    "decision.scan": "Scan",
    "decision.partialSignal": "Teilsignal",
    "decision.mixedSignals": "Gemischte Signale",
    "decision.confidence": "Konfidenz",
    "decision.scanning": "Scannt...",
    "decision.reason": "Begrundung",
    "decision.loadingSignal": "Signal wird geladen...",
    "decision.context": "Kontext",
    "decision.balanced": "Ausgewogenes Signal",
    "decision.waitingShort": "Warten.",
    "decision.riskLevel": "Risikostufe",
    "decision.timeframe": "Zeitrahmen",
    "decision.dataQuality": "Datenqualitat",
    "decision.positionSize": "Positionsgrosse",
    "decision.tradeDetails": "TRADE-DETAILS",
    "decision.executionPlan": "Ausfuhrungsplan",
    "decision.updated": "Aktualisiert",
    "decision.entry": "Einstieg",
    "decision.exit": "Ausstieg",
    "decision.stopLoss": "Stop-Loss",
    "decision.warnings": "Warnungen",
    "chart.label": "Chart",
    "chart.tradingView": "TradingView",
    "chart.comparePlaceholder": "Vergleichen mit...",
    "chart.compareAria": "Aktuellen Chart mit anderem Symbol vergleichen",
    "chart.compare": "Vergleichen",
    "chart.clear": "Zurucksetzen",
    "chart.tapAria": "Chart-Interaktion aktivieren",
    "chart.tap": "Chart antippen",
    "signals.label": "SIGNALE",
    "signals.setups": "Setups",
    "signals.ranking": "Rangliste...",
    "signals.rankingTitle": "Rangliste",
    "signals.rankingHint": "Beste Bewegungen zuerst.",
    "alerts.title": "Alerts",
    "alerts.scanning": "Scannt...",
    "alerts.scanningTitle": "Scannt",
    "alerts.scanningHint": "Bewegungen werden gepruft.",
    "company.selectSymbol": "Symbol wahlen",
    "company.exchangeHint": "Borse erscheint hier",
    "company.exchangeUnavailable": "Borse nicht verfugbar",
    "chart.compareLegend": "Auf 100% normiert",
    "alerts.metaCount": "{count} Live-Alerts",
    "alerts.noAlertsTitle": "Keine Alerts",
    "alerts.noAlertsBody":
      "Keine Ereignisse. Gespeicherte Favoriten erzeugen Smart Alerts bei BUY/SELL-Wechseln.",
    "alerts.smartBadge": "Smart Alert",
    "alerts.warmingTitle": "Alerts starten",
    "alerts.warmingBody": "Bald erneut versuchen.",
    "alerts.retryTap": "Zum Aktualisieren tippen",
    "alerts.retrying": "Alerts erneut... ({n}/5)",
    "alerts.cached": "Zwischengespeicherte Alerts",
    "signals.metaRanked": "{count} bewertet · {full} vollstandige Daten",
    "signals.noSymbols": "Keine Symbole",
    "signals.noRanked": "Noch keine Chancen gerankt",
    "signals.panelWarmingTitle": "Panel warmt auf",
    "signals.panelWarmingBody": "Setups werden gerankt.",
    "signals.sectionTopBuy": "Top BUY",
    "signals.sectionTopSell": "Top SELL",
    "signals.sectionHighConf": "Hohe Konfidenz",
    "signals.emptySetups": "Keine Setups.",
    "signals.bestLong": "Bestes Long.",
    "signals.bestShort": "Bestes Short.",
    "signals.clearestSetup": "Klarstes Setup.",
    "signals.topPick": "Top {rec}",
    "signals.scoreLabel": "Score {label}",
    "learning.offline": "Learning offline",
    "learning.noStats": "Keine Stats",
    "learning.cached": "Zwischengespeichert",
    "learning.noClosedTrades": "Keine geschlossenen Trades",
    "learning.statsLater": "Stats folgen.",
    "learning.tryAgain": "Erneut versuchen.",
    "learning.status.waiting": "Warten",
    "learning.status.on": "An",
    "learning.status.noTrades": "Keine Trades",
    "learning.status.progress": "{current}/{required} Trades",
    "learning.loadFailed": "Laden fehlgeschlagen.",
    "alerts.retryGeneric": "Alerts werden erneut geladen...",
    "signals.retrying": "Chancen werden erneut geladen...",
    "metric.noData": "Keine Daten",
    "overview.liveUnavailable": "Live-Ubersicht nicht verfugbar",
    "learning.performance": "Performance",
    "learning.loading": "Laden",
    "learning.loadingTitle": "Laden",
    "learning.loadingHint": "Trades werden gelesen.",
    "learning.rules": "Regeln",
    "learning.rulesHint": "Startet nach 50 abgeschlossenen Trades.",
    "learning.selected": "Aktiv",
    "learning.metric.winRate": "Win-Rate",
    "learning.metric.avgPl": "Ø P/L",
    "learning.metric.drawdown": "Drawdown",
    "learning.metric.version": "Version",
    "learning.tradesCount": "{n} Trades",
    "learning.note.none": "Kein Hinweis.",
    "learning.note.noRealized":
      "Für {strategy} sind noch keine realisierten Trades erfasst. Learning bleibt neutral.",
    "learning.note.neutralMin":
      "Learning bleibt neutral, bis mindestens {min} geschlossene Trades mit realisiertem Gewinn oder Verlust vorliegen.",
    "learning.note.progressPartial":
      "{count} realisierte Trades erfasst. Learning bleibt neutral, bis {min} Trades vorliegen.",
    "portfolio.sheetTitle": "Portfolio",
    "portfolio.allocation": "Allokation",
    "portfolio.close": "Schliessen",
  },
  en: {
    "auth.builtBy": "Built by Gaurav Lochan",
    "auth.privateAccess": "PRIVATE ACCESS • FOUNDER SYSTEM",
    "auth.subtitle": "Real-time signals. AI-driven decisions.",
    "auth.description":
      "A private trading terminal built for fast market reads, clean execution logic and high-conviction signal monitoring.",
    "auth.accessCodeLabel": "Access code",
    "auth.accessCodePlaceholder": "Enter access code",
    "auth.enterDashboard": "Enter Dashboard",
    "auth.viewSignals": "Signals",
    "auth.hint": "Private system. Access for authorized users only.",
    "auth.purchaseKicker": "Need an access code?",
    "auth.purchaseBody":
      "Unlock Pro for €4.99/month via Stripe. After checkout, sign in here with your access code.",
    "auth.purchaseCta": "Buy access — €4.99 / month",
    "auth.purchaseCtaAria": "Open checkout page for Pro access and access code",
    "auth.purchaseNote": "Apple Pay and Google Pay available at checkout.",
    "auth.features.liveSignalsTitle": "Live Signals",
    "auth.features.liveSignalsBody": "Actionable entries and exits with real-time market context.",
    "auth.features.aiTitle": "AI Strategy Engine",
    "auth.features.aiBody": "Model-driven decisions built for fast directional reads.",
    "auth.features.riskTitle": "Risk Analysis",
    "auth.features.riskBody": "Clear market framing before taking high-conviction trades.",
    "auth.system.liveSignals": "Live signals",
    "auth.system.strategyComparison": "Strategy comparison",

    "paywall.kicker": "Pro Access",
    "paywall.title": "Upgrade to unlock the dashboard",
    "paywall.body": "Subscribe to access live signals, alerts and watchlists.",
    "paywall.upgradeCta": "Upgrade €4.99 / month",
    "paywall.logout": "Logout",
    "paywall.note": "Apple Pay and Google Pay available in Stripe Checkout.",

    "dashboard.homeAria": "Go to dashboard home",
    "dashboard.privateSystem": "Private system",
    "dashboard.searchPlaceholder": "Search",
    "dashboard.backendConnecting": "Connecting backend...",
    "dashboard.subscribe": "Subscribe €4.99",
    "dashboard.refresh": "Refresh",
    "dashboard.logout": "Logout",
    "dashboard.kickerLive": "LIVE",
    "dashboard.kickerStats": "STATS",
    "dashboard.kickerUpdated": "UPDATED",

    "errors.invalidCode": "Invalid access code.",
    "auth.loadingLogin": "Loading login...",
    "paywall.defaultMessage": "Subscribe to access live signals, alerts and watchlists.",
    "dashboard.tradingViewLoading": "Loading TradingView chart...",
    "dashboard.alertsRefreshing": "Refreshing alerts...",
    "dashboard.favoritesUpdateFailed": "Favorite could not update.",
    "dashboard.selectedSymbolFailed": "Selected symbol could not load yet.",
    "dashboard.loading": "Loading",
    "dashboard.saved": "Saved",
    "dashboard.favorite": "Favorite",
    "dashboard.refreshing": "Refreshing",
    "auth.title": "GQ Trading System",
    "auth.system.inside": "Inside your system",
    "auth.system.aiDecisions": "AI-based decisions",
    "auth.stat.winRate": "Win rate",
    "auth.stat.signals": "Signals",
    "auth.stat.accuracy": "Accuracy",
    "auth.miniGame.title": "GQ Pulse",
    "auth.miniGame.hint": "Tap the glowing cell",
    "auth.miniGame.aria": "Quick reflex game: tap the glowing cell",
    "lang.de": "German",
    "lang.en": "English",
    "lang.switch": "Language",
    "dashboard.quickActionsAria": "Quick actions",
    "dashboard.mobileFavoriteAria": "Toggle favorite",
    "dashboard.mobileAlertsAria": "Open alerts",
    "dashboard.mobilePortfolioAria": "Open portfolio",
    "dashboard.depot": "Portfolio",
    "dashboard.mobileAlerts": "Alerts",
    "dashboard.strategyToggleAria": "Trading strategy",
    "strategy.simple": "Simple",
    "strategy.ai": "AI",
    "strategy.hedgefund": "Hedgefund",
    "limited.kicker": "Limited access",
    "limited.body":
      "You can explore the dashboard. Unlock live signals and alerts for full access.",
    "limited.unlock": "Unlock €4.99",
    "watchlist.quotes": "Quotes",
    "watchlist.syncing": "Syncing...",
    "watchlist.metaVisible": "{visible}/{max} visible",
    "watchlist.marketSyncing": "Syncing market data...",
    "watchlist.noData": "No data",
    "watchlist.noDataHint": "No live quote — data provider unavailable or symbol not covered.",
    "watchlist.fallbackName": "Watchlist",
    "watchlist.stalePriceTitle": "Last known price",
    "watchlist.statusStale": "Delayed",
    "watchlist.statusNoData": "No quote",
    "watchlist.statusFetchError": "Fetch failed",
    "watchlist.emptyVisible": "No rows to show.",
    "watchlist.fetchErrorBanner": "Could not load watchlist. Showing cached quotes if available.",
    "watchlist.favoritesTitle": "Favorites · smart alerts",
    "watchlist.favoritesHint":
      "Star to save — we watch the symbol and notify you when the signal flips to BUY or SELL.",
    "search.noMatch": "No match.",
    "search.open": "Open",
    "search.errorOff": "Search unavailable.",
    "favorites.label": "Smart alerts",
    "favorites.pinned": "Watched favorites",
    "favorites.meta": "0 saved",
    "favorites.metaCount": "{n} saved",
    "favorites.emptyTitle": "No favorites",
    "favorites.emptyBody":
      "Star a stock to watch it. When the signal switches to BUY or SELL, an alert appears here.",
    "symbol.selected": "Selected",
    "symbol.favoriteAria": "Save symbol and enable smart alerts on BUY/SELL changes",
    "symbol.favoriteRemoveAria": "Remove symbol and stop smart alerts",
    "symbol.favoriteButton": "Favorite",
    "metric.price": "Price",
    "metric.dayHigh": "Day high",
    "metric.dayLow": "Day low",
    "metric.open": "Open",
    "metric.prevClose": "Prev close",
    "decision.mainLabel": "MAIN DECISION",
    "decision.setupTitle": "Current setup",
    "decision.signalActive": "SIGNAL ACTIVE",
    "decision.waiting": "Waiting",
    "decision.recommendation": "Recommendation",
    "decision.mainDecision": "Main decision",
    "decision.scan": "Scan",
    "decision.partialSignal": "Partial signal",
    "decision.mixedSignals": "Mixed signals",
    "decision.confidence": "Confidence",
    "decision.scanning": "Scanning...",
    "decision.reason": "Reason",
    "decision.loadingSignal": "Loading signal.",
    "decision.context": "Context",
    "decision.balanced": "Balanced signal",
    "decision.waitingShort": "Waiting.",
    "decision.riskLevel": "Risk level",
    "decision.timeframe": "Timeframe",
    "decision.dataQuality": "Data quality",
    "decision.positionSize": "Position size",
    "decision.tradeDetails": "TRADE DETAILS",
    "decision.executionPlan": "Execution plan",
    "decision.updated": "Updated",
    "decision.entry": "Entry",
    "decision.exit": "Exit",
    "decision.stopLoss": "Stop loss",
    "decision.warnings": "Warnings",
    "chart.label": "Chart",
    "chart.tradingView": "TradingView",
    "chart.comparePlaceholder": "Compare with...",
    "chart.compareAria": "Compare current chart with another symbol",
    "chart.compare": "Compare",
    "chart.clear": "Clear",
    "chart.tapAria": "Activate chart interaction",
    "chart.tap": "Tap chart",
    "signals.label": "SIGNALS",
    "signals.setups": "Setups",
    "signals.ranking": "Ranking...",
    "signals.rankingTitle": "Ranking",
    "signals.rankingHint": "Best moves first.",
    "alerts.title": "Alerts",
    "alerts.scanning": "Scanning...",
    "alerts.scanningTitle": "Scanning",
    "alerts.scanningHint": "Checking moves.",
    "company.selectSymbol": "Select a symbol",
    "company.exchangeHint": "Exchange will appear here",
    "company.exchangeUnavailable": "Exchange unavailable",
    "chart.compareLegend": "Normalized to 100%",
    "alerts.metaCount": "{count} live alerts",
    "alerts.noAlertsTitle": "No alerts",
    "alerts.noAlertsBody":
      "No events yet. Saved favorites trigger smart alerts on BUY/SELL changes.",
    "alerts.smartBadge": "Smart alert",
    "alerts.warmingTitle": "Alerts warming",
    "alerts.warmingBody": "Retry soon.",
    "alerts.retryTap": "Tap refresh to retry alerts",
    "alerts.retrying": "Retrying alerts... ({n}/5)",
    "alerts.cached": "Showing cached alerts",
    "signals.metaRanked": "{count} ranked · {full} full data",
    "signals.noSymbols": "No symbols",
    "signals.noRanked": "No ranked opportunities yet",
    "signals.panelWarmingTitle": "Panel warming",
    "signals.panelWarmingBody": "Ranking setups.",
    "signals.sectionTopBuy": "Top BUY",
    "signals.sectionTopSell": "Top SELL",
    "signals.sectionHighConf": "High confidence",
    "signals.emptySetups": "No setups.",
    "signals.bestLong": "Best long.",
    "signals.bestShort": "Best short.",
    "signals.clearestSetup": "Clearest setup.",
    "signals.topPick": "Top {rec}",
    "signals.scoreLabel": "Score {label}",
    "learning.offline": "Learning offline",
    "learning.noStats": "No stats",
    "learning.cached": "Cached",
    "learning.noClosedTrades": "No closed trades",
    "learning.statsLater": "Stats appear later.",
    "learning.tryAgain": "Try again.",
    "learning.status.waiting": "Waiting",
    "learning.status.on": "On",
    "learning.status.noTrades": "No trades",
    "learning.status.progress": "{current}/{required} trades",
    "learning.loadFailed": "Load failed.",
    "alerts.retryGeneric": "Retrying alerts...",
    "signals.retrying": "Retrying opportunities...",
    "metric.noData": "No Data",
    "overview.liveUnavailable": "Live overview unavailable",
    "learning.performance": "Performance",
    "learning.loading": "Loading",
    "learning.loadingTitle": "Loading",
    "learning.loadingHint": "Reading trades.",
    "learning.rules": "Rules",
    "learning.rulesHint": "Starts after 50 closed trades.",
    "learning.selected": "Active",
    "learning.metric.winRate": "Win rate",
    "learning.metric.avgPl": "Avg P/L",
    "learning.metric.drawdown": "Drawdown",
    "learning.metric.version": "Version",
    "learning.tradesCount": "{n} trades",
    "learning.note.none": "No note.",
    "learning.note.noRealized":
      "No realized trades are logged for {strategy} yet. Learning stays neutral.",
    "learning.note.neutralMin":
      "Learning stays neutral until at least {min} closed trades with realized profit or loss are available.",
    "learning.note.progressPartial":
      "{count} realized trades logged. Learning stays neutral until {min} trades are available.",
    "portfolio.sheetTitle": "Portfolio",
    "portfolio.allocation": "Allocation",
    "portfolio.close": "Close",
  },
};

let currentLang = null;

function detectSystemLang() {
  const raw = String(navigator.language || navigator.userLanguage || "").toLowerCase();
  if (raw.startsWith("de")) return "de";
  return "en";
}

function t(key) {
  const lang = currentLang || detectSystemLang();
  return I18N?.[lang]?.[key] ?? I18N?.en?.[key] ?? key;
}

function tf(key, vars) {
  let s = t(key);
  if (vars && typeof vars === "object") {
    Object.keys(vars).forEach((k) => {
      s = s.replaceAll(`{${k}}`, String(vars[k]));
    });
  }
  return s;
}

function applyI18nToDom() {
  const lang = currentLang || detectSystemLang();

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (!key) return;
    el.textContent = t(key);
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const key = el.getAttribute("data-i18n-placeholder");
    if (!key) return;
    el.setAttribute("placeholder", t(key));
  });

  document.querySelectorAll("[data-i18n-aria]").forEach((el) => {
    const key = el.getAttribute("data-i18n-aria");
    if (!key) return;
    el.setAttribute("aria-label", t(key));
  });

  document.querySelectorAll(".auth-lang-button, .dashboard-lang-button").forEach((btn) => {
    btn.classList.toggle("is-active", btn.getAttribute("data-lang") === lang);
  });
}

function setLanguage(next) {
  const normalized = next === I18N_DEFAULT ? I18N_DEFAULT : String(next || "").toLowerCase();
  if (normalized === I18N_DEFAULT) {
    window.localStorage.removeItem(I18N_STORAGE_KEY);
    currentLang = null;
  } else if (I18N_SUPPORTED.has(normalized)) {
    window.localStorage.setItem(I18N_STORAGE_KEY, normalized);
    currentLang = normalized;
  }
  applyI18nToDom();
  if (typeof renderStrategyButtons === "function") {
    renderStrategyButtons();
  }
  if (typeof renderMobileStrategyCards === "function") {
    renderMobileStrategyCards();
  }
  if (typeof refreshDashboardI18n === "function") {
    refreshDashboardI18n();
  }
}

function initI18n() {
  const saved = window.localStorage.getItem(I18N_STORAGE_KEY);
  if (saved && I18N_SUPPORTED.has(saved)) {
    currentLang = saved;
  } else {
    currentLang = null;
  }

  document.querySelectorAll(".auth-lang-button, .dashboard-lang-button").forEach((btn) => {
    btn.addEventListener("click", () => setLanguage(btn.getAttribute("data-lang")));
  });

  applyI18nToDom();
  if (typeof syncCompanyPlaceholders === "function") {
    syncCompanyPlaceholders();
  }
  if (typeof updateChartCompareUi === "function") {
    updateChartCompareUi();
  }
}
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

const STRATEGY_KEYS = ["simple", "ai", "hedgefund"];

function getStrategyLabel(key) {
  const k = String(key || "");
  return t(`strategy.${k}`) || k;
}

const MAX_SIDEBAR_SLOTS = 10;
const OPPORTUNITY_LIMIT = 3;
// Symbol set must stay ⊆ backend Settings.watchlist / DEFAULT_WATCHLIST (see get_dashboard_watchlist_symbols).
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
  alertsUiLoading: false,
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
  opportunityUiLoading: false,
  opportunityPanelMode: "panel",
  opportunityWarningMessage: "",
  opportunityPanelHydrated: false,
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
    adminSession: window.localStorage.getItem(STORAGE_KEYS.adminSession) || "",
    formMode: "login",
    verifyStep: false,
    verifyEmail: "",
    verifyMode: "signup",
    resendCooldownUntil: 0,
    resetSignIn: null,
  },
  appBindingsReady: false,
};

const elements = {
  authOverlay: document.getElementById("authOverlay"),
  paywallOverlay: document.getElementById("paywallOverlay"),
  paywallUpgradeButton: document.getElementById("paywallUpgradeButton"),
  paywallLogoutButton: document.getElementById("paywallLogoutButton"),
  paywallMessage: document.getElementById("paywallMessage"),
  authForm: document.getElementById("authForm"),
  authGoogleButton: document.getElementById("authGoogleButton"),
  authAppleButton: document.getElementById("authAppleButton"),
  authEmailButton: document.getElementById("authEmailButton"),
  authModeLoginButton: document.getElementById("authModeLoginButton"),
  authModeSignupButton: document.getElementById("authModeSignupButton"),
  authSubmitButton: document.getElementById("authSubmitButton"),
  authVerifyPanel: document.getElementById("authVerifyPanel"),
  authVerifyEmail: document.getElementById("authVerifyEmail"),
  authVerificationCode: document.getElementById("authVerificationCode"),
  authResetNewPassword: document.getElementById("authResetNewPassword"),
  authResetPasswordShell: document.getElementById("authResetPasswordShell"),
  authVerifySubmitButton: document.getElementById("authVerifySubmitButton"),
  authVerifyResendButton: document.getElementById("authVerifyResendButton"),
  authVerifyBackButton: document.getElementById("authVerifyBackButton"),
  authForgotPasswordButton: document.getElementById("authForgotPasswordButton"),
  authUsername: document.getElementById("authUsername"),
  authUsernameLabel: document.getElementById("authUsernameLabel"),
  authUsernameShell: document.getElementById("authUsernameShell"),
  authEmail: document.getElementById("authEmail"),
  authAdminToggleButton: document.getElementById("authAdminToggleButton"),
  authLoading: document.getElementById("authLoading"),
  authPassword: document.getElementById("authPassword"),
  authError: document.getElementById("authError"),
  authInfo: document.getElementById("authInfo"),
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
  authVisualArt: document.querySelector(".auth-visual-art"),
};

function resolveApiBaseUrl() {
  if (LOCAL_API_HOSTS.has(window.location.hostname)) {
    const protocol = window.location.protocol || "http:";
    return `${protocol}//${window.location.hostname}:${LOCAL_API_PORT}`;
  }
  return DEPLOYED_API_ORIGIN;
}

function buildApiUrl(path) {
  return `${resolveApiBaseUrl()}${path}`;
}

function resetAuthVisualMotion() {
  if (!elements.authVisualArt) {
    return;
  }
  elements.authVisualArt.style.setProperty("--visual-shift-x", "0px");
  elements.authVisualArt.style.setProperty("--visual-shift-y", "0px");
  elements.authVisualArt.style.setProperty("--visual-tilt-x", "0deg");
  elements.authVisualArt.style.setProperty("--visual-tilt-y", "0deg");
  elements.authVisualArt.style.setProperty("--visual-glow-x", "50%");
  elements.authVisualArt.style.setProperty("--visual-glow-y", "50%");
  elements.authVisualArt.style.setProperty("--visual-glow-opacity", "0");
}

function updateAuthVisualMotion(clientX, clientY) {
  if (!elements.authVisualArt) {
    return;
  }
  const rect = elements.authVisualArt.getBoundingClientRect();
  const relativeX = (clientX - rect.left) / rect.width;
  const relativeY = (clientY - rect.top) / rect.height;
  const shiftX = (relativeX - 0.5) * 26;
  const shiftY = (relativeY - 0.5) * 18;
  const tiltY = (relativeX - 0.5) * 4;
  const tiltX = (0.5 - relativeY) * 3.5;

  elements.authVisualArt.style.setProperty("--visual-shift-x", `${shiftX.toFixed(2)}px`);
  elements.authVisualArt.style.setProperty("--visual-shift-y", `${shiftY.toFixed(2)}px`);
  elements.authVisualArt.style.setProperty("--visual-tilt-x", `${tiltX.toFixed(2)}deg`);
  elements.authVisualArt.style.setProperty("--visual-tilt-y", `${tiltY.toFixed(2)}deg`);
  elements.authVisualArt.style.setProperty("--visual-glow-x", `${(relativeX * 100).toFixed(2)}%`);
  elements.authVisualArt.style.setProperty("--visual-glow-y", `${(relativeY * 100).toFixed(2)}%`);
  elements.authVisualArt.style.setProperty("--visual-glow-opacity", "1");
}

let authVisualMotionRaf = null;
let pendingAuthVisualPoint = null;
let authVisualMotionBound = false;
let authResendTicker = null;

function flushAuthVisualMotion() {
  authVisualMotionRaf = null;
  const point = pendingAuthVisualPoint;
  if (!point) {
    return;
  }
  pendingAuthVisualPoint = null;
  updateAuthVisualMotion(point.x, point.y);
}

function bindAuthVisualMotion() {
  if (!elements.authVisualArt || authVisualMotionBound || prefersReducedMotion) {
    return;
  }
  authVisualMotionBound = true;

  resetAuthVisualMotion();

  elements.authVisualArt.addEventListener("pointermove", (event) => {
    pendingAuthVisualPoint = { x: event.clientX, y: event.clientY };
    if (authVisualMotionRaf !== null) {
      return;
    }
    authVisualMotionRaf = window.requestAnimationFrame(flushAuthVisualMotion);
  });

  elements.authVisualArt.addEventListener("pointerleave", () => {
    resetAuthVisualMotion();
  });

  elements.authVisualArt.addEventListener(
    "touchmove",
    (event) => {
      const touch = event.touches[0];
      if (!touch) {
        return;
      }
      pendingAuthVisualPoint = { x: touch.clientX, y: touch.clientY };
      if (authVisualMotionRaf !== null) {
        return;
      }
      authVisualMotionRaf = window.requestAnimationFrame(flushAuthVisualMotion);
    },
    { passive: true }
  );

  elements.authVisualArt.addEventListener("touchend", () => {
    window.setTimeout(() => resetAuthVisualMotion(), 140);
  });
}

let authMiniGameDispose = null;

function stopAuthMiniGame() {
  if (typeof authMiniGameDispose === "function") {
    authMiniGameDispose();
    authMiniGameDispose = null;
  }
}

function initAuthMiniGame() {
  const root = document.getElementById("authMiniGame");
  const board = document.getElementById("authMiniGameBoard");
  const scoreEl = document.getElementById("authMiniGameScore");
  if (!root || !board || !scoreEl) {
    return;
  }

  stopAuthMiniGame();

  const cols = 4;
  const rows = 3;
  const total = cols * rows;
  let score = 0;
  let activeIndex = -1;
  let timeoutId = null;
  const cells = [];

  function isAuthOverlayOpen() {
    const el = document.getElementById("authOverlay");
    return Boolean(el && !el.hidden && !el.classList.contains("hidden"));
  }

  function clearPulse() {
    if (activeIndex >= 0 && cells[activeIndex]) {
      cells[activeIndex].classList.remove("auth-mini-game-cell--pulse");
    }
    activeIndex = -1;
  }

  function scheduleNext() {
    if (timeoutId) {
      window.clearTimeout(timeoutId);
      timeoutId = null;
    }
    if (!isAuthOverlayOpen()) {
      return;
    }
    clearPulse();
    activeIndex = Math.floor(Math.random() * total);
    cells[activeIndex].classList.add("auth-mini-game-cell--pulse");
    const ms = Math.max(400, 1050 - Math.min(score, 14) * 40);
    timeoutId = window.setTimeout(() => {
      timeoutId = null;
      if (!isAuthOverlayOpen()) {
        return;
      }
      clearPulse();
      scheduleNext();
    }, ms);
  }

  board.replaceChildren();
  for (let i = 0; i < total; i += 1) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "auth-mini-game-cell";
    btn.setAttribute("aria-label", `Feld ${i + 1}`);
    const idx = i;
    btn.addEventListener("click", () => {
      if (!isAuthOverlayOpen() || idx !== activeIndex) {
        return;
      }
      score += 1;
      scoreEl.textContent = String(score);
      if (timeoutId) {
        window.clearTimeout(timeoutId);
        timeoutId = null;
      }
      clearPulse();
      scheduleNext();
    });
    board.appendChild(btn);
    cells.push(btn);
  }

  scoreEl.textContent = "0";
  scheduleNext();

  authMiniGameDispose = () => {
    if (timeoutId) {
      window.clearTimeout(timeoutId);
      timeoutId = null;
    }
    clearPulse();
  };
}

function currentUserKey() {
  return state.auth.currentUser?.auth_subject || "default";
}

function renderAuthMode() {
  if (elements.authForm) {
    elements.authForm.hidden = false;
  }
  const signup = state.auth.formMode === "signup";
  const verifyStep = Boolean(state.auth.verifyStep);
  const resetMode = state.auth.verifyMode === "reset";
  if (elements.authUsernameLabel) {
    elements.authUsernameLabel.hidden = !signup || verifyStep;
  }
  if (elements.authUsernameShell) {
    elements.authUsernameShell.hidden = !signup || verifyStep;
  }
  if (elements.authEmail) {
    elements.authEmail.disabled = verifyStep;
  }
  if (elements.authPassword) {
    elements.authPassword.disabled = verifyStep;
  }
  if (elements.authSubmitButton) {
    elements.authSubmitButton.textContent = signup ? "Create account" : "Login";
    elements.authSubmitButton.hidden = verifyStep;
  }
  if (elements.authForgotPasswordButton) {
    elements.authForgotPasswordButton.hidden = verifyStep || signup;
  }
  if (elements.authVerifyPanel) {
    elements.authVerifyPanel.hidden = !verifyStep;
  }
  if (elements.authVerifyEmail) {
    elements.authVerifyEmail.textContent = state.auth.verifyEmail || "your email";
  }
  if (elements.authResetPasswordShell) {
    elements.authResetPasswordShell.hidden = !verifyStep || !resetMode;
  }
  if (elements.authVerifySubmitButton) {
    elements.authVerifySubmitButton.textContent = resetMode ? "Reset password and continue" : "Verify and continue";
  }
  elements.authModeLoginButton?.classList.toggle("bg-neutral-900", !signup);
  elements.authModeLoginButton?.classList.toggle("text-white", !signup);
  elements.authModeSignupButton?.classList.toggle("bg-neutral-900", signup);
  elements.authModeSignupButton?.classList.toggle("text-white", signup);
}

function setAuthLoading(loading, message = "Redirecting…") {
  if (!elements.authLoading) {
    return;
  }
  elements.authLoading.hidden = !loading;
  elements.authLoading.textContent = message;
}

function setAuthInfo(message = "") {
  if (!elements.authInfo) {
    return;
  }
  if (!message) {
    elements.authInfo.hidden = true;
    elements.authInfo.textContent = "";
    return;
  }
  elements.authInfo.textContent = message;
  elements.authInfo.hidden = false;
}

function setAuthError(message = "") {
  if (!elements.authError) {
    return;
  }
  if (!message) {
    elements.authError.hidden = true;
    elements.authPassword?.setAttribute("aria-invalid", "false");
    elements.authEmail?.setAttribute("aria-invalid", "false");
    elements.authVerificationCode?.setAttribute("aria-invalid", "false");
    elements.authResetNewPassword?.setAttribute("aria-invalid", "false");
    return;
  }
  elements.authError.textContent = message;
  elements.authError.hidden = false;
  elements.authPassword?.setAttribute("aria-invalid", "true");
  elements.authEmail?.setAttribute("aria-invalid", "true");
  elements.authVerificationCode?.setAttribute("aria-invalid", "true");
  elements.authResetNewPassword?.setAttribute("aria-invalid", "true");
}

function readClerkPublishableKeyFromDom() {
  const node = document.querySelector('meta[name="clerk-publishable-key"]');
  return String(node?.getAttribute("content") || "").trim();
}

function deriveClerkFrontendApiUrlFromPublishableKey(publishableKey) {
  const value = String(publishableKey || "").trim();
  if (!value || !value.includes("$")) {
    return "";
  }
  try {
    const encoded = value.split("$", 1)[0].split("_").pop() || "";
    if (!encoded) {
      return "";
    }
    const padded = `${encoded}${"=".repeat((4 - (encoded.length % 4)) % 4)}`;
    const decoded = window
      .atob(padded.replace(/-/g, "+").replace(/_/g, "/"))
      .trim();
    if (!decoded) {
      return "";
    }
    return decoded.startsWith("https://") ? decoded : `https://${decoded}`;
  } catch {
    return "";
  }
}

function getClientAuthConfigFallback() {
  const publishableKey = readClerkPublishableKeyFromDom();
  if (!publishableKey) {
    return null;
  }
  const frontendApiUrl = deriveClerkFrontendApiUrlFromPublishableKey(publishableKey);
  if (!frontendApiUrl) {
    return null;
  }
  return {
    enabled: true,
    provider: "clerk",
    publishable_key: publishableKey,
    frontend_api_url: frontendApiUrl,
  };
}

function startResendCooldown(seconds = AUTH_RESEND_COOLDOWN_SECONDS) {
  state.auth.resendCooldownUntil = Date.now() + Math.max(1, seconds) * 1000;
  syncResendCooldownButton();
}

function syncResendCooldownButton() {
  if (!elements.authVerifyResendButton) {
    return;
  }
  const remainingMs = state.auth.resendCooldownUntil - Date.now();
  if (remainingMs <= 0) {
    elements.authVerifyResendButton.disabled = false;
    elements.authVerifyResendButton.textContent = "Resend code";
    if (authResendTicker) {
      window.clearTimeout(authResendTicker);
      authResendTicker = null;
    }
    return;
  }
  const remainingSeconds = Math.ceil(remainingMs / 1000);
  elements.authVerifyResendButton.disabled = true;
  elements.authVerifyResendButton.textContent = `Resend in ${remainingSeconds}s`;
  if (authResendTicker) {
    window.clearTimeout(authResendTicker);
  }
  authResendTicker = window.setTimeout(syncResendCooldownButton, 250);
}

async function fetchAuthConfig() {
  let config = {};
  try {
    config = await api("/api/auth/config", {
      timeoutMs: 12000,
      retryCount: 1,
      skipAuth: true,
    });
  } catch (error) {
    console.warn("[frontend] auth config endpoint unavailable, trying client fallback", error);
  }

  const fallback = getClientAuthConfigFallback();
  const merged = { ...(config || {}) };
  if (fallback) {
    merged.provider = "clerk";
    merged.publishable_key = merged.publishable_key || fallback.publishable_key;
    merged.frontend_api_url = merged.frontend_api_url || fallback.frontend_api_url;
    if (!merged.enabled) {
      merged.enabled = true;
    }
  }

  state.auth.config = merged;
  state.auth.enabled = Boolean(
    merged?.provider === "clerk" && merged.publishable_key && merged.frontend_api_url,
  );
  renderAuthMode();
  return merged;
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
  state.auth.formMode = mode === "signup" ? "signup" : "login";
  renderAuthMode();
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

  if (hasProAccess()) {
    elements.subscribeButton.textContent = "Full Access";
    elements.subscribeButton.disabled = true;
    elements.subscribeButton.className =
      "action-secondary rounded-2xl border border-[#005c39]/25 bg-[#005c39]/10 px-4 py-3 text-sm font-semibold text-[#005c39] opacity-90 xl:min-w-[132px]";
    return;
  }

  elements.subscribeButton.disabled = !isAuthenticated();
  elements.subscribeButton.textContent = isAuthenticated() ? "Upgrade €4.99" : "Locked";
  elements.subscribeButton.className =
    "action-secondary rounded-2xl border border-neutral-200/90 bg-white/5 px-4 py-3 text-sm font-semibold text-neutral-700 opacity-80 xl:min-w-[132px]";
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

function isOwnerUser() {
  return Boolean(state.auth.currentUser?.is_admin || state.auth.currentUser?.role === "owner");
}

function hasActiveSubscription() {
  return Boolean(state.auth.subscription?.active || isOwnerUser());
}

function hasProAccess() {
  return hasActiveSubscription();
}

function strategyRequiresPro(strategy) {
  const normalized = String(strategy || "").toLowerCase();
  return normalized === "ai" || normalized === "hedgefund";
}

function setAdminSessionToken(token = "") {
  state.auth.adminSession = String(token || "").trim();
  if (state.auth.adminSession) {
    window.localStorage.setItem(STORAGE_KEYS.adminSession, state.auth.adminSession);
    return;
  }
  window.localStorage.removeItem(STORAGE_KEYS.adminSession);
}

function pricingPageUrl() {
  try {
    return new URL("pricing.html", window.location.href).href;
  } catch {
    return "pricing.html";
  }
}

function isPricingPage() {
  const path = window.location.pathname || "";
  return /(^|\/)pricing\.html$/i.test(path);
}

function redirectToPricingPage() {
  if (isPricingPage()) {
    return;
  }
  hidePaywall();
  window.location.replace(pricingPageUrl());
}

function showPaywall(message = t("paywall.defaultMessage")) {
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
  if (!elements.limitedAccessBanner) {
    return;
  }
  const show = isAuthenticated() && !hasProAccess();
  elements.limitedAccessBanner.classList.toggle("hidden", !show);
  elements.limitedAccessBanner.classList.toggle("flex", show);
  elements.limitedAccessBanner.hidden = !show;
}

async function loadSubscriptionStatus() {
  if (!isAuthenticated()) {
    state.auth.subscription = null;
    renderSubscriptionButton();
    syncLimitedAccessBanner();
    return null;
  }

  try {
    state.auth.subscription = await api("/api/billing/subscription", {
      timeoutMs: 15000,
      retryCount: 1,
    });
  } catch (error) {
    console.error("[frontend] subscription status load failed", error);
    state.auth.subscription = {
      active: false,
      status: "inactive",
      amount_cents: 499,
      currency: "eur",
      interval: "month",
    };
  }
  renderSubscriptionButton();
  syncLimitedAccessBanner();
  return state.auth.subscription;
}

async function startCheckout() {
  if (!isAuthenticated()) {
    setAuthError("Please login first.");
    return;
  }
  try {
    const session = await api("/api/billing/checkout", {
      method: "POST",
      body: JSON.stringify({}),
      timeoutMs: 20000,
      retryCount: 0,
    });
    if (!session?.url) {
      throw new Error("Checkout is unavailable.");
    }
    window.location.href = session.url;
  } catch (error) {
    showError(error.message || "Checkout failed.");
  }
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

async function restoreAdminSessionUser() {
  if (!state.auth.adminSession || state.auth.currentUser) {
    return null;
  }

  try {
    const user = await api("/api/auth/me", {
      timeoutMs: 12000,
      retryCount: 0,
    });
    state.auth.currentUser = user;
    return user;
  } catch (error) {
    console.error("[frontend] admin session restore failed", error);
    setAdminSessionToken("");
    setAuthenticated(false);
    state.auth.currentUser = null;
    return null;
  }
}

async function initializeManagedAuth() {
  state.auth.enabled = false;
  state.auth.client = null;
  state.auth.showManagedAuth = false;
  state.auth.showAdminAccess = true;
  renderAuthMode();
  try {
    const config = await fetchAuthConfig();
    if (!config?.enabled) {
      state.auth.ready = true;
      renderSubscriptionButton();
      return false;
    }
    const clerk = await ensureClerkFrontendLoaded(config);
    await clerk.load();
    state.auth.client = clerk;
    state.auth.enabled = true;
    state.auth.ready = true;

    if (clerk.user && clerk.session) {
      setAuthenticated(true);
      await syncAuthenticatedUser(true);
      await loadSubscriptionStatus();
      await handleBillingRedirectState();
    } else {
      setAuthenticated(false);
      state.auth.subscription = null;
      renderSubscriptionButton();
    }
    return true;
  } catch (error) {
    console.error("[frontend] managed auth init failed", error);
    state.auth.enabled = false;
    state.auth.client = null;
    state.auth.ready = true;
    renderSubscriptionButton();
    return false;
  }
}

async function loginWithManagedProvider(mode = "login") {
  if (!state.auth.ready) {
    return;
  }
  renderManagedAuthView(mode);
}

async function continueWithOAuth(strategy) {
  if (!state.auth.ready) {
    setAuthLoading(true, t("auth.loadingLogin"));
    return;
  }

  if (!state.auth.enabled || !state.auth.client) {
    setAuthError("Login is unavailable.");
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

async function authenticateWithEmailPassword({ mode, username, email, password }) {
  if (!state.auth.enabled || !state.auth.client) {
    throw new Error("Login is unavailable.");
  }
  const clerk = state.auth.client;
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const normalizedPassword = String(password || "");
  const normalizedUsername = String(username || "").trim();
  if (!normalizedEmail || !normalizedPassword) {
    throw new Error("Email and password are required.");
  }
  if (mode === "signup" && normalizedUsername.length < 3) {
    throw new Error("Username must have at least 3 characters.");
  }

  if (mode === "signup") {
    const signUpAttempt = await clerk.client.signUp.create({
      emailAddress: normalizedEmail,
      password: normalizedPassword,
      username: normalizedUsername || undefined,
    });
    if (signUpAttempt.status === "complete" && signUpAttempt.createdSessionId) {
      await clerk.setActive({ session: signUpAttempt.createdSessionId });
      return;
    }
    await clerk.client.signUp.prepareEmailAddressVerification({ strategy: "email_code" });
    state.auth.verifyStep = true;
    state.auth.verifyEmail = normalizedEmail;
    state.auth.verifyMode = "signup";
    startResendCooldown();
    renderAuthMode();
    throw new Error("Enter the verification code sent to your email.");
  }

  const signInAttempt = await clerk.client.signIn.create({
    identifier: normalizedEmail,
    password: normalizedPassword,
  });
  if (signInAttempt.status === "complete" && signInAttempt.createdSessionId) {
    await clerk.setActive({ session: signInAttempt.createdSessionId });
    return;
  }
  throw new Error("Login failed. Check your credentials.");
}

async function completeSignupVerification(code) {
  if (!state.auth.enabled || !state.auth.client) {
    throw new Error("Login is unavailable.");
  }
  const normalizedCode = String(code || "").trim();
  if (!normalizedCode) {
    throw new Error("Verification code is required.");
  }
  const result = await state.auth.client.client.signUp.attemptEmailAddressVerification({
    code: normalizedCode,
  });
  if (result.status === "complete" && result.createdSessionId) {
    await state.auth.client.setActive({ session: result.createdSessionId });
    state.auth.verifyStep = false;
    state.auth.verifyEmail = "";
    state.auth.verifyMode = "signup";
    renderAuthMode();
    return;
  }
  throw new Error("Verification failed. Try again.");
}

async function startPasswordResetFlow(email) {
  if (!state.auth.enabled || !state.auth.client) {
    throw new Error("Login is unavailable.");
  }
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) {
    throw new Error("Please enter your email first.");
  }
  const signIn = await state.auth.client.client.signIn.create({
    strategy: "reset_password_email_code",
    identifier: normalizedEmail,
  });
  state.auth.resetSignIn = signIn;
  state.auth.verifyStep = true;
  state.auth.verifyMode = "reset";
  state.auth.verifyEmail = normalizedEmail;
  startResendCooldown();
  renderAuthMode();
}

async function completePasswordReset(code, newPassword) {
  const normalizedCode = String(code || "").trim();
  const normalizedPassword = String(newPassword || "");
  if (!normalizedCode) {
    throw new Error("Verification code is required.");
  }
  if (normalizedPassword.length < 8) {
    throw new Error("New password must be at least 8 characters.");
  }
  const baseSignIn = state.auth.resetSignIn || state.auth.client?.client?.signIn;
  if (!baseSignIn?.attemptFirstFactor) {
    throw new Error("Password reset session is unavailable.");
  }
  const result = await baseSignIn.attemptFirstFactor({
    strategy: "reset_password_email_code",
    code: normalizedCode,
    password: normalizedPassword,
  });
  if (result.status === "complete" && result.createdSessionId) {
    await state.auth.client.setActive({ session: result.createdSessionId });
    state.auth.verifyStep = false;
    state.auth.verifyEmail = "";
    state.auth.verifyMode = "signup";
    state.auth.resetSignIn = null;
    renderAuthMode();
    return;
  }
  throw new Error("Password reset failed. Please try again.");
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

/** POST /api/auth/access-code is not covered by read-only fallback; retry deployed if local has no route or is down */
function canFallbackAccessCodePost(path, options = {}, baseUrl) {
  return (
    path === "/api/auth/access-code" &&
    String(options.method || "GET").toUpperCase() === "POST" &&
    LOCAL_API_HOSTS.has(window.location.hostname) &&
    baseUrl !== DEPLOYED_API_ORIGIN &&
    !options.skipDeployedFallback
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
  return isValidMarketPrice(value) ? currency(value) : t("metric.noData");
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
    return "text-neutral-800";
  }
  if (options.invert) {
    if (numeric <= 0) {
      return "text-neutral-800";
    }
    return "text-rose-700";
  }
  if (numeric > 0) {
    return "text-emerald-700";
  }
  if (numeric < 0) {
    return "text-rose-700";
  }
  return "text-neutral-800";
}

function learningStatus(profile) {
  if (!profile) {
    return {
      label: t("learning.status.waiting"),
      tone: "text-neutral-600",
      badge: "border-neutral-200/90 bg-white/5 text-neutral-700",
    };
  }
  if (profile.eligible) {
    return {
      label: t("learning.status.on"),
      tone: "text-emerald-700",
      badge: "border-emerald-400/20 bg-emerald-500/10 text-emerald-200",
    };
  }
  if (profile.trade_count > 0) {
    return {
      label: tf("learning.status.progress", {
        current: profile.trade_count,
        required: profile.min_trades_required,
      }),
      tone: "text-amber-300",
      badge: "border-amber-400/20 bg-amber-500/10 text-amber-200",
    };
  }
  return {
    label: t("learning.status.noTrades"),
    tone: "text-neutral-600",
    badge: "border-neutral-200/90 bg-white/5 text-neutral-700",
  };
}

function emptyLearningResponse() {
  return {
    version: "performance-learning-v1",
    strategies: [],
  };
}

function sortLearningStrategies(strategies) {
  const order = STRATEGY_KEYS;
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
  elements.backendStatus.className = `dashboard-chip rounded-full border px-4 py-2 text-xs font-semibold ${palette[tone] || palette.loading}`;
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
      <div class="rounded-2xl px-4 py-4 text-sm text-neutral-600">
        ${escapeHtml(t("search.noMatch"))}
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
          data-symbol="${escapeHtml(item.symbol)}"
        >
          <div class="min-w-0">
            <p class="text-sm font-semibold text-neutral-900">${escapeHtml(item.symbol)}</p>
            <p class="mt-1 text-xs text-neutral-600">${escapeHtml(item.name || "")}</p>
          </div>
          <span class="ml-3 shrink-0 text-xs uppercase tracking-[0.24em] text-neutral-500">${escapeHtml(t("search.open"))}</span>
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
    const results = await api(`/api/search?q=${encodeURIComponent(trimmed)}&limit=20`, {
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
      <div class="rounded-2xl px-4 py-4 text-sm text-rose-700">
        ⚠️ ${escapeHtml(t("search.errorOff"))}
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
  elements.recommendationCard.className = "rounded-[28px] border border-neutral-200/90 bg-neutral-50 p-5";
  elements.recommendationValue.className = "text-5xl font-black tracking-[-0.06em] text-neutral-900 xl:text-6xl";
  elements.recommendationIcon.className = "signal-icon tone-muted";
  elements.recommendationIcon.textContent = "◌";
  elements.recommendationValue.textContent = "LOADING";
  elements.signalQualityBadge.hidden = true;
  elements.conflictBadge.hidden = true;
  elements.confidenceValue.className = "mt-2 text-2xl font-semibold text-neutral-900";
  elements.confidenceValue.textContent = "--";
  setConfidenceBar(0, "NO_DATA");
  elements.confidenceHint.textContent = "⚠️ Scanning";
  elements.analysisSummary.textContent = trimDecisionText(
    `${getStrategyLabel(state.selectedStrategy)} scan: ${symbol}`,
    110,
  );
  elements.selectedStrategyBadge.textContent = getStrategyLabel(state.selectedStrategy);
  elements.analysisGeneratedAt.textContent = "Running";
  elements.biasValue.textContent = "Balanced";
  elements.noTradeReason.textContent = "Waiting.";
  if (elements.mobileConfidenceValue) {
    elements.mobileConfidenceValue.className = "mt-2 text-2xl font-semibold text-neutral-900";
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
      `${getStrategyLabel(state.selectedStrategy)} scan: ${symbol}`,
      110,
    );
  }
  if (elements.mobileBiasValue) {
    elements.mobileBiasValue.textContent = "Balanced";
  }
  if (elements.mobileNoTradeReason) {
    elements.mobileNoTradeReason.textContent = "Waiting.";
  }
  elements.riskValue.className = "mt-3 text-2xl font-semibold text-neutral-900";
  elements.riskValue.textContent = "--";
  elements.timeframeValue.textContent = "--";
  elements.coverageValue.className = "mt-3 text-2xl font-semibold text-neutral-900";
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
    '<span class="rounded-full border border-neutral-200/90 bg-white/5 px-3 py-2 text-xs font-medium text-neutral-600">Loading</span>';

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
      card: "border-emerald-400/25 bg-emerald-500/10",
      badge: "border border-emerald-400/25 bg-emerald-400/15 text-emerald-800",
    };
  }
  if (tone === "bearish") {
    return {
      card: "border-rose-400/25 bg-rose-500/10",
      badge: "border border-rose-400/25 bg-rose-400/15 text-rose-800",
    };
  }
  return {
    card: "border-neutral-200/90 bg-white",
    badge: "border border-neutral-200/90 bg-neutral-100 text-neutral-800",
  };
}

function renderAlertsLoading() {
  state.alertsUiLoading = true;
  elements.alertsMeta.textContent = t("alerts.scanning");
  elements.alertsList.innerHTML = Array.from({ length: 3 })
    .map(
      () => `
        <article class="animate-pulse rounded-2xl border border-neutral-200/90 bg-white p-4">
          <div class="h-4 w-24 rounded bg-neutral-200/70"></div>
          <div class="mt-3 h-6 w-40 rounded bg-neutral-200/70"></div>
          <div class="mt-3 h-4 w-full rounded bg-neutral-200/70"></div>
        </article>
      `,
    )
    .join("");
  requestAnimationFrame(syncCompanySectionAlignment);
}

function renderAlerts(alerts) {
  state.alertsUiLoading = false;
  state.alertsRetryAttempt = 0;
  window.clearTimeout(state.alertsRetryId);
  writeCachedJson(STORAGE_KEYS.cachedAlerts, alerts);
  elements.alertsMeta.textContent = tf("alerts.metaCount", { count: alerts.length });

  if (!alerts.length) {
    elements.alertsList.innerHTML = `
      <article class="rounded-2xl border border-neutral-200/90 bg-white p-4">
        <p class="text-sm font-semibold text-neutral-900">${escapeHtml(t("alerts.noAlertsTitle"))}</p>
        <p class="mt-2 text-sm leading-6 text-neutral-600">⚠️ ${escapeHtml(t("alerts.noAlertsBody"))}</p>
      </article>
    `;
    requestAnimationFrame(syncCompanySectionAlignment);
    return;
  }

  elements.alertsList.innerHTML = alerts
    .map((alert) => {
      const tone = alertToneClasses(alert.tone);
      const smartBadge =
        alert.kind === "favorite_signal"
          ? `<span class="shrink-0 rounded-full border border-violet-200/90 bg-violet-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-violet-900">${escapeHtml(t("alerts.smartBadge"))}</span>`
          : "";
      return `
        <article class="rounded-2xl border p-4 ${tone.card}">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="text-sm font-semibold text-neutral-900">${escapeHtml(alert.title)}</p>
              <p class="mt-2 text-sm leading-6 text-neutral-700">${escapeHtml(alert.message)}</p>
            </div>
            <div class="flex shrink-0 flex-col items-end gap-1.5">
              ${smartBadge}
              <span class="rounded-full px-3 py-2 text-[11px] font-semibold ${tone.badge}">
                ${escapeHtml(getStrategyLabel(alert.strategy) || titleCase(alert.strategy))}
              </span>
            </div>
          </div>
        </article>
      `;
    })
    .join("");
  requestAnimationFrame(syncCompanySectionAlignment);
}

function renderAlertsWarning(message) {
  state.alertsUiLoading = false;
  elements.alertsMeta.textContent = message;
  elements.alertsList.innerHTML = `
    <article class="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4">
      <p class="text-sm font-semibold text-neutral-900">${escapeHtml(t("alerts.warmingTitle"))}</p>
      <p class="mt-2 text-sm leading-6 text-neutral-700">⚠️ ${escapeHtml(t("alerts.warmingBody"))}</p>
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
  state.opportunityUiLoading = true;
  state.opportunityPanelHydrated = false;
  elements.opportunityMeta.textContent = t("signals.ranking");
  elements.opportunityList.innerHTML = Array.from({ length: 3 })
    .map(
      () => `
        <article class="animate-pulse rounded-2xl border border-neutral-200/90 bg-white p-4">
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
          <p class="opportunity-group-title">${escapeHtml(title)}</p>
        </div>
        <div class="rounded-2xl border border-neutral-200/90 bg-white px-4 py-4 text-sm leading-6 text-neutral-600">
          ${escapeHtml(t("signals.emptySetups"))}
          <span class="block mt-1 text-xs text-neutral-500">${escapeHtml(emptyMessage)}</span>
        </div>
      </article>
    `;
  }

  return `
    <article class="opportunity-group">
      <div class="opportunity-group-head">
        <p class="opportunity-group-title">${escapeHtml(title)}</p>
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
                    <p class="truncate text-sm font-semibold text-neutral-900">${entry.symbol}</p>
                    <span class="opportunity-pill">${index === 0 ? escapeHtml(tf("signals.topPick", { rec: entry.recommendation })) : escapeHtml(entry.recommendation)}</span>
                  </div>
                  <p class="mt-1 truncate text-xs text-neutral-600">${entry.name}</p>
                </div>
                <div class="text-right">
                  <p class="text-sm font-semibold text-neutral-900">${Math.round(entry.confidence)}%</p>
                  <p class="mt-1 text-[11px] uppercase tracking-[0.18em] text-neutral-500">${escapeHtml(tf("signals.scoreLabel", { label: entry.scoreLabel }))}</p>
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
      const st = normalizeWatchlistQuoteStatus(item);
      const priceOk = safeWatchlistPrice(item.price) !== null;
      const change =
        (st === "success" || st === "stale") && priceOk ? Number(item.change_percent) : NaN;
      const score = Number.isFinite(change) ? Math.max(-1, Math.min(1, change / 2)) : 0;
      const confidence = Number.isFinite(change) ? Math.max(28, Math.min(62, Math.abs(change) * 8 + 28)) : 32;
      const recommendation = score > 0 ? "BUY" : score < 0 ? "SELL" : index === 0 ? "BUY" : "HOLD";
      const dataQuality =
        st === "success" && priceOk ? "FULL" : st === "stale" && priceOk ? "PARTIAL" : "NO_DATA";
      return {
        symbol,
        name: item.name || symbol,
        recommendation,
        score,
        scoreLabel: score > 0 ? "+1" : score < 0 ? "-1" : "0",
        confidence,
        dataQuality,
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
  state.opportunityUiLoading = false;
  state.opportunityPanelMode = "panel";
  state.opportunityPanelHydrated = true;
  state.opportunityWarningMessage = "";
  state.opportunities = entries;
  const fullCount = entries.filter((entry) => entry.dataQuality === "FULL").length;
  elements.opportunityMeta.textContent = tf("signals.metaRanked", { count: entries.length, full: fullCount });
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
    buildOpportunitySection(`📈 ${t("signals.sectionTopBuy")}`, "BUY", topBuy, t("signals.bestLong")),
    buildOpportunitySection(`📉 ${t("signals.sectionTopSell")}`, "SELL", topSell, t("signals.bestShort")),
    buildOpportunitySection(`⚠️ ${t("signals.sectionHighConf")}`, "HOLD", highConfidence, t("signals.clearestSetup")),
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
  state.opportunityUiLoading = false;
  state.opportunityPanelMode = "warning";
  state.opportunityPanelHydrated = true;
  state.opportunityWarningMessage = message;
  elements.opportunityMeta.textContent = message;
  elements.opportunityList.innerHTML = `
    <article class="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4">
      <p class="text-sm font-semibold text-neutral-900">${escapeHtml(t("signals.panelWarmingTitle"))}</p>
      <p class="mt-2 text-sm leading-6 text-neutral-700">⚠️ ${escapeHtml(t("signals.panelWarmingBody"))}</p>
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
    renderOpportunityWarning(t("signals.noSymbols"));
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
      renderOpportunityWarning(t("signals.noRanked"));
      return [];
    }
  }

  renderOpportunityPanel(entries);
  return entries;
}

function queueAlertsRetry(forceRefresh = false, delayMs = 2500) {
  const nextAttempt = state.alertsRetryAttempt + 1;
  if (nextAttempt > 5) {
    elements.alertsMeta.textContent = t("alerts.retryTap");
    return;
  }
  state.alertsRetryAttempt = nextAttempt;
  window.clearTimeout(state.alertsRetryId);
  state.alertsRetryId = window.setTimeout(() => {
    loadAlerts(forceRefresh).catch((error) => {
      console.error("[frontend] alerts retry failed", error);
      renderAlertsWarning(tf("alerts.retrying", { n: state.alertsRetryAttempt }));
      queueAlertsRetry(forceRefresh, Math.min(delayMs * 1.6, 8000));
    });
  }, delayMs);
}

/** Maps known English backend notes to the current UI language. */
function formatLearningNote(note) {
  if (note == null || !String(note).trim()) {
    return "";
  }
  const s = String(note).trim();

  let m = s.match(
    /^No realized trades are logged for strategy (\w+) yet, so learning stays neutral\.$/i,
  );
  if (m) {
    const key = m[1].toLowerCase();
    return tf("learning.note.noRealized", { strategy: getStrategyLabel(key) });
  }

  m = s.match(/^No realized trades are logged for (\w+) yet, so learning stays neutral\.$/i);
  if (m) {
    const key = m[1].toLowerCase();
    return tf("learning.note.noRealized", { strategy: getStrategyLabel(key) });
  }

  m = s.match(
    /^Learning stays neutral until at least (\d+) closed trades with realized profit or loss are available\.$/,
  );
  if (m) {
    return tf("learning.note.neutralMin", { min: m[1] });
  }

  m = s.match(
    /^(\d+) realized trades are logged\. Learning stays neutral until (\d+) trades are available\.$/,
  );
  if (m) {
    return tf("learning.note.progressPartial", { count: m[1], min: m[2] });
  }

  return s;
}

function formatLearningVersion(raw) {
  if (raw == null || raw === "") {
    return "--";
  }
  const str = String(raw);
  const m = str.match(/(?:^|-)v(\d+)$/i);
  return m ? `v${m[1]}` : str;
}

function renderLearningStatsLoading() {
  if (!elements.learningList || !elements.learningMeta) {
    return;
  }
  elements.learningMeta.textContent = t("learning.loading");
  elements.learningMeta.className =
    "min-w-0 max-w-full shrink whitespace-normal rounded-full border border-neutral-200/90 bg-white px-3 py-2 text-right text-[0.68rem] font-medium leading-snug text-neutral-600 sm:max-w-[min(100%,14rem)]";
  elements.learningList.innerHTML = Array.from({ length: 3 })
    .map(
      () => `
        <article class="animate-pulse rounded-2xl border border-neutral-200/90 bg-white p-4">
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
  elements.learningMeta.textContent = t("learning.offline");
  elements.learningMeta.className =
    "min-w-0 max-w-full shrink whitespace-normal rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-right text-[0.68rem] font-medium leading-snug text-amber-200 sm:max-w-[min(100%,14rem)]";
  elements.learningList.innerHTML = `
    <article class="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4">
      <p class="text-sm font-semibold text-neutral-900">${escapeHtml(t("learning.offline"))}</p>
      <p class="mt-2 text-sm leading-6 text-neutral-700">${escapeHtml(message || `⚠️ ${t("learning.tryAgain")}`)}</p>
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
    ? `${getStrategyLabel(state.selectedStrategy)} · ${selectedStatus.label}`
    : t("learning.noStats");
  elements.learningMeta.className = `min-w-0 max-w-full shrink whitespace-normal rounded-full border px-3 py-2 text-right text-[0.68rem] font-medium leading-snug sm:max-w-[min(100%,14rem)] ${
    selectedProfile?.eligible
      ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
      : selectedProfile
        ? "border-amber-400/20 bg-amber-500/10 text-amber-200"
        : "border-neutral-200/90 bg-white text-neutral-600"
  }`;

  if (!strategies.length) {
    elements.learningList.innerHTML = `
      <article class="rounded-2xl border border-neutral-200/90 bg-white p-4">
        <p class="text-sm font-semibold text-neutral-900">${escapeHtml(t("learning.noClosedTrades"))}</p>
        <p class="mt-2 text-sm leading-6 text-neutral-600">${escapeHtml(t("learning.statsLater"))}</p>
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
          ? "text-emerald-700"
          : profile.win_rate > 0 && profile.win_rate <= 0.45
            ? "text-rose-700"
            : "text-neutral-800";
      const noteText = profile.note ? formatLearningNote(profile.note) : "";
      const noteHtml = noteText
        ? `<p class="mt-4 text-sm leading-relaxed text-neutral-600">${escapeHtml(noteText)}</p>`
        : "";

      return `
        <article class="rounded-2xl border p-4 ${
          active
            ? "border-[#005c39]/30 bg-[#005c39]/10 shadow-md shadow-black/10"
            : "border-neutral-200/90 bg-white"
        }">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <p class="text-sm font-semibold text-neutral-900">${getStrategyLabel(profile.strategy) || titleCase(profile.strategy)}</p>
                ${
                  active
                    ? `<span class="rounded-full border border-[#005c39]/25 bg-[#005c39]/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#005c39]">${escapeHtml(t("learning.selected"))}</span>`
                    : ""
                }
              </div>
              <p class="mt-2 text-xs ${status.tone}">${status.label}</p>
            </div>
            <span class="shrink-0 rounded-full border px-3 py-2 text-[11px] font-semibold ${status.badge}">
              ${escapeHtml(tf("learning.tradesCount", { n: profile.trade_count }))}
            </span>
          </div>

          <div class="mt-4 grid min-w-0 grid-cols-2 gap-2 sm:gap-3">
            <div class="min-w-0 rounded-2xl border border-neutral-200/90 bg-white/5 px-2.5 py-2.5 sm:px-3 sm:py-3">
              <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500">${escapeHtml(t("learning.metric.winRate"))}</p>
              <p class="mt-2 text-lg font-semibold tabular-nums ${winRateTone}">${ratioPercent(profile.win_rate)}</p>
            </div>
            <div class="min-w-0 rounded-2xl border border-neutral-200/90 bg-white/5 px-2.5 py-2.5 sm:px-3 sm:py-3">
              <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500">${escapeHtml(t("learning.metric.avgPl"))}</p>
              <p class="mt-2 text-lg font-semibold tabular-nums ${avgPnlTone}">${signedCurrency(profile.average_profit_loss)}</p>
            </div>
            <div class="min-w-0 rounded-2xl border border-neutral-200/90 bg-white/5 px-2.5 py-2.5 sm:px-3 sm:py-3">
              <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500">${escapeHtml(t("learning.metric.drawdown"))}</p>
              <p class="mt-2 text-lg font-semibold tabular-nums ${drawdownTone}">${currency(profile.drawdown || 0)}</p>
            </div>
            <div class="min-w-0 rounded-2xl border border-neutral-200/90 bg-white/5 px-2.5 py-2.5 sm:px-3 sm:py-3">
              <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500">${escapeHtml(t("learning.metric.version"))}</p>
              <p class="mt-2 text-sm font-semibold tabular-nums text-neutral-800">${escapeHtml(formatLearningVersion(profile.learning_version || response.version))}</p>
            </div>
          </div>

          ${noteHtml}
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
  elements.selectedStrategyBadge.textContent = getStrategyLabel(strategy) || titleCase(strategy);
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
    elements.recommendationValue.className = "text-5xl font-black tracking-[-0.06em] text-rose-800 xl:text-6xl";
    elements.recommendationValue.textContent = "NO DATA";
    elements.signalQualityBadge.hidden = true;
    elements.conflictBadge.hidden = true;
    elements.confidenceValue.className = "mt-2 text-2xl font-semibold text-neutral-800";
    elements.confidenceValue.textContent = "--";
    setConfidenceBar(0, "NO_DATA");
    elements.confidenceHint.textContent = "⚠️ No data";
    elements.analysisSummary.textContent = trimDecisionText(reason, 110);
    elements.analysisGeneratedAt.textContent = "No signal";
    elements.biasValue.textContent = "Balanced";
    elements.noTradeReason.textContent = reason;
    if (elements.mobileConfidenceValue) {
      elements.mobileConfidenceValue.className = "mt-2 text-2xl font-semibold text-neutral-800";
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
    elements.riskValue.className = "mt-3 text-2xl font-semibold text-neutral-800";
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
      '<span class="rounded-full border border-rose-400/25 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-800">No live data</span>';
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
  elements.entryValue.className = `mt-3 text-2xl font-semibold ${analysis.entry_signal ? "text-emerald-700" : "text-neutral-800"}`;
  elements.entryValue.textContent = yesNoLabel(analysis.entry_signal);
  elements.entryReason.textContent = analysis.entry_reason || "No entry.";
  elements.exitValue.className = `mt-3 text-2xl font-semibold ${analysis.exit_signal ? "text-rose-700" : "text-neutral-800"}`;
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
            : "border-neutral-200/90 bg-white/5 text-neutral-700";
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
  elements.mobileStrategyCards.innerHTML = STRATEGY_KEYS.map((k) => [k, getStrategyLabel(k)])
    .map(
      ([key, label]) => `
        <button type="button" class="mobile-strategy-card mobile-only rounded-2xl border border-neutral-200/90 bg-white p-4 text-left" data-mobile-strategy="${key}">
          <div class="flex items-center justify-between gap-3">
            <p class="text-sm font-semibold text-neutral-900">${label}</p>
            <span class="rounded-full border border-neutral-200/90 bg-white/5 px-3 py-1 text-[11px] font-semibold text-neutral-700">Scan</span>
          </div>
          <div class="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10"><div class="mobile-skeleton h-full w-1/2 rounded-full"></div></div>
          <p class="mt-3 text-sm text-neutral-600">Checking ${symbol}</p>
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
  elements.mobileStrategyCards.innerHTML = STRATEGY_KEYS.map((k) => [k, getStrategyLabel(k)])
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
              <p class="text-sm font-semibold text-neutral-900">${label}</p>
              <p class="mt-2 text-xl font-black tracking-[-0.03em]">${recommendation}</p>
            </div>
            <div class="text-right">
              <p class="text-[11px] font-medium uppercase tracking-[0.2em] opacity-70">Confidence</p>
              <p class="mt-2 text-base font-semibold text-neutral-900">${confidence}</p>
            </div>
          </div>
          <p class="mt-3 line-clamp-2 text-sm leading-6 text-neutral-800/90">${reason}</p>
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
      if (strategyRequiresPro(nextStrategy) && !hasProAccess()) {
        showPaywall("AI and Hedgefund strategies require Pro subscription.");
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
    <span>${active ? t("dashboard.saved") || "Saved" : t("dashboard.favorite") || "Favorite"}</span>
  `;
  elements.mobileFavoriteButton.classList.toggle("mobile-quick-action-active", active);
}

function syncSelectedFavoriteButton() {
  if (!elements.selectedFavoriteButton) {
    return;
  }
  const active = isFavoriteSymbol(state.selectedSymbol);
  elements.selectedFavoriteButton.textContent = active
    ? `★ ${t("symbol.favoriteButton")}`
    : `☆ ${t("symbol.favoriteButton")}`;
  elements.selectedFavoriteButton.className = active
    ? "favorite-button favorite-active rounded-full border border-amber-500/40 bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-950"
    : "favorite-button rounded-full border border-neutral-200/90 bg-white px-4 py-2 text-sm font-semibold text-neutral-800";
  elements.selectedFavoriteButton.setAttribute(
    "aria-label",
    active ? t("symbol.favoriteRemoveAria") : t("symbol.favoriteAria"),
  );
}

function showPortfolioSheetLoading() {
  elements.portfolioSheetSummary.innerHTML = `
    <div class="rounded-2xl border border-neutral-200/90 bg-white p-4">
      <div class="mobile-skeleton h-4 w-24"></div>
      <div class="mt-3 mobile-skeleton h-8 w-32"></div>
    </div>
  `;
  elements.portfolioSheetPositions.innerHTML = `
    <div class="rounded-2xl border border-neutral-200/90 bg-white p-4"><div class="mobile-skeleton h-4 w-full"></div><div class="mt-3 mobile-skeleton h-4 w-10/12"></div></div>
  `;
}

function renderPortfolioSheet(portfolio) {
  const pnlTone = Number(portfolio.total_pnl || 0) >= 0 ? "text-emerald-700" : "text-rose-700";
  elements.portfolioSheetSummary.innerHTML = `
    <article class="rounded-2xl border border-neutral-200/90 bg-white p-4">
      <p class="text-[11px] font-medium uppercase tracking-[0.22em] text-neutral-500">Market value</p>
      <p class="mt-3 text-3xl font-semibold text-neutral-900">${currency(portfolio.market_value || 0)}</p>
      <p class="mt-2 text-sm ${pnlTone}">${percent(portfolio.total_pnl_percent || 0)} · ${currency(portfolio.total_pnl || 0)}</p>
    </article>
  `;
  if (!portfolio.positions?.length) {
    elements.portfolioSheetPositions.innerHTML = `
      <article class="rounded-2xl border border-neutral-200/90 bg-white p-4">
        <p class="text-sm font-semibold text-neutral-900">No positions</p>
        <p class="mt-2 text-sm leading-6 text-neutral-600">Add later.</p>
      </article>
    `;
    return;
  }
  elements.portfolioSheetPositions.innerHTML = portfolio.positions
    .map((position) => {
      const allocation = portfolio.market_value ? ((position.market_value / portfolio.market_value) * 100).toFixed(1) : "0.0";
      const tone = Number(position.pnl || 0) >= 0 ? "text-emerald-700" : "text-rose-700";
      return `
        <article class="rounded-2xl border border-neutral-200/90 bg-white p-4">
          <div class="flex items-center justify-between gap-3">
            <div>
              <p class="text-sm font-semibold text-neutral-900">${position.symbol}</p>
              <p class="mt-1 text-xs text-neutral-600">${allocation}% allocation</p>
            </div>
            <p class="text-sm font-semibold ${tone}">${currency(position.pnl || 0)}</p>
          </div>
          <div class="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div><p class="text-neutral-500">Value</p><p class="mt-1 font-medium text-neutral-900">${currency(position.market_value || 0)}</p></div>
            <div><p class="text-neutral-500">Entry</p><p class="mt-1 font-medium text-neutral-900">${currency(position.average_price || 0)}</p></div>
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
          <p class="text-sm font-semibold text-neutral-900">Portfolio offline</p>
          <p class="mt-2 text-sm leading-6 text-neutral-700">${error.message || "⚠️ Try again."}</p>
        </article>
      `;
    });
}

function closePortfolioSheet() {
  elements.portfolioSheetBackdrop?.classList.add("hidden");
  elements.portfolioSheet?.classList.add("hidden");
}

function setAuthenticated(value) {
  if (value) {
    window.localStorage.setItem(STORAGE_KEYS.authenticated, "1");
    return;
  }
  window.localStorage.removeItem(STORAGE_KEYS.authenticated);
  state.auth.currentUser = null;
  state.auth.accessToken = "";
  state.auth.tokenFetchedAt = 0;
  setAdminSessionToken("");
}

function isAuthenticated() {
  return window.localStorage.getItem(STORAGE_KEYS.authenticated) === "1";
}

function persistSelectedSymbol(symbol) {
  state.selectedSymbol = symbol;
  window.sessionStorage.setItem(STORAGE_KEYS.selectedSymbol, symbol);
}

function persistSelectedStrategy(strategy) {
  const next = strategyRequiresPro(strategy) && !hasProAccess() ? "simple" : strategy;
  state.selectedStrategy = next;
  window.sessionStorage.setItem(STORAGE_KEYS.selectedStrategy, next);
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
  const price = safeWatchlistPrice(overview.price);
  const ch = overview.change_percent;
  const chNum = Number(ch);
  return {
    symbol: overview.symbol,
    name: overview.name || overview.symbol,
    price,
    change: null,
    change_percent: price != null && Number.isFinite(chNum) ? chNum : null,
    stale: Boolean(overview.stale),
    is_stale: Boolean(overview.stale),
    no_data: price == null,
    quote_status: price != null ? "success" : "no_data",
    data_source: "symbol_overview",
    error_reason: null,
    last_updated: null,
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
        placeholder: false,
      };
    }
    return {
      ...fallbackItem,
      price: null,
      change: null,
      change_percent: null,
      placeholder: true,
      quote_status: "placeholder",
      data_source: null,
      error_reason: null,
      last_updated: null,
      stale: false,
      is_stale: false,
      no_data: true,
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
          strategy: state.selectedStrategy || "hedgefund",
        }),
      });
      void loadAlerts(true).catch(() => {});
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
    showError(error.message || t("dashboard.favoritesUpdateFailed"));
  }
}

function renderFavoriteButton(symbol) {
  const sym = String(symbol || "").trim();
  const active = isFavoriteSymbol(sym);
  const label = escapeHtml(active ? t("symbol.favoriteRemoveAria") : t("symbol.favoriteAria"));
  const escSym = escapeHtml(sym);
  const classes = active
    ? "favorite-button favorite-active rounded-full border border-amber-500/40 bg-amber-100 px-3 py-2 text-amber-950"
    : "favorite-button rounded-full border border-neutral-200/90 bg-white px-3 py-2 font-semibold text-neutral-800";
  return `<button type="button" class="${classes}" data-favorite-symbol="${escSym}" aria-label="${label}">${active ? "★" : "☆"}</button>`;
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
  elements.favoritesMeta.textContent = tf("favorites.metaCount", { n: favoriteItems.length });

  if (!favoriteItems.length) {
    elements.favoritesBody.innerHTML = `
      <article class="rounded-2xl border border-neutral-200/90 bg-white p-4">
        <p class="text-sm font-semibold text-neutral-900">${escapeHtml(t("favorites.emptyTitle"))}</p>
        <p class="mt-2 text-sm leading-6 text-neutral-600">${escapeHtml(t("favorites.emptyBody"))}</p>
      </article>
    `;
    return;
  }

  elements.favoritesBody.innerHTML = favoriteItems
    .map((item) => {
      const tone = item.change_percent >= 0 ? "text-emerald-700" : "text-rose-700";
      const sym = String(item.symbol || "");
      return `
        <button
          type="button"
          class="favorite-card w-full rounded-2xl border border-neutral-200/90 bg-white p-4 text-left transition hover:bg-neutral-100"
          data-symbol="${escapeHtml(sym)}"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="text-sm font-semibold text-neutral-900">${escapeHtml(sym)}</p>
              <p class="mt-1 truncate text-xs text-neutral-600">${escapeHtml(item.name || "")}</p>
            </div>
            ${renderFavoriteButton(sym)}
          </div>
          <div class="mt-4 flex items-center justify-between gap-3">
            <p class="text-sm font-semibold text-neutral-900">${currency(item.price)}</p>
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
    elements.watchlistMeta.textContent = tf("watchlist.metaVisible", {
      visible: MAX_SIDEBAR_SLOTS,
      max: MAX_SIDEBAR_SLOTS,
    });
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
    elements.learningMeta.textContent = t("dashboard.refreshing");
    elements.learningMeta.className =
      "min-w-0 max-w-full shrink whitespace-normal rounded-full border border-neutral-200/90 bg-white px-3 py-2 text-right text-[0.68rem] font-medium leading-snug text-neutral-600 sm:max-w-[min(100%,14rem)]";
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
      elements.learningMeta.textContent = t("learning.cached");
      elements.learningMeta.className =
        "min-w-0 max-w-full shrink whitespace-normal rounded-full border border-neutral-200/90 bg-white px-3 py-2 text-right text-[0.68rem] font-medium leading-snug text-neutral-600 sm:max-w-[min(100%,14rem)]";
      return cachedLearningStats;
    }
    renderLearningStatsError(error.message || `⚠️ ${t("learning.loadFailed")}`);
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
    const strat = button.dataset.strategy;
    if (strat) {
      button.textContent = getStrategyLabel(strat);
    }
    button.className = [
      "strategy-button rounded-xl px-3 py-2 text-xs font-semibold transition",
      active ? "strategy-button-active" : "strategy-button-idle",
    ].join(" ");
  });
  if (elements.selectedStrategyBadge) {
    elements.selectedStrategyBadge.textContent = getStrategyLabel(state.selectedStrategy);
  }
}

function resetAuthOverlayPosition() {
  if (!elements.authOverlay) {
    return;
  }

  const resetScroll = () => {
    elements.authOverlay.scrollTop = 0;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  };

  resetScroll();
  window.requestAnimationFrame(resetScroll);
}

function showAppShell() {
  ensureAppBindings();
  stopAuthMiniGame();
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
  setAuthError("");
  elements.authForm?.reset();
  resetAuthOverlayPosition();
  state.auth.showManagedAuth = false;
  state.auth.showAdminAccess = false;
  renderAuthMode();
  if (state.auth.enabled) {
    setAuthLoading(false);
  }
  bindAuthVisualMotion();
  if (!prefersReducedMotion) {
    scheduleLowPriorityTask(() => initAuthMiniGame(), 120);
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
      if (canFallbackAccessCodePost(path, options, baseUrl)) {
        console.warn("[frontend] local access-code timed out, retrying against deployed backend", { path });
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
    if (canFallbackAccessCodePost(path, options, baseUrl)) {
      console.warn("[frontend] local access-code request failed, retrying against deployed backend", {
        path,
        error: error.message,
      });
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
    if (
      shouldFallbackToDeployedApi(path, options, baseUrl) ||
      (canFallbackAccessCodePost(path, options, baseUrl) && response.status === 404)
    ) {
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
    if (database.backend === "neon") {
      setBackendStatus("Connected · Neon", "ok");
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
    elements.alertsMeta.textContent = t("dashboard.alertsRefreshing");
  }
  const params = new URLSearchParams({
    strategy: state.selectedStrategy,
    limit: "10",
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
            <div class="animate-pulse rounded-2xl border border-neutral-200/90 bg-neutral-50 px-4 py-4">
              <div class="flex items-start gap-4">
                <div class="h-10 w-10 shrink-0 rounded-2xl bg-neutral-200/80"></div>
                <div class="min-w-0 flex-1 space-y-2">
                  <div class="h-4 w-20 rounded bg-neutral-200/80"></div>
                  <div class="h-3 w-full max-w-[8rem] rounded bg-neutral-200/80"></div>
                </div>
                <div class="h-8 w-8 shrink-0 rounded-2xl bg-neutral-200/80"></div>
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
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeWatchlistQuoteStatus(item) {
  const raw = String(item?.quote_status || "").toLowerCase();
  if (raw === "success" || raw === "stale" || raw === "no_data" || raw === "fetch_error") {
    return raw;
  }
  if (item?.placeholder) {
    return "placeholder";
  }
  const priceOk = safeWatchlistPrice(item?.price) !== null;
  if (item?.stale && priceOk) {
    return "stale";
  }
  if (item?.no_data || !priceOk) {
    return "no_data";
  }
  return "success";
}

function formatWatchlistShortTime(iso) {
  if (!iso) {
    return "";
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return "";
  }
  return d.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
}

function renderWatchlist(items) {
  const visibleItems = getVisibleWatchlistItems(items);
  elements.watchlistMeta.textContent = tf("watchlist.metaVisible", {
    visible: visibleItems.length,
    max: MAX_SIDEBAR_SLOTS,
  });
  elements.watchlistBody.innerHTML = "";

  if (!visibleItems.length) {
    const emptyLabel = state.selectedSymbol || t("watchlist.fallbackName");
    const emptyMono = String(state.selectedSymbol || "WL").slice(0, 2);
    elements.watchlistBody.innerHTML = `
      <div class="rounded-2xl border border-neutral-200/90 bg-neutral-50 px-4 py-4">
        <div class="flex items-start gap-4">
          <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-neutral-200/90 bg-white text-[0.7rem] font-bold leading-none text-neutral-950">
            ${escapeHtml(emptyMono)}
          </div>
          <div class="flex min-w-0 flex-1 flex-col gap-2">
            <div class="flex items-start justify-between gap-3">
              <p class="truncate text-base font-semibold leading-tight tracking-tight text-neutral-900">${escapeHtml(emptyLabel)}</p>
              <p class="shrink-0 tabular-nums text-xs font-semibold text-neutral-500">—</p>
            </div>
            <div class="flex items-start justify-between gap-3">
              <p class="line-clamp-2 min-w-0 flex-1 text-xs font-medium leading-snug text-neutral-600">${escapeHtml(t("watchlist.emptyVisible"))}</p>
              <p class="shrink-0 tabular-nums text-sm font-semibold text-neutral-500">—</p>
            </div>
          </div>
        </div>
      </div>
    `;
    renderFavorites();
    return;
  }

  visibleItems.forEach((item) => {
    const quoteStatus = normalizeWatchlistQuoteStatus(item);
    const priceValue = safeWatchlistPrice(item.price);
    const hasPrice = priceValue !== null;
    const changeRaw = safeWatchlistChange(item.change_percent);
    const hasChange = hasPrice && changeRaw !== null;
    const changeDisplay = hasChange ? percent(changeRaw) : "—";
    const stale = quoteStatus === "stale" || (Boolean(item.stale) && hasPrice);
    const missingQuote =
      !hasPrice ||
      quoteStatus === "placeholder" ||
      quoteStatus === "no_data" ||
      quoteStatus === "fetch_error";
    const tone = missingQuote
      ? quoteStatus === "fetch_error"
        ? "text-neutral-600"
        : "text-neutral-500"
      : stale
        ? "text-amber-900"
        : changeRaw != null && changeRaw >= 0
          ? "text-emerald-800"
          : "text-rose-800";
    const active = item.symbol === state.selectedSymbol;
    const sym = String(item.symbol || "");
    const escSym = escapeHtml(sym);
    const displayName = String(item.name || "").trim() || sym;
    const escName = escapeHtml(displayName);
    const staleTitle = escapeHtml(t("watchlist.stalePriceTitle"));
    const noDataTitle = escapeHtml(t("watchlist.noDataHint"));
    const updatedLabel = formatWatchlistShortTime(item.last_updated);
    const updatedTitle = escapeHtml(
      updatedLabel ? `${t("watchlist.stalePriceTitle")}: ${updatedLabel}` : t("watchlist.stalePriceTitle"),
    );
    const statusBadge =
      stale && hasPrice
        ? `<span class="rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-950" title="${updatedTitle}">${escapeHtml(t("watchlist.statusStale"))}</span>`
        : "";
    const errHint =
      quoteStatus === "fetch_error" && item.error_reason
        ? `<p class="mt-1 line-clamp-2 text-[11px] leading-snug text-neutral-500">${escapeHtml(String(item.error_reason).slice(0, 120))}</p>`
        : "";
    const priceTextMissing =
      quoteStatus === "fetch_error"
        ? t("watchlist.statusFetchError")
        : quoteStatus === "placeholder"
          ? t("watchlist.marketSyncing")
          : t("watchlist.statusNoData");
    const priceTitle = missingQuote
      ? quoteStatus === "fetch_error"
        ? escapeHtml(String(item.error_reason || t("watchlist.statusFetchError")))
        : quoteStatus === "placeholder"
          ? escapeHtml(t("watchlist.marketSyncing"))
          : noDataTitle
      : updatedLabel
        ? escapeHtml(`${t("watchlist.stalePriceTitle")}: ${updatedLabel}`)
        : stale
          ? staleTitle
          : "";
    const priceHtml = missingQuote
      ? escapeHtml(priceTextMissing)
      : escapeHtml(displayMarketPrice(priceValue));
    const card = document.createElement("button");
    card.type = "button";
    card.dataset.symbol = sym;
    card.className = [
      "watchlist-slot w-full rounded-2xl border px-4 py-4 text-left transition",
      active
        ? "border-[#005c39]/35 bg-[#005c39]/10 shadow-md shadow-black/10"
        : quoteStatus === "fetch_error"
          ? "border-neutral-200/90 bg-neutral-50/90 hover:bg-neutral-100"
          : "border-neutral-200/90 bg-neutral-50 hover:bg-neutral-100",
    ].join(" ");
    card.innerHTML = `
      <div class="flex items-start gap-4">
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-neutral-200/90 bg-white text-[0.7rem] font-bold leading-none tracking-tight text-neutral-950">
          ${escapeHtml(sym.slice(0, 2))}
        </div>
        <div class="flex min-w-0 flex-1 flex-col gap-2">
          <div class="flex items-start justify-between gap-3">
            <p class="watchlist-symbol min-w-0 truncate text-base font-semibold leading-tight tracking-tight text-neutral-900">${escSym}</p>
            <p class="watchlist-change shrink-0 tabular-nums text-xs font-semibold leading-tight ${tone}">${escapeHtml(changeDisplay)}</p>
          </div>
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0 flex-1">
              <p class="watchlist-name line-clamp-2 text-xs font-medium leading-snug text-neutral-800">${escName}</p>
              ${errHint}
            </div>
            <div class="flex shrink-0 flex-col items-end gap-1 self-start pt-0.5">
              ${statusBadge}
              <p class="watchlist-price text-right tabular-nums text-sm font-semibold leading-none ${missingQuote ? "text-neutral-500" : stale ? "text-amber-950" : "text-neutral-900"}"${priceTitle ? ` title="${priceTitle}"` : ""}>${priceHtml}</p>
            </div>
          </div>
        </div>
        <div class="flex shrink-0 self-start pt-0.5">
          ${renderFavoriteButton(sym)}
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
    ["IPO", overview.ipo || "--"],
    ["Market Cap", formatMarketCap(overview.market_capitalization)],
    ["Shares Out", overview.share_outstanding ? compactNumber(overview.share_outstanding) : "--"],
    ["Industry", overview.finnhub_industry || "--"],
  ];

  elements.companyDetails.innerHTML = rows
    .map(([label, value]) => {
      const l = escapeHtml(String(label));
      const v = escapeHtml(String(value));
      return `
        <div class="company-detail-row flex min-w-0 flex-col gap-1 rounded-2xl border border-neutral-200/90 bg-neutral-100 px-4 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
          <dt class="shrink-0 text-sm text-neutral-600">${l}</dt>
          <dd class="min-w-0 flex-1 text-sm font-medium leading-snug text-neutral-900 sm:text-right">${v}</dd>
        </div>`;
    })
    .join("");
}

function normalizeTickerSymbol(value) {
  return String(value || "").trim().toUpperCase();
}

function updateChartCompareUi() {
  const primary = normalizeTickerSymbol(state.selectedSymbol);
  const compare = normalizeTickerSymbol(state.compareSymbol);
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
    <span class="chart-compare-note">${escapeHtml(t("chart.compareLegend"))}</span>
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

function syncCompanyPlaceholders() {
  if (!elements.companyHeadline || !elements.companyExchange) {
    return;
  }
  const sel = normalizeTickerSymbol(state.selectedSymbol);
  if (state.latestOverview && normalizeTickerSymbol(state.latestOverview.symbol) === sel) {
    elements.companyHeadline.textContent = state.latestOverview.name;
    elements.companyExchange.textContent = state.latestOverview.exchange || t("company.exchangeUnavailable");
    return;
  }
  const headline = elements.companyHeadline.textContent.trim();
  if (headline === sel) {
    elements.companyExchange.textContent = t("company.exchangeUnavailable");
    return;
  }
  elements.companyHeadline.textContent = t("company.selectSymbol");
  elements.companyExchange.textContent = t("company.exchangeHint");
}

function refreshDashboardI18n() {
  if (typeof updateChartCompareUi === "function") {
    updateChartCompareUi();
  }
  syncCompanyPlaceholders();
  if (state.alertsUiLoading && typeof renderAlertsLoading === "function") {
    renderAlertsLoading();
  } else {
    const cachedAlerts = readCachedJson(STORAGE_KEYS.cachedAlerts);
    if (Array.isArray(cachedAlerts) && typeof renderAlerts === "function") {
      renderAlerts(cachedAlerts);
    }
  }
  if (
    state.opportunityPanelHydrated &&
    !state.opportunityUiLoading &&
    typeof renderOpportunityPanel === "function" &&
    typeof renderOpportunityWarning === "function"
  ) {
    if (state.opportunityPanelMode === "panel") {
      renderOpportunityPanel(state.opportunities);
    } else if (state.opportunityPanelMode === "warning") {
      renderOpportunityWarning(state.opportunityWarningMessage);
    }
  }
  if (state.learningStats && typeof renderLearningStats === "function") {
    renderLearningStats(state.learningStats);
  }
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
    : t("metric.noData");
  elements.changeBadge.className = [
    "inline-flex w-fit rounded-full px-4 py-2 text-sm font-semibold",
    hasPrice
      ? positive
        ? "bg-[#005c39]/12 text-[#004730]"
        : "bg-rose-500/15 text-rose-700"
      : "bg-neutral-100 text-neutral-600",
  ].join(" ");

  elements.companyHeadline.textContent = overview.name;
  elements.companyExchange.textContent = overview.exchange || t("company.exchangeUnavailable");

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
  elements.selectedCompanyName.textContent = t("overview.liveUnavailable");
  elements.changeBadge.textContent = t("metric.noData");
  elements.changeBadge.className =
    "inline-flex w-fit rounded-full bg-neutral-100 px-4 py-2 text-sm font-semibold text-neutral-600";
  elements.metricPrice.textContent = t("metric.noData");
  elements.metricHigh.textContent = t("metric.noData");
  elements.metricLow.textContent = t("metric.noData");
  elements.metricOpen.textContent = t("metric.noData");
  elements.metricPrevClose.textContent = t("metric.noData");
  elements.companyHeadline.textContent = symbol;
  elements.companyExchange.textContent = t("company.exchangeUnavailable");
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

function showTradingViewLoader(message = t("dashboard.tradingViewLoading")) {
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
    return t("dashboard.tradingViewLoading");
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
  elements.watchlistMeta.textContent = tf("watchlist.metaVisible", { visible: 0, max: MAX_SIDEBAR_SLOTS });
  const suffix = forceRefresh ? "?refresh=1" : "";
  try {
    const items = await api(`/api/dashboard/watchlist${suffix}`, {
      timeoutMs: 25000,
      retryCount: 1,
    });
    state.watchlist = items;
    writeCachedJson(STORAGE_KEYS.cachedWatchlist, items);
    renderWatchlist(items);
    return items;
  } catch (error) {
    console.error("[frontend] watchlist load failed", error);
    const cached = readCachedJson(STORAGE_KEYS.cachedWatchlist);
    if (Array.isArray(cached) && cached.length) {
      state.watchlist = cached.map((row) => {
        if (safeWatchlistPrice(row.price) != null) {
          return {
            ...row,
            quote_status: "stale",
            stale: true,
            is_stale: true,
            data_source: row.data_source || "stale_cache",
          };
        }
        return row;
      });
    } else {
      state.watchlist = [];
    }
    renderWatchlist(state.watchlist);
    showError(error?.message || t("watchlist.fetchErrorBanner"));
    return state.watchlist;
  }
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
  const strategies = hasProAccess() ? STRATEGY_KEYS : ["simple"];
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
  clearError();
  updateChartCompareUi();
  if (!forceRefresh) {
    hydrateDashboardFromCache();
  }
  renderAlertsLoading();
  try {
    setBackendStatus(t("dashboard.backendConnecting"), "loading");
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

    if (hasProAccess()) {
      scheduleLowPriorityTask(() => {
        loadAlerts(forceRefresh).catch((error) => {
          console.error("[frontend] alerts load failed", error);
          const cachedAlerts = readCachedJson(STORAGE_KEYS.cachedAlerts);
          if (Array.isArray(cachedAlerts) && cachedAlerts.length) {
            renderAlerts(cachedAlerts);
            elements.alertsMeta.textContent = t("alerts.cached");
          } else {
            renderAlertsWarning(t("alerts.retryGeneric"));
          }
          queueAlertsRetry(forceRefresh);
        });
      }, 180);

      scheduleLowPriorityTask(() => {
        loadOpportunities(forceRefresh).catch((error) => {
          console.error("[frontend] opportunity load failed", error);
          renderOpportunityWarning(t("signals.retrying"));
        });
      }, 220);
    } else {
      renderAlertsWarning(t("paywall.defaultMessage"));
      renderOpportunityWarning(t("paywall.defaultMessage"));
    }

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
        showError(symbolResult.reason?.message || t("dashboard.selectedSymbolFailed"));
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

  elements.authModeLoginButton?.addEventListener("click", () => {
    state.auth.formMode = "login";
    state.auth.verifyStep = false;
    state.auth.verifyEmail = "";
    state.auth.verifyMode = "signup";
    state.auth.resetSignIn = null;
    state.auth.resendCooldownUntil = 0;
    setAuthInfo("");
    setAuthError("");
    syncResendCooldownButton();
    renderAuthMode();
  });

  elements.authModeSignupButton?.addEventListener("click", () => {
    state.auth.formMode = "signup";
    state.auth.verifyStep = false;
    state.auth.verifyEmail = "";
    state.auth.verifyMode = "signup";
    state.auth.resetSignIn = null;
    state.auth.resendCooldownUntil = 0;
    setAuthInfo("");
    setAuthError("");
    syncResendCooldownButton();
    renderAuthMode();
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
    setAuthInfo("");
    setAuthError("");
  });
  elements.authEmail?.addEventListener("input", () => {
    setAuthInfo("");
    setAuthError("");
  });
  elements.authUsername?.addEventListener("input", () => {
    setAuthInfo("");
    setAuthError("");
  });
  elements.authVerificationCode?.addEventListener("input", () => {
    setAuthInfo("");
    setAuthError("");
  });
  elements.authResetNewPassword?.addEventListener("input", () => {
    setAuthInfo("");
    setAuthError("");
  });

  elements.authForgotPasswordButton?.addEventListener("click", async () => {
    try {
      setAuthInfo("");
      setAuthError("");
      setAuthLoading(true, "Sending reset code...");
      await startPasswordResetFlow(elements.authEmail?.value || "");
      setAuthInfo("Reset code sent. Enter code and new password.");
    } catch (error) {
      setAuthError(error.message || "Could not start password reset.");
    } finally {
      setAuthLoading(false);
    }
  });

  elements.authVerifySubmitButton?.addEventListener("click", async () => {
    try {
      setAuthLoading(true, "Verifying...");
      setAuthInfo("");
      setAuthError("");
      if (state.auth.verifyMode === "reset") {
        await completePasswordReset(
          elements.authVerificationCode?.value || "",
          elements.authResetNewPassword?.value || "",
        );
      } else {
        await completeSignupVerification(elements.authVerificationCode?.value || "");
      }
      await syncAuthenticatedUser(true);
      setAuthError("");
      setAuthenticated(true);
      setAdminSessionToken("");
      await loadSubscriptionStatus();
      showAppShell();
      await bootDashboard();
      elements.authForm?.reset();
      state.auth.formMode = "login";
      state.auth.verifyStep = false;
      state.auth.verifyEmail = "";
      state.auth.verifyMode = "signup";
      state.auth.resetSignIn = null;
      state.auth.resendCooldownUntil = 0;
      syncResendCooldownButton();
      renderAuthMode();
    } catch (error) {
      setAuthenticated(false);
      setAuthError(error.message || "Verification failed.");
    } finally {
      setAuthLoading(false);
    }
  });

  elements.authVerifyResendButton?.addEventListener("click", async () => {
    if (state.auth.resendCooldownUntil > Date.now()) {
      return;
    }
    try {
      setAuthLoading(true, "Resending code...");
      setAuthError("");
      if (state.auth.verifyMode === "reset") {
        const baseSignIn = state.auth.resetSignIn || state.auth.client?.client?.signIn;
        if (!baseSignIn?.prepareFirstFactor) {
          throw new Error("Password reset session is unavailable.");
        }
        await baseSignIn.prepareFirstFactor({
          strategy: "reset_password_email_code",
        });
      } else {
        await state.auth.client?.client?.signUp?.prepareEmailAddressVerification?.({
          strategy: "email_code",
        });
      }
      startResendCooldown();
      setAuthInfo("A new verification code was sent.");
    } catch (error) {
      setAuthError(error.message || "Could not resend code.");
    } finally {
      setAuthLoading(false);
    }
  });

  elements.authVerifyBackButton?.addEventListener("click", () => {
    state.auth.verifyStep = false;
    state.auth.verifyEmail = "";
    state.auth.verifyMode = "signup";
    state.auth.resetSignIn = null;
    state.auth.resendCooldownUntil = 0;
    setAuthInfo("");
    setAuthError("");
    syncResendCooldownButton();
    renderAuthMode();
  });

  elements.authForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (state.auth.verifyStep) {
      return;
    }
    const mode = state.auth.formMode === "signup" ? "signup" : "login";
    const username = elements.authUsername?.value || "";
    const email = elements.authEmail?.value || "";
    const password = elements.authPassword?.value || "";
    try {
      setAuthLoading(true, mode === "signup" ? "Creating account..." : "Signing in...");
      setAuthInfo("");
      await authenticateWithEmailPassword({ mode, username, email, password });
      await syncAuthenticatedUser(true);
      setAuthError("");
      setAuthenticated(true);
      setAdminSessionToken("");
      await loadSubscriptionStatus();
      showAppShell();
      await bootDashboard();
      elements.authForm?.reset();
      state.auth.formMode = "login";
      state.auth.verifyStep = false;
      state.auth.verifyEmail = "";
      state.auth.verifyMode = "signup";
      state.auth.resetSignIn = null;
      state.auth.resendCooldownUntil = 0;
      syncResendCooldownButton();
      renderAuthMode();
    } catch (error) {
      setAuthenticated(false);
      if (!state.auth.verifyStep) {
        setAuthError(error.message || "Authentication failed.");
      }
      elements.authPassword?.select();
    } finally {
      setAuthLoading(false);
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
    if (strategyRequiresPro(nextStrategy) && !hasProAccess()) {
      showPaywall("AI and Hedgefund strategies require Pro subscription.");
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
          elements.alertsMeta.textContent = t("alerts.cached");
        } else {
          renderAlertsWarning(t("alerts.retryGeneric"));
        }
        queueAlertsRetry(true);
      });
      loadOpportunities(true).catch((error) => {
        console.error("[frontend] opportunity refresh failed", error);
        renderOpportunityWarning(t("signals.retrying"));
      });
      await loadSymbol(state.selectedSymbol, true);
    }
  };

  elements.logoutButton.addEventListener("click", async () => {
    try {
      await state.auth.client?.signOut?.();
    } catch (error) {
      console.error("[frontend] signout failed", error);
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
    try {
      await state.auth.client?.signOut?.();
    } catch (error) {
      console.error("[frontend] signout failed", error);
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

function ensureAppBindings() {
  if (state.appBindingsReady) {
    return;
  }
  bindApp();
  state.appBindingsReady = true;
}

function releaseBootAnimationFreeze() {
  if (!document.body.classList.contains("booting")) {
    return;
  }
  window.setTimeout(() => {
    document.body.classList.remove("booting");
  }, BOOT_ANIMATION_FREEZE_MS);
}

function deferToNextFrame() {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
}

async function initializeApp() {
  await deferToNextFrame();
  initI18n();
  releaseBootAnimationFreeze();
  try {
    await initializeManagedAuth();
    await restoreAdminSessionUser();
  } catch (error) {
    console.error("[frontend] auth init failed", error);
    state.auth.enabled = false;
    renderAuthMode();
    setAuthError("Login setup failed.");
  } finally {
    setAuthLoading(false);
  }

  bindAuth();

  if (isAuthenticated()) {
    ensureAppBindings();
    await loadSubscriptionStatus();
    if (strategyRequiresPro(state.selectedStrategy) && !hasProAccess()) {
      persistSelectedStrategy("simple");
    }
    showAppShell();
    void bootDashboard();
    return;
  }

  showLoginOverlay();
}

function scheduleAppBootstrap() {
  const run = () => {
    void initializeApp();
  };

  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(
      () => {
        window.requestAnimationFrame(run);
      },
      { timeout: 1200 }
    );
    return;
  }

  window.requestAnimationFrame(() => {
    window.setTimeout(run, 40);
  });
}

scheduleAppBootstrap();
