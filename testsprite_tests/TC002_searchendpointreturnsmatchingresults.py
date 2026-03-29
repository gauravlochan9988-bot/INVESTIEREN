import requests

BASE_URL = "http://127.0.0.1:8000"
TIMEOUT = 30

def test_searchendpointreturnsmatchingresults():
    url = f"{BASE_URL}/api/search"
    params = {"q": "AAPL"}
    headers = {"Accept": "application/json"}

    try:
        response = requests.get(url, params=params, headers=headers, timeout=TIMEOUT)
    except requests.RequestException as e:
        assert False, f"Request to {url} failed: {e}"

    assert response.status_code == 200, f"Expected status code 200, got {response.status_code}"

    try:
        json_data = response.json()
    except ValueError:
        assert False, "Response is not valid JSON"

    assert isinstance(json_data, list), "Response JSON is not a list"

    # If list has items, verify each item is a dict with expected keys (symbol and metadata)
    for item in json_data:
        assert isinstance(item, dict), "Each item in response list must be a dict"
        assert "symbol" in item or "name" in item, "Each item must have at least 'symbol' or 'name' key"

test_searchendpointreturnsmatchingresults()