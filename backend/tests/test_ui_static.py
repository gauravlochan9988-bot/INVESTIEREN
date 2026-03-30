def test_root_serves_static_dashboard(client):
    response = client.get("/")

    assert response.status_code == 200
    assert "Investieren AI" in response.text
    assert 'id="authOverlay"' in response.text
    assert "Enter password to open the dashboard" in response.text
    assert "Unlock dashboard" in response.text
    assert "Trading Dashboard" in response.text
    assert "Search stocks, ETFs or companies" in response.text
    assert "Live Quotes" in response.text
    assert "TradingView" in response.text
    assert "Company Snapshot" in response.text
    assert "Company headlines" in response.text
    assert 'id="brandHomeButton"' in response.text
    assert 'id="logoutButton"' in response.text
    assert 'id="refreshButton"' in response.text
    assert 'id="watchlistBody"' in response.text
    assert 'id="tradingviewChart"' in response.text
    assert 'id="newsList"' in response.text


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
    assert "sessionStorage" in response.text
    assert 'const AUTH_PASSWORD = "9988"' in response.text
    assert "showLoginOverlay" in response.text
    assert "showAppShell" in response.text
    assert "buildApiUrl" in response.text
    assert "TradingView.widget" in response.text
