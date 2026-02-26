"""
Test subscription management endpoints:
- /api/payments/subscription-details - GET current subscription info
- /api/payments/update-subscription - POST change subscription plan
- /api/payments/billing-portal - POST get Stripe portal URL
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials (coach developer without Stripe subscription)
TEST_EMAIL = "joemorrisseyg@gmail.com"
TEST_PASSWORD = "TestPass123!"


class TestSubscriptionManagement:
    """Test subscription management endpoints for the upgrade modal feature"""
    
    @pytest.fixture(scope="class")
    def session(self):
        """Create a requests session"""
        return requests.Session()
    
    @pytest.fixture(scope="class")
    def auth_token(self, session):
        """Login and get auth token"""
        login_response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        
        if login_response.status_code != 200:
            pytest.skip(f"Login failed: {login_response.status_code} - {login_response.text}")
        
        data = login_response.json()
        token = data.get("token")
        
        if not token:
            pytest.skip("No token in login response")
        
        session.headers.update({"Authorization": f"Bearer {token}"})
        return token
    
    def test_subscription_details_endpoint_exists(self, session, auth_token):
        """Test that /api/payments/subscription-details endpoint exists and responds"""
        response = session.get(f"{BASE_URL}/api/payments/subscription-details")
        
        # Should return 200 (not 404 or 500)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Response should have required fields
        assert "has_subscription" in data, "Response should contain 'has_subscription' field"
        print(f"PASS: subscription-details endpoint exists and returns data: {data}")
    
    def test_subscription_details_returns_correct_structure(self, session, auth_token):
        """Test that subscription-details returns proper structure"""
        response = session.get(f"{BASE_URL}/api/payments/subscription-details")
        
        assert response.status_code == 200
        data = response.json()
        
        # For a user without subscription, should have these fields
        assert "has_subscription" in data
        assert "tier" in data
        assert "status" in data
        
        # If there IS a subscription, should have additional fields
        if data.get("has_subscription"):
            assert "billing_period" in data, "Subscribed users should have billing_period"
            assert data["billing_period"] in ["monthly", "annual"], f"billing_period should be monthly/annual, got: {data.get('billing_period')}"
            assert "tier_name" in data, "Subscribed users should have tier_name"
            print(f"PASS: User HAS subscription - tier: {data.get('tier')}, billing: {data.get('billing_period')}")
        else:
            print(f"PASS: User does NOT have subscription (expected for test user)")
    
    def test_subscription_details_requires_auth(self, session):
        """Test that subscription-details requires authentication"""
        # Create new session without auth
        unauth_session = requests.Session()
        response = unauth_session.get(f"{BASE_URL}/api/payments/subscription-details")
        
        # Should return 401 Unauthorized
        assert response.status_code == 401, f"Expected 401 for unauthenticated request, got {response.status_code}"
        print("PASS: subscription-details requires authentication")
    
    def test_update_subscription_endpoint_exists(self, session, auth_token):
        """Test that /api/payments/update-subscription endpoint exists"""
        # This should fail gracefully for users without subscription
        # We're testing that the endpoint exists and validates properly
        response = session.post(
            f"{BASE_URL}/api/payments/update-subscription",
            json={"tier_id": "developer", "billing_period": "monthly"}
        )
        
        # Should NOT be 404 (endpoint exists)
        # Should be 400 (no subscription to update) for test user
        assert response.status_code != 404, "update-subscription endpoint should exist"
        
        if response.status_code == 400:
            data = response.json()
            # Expected error for user without subscription
            assert "No active subscription" in data.get("detail", "") or "subscription" in data.get("detail", "").lower()
            print("PASS: update-subscription endpoint exists, correctly rejects user without subscription")
        else:
            print(f"update-subscription returned {response.status_code}: {response.text}")
    
    def test_update_subscription_validates_tier(self, session, auth_token):
        """Test that update-subscription validates tier_id"""
        response = session.post(
            f"{BASE_URL}/api/payments/update-subscription",
            json={"tier_id": "invalid_tier", "billing_period": "monthly"}
        )
        
        # Should be 400 Bad Request for invalid tier
        assert response.status_code == 400, f"Expected 400 for invalid tier, got {response.status_code}"
        data = response.json()
        assert "tier" in data.get("detail", "").lower(), f"Error should mention tier: {data}"
        print("PASS: update-subscription validates tier_id")
    
    def test_update_subscription_validates_billing_period(self, session, auth_token):
        """Test that update-subscription validates billing_period"""
        response = session.post(
            f"{BASE_URL}/api/payments/update-subscription",
            json={"tier_id": "developer", "billing_period": "weekly"}  # Invalid
        )
        
        # Should be 400 Bad Request for invalid billing period
        assert response.status_code == 400, f"Expected 400 for invalid billing period, got {response.status_code}"
        data = response.json()
        assert "billing" in data.get("detail", "").lower(), f"Error should mention billing: {data}"
        print("PASS: update-subscription validates billing_period")
    
    def test_update_subscription_requires_auth(self, session):
        """Test that update-subscription requires authentication"""
        unauth_session = requests.Session()
        response = unauth_session.post(
            f"{BASE_URL}/api/payments/update-subscription",
            json={"tier_id": "developer", "billing_period": "monthly"}
        )
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("PASS: update-subscription requires authentication")
    
    def test_billing_portal_endpoint_exists(self, session, auth_token):
        """Test that /api/payments/billing-portal endpoint exists"""
        response = session.post(
            f"{BASE_URL}/api/payments/billing-portal",
            json={"return_url": "https://mycoachdeveloper.com/settings"}
        )
        
        # Should NOT be 404
        assert response.status_code != 404, "billing-portal endpoint should exist"
        
        # May fail for user without subscription, but endpoint should exist
        if response.status_code == 400:
            data = response.json()
            # Expected - no subscription/customer
            print(f"PASS: billing-portal endpoint exists (no subscription for test user)")
        elif response.status_code == 200:
            data = response.json()
            assert "url" in data, "Should return Stripe portal URL"
            print(f"PASS: billing-portal returned URL")
        else:
            print(f"billing-portal returned {response.status_code}: {response.text}")
    
    def test_subscription_status_endpoint(self, session, auth_token):
        """Test that /api/payments/subscription-status endpoint works"""
        response = session.get(f"{BASE_URL}/api/payments/subscription-status")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "has_subscription" in data
        print(f"PASS: subscription-status endpoint works: {data}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
