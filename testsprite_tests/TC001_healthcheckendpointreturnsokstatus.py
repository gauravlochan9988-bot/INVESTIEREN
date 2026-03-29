import requests

def test_healthcheckendpointreturnsokstatus():
    base_url = "http://127.0.0.1:8000"
    url = f"{base_url}/api/health"

    try:
        response = requests.get(url, timeout=30)
    except requests.RequestException as e:
        assert False, f"Request to {url} failed: {e}"

    assert response.status_code == 200, f"Expected status code 200 but got {response.status_code}"
    try:
        json_data = response.json()
    except ValueError:
        assert False, "Response content is not valid JSON"

    assert isinstance(json_data, dict), "Response JSON is not a dictionary"
    assert json_data.get("status") == "ok", f"Expected status 'ok' but got {json_data.get('status')}"

test_healthcheckendpointreturnsokstatus()