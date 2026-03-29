import requests

BASE_URL = "http://localhost:8000"
TIMEOUT = 30

def test_search_universe_endpoint_returns_full_symbol_list():
    url = f"{BASE_URL}/api/search/universe"
    headers = {
        "Accept": "application/json"
    }
    try:
        response = requests.get(url, headers=headers, timeout=TIMEOUT)
        response.raise_for_status()
    except requests.RequestException as e:
        assert False, f"Request to {url} failed: {e}"

    assert response.status_code == 200, f"Expected status 200 but got {response.status_code}"
    try:
        data = response.json()
    except ValueError:
        assert False, "Response is not valid JSON"

    assert isinstance(data, list), "Response JSON is not a list"
    # Additional basic check: list should not be empty
    assert len(data) > 0, "Universe list is empty"

    # Validate that each item has at least minimal expected keys like 'symbol' and 'name'
    for item in data:
        assert isinstance(item, dict), "Universe list item is not a dictionary"
        assert "symbol" in item, "Universe item missing 'symbol' key"
        assert "name" in item, "Universe item missing 'name' key"

test_search_universe_endpoint_returns_full_symbol_list()