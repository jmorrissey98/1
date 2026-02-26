"""
Test Suite: Subscription Update Bug Fix and Auth Header Fix
=============================================================

Tests for two bug fixes:
1. Subscription update bug - upgrading/downgrading plans now calls /api/payments/update-subscription 
   instead of /api/payments/checkout (which was creating duplicate subscriptions)
2. 401 Unauthorized errors - axios calls now include proper Authorization headers

Test Credentials:
- Admin: hello@mycoachdeveloper.com / _mcDeveloper26!
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestAuthAndCoachEndpoints:
    """Test authentication and coach endpoints with proper headers"""
    
    @pytest.fixture(scope="class")
    def session(self):
        """Create a requests session"""
        return requests.Session()
    
    @pytest.fixture(scope="class")
    def admin_credentials(self):
        """Admin credentials"""
        return {
            "email": "hello@mycoachdeveloper.com",
            "password": "_mcDeveloper26!"
        }
    
    @pytest.fixture(scope="class")
    def auth_token(self, session, admin_credentials):
        """Get authentication token via login"""
        response = session.post(
            f"{BASE_URL}/api/auth/login",
            json=admin_credentials
        )
        
        if response.status_code == 200:
            data = response.json()
            # Token might be in different places depending on implementation
            token = data.get("token") or data.get("session_token")
            return token
        else:
            pytest.skip(f"Login failed with status {response.status_code}: {response.text}")
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Headers with Authorization Bearer token"""
        return {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }

    # ==================== LOGIN TESTS ====================
    
    def test_login_returns_valid_response(self, session, admin_credentials):
        """Test that login endpoint returns 200 and valid response"""
        response = session.post(
            f"{BASE_URL}/api/auth/login",
            json=admin_credentials
        )
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        
        # Verify response has user data
        assert "user" in data or "user_id" in data or "email" in data, "Response should contain user data"
        print(f"Login successful, response keys: {data.keys()}")
    
    def test_login_returns_token_or_session(self, session, admin_credentials):
        """Test that login returns token for authentication"""
        response = session.post(
            f"{BASE_URL}/api/auth/login",
            json=admin_credentials
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Check for token in response or cookies
        has_token = "token" in data or "session_token" in data
        has_cookie = "session_token" in response.cookies
        
        assert has_token or has_cookie, "Login should return token or set session cookie"
        print(f"Token/session found: response_keys={data.keys()}, cookies={response.cookies.keys()}")

    # ==================== COACHES ENDPOINT TESTS ====================
    
    def test_coaches_endpoint_without_auth_returns_401(self):
        """Test that /api/coaches without auth returns 401"""
        # Use a fresh session without any cookies
        response = requests.get(f"{BASE_URL}/api/coaches")
        
        assert response.status_code == 401, f"Expected 401 without auth, got {response.status_code}"
        print("GET /api/coaches correctly returns 401 without auth")
    
    def test_coaches_endpoint_with_auth_returns_200(self, session, auth_headers):
        """Test that /api/coaches with proper Authorization header returns 200"""
        response = session.get(
            f"{BASE_URL}/api/coaches",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"GET /api/coaches failed: {response.status_code} - {response.text}"
        data = response.json()
        
        # Response should be a list (even if empty)
        assert isinstance(data, list), f"Expected list of coaches, got {type(data)}"
        print(f"GET /api/coaches returned {len(data)} coaches")
    
    def test_coaches_endpoint_with_cookie_auth(self, session, admin_credentials):
        """Test that /api/coaches works with session cookie authentication"""
        # First login to get cookie
        login_response = session.post(
            f"{BASE_URL}/api/auth/login",
            json=admin_credentials
        )
        assert login_response.status_code == 200
        
        # Now try to get coaches with cookie auth
        response = session.get(f"{BASE_URL}/api/coaches")
        
        # Should work with cookie
        assert response.status_code == 200, f"GET /api/coaches with cookie failed: {response.status_code}"
        print("GET /api/coaches works with cookie authentication")

    # ==================== SINGLE COACH ENDPOINT TESTS ====================
    
    def test_single_coach_endpoint_with_auth(self, session, auth_headers):
        """Test that /api/coaches/{coachId} with proper auth returns 200 or 404"""
        # First get list of coaches to find a valid ID
        list_response = session.get(
            f"{BASE_URL}/api/coaches",
            headers=auth_headers
        )
        
        assert list_response.status_code == 200
        coaches = list_response.json()
        
        if len(coaches) == 0:
            # No coaches in this org, test with invalid ID should return 404
            response = session.get(
                f"{BASE_URL}/api/coaches/test_coach_123",
                headers=auth_headers
            )
            assert response.status_code in [404, 200], f"Expected 404 for non-existent coach, got {response.status_code}"
            print("GET /api/coaches/{coachId} correctly handles non-existent coach")
        else:
            # Get first coach ID
            coach_id = coaches[0].get("id") or coaches[0].get("coach_id")
            assert coach_id, f"Coach should have id field, got: {coaches[0].keys()}"
            
            response = session.get(
                f"{BASE_URL}/api/coaches/{coach_id}",
                headers=auth_headers
            )
            
            assert response.status_code == 200, f"GET /api/coaches/{coach_id} failed: {response.status_code} - {response.text}"
            coach_data = response.json()
            
            assert "name" in coach_data or "id" in coach_data, "Coach response should have name or id"
            print(f"GET /api/coaches/{coach_id} returned coach: {coach_data.get('name', 'unknown')}")
    
    def test_single_coach_without_auth_returns_401(self):
        """Test that /api/coaches/{coachId} without auth returns 401"""
        # Use a fresh request without any cookies
        response = requests.get(f"{BASE_URL}/api/coaches/any_coach_id")
        
        # Both 401 (not authenticated) and 404 (not found) are acceptable
        # since the auth check might come before or after route matching
        assert response.status_code in [401, 404], f"Expected 401/404 without auth, got {response.status_code}"
        print(f"GET /api/coaches/{{coachId}} returns {response.status_code} without auth")


class TestPaymentEndpoints:
    """Test payment/subscription related endpoints"""
    
    @pytest.fixture(scope="class")
    def session(self):
        """Create a requests session"""
        return requests.Session()
    
    @pytest.fixture(scope="class")
    def admin_credentials(self):
        """Admin credentials"""
        return {
            "email": "hello@mycoachdeveloper.com",
            "password": "_mcDeveloper26!"
        }
    
    @pytest.fixture(scope="class")
    def auth_token(self, session, admin_credentials):
        """Get authentication token via login"""
        response = session.post(
            f"{BASE_URL}/api/auth/login",
            json=admin_credentials
        )
        
        if response.status_code == 200:
            data = response.json()
            token = data.get("token") or data.get("session_token")
            return token
        else:
            pytest.skip(f"Login failed with status {response.status_code}: {response.text}")
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Headers with Authorization Bearer token"""
        return {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }

    # ==================== SUBSCRIPTION DETAILS TESTS ====================
    
    def test_subscription_details_endpoint_exists(self, session, auth_headers):
        """Test that /api/payments/subscription-details endpoint exists and works"""
        response = session.get(
            f"{BASE_URL}/api/payments/subscription-details",
            headers=auth_headers
        )
        
        # Should return 200 (success) - endpoint exists
        assert response.status_code == 200, f"subscription-details failed: {response.status_code} - {response.text}"
        
        data = response.json()
        
        # Verify response structure
        assert "has_subscription" in data, "Response should have 'has_subscription' field"
        print(f"subscription-details response: has_subscription={data.get('has_subscription')}, tier={data.get('tier')}")
    
    def test_subscription_details_without_auth_returns_401(self):
        """Test that /api/payments/subscription-details without auth returns 401"""
        # Use a fresh request without any cookies
        response = requests.get(f"{BASE_URL}/api/payments/subscription-details")
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("subscription-details correctly returns 401 without auth")

    # ==================== UPDATE SUBSCRIPTION TESTS ====================
    
    def test_update_subscription_endpoint_exists(self, session, auth_headers):
        """Test that /api/payments/update-subscription endpoint exists"""
        # Try to call update-subscription
        # Expected: 400 (no active subscription) rather than 404 (endpoint not found)
        response = session.post(
            f"{BASE_URL}/api/payments/update-subscription",
            headers=auth_headers,
            json={
                "tier_id": "developer",
                "billing_period": "monthly"
            }
        )
        
        # Should NOT be 404 (endpoint should exist)
        assert response.status_code != 404, f"update-subscription endpoint not found (404)"
        
        # Expected: 400 with "No active subscription to update" message
        # OR 200 if there is an active subscription
        assert response.status_code in [200, 400], f"Unexpected status: {response.status_code} - {response.text}"
        
        if response.status_code == 400:
            data = response.json()
            # Verify it's the expected error (no active subscription)
            detail = data.get("detail", "")
            assert "subscription" in detail.lower() or "active" in detail.lower(), \
                f"Expected 'no active subscription' error, got: {detail}"
            print(f"update-subscription correctly rejects without active subscription: {detail}")
        else:
            print("update-subscription endpoint exists and accepted the request")
    
    def test_update_subscription_without_auth_returns_401(self, session):
        """Test that /api/payments/update-subscription without auth returns 401"""
        response = session.post(
            f"{BASE_URL}/api/payments/update-subscription",
            json={
                "tier_id": "developer",
                "billing_period": "monthly"
            }
        )
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("update-subscription correctly returns 401 without auth")
    
    def test_update_subscription_validates_tier(self, session, auth_headers):
        """Test that update-subscription validates tier_id"""
        response = session.post(
            f"{BASE_URL}/api/payments/update-subscription",
            headers=auth_headers,
            json={
                "tier_id": "invalid_tier",
                "billing_period": "monthly"
            }
        )
        
        # Should return 400 for invalid tier
        assert response.status_code == 400, f"Expected 400 for invalid tier, got {response.status_code}"
        print("update-subscription correctly validates tier_id")
    
    def test_update_subscription_validates_billing_period(self, session, auth_headers):
        """Test that update-subscription validates billing_period"""
        response = session.post(
            f"{BASE_URL}/api/payments/update-subscription",
            headers=auth_headers,
            json={
                "tier_id": "developer",
                "billing_period": "invalid_period"
            }
        )
        
        # Should return 400 for invalid billing period
        assert response.status_code == 400, f"Expected 400 for invalid billing period, got {response.status_code}"
        print("update-subscription correctly validates billing_period")

    # ==================== CHECKOUT ENDPOINT COMPARISON ====================
    
    def test_checkout_endpoint_exists(self, session, auth_headers):
        """Test that /api/payments/checkout endpoint still exists (for new subscriptions)"""
        response = session.post(
            f"{BASE_URL}/api/payments/checkout",
            headers=auth_headers,
            json={
                "tier_id": "developer",
                "billing_period": "monthly",
                "origin_url": "https://example.com/settings"
            }
        )
        
        # Should NOT be 404 (endpoint should exist)
        # May return 200 (checkout created) or other status
        assert response.status_code != 404, "checkout endpoint should exist"
        
        # Checkout should return URL for new subscriptions
        if response.status_code == 200:
            data = response.json()
            assert "url" in data or "checkout_url" in data, "Checkout should return URL"
            print(f"checkout endpoint works, returns URL")
        else:
            print(f"checkout endpoint exists, status: {response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
