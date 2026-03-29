import requests

def test_historicalpricesendpointreturnsdataforvalidsymbol():
    base_url = "http://127.0.0.1:8000"
    symbol = "AAPL"
    params = {"range": "1mo"}
    url = f"{base_url}/api/stocks/{symbol}/history"
    headers = {
        "Accept": "application/json"
    }
    try:
        response = requests.get(url, headers=headers, params=params, timeout=30)
        response.raise_for_status()
    except requests.exceptions.RequestException as e:
        assert False, f"Request failed: {e}"

    assert response.status_code == 200, f"Expected status code 200, got {response.status_code}"
    # Validate that response body contains time-series OHLCV data for the requested range
    data = response.json()
    # Check data is a list or similar time-series structure
    assert isinstance(data, (list, dict)), "Response data should be a list or dict representing time-series data"
    # If list, check non-empty and structure contains OHLCV keys
    if isinstance(data, list):
        assert len(data) > 0, "Time-series data list should not be empty"
        first_entry = data[0]
    elif isinstance(data, dict):
        # If dict, it may be keyed by date or other; check at least one entry with OHLCV
        assert len(data) > 0, "Time-series data dict should not be empty"
        first_entry = next(iter(data.values()))
    else:
        assert False, "Unexpected data format for time-series data"

    # Check first_entry contains required keys for OHLCV data
    required_keys = {"open", "high", "low", "close", "volume"}
    assert all(key in first_entry for key in required_keys), f"Time-series entry missing one of {required_keys}"

test_historicalpricesendpointreturnsdataforvalidsymbol()