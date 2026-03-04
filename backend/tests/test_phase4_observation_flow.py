"""
Phase 4: Observation Flow UI Updates - Backend API Tests
==========================================================
Tests for the observation limits APIs used in the SessionSetup page:
- GET /api/subscriptions/limits-summary
- POST /api/subscriptions/observation-limit/batch
- GET /api/subscriptions/observation-limit/{coach_id}
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "hello@mycoachdeveloper.com"
TEST_PASSWORD = "_mcDeveloper26!"

# ---------------------------------------------------
# Fixtures
# ---------------------------------------------------

@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for API calls"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
        headers={"Content-Type": "application/json"}
    )
    if response.status_code != 200:
        pytest.skip(f"Authentication failed: {response.text}")
    data = response.json()
    return data.get("token") or data.get("session_token")


@pytest.fixture
def api_client(auth_token):
    """Create authenticated API client session"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {auth_token}"
    })
    return session


# ---------------------------------------------------
# Test: GET /api/subscriptions/limits-summary
# ---------------------------------------------------

class TestLimitsSummaryAPI:
    """Tests for the limits-summary endpoint"""
    
    def test_limits_summary_returns_200(self, api_client):
        """limits-summary endpoint should return 200 OK"""
        response = api_client.get(f"{BASE_URL}/api/subscriptions/limits-summary")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"[PASS] limits-summary returns 200 OK")
    
    def test_limits_summary_has_tier_info(self, api_client):
        """limits-summary should return tier key and name"""
        response = api_client.get(f"{BASE_URL}/api/subscriptions/limits-summary")
        data = response.json()
        
        assert "tier_key" in data, "Missing tier_key in response"
        assert "tier_name" in data, "Missing tier_name in response"
        
        print(f"[PASS] tier_key: {data['tier_key']}, tier_name: {data['tier_name']}")
    
    def test_limits_summary_has_coach_limits(self, api_client):
        """limits-summary should include coach limits info"""
        response = api_client.get(f"{BASE_URL}/api/subscriptions/limits-summary")
        data = response.json()
        
        assert "coaches" in data, "Missing coaches section"
        coaches = data["coaches"]
        
        # Verify required fields
        assert "current" in coaches, "Missing coaches.current"
        assert "limit" in coaches or "is_unlimited" in coaches, "Missing coaches.limit or is_unlimited"
        
        print(f"[PASS] Coaches: current={coaches.get('current')}, limit={coaches.get('limit')}, unlimited={coaches.get('is_unlimited')}")
    
    def test_limits_summary_has_observation_limits(self, api_client):
        """limits-summary should include observation per coach limits"""
        response = api_client.get(f"{BASE_URL}/api/subscriptions/limits-summary")
        data = response.json()
        
        assert "observations_per_coach" in data, "Missing observations_per_coach section"
        obs = data["observations_per_coach"]
        
        # Verify required fields
        assert "limit" in obs or "is_unlimited" in obs, "Missing observation limit or is_unlimited"
        
        print(f"[PASS] Observations per coach: limit={obs.get('limit')}, unlimited={obs.get('is_unlimited')}")
    
    def test_limits_summary_coach_developer_tier_has_10_observations(self, api_client):
        """Coach Developer tier should have 10 observations per coach limit"""
        response = api_client.get(f"{BASE_URL}/api/subscriptions/limits-summary")
        data = response.json()
        
        tier_key = data.get("tier_key")
        obs = data.get("observations_per_coach", {})
        
        # Note: This test might vary based on actual subscription
        if tier_key == "coach_developer":
            assert obs.get("limit") == 10, f"Expected limit 10 for coach_developer, got {obs.get('limit')}"
            assert obs.get("is_unlimited") is False, "coach_developer should not be unlimited"
            print(f"[PASS] Coach Developer tier correctly shows 10 observations limit")
        else:
            print(f"[INFO] Current tier is {tier_key}, not coach_developer - skipping specific limit check")


# ---------------------------------------------------
# Test: POST /api/subscriptions/observation-limit/batch
# ---------------------------------------------------

class TestBatchObservationLimitAPI:
    """Tests for the batch observation limit endpoint"""
    
    def test_batch_endpoint_returns_200_with_empty_list(self, api_client):
        """batch endpoint should return 200 even with empty coach list"""
        response = api_client.post(
            f"{BASE_URL}/api/subscriptions/observation-limit/batch",
            json={"coach_ids": []}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"[PASS] batch endpoint returns 200 with empty list")
    
    def test_batch_endpoint_returns_dict(self, api_client):
        """batch endpoint should return a dictionary"""
        response = api_client.post(
            f"{BASE_URL}/api/subscriptions/observation-limit/batch",
            json={"coach_ids": []}
        )
        data = response.json()
        assert isinstance(data, dict), f"Expected dict, got {type(data)}"
        print(f"[PASS] batch endpoint returns dict")
    
    def test_batch_endpoint_with_coach_ids(self, api_client):
        """batch endpoint should return status for provided coach IDs"""
        # First get list of coaches
        coaches_response = api_client.get(f"{BASE_URL}/api/coaches")
        coaches = coaches_response.json() if coaches_response.status_code == 200 else []
        
        if not coaches:
            print(f"[SKIP] No coaches found to test with")
            return
        
        # Get first 3 coach IDs
        coach_ids = [c.get("id") for c in coaches[:3] if c.get("id")]
        
        if not coach_ids:
            print(f"[SKIP] No valid coach IDs found")
            return
        
        response = api_client.post(
            f"{BASE_URL}/api/subscriptions/observation-limit/batch",
            json={"coach_ids": coach_ids}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        # Verify each coach ID has status
        for coach_id in coach_ids:
            assert coach_id in data, f"Missing status for coach {coach_id}"
            status = data[coach_id]
            assert "current_count" in status, f"Missing current_count for {coach_id}"
            assert "can_observe" in status, f"Missing can_observe for {coach_id}"
            
        print(f"[PASS] batch endpoint returns status for {len(coach_ids)} coaches")
        for coach_id in coach_ids:
            s = data[coach_id]
            print(f"  - {coach_id}: count={s.get('current_count')}, limit={s.get('limit')}, can_observe={s.get('can_observe')}")
    
    def test_batch_endpoint_status_structure(self, api_client):
        """batch endpoint status should have required fields"""
        # Get coaches
        coaches_response = api_client.get(f"{BASE_URL}/api/coaches")
        coaches = coaches_response.json() if coaches_response.status_code == 200 else []
        
        if not coaches:
            print(f"[SKIP] No coaches to test status structure")
            return
        
        coach_id = coaches[0].get("id")
        if not coach_id:
            print(f"[SKIP] No valid coach ID")
            return
        
        response = api_client.post(
            f"{BASE_URL}/api/subscriptions/observation-limit/batch",
            json={"coach_ids": [coach_id]}
        )
        
        data = response.json()
        status = data.get(coach_id, {})
        
        # Verify structure
        required_fields = ["current_count", "limit", "is_unlimited", "can_observe"]
        for field in required_fields:
            assert field in status, f"Missing required field: {field}"
        
        print(f"[PASS] Status has all required fields: {required_fields}")


# ---------------------------------------------------
# Test: GET /api/subscriptions/observation-limit/{coach_id}
# ---------------------------------------------------

class TestSingleCoachObservationLimitAPI:
    """Tests for single coach observation limit endpoint"""
    
    def test_single_coach_endpoint_returns_200(self, api_client):
        """single coach endpoint should return 200"""
        # Get a coach ID
        coaches_response = api_client.get(f"{BASE_URL}/api/coaches")
        coaches = coaches_response.json() if coaches_response.status_code == 200 else []
        
        if not coaches:
            # Try with a test ID - should still work
            coach_id = "test_coach_123"
        else:
            coach_id = coaches[0].get("id", "test_coach_123")
        
        response = api_client.get(f"{BASE_URL}/api/subscriptions/observation-limit/{coach_id}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"[PASS] single coach endpoint returns 200 for coach_id={coach_id}")
    
    def test_single_coach_endpoint_response_structure(self, api_client):
        """single coach endpoint should return proper structure"""
        coaches_response = api_client.get(f"{BASE_URL}/api/coaches")
        coaches = coaches_response.json() if coaches_response.status_code == 200 else []
        
        coach_id = coaches[0].get("id") if coaches else "test_coach_123"
        
        response = api_client.get(f"{BASE_URL}/api/subscriptions/observation-limit/{coach_id}")
        data = response.json()
        
        # Verify structure
        assert "can_observe" in data, "Missing can_observe"
        assert "current_count" in data, "Missing current_count"
        assert "limit" in data or data.get("is_unlimited"), "Missing limit info"
        assert "is_unlimited" in data, "Missing is_unlimited"
        assert "tier_key" in data, "Missing tier_key"
        
        print(f"[PASS] Single coach response structure verified")
        print(f"  - can_observe: {data.get('can_observe')}")
        print(f"  - current_count: {data.get('current_count')}")
        print(f"  - limit: {data.get('limit')}")
        print(f"  - is_unlimited: {data.get('is_unlimited')}")
        print(f"  - tier_key: {data.get('tier_key')}")


# ---------------------------------------------------
# Test: API requires authentication
# ---------------------------------------------------

class TestAPIAuthentication:
    """Tests that APIs require authentication"""
    
    def test_limits_summary_requires_auth(self):
        """limits-summary should return 401 without auth"""
        response = requests.get(f"{BASE_URL}/api/subscriptions/limits-summary")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print(f"[PASS] limits-summary requires authentication")
    
    def test_batch_endpoint_requires_auth(self):
        """batch observation limit should return 401 without auth"""
        response = requests.post(
            f"{BASE_URL}/api/subscriptions/observation-limit/batch",
            json={"coach_ids": []},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print(f"[PASS] batch endpoint requires authentication")
    
    def test_single_coach_endpoint_requires_auth(self):
        """single coach observation limit should return 401 without auth"""
        response = requests.get(f"{BASE_URL}/api/subscriptions/observation-limit/test123")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print(f"[PASS] single coach endpoint requires authentication")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
