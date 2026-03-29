import requests

def test_search_universe_endpoint_returns_full_universe():
    base_url = "http://127.0.0.1:8000"
    url = f"{base_url}/api/search/universe"
    headers = {
        "Accept": "application/json"
    }
    try:
        response = requests.get(url, headers=headers, timeout=30)
        # Assert the status code is 200 OK
        assert response.status_code == 200, f"Expected status code 200 but got {response.status_code}"

        # Assert the response is JSON and is a list (full universe list)
        json_data = response.json()
        assert isinstance(json_data, list), "Response is not a list of universe items"

        # The list should not be empty for a full universe
        assert len(json_data) > 0, "Universe list is empty"

    except requests.exceptions.RequestException as e:
        assert False, f"Request to {url} failed with exception: {e}"

test_search_universe_endpoint_returns_full_universe()