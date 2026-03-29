import requests

BASE_URL = "http://localhost:8000"
API_STOCKS_PATH = "/api/stocks"
TIMEOUT = 30


def test_stocks_endpoint_returns_demo_watchlist_with_live_quotes():
    url = BASE_URL + API_STOCKS_PATH
    try:
        response = requests.get(url, timeout=TIMEOUT)
        if response.status_code == 200:
            data = response.json()
            # Assert response is a list/array
            assert isinstance(data, list), f"Expected list response, got {type(data)}"
            # Each item should at least have symbol, and quote with price, change, and timestamp
            for item in data:
                assert isinstance(item, dict), "Each item should be a dict"
                assert "symbol" in item, "Item missing 'symbol' key"
                assert isinstance(item["symbol"], str), "'symbol' should be a string"
                # Expect quote info
                assert "price" in item or "change" in item or "timestamp" in item, (
                    "Item should contain at least 'price', 'change', or 'timestamp'"
                )
                # Validate price if present
                if "price" in item:
                    assert isinstance(item["price"], (int, float)), "'price' should be a number"
                if "change" in item:
                    assert isinstance(item["change"], (int, float)), "'change' should be a number"
                if "timestamp" in item:
                    # timestamp should be string (sortable datetime ISO format)
                    assert isinstance(item["timestamp"], str), "'timestamp' should be a string"
        elif response.status_code == 503:
            error_json = response.json()
            assert error_json == {"detail": "market data unavailable"}, (
                "Expected error JSON {'detail': 'market data unavailable'}"
            )
        else:
            assert False, f"Unexpected status code: {response.status_code} with body: {response.text}"
    except requests.RequestException as e:
        assert False, f"Request to {url} failed with exception: {e}"


test_stocks_endpoint_returns_demo_watchlist_with_live_quotes()