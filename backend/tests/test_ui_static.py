def test_root_serves_static_dashboard(client):
    response = client.get("/")

    assert response.status_code == 200
    assert "Investieren MVP" in response.text
    assert "Search symbol, stock, ETF or company" in response.text
    assert "Tracked names" in response.text
    assert "Selected Asset" in response.text
    assert "Portfolio" in response.text
    assert "Kein sinnvoller Trade aktuell" in response.text
    assert "Search for a stock to start analysis" in response.text
    assert "Need attention" in response.text
    assert "Backdrop" in response.text


def test_static_assets_are_available(client):
    response = client.get("/static/app.js")

    assert response.status_code == 200
    assert "async function analyze" in response.text
    assert "renderAnalysis" in response.text
    assert "renderSearchSuggestions" in response.text
    assert "directSymbolCandidate" in response.text
    assert "/api/search" in response.text
    assert "No results" in response.text
    assert "localStorage" in response.text
