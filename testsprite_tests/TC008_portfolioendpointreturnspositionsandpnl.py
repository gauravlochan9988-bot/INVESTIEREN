import requests

BASE_URL = "http://127.0.0.1:8000"
TIMEOUT = 30

def test_portfolio_endpoint_returns_positions_and_pnl():
    url = f"{BASE_URL}/api/portfolio"
    try:
        response = requests.get(url, timeout=TIMEOUT)
    except requests.RequestException as e:
        assert False, f"Request to {url} failed with exception: {e}"

    assert response.status_code == 200, f"Expected status code 200, got {response.status_code}"

    try:
        json_data = response.json()
    except ValueError:
        assert False, "Response is not valid JSON"

    assert isinstance(json_data, dict), "Response JSON is not a dictionary"

    # Validate keys 'positions' and aggregated PnL fields
    assert "positions" in json_data, "'positions' key missing in response"
    positions = json_data["positions"]
    assert isinstance(positions, list), "'positions' should be an array"

    # Aggregated PnL: expect a key like 'aggregated_pnl' or similar, but PRD does not specify exact key.
    # We will check at least one other numeric field typically named pnl or aggregated_pnl
    pnl_keys_candidates = [key for key in json_data if "pnl" in key.lower()]
    assert pnl_keys_candidates, "No key containing 'pnl' found in response for aggregated PnL"

    for pnl_key in pnl_keys_candidates:
        pnl_value = json_data[pnl_key]
        assert isinstance(pnl_value, (int, float)), f"Aggregated PnL value for '{pnl_key}' should be numeric"

test_portfolio_endpoint_returns_positions_and_pnl()