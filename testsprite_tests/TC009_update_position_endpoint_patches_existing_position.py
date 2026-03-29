import requests

BASE_URL = "http://127.0.0.1:8000"
TIMEOUT = 30
HEADERS = {"Content-Type": "application/json"}


def test_TC009_update_position_endpoint_patches_existing_position():
    create_url = f"{BASE_URL}/api/portfolio/positions"
    patch_url_template = f"{BASE_URL}/api/portfolio/positions/{{}}"
    delete_url_template = f"{BASE_URL}/api/portfolio/positions/{{}}"

    # Create a new position to update
    create_payload = {
        "symbol": "AAPL",
        "quantity": 10,
        "entry_price": 150.0
    }

    position_id = None

    try:
        # Create position
        create_resp = requests.post(create_url, json=create_payload, headers=HEADERS, timeout=TIMEOUT)
        assert create_resp.status_code == 201, f"Expected 201 on position creation, got {create_resp.status_code}"
        create_data = create_resp.json()
        assert "id" in create_data, "Created position response missing id"
        position_id = create_data["id"]

        # PATCH existing position
        patch_payload = {
            "quantity": 15,
            "entry_price": 155.0
        }
        patch_resp = requests.patch(patch_url_template.format(position_id), json=patch_payload, headers=HEADERS, timeout=TIMEOUT)
        assert patch_resp.status_code == 200, f"Expected 200 on patch, got {patch_resp.status_code}"
        patch_data = patch_resp.json()
        assert patch_data.get("id") == position_id, "Patched position id mismatch"
        assert patch_data.get("quantity") == 15, f"Expected quantity updated to 15, got {patch_data.get('quantity')}"
        assert patch_data.get("entry_price") == 155.0, f"Expected entry_price updated to 155, got {patch_data.get('entry_price')}"

        # PATCH non-existent position should return 404
        fake_id = 999999999
        patch_resp_notfound = requests.patch(patch_url_template.format(fake_id), json=patch_payload, headers=HEADERS, timeout=TIMEOUT)
        assert patch_resp_notfound.status_code == 404, f"Expected 404 for non-existent position patch, got {patch_resp_notfound.status_code}"
        notfound_data = patch_resp_notfound.json()
        assert "detail" in notfound_data and "not found" in notfound_data["detail"].lower(), "Expected 'position not found' detail in 404 response"

    finally:
        # Cleanup: delete the created position if it exists
        if position_id is not None:
            requests.delete(delete_url_template.format(position_id), headers=HEADERS, timeout=TIMEOUT)


test_TC009_update_position_endpoint_patches_existing_position()
