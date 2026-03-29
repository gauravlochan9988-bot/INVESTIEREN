import requests

def test_search_endpoint_validation_error_for_missing_query():
    base_url = "http://127.0.0.1:8000"
    url = f"{base_url}/api/search"
    try:
        response = requests.get(url, timeout=30)
        assert response.status_code == 422, f"Expected status 422 but got {response.status_code}"
        json_response = response.json()
        # Basic validation: FastAPI uses detail with list of validation errors
        assert "detail" in json_response, "'detail' key not found in response JSON"
        # The detail should indicate a missing required query parameter 'q'
        error_found = False
        if isinstance(json_response["detail"], list):
            for err in json_response["detail"]:
                if (
                    isinstance(err, dict)
                    and err.get("loc") is not None
                    and "query" in err.get("loc")  # query parameter location
                    and err.get("msg") is not None
                    and ("field required" in err.get("msg").lower() or "missing" in err.get("msg").lower())
                ):
                    error_found = True
                    break
        assert error_found, "Validation error for missing query parameter 'q' not found in response detail"
    except requests.RequestException as e:
        assert False, f"Request to {url} failed with exception: {e}"

test_search_endpoint_validation_error_for_missing_query()