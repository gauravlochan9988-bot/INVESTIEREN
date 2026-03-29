import requests

def test_analysisendpointreturnsrecommendation():
    base_url = "http://127.0.0.1:8000"
    analyze_endpoint = f"{base_url}/api/analyze"
    headers = {"Content-Type": "application/json"}
    payload = {
        "symbol": "AAPL",
        "range": "1mo"
    }
    try:
        response = requests.post(analyze_endpoint, json=payload, headers=headers, timeout=30)
    except requests.RequestException as e:
        assert False, f"Request to /api/analyze failed: {e}"

    assert response.status_code == 200, f"Expected status code 200, got {response.status_code}"
    try:
        data = response.json()
    except ValueError:
        assert False, "Response is not valid JSON"

    # Assert the recommendation field is one of the expected values
    recommendation = data.get("recommendation")
    assert recommendation in ("BUY", "HOLD", "SELL", "NO_TRADE"), \
        f"Invalid recommendation value: {recommendation}"

    # Assert the presence of required keys
    assert "score_breakdown" in data, "Missing score_breakdown in response"
    assert isinstance(data["score_breakdown"], dict), "score_breakdown should be a dict"

    # Confidence should be present and a number (float or int)
    confidence = data.get("confidence")
    assert confidence is not None, "Missing confidence in response"
    assert isinstance(confidence, (float, int)), f"Confidence should be a number, got {type(confidence)}"

    # Warnings should be present and be a list
    warnings = data.get("warnings")
    assert warnings is not None, "Missing warnings in response"
    assert isinstance(warnings, list), f"Warnings should be a list, got {type(warnings)}"

    # Position size should be present and a number (float or int)
    position_size = data.get("position_size")
    assert position_size is not None, "Missing position_size in response"
    assert isinstance(position_size, (float, int)), f"Position_size should be a number, got {type(position_size)}"

    # Entry and exit guidance fields should be present as strings or dicts if provided
    # We check at least one of entry or exit guidance keys presence (entry guidance and exit guidance expected)
    entry_guidance = data.get("entry_guidance")
    exit_guidance = data.get("exit_guidance")
    assert entry_guidance is not None or exit_guidance is not None, "Missing entry_guidance and exit_guidance both"

    if entry_guidance is not None:
        assert isinstance(entry_guidance, (str, dict)), f"entry_guidance should be str or dict, got {type(entry_guidance)}"
    if exit_guidance is not None:
        assert isinstance(exit_guidance, (str, dict)), f"exit_guidance should be str or dict, got {type(exit_guidance)}"

test_analysisendpointreturnsrecommendation()