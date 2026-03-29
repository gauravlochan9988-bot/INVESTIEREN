import requests

BASE_URL = "http://127.0.0.1:8000"
TIMEOUT = 30
HEADERS = {"Content-Type": "application/json"}


def test_portfolio_endpoint_returns_user_portfolio_summary():
    # First, ensure that the portfolio is non-empty by creating a position
    position_data = {
        "symbol": "AAPL",
        "quantity": 1,
        "entry_price": 150.0
    }
    created_position_id = None

    try:
        # Create a new position to ensure portfolio has holdings
        create_resp = requests.post(
            f"{BASE_URL}/api/portfolio/positions",
            json=position_data,
            headers=HEADERS,
            timeout=TIMEOUT,
        )
        assert create_resp.status_code == 201, f"Expected 201 Created, got {create_resp.status_code}"
        created_position = create_resp.json()
        created_position_id = created_position.get("id")
        assert created_position_id is not None, "Created position ID missing"

        # GET portfolio when it has holdings
        get_resp = requests.get(
            f"{BASE_URL}/api/portfolio",
            headers=HEADERS,
            timeout=TIMEOUT,
        )
        assert get_resp.status_code == 200, f"Expected 200 OK, got {get_resp.status_code}"
        portfolio = get_resp.json()

        # Validate positions array exists and includes the created position
        positions = portfolio.get("positions")
        assert isinstance(positions, list), "`positions` should be a list"
        assert any(pos.get("id") == created_position_id for pos in positions), "Created position not found in portfolio"

        # Validate aggregated PnL exists and is a number (int or float)
        aggregated_pnl = portfolio.get("aggregated_pnl")
        assert (isinstance(aggregated_pnl, (int, float)) or aggregated_pnl is None), "`aggregated_pnl` should be int, float or None"

        # Now delete all positions to test empty portfolio response
        for pos in positions:
            pos_id = pos.get("id")
            if pos_id:
                del_resp = requests.delete(
                    f"{BASE_URL}/api/portfolio/positions/{pos_id}",
                    headers=HEADERS,
                    timeout=TIMEOUT,
                )
                # 204 if deleted, else 404 if not found; ignore errors here for cleanup
        # GET portfolio when it has no holdings
        get_empty_resp = requests.get(
            f"{BASE_URL}/api/portfolio",
            headers=HEADERS,
            timeout=TIMEOUT,
        )
        assert get_empty_resp.status_code == 200, f"Expected 200 OK, got {get_empty_resp.status_code}"
        empty_portfolio = get_empty_resp.json()

        empty_positions = empty_portfolio.get("positions")
        assert isinstance(empty_positions, list), "`positions` should be a list"
        assert len(empty_positions) == 0, "Positions array should be empty when portfolio has no holdings"

        # aggregated_pnl should still be present and a number or None
        empty_aggregated_pnl = empty_portfolio.get("aggregated_pnl")
        assert (isinstance(empty_aggregated_pnl, (int, float)) or empty_aggregated_pnl is None), "`aggregated_pnl` should be int, float or None"

    finally:
        # Cleanup: delete created position if still exists
        if created_position_id:
            requests.delete(
                f"{BASE_URL}/api/portfolio/positions/{created_position_id}",
                headers=HEADERS,
                timeout=TIMEOUT,
            )


test_portfolio_endpoint_returns_user_portfolio_summary()
