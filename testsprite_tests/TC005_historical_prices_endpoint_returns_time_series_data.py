import requests

BASE_URL = "http://localhost:8000"
HEADERS = {"Accept": "application/json"}
TIMEOUT = 30

def test_historical_prices_endpoint_returns_time_series_data():
    symbol_valid = "AAPL"
    range_param = "1mo"
    valid_url = f"{BASE_URL}/api/stocks/{symbol_valid}/history"
    params = {"range": range_param}

    # Test valid symbol - expect 200 with OHLCV time-series data
    response = requests.get(valid_url, headers=HEADERS, params=params, timeout=TIMEOUT)
    assert response.status_code == 200, f"Expected 200 but got {response.status_code}"
    data = response.json()

    # Validate presence of time-series data with OHLCV keys for first item if list is not empty
    assert isinstance(data, list), "Expected response to be a list"
    if len(data) > 0:
        first_entry = data[0]
        for key in ["open", "high", "low", "close", "volume"]:
            assert key in first_entry, f"Missing '{key}' in OHLCV data"

    # Test unknown symbol - expect 404 with {"detail":"symbol not found"}
    symbol_unknown = "UNKNOWN"
    invalid_url = f"{BASE_URL}/api/stocks/{symbol_unknown}/history"
    response_404 = requests.get(invalid_url, headers=HEADERS, params=params, timeout=TIMEOUT)
    assert response_404.status_code == 404, f"Expected 404 but got {response_404.status_code}"
    error_detail = response_404.json()
    assert error_detail == {"detail": "symbol not found"}, f"Unexpected error detail: {error_detail}"

test_historical_prices_endpoint_returns_time_series_data()
