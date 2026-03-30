def test_root_serves_static_dashboard(client):
    response = client.get("/")

    assert response.status_code == 200
    assert "Investieren MVP" in response.text
    assert "Search all stocks, ETFs or companies" in response.text
    assert "Tracked names" in response.text
    assert "Selected Asset" in response.text
    assert "Portfolio" in response.text
    assert "Select a stock to start analysis" in response.text
    assert "Search or choose a stock from the watchlist to load live analysis." in response.text
    assert 'id="brandHomeButton"' in response.text
    assert 'id="resetViewButton"' in response.text
    assert 'id="refreshStocks"' in response.text
    assert 'id="decisionPanel" class="decision-panel" hidden' in response.text
    assert 'id="actionPanel" class="action-panel" hidden' in response.text
    assert 'id="chartPanel" class="panel chart-panel" hidden' in response.text
    assert 'id="signalsPanel" class="panel signals-panel" hidden' in response.text
    assert 'id="contextSection" class="panel detail-section context-section" hidden' in response.text


def test_static_assets_are_available(client):
    response = client.get("/static/app.js")

    assert response.status_code == 200
    assert "async function analyze" in response.text
    assert "renderAnalysis" in response.text
    assert "renderSearchSuggestions" in response.text
    assert "directSymbolCandidate" in response.text
    assert "loadUniverse" in response.text
    assert "RequestTimeoutError" in response.text
    assert "withRefresh" in response.text
    assert "brandHomeButton" in response.text
    assert "/api/search/universe" in response.text
    assert "/api/search" in response.text
    assert "No results" in response.text
    assert "No live market data available" in response.text
    assert "The market bias is visible, but not strong enough for a clean trade." in response.text
    assert "No chart or analysis is shown without live market data." in response.text
    assert "displayRecommendation" in response.text
    assert "classifyDataIssue" in response.text
    assert "convictionLabel" in response.text
    assert "setupStateLabel" in response.text
    assert "marketBiasLabel" in response.text
    assert "prioritizedWarnings" in response.text
    assert "analysis.no_data" in response.text
    assert "localStorage" in response.text
    assert "showAppShell" in response.text
    assert "resetDashboardView" in response.text
    assert "setAnalysisSectionsVisible" in response.text
    assert "focus names" in response.text
