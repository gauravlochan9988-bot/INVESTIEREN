import requests

BASE_URL = "http://localhost:8000"
SEARCH_ENDPOINT = f"{BASE_URL}/api/search"
TIMEOUT = 30
HEADERS = {"accept": "application/json"}

def test_search_endpoint_returns_matching_symbols():
    # 1. Test valid query parameter q with expected matches (e.g. "AAPL")
    params = {"q": "AAPL"}
    response = requests.get(SEARCH_ENDPOINT, headers=HEADERS, params=params, timeout=TIMEOUT)
    assert response.status_code == 200, f"Expected 200 but got {response.status_code}"
    data = response.json()
    assert isinstance(data, list), "Response should be a list"
    # Each item should have at least symbol and some metadata keys (symbol string check)
    for item in data:
        assert isinstance(item, dict), "Each item should be a dict"
        assert "symbol" in item and isinstance(item["symbol"], str), "Each item must contain 'symbol' as a string"

    # 2. Test missing query parameter q to receive 422 validation error
    response_missing_q = requests.get(SEARCH_ENDPOINT, headers=HEADERS, timeout=TIMEOUT)
    assert response_missing_q.status_code == 422, f"Expected 422 but got {response_missing_q.status_code}"
    error_json = response_missing_q.json()
    assert "detail" in error_json, "Response should contain validation error details"
    assert isinstance(error_json["detail"], list) and len(error_json["detail"]) > 0, "'detail' must be a non-empty list of validation errors"

    # 3. Test query parameter q that yields no results (e.g. "INVALID_SYMBOL")
    params_no_match = {"q": "INVALID_SYMBOL"}
    response_no_match = requests.get(SEARCH_ENDPOINT, headers=HEADERS, params=params_no_match, timeout=TIMEOUT)
    assert response_no_match.status_code == 200, f"Expected 200 but got {response_no_match.status_code}"
    data_no_match = response_no_match.json()
    assert isinstance(data_no_match, list), "Response should be a list"
    assert len(data_no_match) == 0, "Expected empty list for no matching symbols"

test_search_endpoint_returns_matching_symbols()
