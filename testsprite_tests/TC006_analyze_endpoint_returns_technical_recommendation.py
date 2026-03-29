import requests

BASE_URL = "http://localhost:8000"
TIMEOUT = 30
HEADERS = {"Content-Type": "application/json"}

def test_analyze_endpoint_returns_technical_recommendation():
    url = f"{BASE_URL}/api/analyze"

    # Successful case with symbol and range
    payload_valid = {
        "symbol": "AAPL",
        "range": "1mo"
    }
    response = requests.post(url, json=payload_valid, headers=HEADERS, timeout=TIMEOUT)
    assert response.status_code == 200, f"Expected status 200, got {response.status_code}"
    data = response.json()
    # Validate fields in response
    assert "recommendation" in data, "Missing recommendation in response"
    assert data["recommendation"] in {"BUY", "HOLD", "SELL", "NO_TRADE"}, "Invalid recommendation value"
    # score_breakdown might be present
    if "score_breakdown" in data:
        assert isinstance(data["score_breakdown"], dict), "score_breakdown should be a dict"
    assert "confidence" in data, "Missing confidence in response"
    assert isinstance(data["confidence"], (int, float)), "confidence should be a number"
    assert "warnings" in data, "Missing warnings in response"
    assert isinstance(data["warnings"], list), "warnings should be a list"
    # position_size might be present
    if "position_size" in data:
        # position_size can be any type as per PRD (likely number)
        pass
    # If NO_TRADE in recommendation, warnings expected
    if data["recommendation"] == "NO_TRADE":
        assert len(data["warnings"]) > 0, "Expected warnings for NO_TRADE recommendation"

    # Error case: missing symbol key should cause 422 validation error
    payload_missing_symbol = {
        "range": "1mo"
    }
    response = requests.post(url, json=payload_missing_symbol, headers=HEADERS, timeout=TIMEOUT)
    assert response.status_code == 422, f"Expected 422 for missing symbol, got {response.status_code}"

test_analyze_endpoint_returns_technical_recommendation()
