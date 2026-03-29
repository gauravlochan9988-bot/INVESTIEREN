import requests

BASE_URL = "http://127.0.0.1:8000"
TIMEOUT = 30

def test_watchlist_endpoint_returns_live_quotes():
    url = f"{BASE_URL}/api/stocks"
    try:
        response = requests.get(url, timeout=TIMEOUT)
    except requests.RequestException as e:
        assert False, f"Request to {url} failed: {e}"
    assert response.status_code == 200, f"Expected status 200, got {response.status_code}"
    try:
        data = response.json()
    except ValueError:
        assert False, "Response is not valid JSON"
    assert isinstance(data, list), "Response JSON is not a list"
    assert len(data) > 0, "Watchlist is empty, expected symbols with live quotes"
    for entry in data:
        assert isinstance(entry, dict), "Each item in watchlist must be a dict"
        assert "symbol" in entry, "Missing 'symbol' in watchlist item"
        assert "price" in entry, "Missing 'price' in watchlist item"
        assert "change" in entry, "Missing 'change' in watchlist item"
        assert "timestamp" in entry, "Missing 'timestamp' in watchlist item"
        # Validate types
        assert isinstance(entry["symbol"], str) and entry["symbol"], "'symbol' must be non-empty string"
        # price and change should be numbers (int or float)
        assert isinstance(entry["price"], (int, float)), "'price' must be a number"
        assert isinstance(entry["change"], (int, float)), "'change' must be a number"
        # timestamp should be a non-empty string (ISO8601 or similar)
        assert isinstance(entry["timestamp"], str) and entry["timestamp"], "'timestamp' must be non-empty string"

test_watchlist_endpoint_returns_live_quotes()