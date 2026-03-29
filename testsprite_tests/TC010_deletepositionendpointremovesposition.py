import requests

BASE_URL = "http://127.0.0.1:8000"
TIMEOUT = 30

def test_delete_position_endpoint_removes_position():
    position_data = {
        "symbol": "AAPL",
        "quantity": 10,
        "entry_price": 150
    }
    created_position_id = None

    try:
        # Create a position to delete
        response_create = requests.post(
            f"{BASE_URL}/api/portfolio/positions",
            json=position_data,
            timeout=TIMEOUT
        )
        assert response_create.status_code == 201, f"Expected 201 on position creation, got {response_create.status_code}"
        created_position = response_create.json()
        assert "id" in created_position, "Created position response missing 'id'"
        created_position_id = created_position["id"]

        # Delete the created position
        response_delete = requests.delete(
            f"{BASE_URL}/api/portfolio/positions/{created_position_id}",
            timeout=TIMEOUT
        )
        assert response_delete.status_code == 204, f"Expected 204 on position deletion, got {response_delete.status_code}"
        assert response_delete.text == "" or response_delete.content == b"", "Expected no content in response body on delete"

        # Attempt to delete the same position again, should return 404
        response_delete_again = requests.delete(
            f"{BASE_URL}/api/portfolio/positions/{created_position_id}",
            timeout=TIMEOUT
        )
        assert response_delete_again.status_code == 404, f"Expected 404 when deleting nonexistent position, got {response_delete_again.status_code}"
        json_resp = response_delete_again.json()
        assert "detail" in json_resp and isinstance(json_resp["detail"], str), "Expected 'detail' string in 404 response"

        # Attempt to delete a position with a very unlikely ID (assume 9999999)
        response_delete_nonexistent = requests.delete(
            f"{BASE_URL}/api/portfolio/positions/9999999",
            timeout=TIMEOUT
        )
        assert response_delete_nonexistent.status_code == 404, f"Expected 404 when deleting non-existent position ID, got {response_delete_nonexistent.status_code}"
        json_resp2 = response_delete_nonexistent.json()
        assert "detail" in json_resp2 and isinstance(json_resp2["detail"], str), "Expected 'detail' string in 404 response for non-existent id"

    finally:
        # Cleanup: If position still exists (in case delete failed), try deleting it
        if created_position_id is not None:
            requests.delete(
                f"{BASE_URL}/api/portfolio/positions/{created_position_id}",
                timeout=TIMEOUT
            )

test_delete_position_endpoint_removes_position()