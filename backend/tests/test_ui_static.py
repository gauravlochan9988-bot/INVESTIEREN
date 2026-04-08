def test_root_serves_static_dashboard(client):
    response = client.get("/")

    assert response.status_code == 200
    assert "Investieren AI" in response.text
    assert 'id="authOverlay"' in response.text
    assert "Access dashboard" in response.text
    assert "Continue with Google" in response.text
    assert "Continue with Apple" in response.text
    assert "Create Account" in response.text
    assert "Login" in response.text
    assert 'id="authManagedPanel"' in response.text
    assert 'id="paywallOverlay"' in response.text
    assert "Upgrade to unlock the dashboard" in response.text
    assert "Upgrade €9.99 / month" in response.text
    assert 'placeholder="Search"' in response.text
    assert "Quotes" in response.text
    assert "TradingView" in response.text
    assert "Snapshot" in response.text
    assert "Learning Stats" in response.text
    assert "Learning" in response.text
    assert "Trade decision" in response.text
    assert 'id="recommendationIcon"' in response.text
    assert 'id="signalQualityBadge"' in response.text
    assert 'id="conflictBadge"' in response.text
    assert 'id="brandHomeButton"' in response.text
    assert 'id="logoutButton"' in response.text
    assert 'id="refreshButton"' in response.text
    assert 'id="watchlistBody"' in response.text
    assert 'id="tradingviewChart"' in response.text
    assert 'id="alertsList"' in response.text
    assert 'id="learningSection"' in response.text
    assert 'id="learningMeta"' in response.text
    assert 'id="learningList"' in response.text
    assert 'id="mobileQuickActions"' in response.text
    assert 'id="mobileFavoriteButton"' in response.text
    assert 'id="mobileAlertButton"' in response.text
    assert 'id="mobilePortfolioButton"' in response.text


def test_static_assets_are_available(client):
    response = client.get("/static/app.js")

    assert response.status_code == 200
    assert "loadWatchlist" in response.text
    assert "loadSymbol" in response.text
    assert "renderTradingView" in response.text
    assert "loadBackendHealth" in response.text
    assert "/api/dashboard/watchlist" in response.text
    assert "/api/dashboard/symbol/" in response.text
    assert "/api/dashboard/news/" in response.text
    assert "/api/analysis/" in response.text
    assert "/api/analysis/performance" in response.text
    assert "/api/auth/config" in response.text
    assert "/api/auth/me" in response.text
    assert "sessionStorage" in response.text
    assert "initializeManagedAuth" in response.text
    assert "createAuth0Client" in response.text
    assert "showPaywall" in response.text
    assert "hasActiveSubscription" in response.text
    assert "showLoginOverlay" in response.text
    assert "showAppShell" in response.text
    assert "buildApiUrl" in response.text
    assert "TradingView.widget" in response.text
    assert "Scroll to load chart." in response.text
    assert "renderLearningStats" in response.text
    assert "loadLearningStats" in response.text
    assert "mergeLearningInsight" in response.text
    assert "recommendationIcon(" in response.text
    assert "hasMixedSignals" in response.text
