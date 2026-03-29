import requests

BASE_URL = "http://127.0.0.1:8000"
POSITIONS_ENDPOINT = f"{BASE_URL}/api/portfolio/positions"
TIMEOUT = 30
HEADERS = {"Content-Type": "application/json"}

def test_create_position_endpoint_adds_manual_position():
    # Valid position data
    valid_position = {
        "symbol": "AAPL",
        "quantity": 10,
        "entry_price": 150.0
    }

    # Invalid position data (quantity 0)
    invalid_position = {
        "symbol": "AAPL",
        "quantity": 0,
        "entry_price": 150.0
    }

    # 1) Test creating a valid position
    position_id = None
    try:
        response = requests.post(POSITIONS_ENDPOINT, json=valid_position, headers=HEADERS, timeout=TIMEOUT)
        assert response.status_code == 201, f"Expected 201, got {response.status_code}"
        created_position = response.json()
        assert "id" in created_position, "Response JSON missing 'id'"
        assert created_position["symbol"] == valid_position["symbol"]
        assert created_position["quantity"] == valid_position["quantity"]
        assert float(created_position["entry_price"]) == valid_position["entry_price"]
        position_id = created_position["id"]

        # 2) Test creating a position with invalid quantity (0)
        response_invalid = requests.post(POSITIONS_ENDPOINT, json=invalid_position, headers=HEADERS, timeout=TIMEOUT)
        assert response_invalid.status_code == 422, f"Expected 422 for invalid quantity, got {response_invalid.status_code}"
        error_response = response_invalid.json()
        assert "detail" in error_response or isinstance(error_response, dict)

    finally:
        # Cleanup: delete the created position if exists
        if position_id:
            try:
                del_resp = requests.delete(f"{POSITIONS_ENDPOINT}/{position_id}", timeout=TIMEOUT)
                assert del_resp.status_code == 204, f"Cleanup delete failed with status {del_resp.status_code}"
            except Exception:
                pass

test_create_position_endpoint_adds_manual_position()
