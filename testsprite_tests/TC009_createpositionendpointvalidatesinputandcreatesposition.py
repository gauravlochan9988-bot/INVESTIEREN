import requests

BASE_URL = "http://127.0.0.1:8000"
HEADERS = {"Content-Type": "application/json"}
TIMEOUT = 30

def test_create_position_endpoint_validates_input_and_creates_position():
    valid_payload = {
        "symbol": "AAPL",
        "quantity": 10,
        "entry_price": 150
    }
    invalid_payload = {
        "symbol": "AAPL",
        "quantity": 0,
        "entry_price": 150
    }

    created_position_id = None

    # Test valid input - expect 201 Created and position returned
    try:
        response = requests.post(
            f"{BASE_URL}/api/portfolio/positions",
            json=valid_payload,
            headers=HEADERS,
            timeout=TIMEOUT
        )
        assert response.status_code == 201, f"Expected 201 but got {response.status_code}"
        data = response.json()
        assert data.get("id") is not None, "Response missing position ID"
        assert data.get("symbol") == valid_payload["symbol"]
        assert data.get("quantity") == valid_payload["quantity"]
        assert abs(data.get("entry_price", 0) - valid_payload["entry_price"]) < 1e-6
        created_position_id = data["id"]
    except Exception as e:
        raise AssertionError(f"Valid input test failed: {e}")

    # Test invalid input - quantity 0, expect 422 or 400 validation error
    try:
        response_invalid = requests.post(
            f"{BASE_URL}/api/portfolio/positions",
            json=invalid_payload,
            headers=HEADERS,
            timeout=TIMEOUT
        )
        assert response_invalid.status_code in (400, 422), (
            f"Expected 422 or 400 for invalid quantity but got {response_invalid.status_code}"
        )
    except Exception as e:
        raise AssertionError(f"Invalid input test failed: {e}")

    # Cleanup created position
    if created_position_id is not None:
        try:
            del_resp = requests.delete(
                f"{BASE_URL}/api/portfolio/positions/{created_position_id}",
                headers=HEADERS,
                timeout=TIMEOUT
            )
            # We accept 204 No Content or 200 OK on delete cleanup
            assert del_resp.status_code in (200, 204), (
                f"Cleanup delete failed with status {del_resp.status_code}"
            )
        except Exception as e:
            # Log cleanup error but do not fail the test because of it
            print(f"Warning: Cleanup delete position failed: {e}")

test_create_position_endpoint_validates_input_and_creates_position()