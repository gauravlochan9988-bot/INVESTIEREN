import requests

BASE_URL = "http://localhost:8000"
TIMEOUT = 30

def test_health_check_endpoint_returns_server_status():
    url = f"{BASE_URL}/api/health"
    headers = {"Accept": "application/json"}

    # Test healthy server response
    try:
        response = requests.get(url, headers=headers, timeout=TIMEOUT)
        if response.status_code == 200:
            json_data = response.json()
            assert 'status' in json_data and json_data['status'] == 'ok', f"Expected status 'ok', got {json_data}"
        elif response.status_code == 500:
            json_data = response.json()
            assert json_data == {"status":"error","detail":"database unavailable"}, f"Expected database unavailable error, got {json_data}"
        else:
            assert False, f"Unexpected status code {response.status_code} with content {response.text}"
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

test_health_check_endpoint_returns_server_status()
