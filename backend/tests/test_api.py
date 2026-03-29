def test_stocks_endpoint_returns_watchlist(client):
    response = client.get("/api/stocks")

    assert response.status_code == 200
    payload = response.json()
    assert [stock["symbol"] for stock in payload] == ["AAPL", "MSFT", "TSLA", "NVDA", "AMZN"]


def test_search_endpoint_returns_global_symbol_results(client):
    response = client.get("/api/search", params={"q": "ap"})

    assert response.status_code == 200
    assert response.json() == [
        {"symbol": "AAPL", "name": "Apple Inc"},
        {"symbol": "APD", "name": "Air Products and Chemicals"},
    ]


def test_analyze_endpoint_returns_decision_payload(client):
    response = client.post("/api/analyze", json={"symbol": "AAPL"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["symbol"] == "AAPL"
    assert payload["recommendation"] in {"BUY", "HOLD", "SELL"}
    assert 0 <= payload["probability_up"] <= 1
    assert 0 <= payload["probability_down"] <= 1
    assert isinstance(payload["warnings"], list)
    assert set(payload["macro"]) == {
        "market_trend",
        "interest_rate_effect",
        "usd_strength",
        "macro_score",
    }
    assert isinstance(payload["no_trade"], bool)
    assert isinstance(payload["no_trade_reason"], str)
    assert isinstance(payload["entry_signal"], bool)
    assert isinstance(payload["exit_signal"], bool)
    assert isinstance(payload["stop_loss_level"], float)
    assert isinstance(payload["position_size_percent"], float)
    assert payload["timeframe"] in {"short_term", "mid_term", "unclear"}
    assert payload["summary"].startswith("AAPL ->")
    assert "entry=" in payload["summary"]
    assert set(payload["signals"]) == {
        "trend",
        "sma_crossover",
        "rsi",
        "momentum",
        "volatility",
        "news_sentiment",
        "trend_strength",
    }


def test_analyze_endpoint_accepts_symbol_outside_watchlist(client):
    response = client.post("/api/analyze", json={"symbol": "NFLX"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["symbol"] == "NFLX"
    assert payload["recommendation"] in {"BUY", "HOLD", "SELL"}


def test_analysis_get_endpoint_returns_nested_signal_block(client):
    response = client.get("/api/analysis/AAPL")

    assert response.status_code == 200
    payload = response.json()
    assert payload["symbol"] == "AAPL"
    assert payload["recommendation"] in {"BUY", "HOLD", "SELL"}
    assert "no_trade" in payload
    assert "no_trade_reason" in payload
    assert "entry_reason" in payload
    assert "exit_reason" in payload
    assert "stop_loss_reason" in payload
    assert "position_size_reason" in payload
    assert payload["macro"]["market_trend"] in {"bullish", "neutral", "bearish"}
    assert payload["macro"]["interest_rate_effect"] in {"positive", "neutral", "negative"}
    assert payload["macro"]["usd_strength"] in {"weak", "neutral", "strong"}
    assert payload["signals"]["news_sentiment"]["name"] == "News Sentiment"
    assert payload["signals"]["trend_strength"]["name"] == "Trend Strength"


def test_portfolio_crud_flow(client, sample_position_payload):
    create_response = client.post("/api/portfolio/positions", json=sample_position_payload)

    assert create_response.status_code == 201
    created = create_response.json()
    assert created["symbol"] == "AAPL"
    assert created["market_value"] > 0

    get_response = client.get("/api/portfolio")
    assert get_response.status_code == 200
    snapshot = get_response.json()
    assert snapshot["cost_basis"] == round(3 * 155.5, 2)
    assert len(snapshot["positions"]) == 1

    patch_response = client.patch(
        f"/api/portfolio/positions/{created['id']}",
        json={"quantity": 5, "average_price": 150.0},
    )
    assert patch_response.status_code == 200
    updated = patch_response.json()
    assert updated["quantity"] == 5
    assert updated["average_price"] == 150.0

    delete_response = client.delete(f"/api/portfolio/positions/{created['id']}")
    assert delete_response.status_code == 204

    final_snapshot = client.get("/api/portfolio").json()
    assert final_snapshot["positions"] == []
    assert final_snapshot["market_value"] == 0.0


def test_error_payload_uses_consistent_error_shape(client):
    response = client.get("/api/stocks/ZZZZ/history?range=1mo")

    assert response.status_code == 404
    assert "error" in response.json()
