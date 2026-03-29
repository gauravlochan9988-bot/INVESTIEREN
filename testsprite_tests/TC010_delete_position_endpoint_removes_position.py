import requests
import uuid

BASE_URL = "http://localhost:8000"
TIMEOUT = 30

def test_delete_position_endpoint_removes_position():
    # First create a new position to delete
    create_url = f"{BASE_URL}/api/portfolio/positions"
    delete_url_template = f"{BASE_URL}/api/portfolio/positions/{{}}"
    position_data = {
        "symbol": "AAPL",
        "quantity": 10,
        "entry_price": 150.0
    }

    created_position_id = None
    try:
        # Create a new position
        create_response = requests.post(create_url, json=position_data, timeout=TIMEOUT)
        assert create_response.status_code == 201, f"Expected 201, got {create_response.status_code}"
        created_position = create_response.json()
        assert "id" in created_position and isinstance(created_position["id"], int), "Created position missing valid 'id'"
        created_position_id = created_position["id"]

        # Delete the created position
        delete_response = requests.delete(delete_url_template.format(created_position_id), timeout=TIMEOUT)
        assert delete_response.status_code == 204, f"Expected 204, got {delete_response.status_code}"
        assert delete_response.text == "", "Expected empty response body on successful delete"

        # Verify deleting again returns 404 (position no longer exists)
        delete_again_response = requests.delete(delete_url_template.format(created_position_id), timeout=TIMEOUT)
        assert delete_again_response.status_code == 404, f"Expected 404 for non-existent position, got {delete_again_response.status_code}"
        error_body = delete_again_response.json()
        assert "detail" in error_body and error_body["detail"] == "position not found", f"Expected detail 'position not found', got {error_body}"

        # Verify deleting a completely random/nonexistent id returns 404
        random_id = 999999999  # Large number unlikely to exist
        delete_random_response = requests.delete(delete_url_template.format(random_id), timeout=TIMEOUT)
        assert delete_random_response.status_code == 404, f"Expected 404 for random non-existent position, got {delete_random_response.status_code}"
        error_body = delete_random_response.json()
        assert "detail" in error_body and error_body["detail"] == "position not found", f"Expected detail 'position not found', got {error_body}"

    finally:
        # Cleanup if the position was not deleted
        if created_position_id is not None:
            requests.delete(delete_url_template.format(created_position_id), timeout=TIMEOUT)

test_delete_position_endpoint_removes_position()
