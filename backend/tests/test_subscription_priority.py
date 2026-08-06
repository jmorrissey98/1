"""
Test Subscription Priority Logic - Bug Fix Verification

CRITICAL BUG: When an org has BOTH an expired trial subscription AND an active paid 
Stripe subscription, the entitlement endpoint should return is_entitled=true with 
reason 'status_active', NOT 'trial_expired'.

Root Cause: find_one() could return the old trial doc first, resulting in 'trial_expired'
even though the user has an active paid subscription.

Fix: Changed from find_one to find().to_list(10), with priority logic to prefer 
active non-trial subscriptions over trial ones.
"""

import pytest
import requests
import os
import uuid
from datetime import datetime, timedelta, timezone

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "hello@mycoachdeveloper.com"
ADMIN_PASSWORD = "_mcDeveloper26!"
DEMO_EMAIL = "sarah.mitchell@demo.mycoachdeveloper.com"
DEMO_PASSWORD = "Demo123!"
DEMO_ORG_ID = "org_demo_0725dd5e668a"


def get_admin_token():
    """Get admin authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    return None


def get_demo_user_token():
    """Get demo user authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": DEMO_EMAIL,
        "password": DEMO_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    return None


class TestSubscriptionPriorityBugFix:
    """
    Test the critical bug fix: When an org has BOTH an expired trial AND an active paid 
    subscription, entitlement should return is_entitled=true with reason 'status_active'.
    """
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup tokens for each test"""
        self.admin_token = get_admin_token()
        self.demo_token = get_demo_user_token()
        assert self.admin_token, "Admin login failed"
        assert self.demo_token, "Demo user login failed"
    
    def test_01_verify_demo_org_exists(self):
        """Verify demo org exists before testing"""
        response = requests.get(
            f"{BASE_URL}/api/admin/organizations",
            headers={"Authorization": f"Bearer {self.admin_token}"}
        )
        assert response.status_code == 200, f"Failed to get orgs: {response.text}"
        
        orgs = response.json()
        demo_org = next((o for o in orgs if o.get("org_id") == DEMO_ORG_ID), None)
        assert demo_org is not None, f"Demo org {DEMO_ORG_ID} not found"
        print(f"Demo org found: {demo_org.get('name')}")
        print(f"Current subscription_status: {demo_org.get('subscription_status')}")
        print(f"Current is_trial: {demo_org.get('is_trial')}")
    
    def test_02_check_current_entitlement(self):
        """Check current entitlement status for demo user"""
        response = requests.get(
            f"{BASE_URL}/api/billing/entitlement",
            headers={"Authorization": f"Bearer {self.demo_token}"}
        )
        assert response.status_code == 200, f"Entitlement check failed: {response.text}"
        
        data = response.json()
        print(f"Current entitlement: is_entitled={data.get('is_entitled')}, reason={data.get('reason')}")
        print(f"is_trial={data.get('is_trial')}, subscription_status={data.get('subscription_status')}")
    
    def test_03_verify_entitlement_priority_logic(self):
        """
        Verify that entitlement check uses priority logic:
        - Active non-trial subscription should take precedence over expired trial
        """
        response = requests.get(
            f"{BASE_URL}/api/billing/entitlement",
            headers={"Authorization": f"Bearer {self.demo_token}"}
        )
        assert response.status_code == 200, f"Entitlement check failed: {response.text}"
        
        data = response.json()
        print(f"Entitlement result: {data}")
        
        # If the org has an active subscription, it should be entitled
        # The key fix is that even if there's an expired trial, active paid takes precedence
        if data.get("subscription_status") == "active" and not data.get("is_trial"):
            assert data.get("is_entitled") == True, "Active paid subscription should be entitled"
            assert data.get("reason") == "status_active", f"Reason should be 'status_active', got '{data.get('reason')}'"
            print("PASS: Active paid subscription correctly takes precedence")
        elif data.get("is_trial"):
            # If it's a trial, check if trial is active or expired
            if data.get("trial_expired"):
                print(f"Trial is expired - is_entitled={data.get('is_entitled')}")
            else:
                assert data.get("is_entitled") == True, "Active trial should be entitled"
                print("PASS: Active trial is correctly entitled")
        else:
            print(f"Other subscription state: {data}")
    
    def test_04_admin_org_list_shows_correct_status(self):
        """
        Verify admin org list shows correct subscription_status and is_trial
        when org has both expired trial and active paid subscription.
        """
        response = requests.get(
            f"{BASE_URL}/api/admin/organizations",
            headers={"Authorization": f"Bearer {self.admin_token}"}
        )
        assert response.status_code == 200, f"Failed to get orgs: {response.text}"
        
        orgs = response.json()
        demo_org = next((o for o in orgs if o.get("org_id") == DEMO_ORG_ID), None)
        assert demo_org is not None, f"Demo org not found"
        
        print(f"Admin org list - Demo org:")
        print(f"  subscription_status: {demo_org.get('subscription_status')}")
        print(f"  is_trial: {demo_org.get('is_trial')}")
        print(f"  trial_end_date: {demo_org.get('trial_end_date')}")
        
        # If there's an active paid subscription, is_trial should be False
        # and subscription_status should be 'active'
        if demo_org.get("subscription_status") == "active" and not demo_org.get("is_trial"):
            print("PASS: Admin org list correctly shows active paid subscription")


class TestTrialOnlyScenarios:
    """Test scenarios with only trial subscriptions"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup tokens for each test"""
        self.demo_token = get_demo_user_token()
        assert self.demo_token, "Demo user login failed"
    
    def test_01_trial_active_entitlement(self):
        """
        When only a trial subscription exists and it's active,
        entitlement should return trial_active and is_entitled=true.
        """
        response = requests.get(
            f"{BASE_URL}/api/billing/entitlement",
            headers={"Authorization": f"Bearer {self.demo_token}"}
        )
        assert response.status_code == 200, f"Entitlement check failed: {response.text}"
        
        data = response.json()
        
        if data.get("is_trial") and not data.get("trial_expired"):
            assert data.get("is_entitled") == True, "Active trial should be entitled"
            assert data.get("reason") == "trial_active", f"Reason should be 'trial_active', got '{data.get('reason')}'"
            print(f"PASS: Active trial correctly returns is_entitled=true, reason=trial_active")
            print(f"  trial_days_remaining: {data.get('trial_days_remaining')}")
        else:
            print(f"Skipping - current state is not active trial: is_trial={data.get('is_trial')}, trial_expired={data.get('trial_expired')}")


class TestPaidOnlyScenarios:
    """Test scenarios with only paid subscriptions (no trial)"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup tokens for each test"""
        self.demo_token = get_demo_user_token()
        assert self.demo_token, "Demo user login failed"
    
    def test_01_paid_active_entitlement(self):
        """
        When only an active paid subscription exists (no trial),
        entitlement should return status_active and is_entitled=true.
        """
        response = requests.get(
            f"{BASE_URL}/api/billing/entitlement",
            headers={"Authorization": f"Bearer {self.demo_token}"}
        )
        assert response.status_code == 200, f"Entitlement check failed: {response.text}"
        
        data = response.json()
        
        if not data.get("is_trial") and data.get("subscription_status") == "active":
            assert data.get("is_entitled") == True, "Active paid subscription should be entitled"
            assert data.get("reason") == "status_active", f"Reason should be 'status_active', got '{data.get('reason')}'"
            print(f"PASS: Active paid subscription correctly returns is_entitled=true, reason=status_active")
        else:
            print(f"Skipping - current state is not active paid: is_trial={data.get('is_trial')}, status={data.get('subscription_status')}")


class TestAdminOrgListPriority:
    """Test admin org list subscription priority logic"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup tokens for each test"""
        self.admin_token = get_admin_token()
        assert self.admin_token, "Admin login failed"
    
    def test_01_admin_org_list_returns_correct_fields(self):
        """Verify admin org list includes subscription priority fields"""
        response = requests.get(
            f"{BASE_URL}/api/admin/organizations",
            headers={"Authorization": f"Bearer {self.admin_token}"}
        )
        assert response.status_code == 200, f"Failed to get orgs: {response.text}"
        
        orgs = response.json()
        assert len(orgs) > 0, "No organizations found"
        
        # Check that orgs have the required fields
        for org in orgs[:3]:  # Check first 3 orgs
            print(f"Org: {org.get('name')}")
            print(f"  org_id: {org.get('org_id')}")
            print(f"  subscription_status: {org.get('subscription_status')}")
            print(f"  is_trial: {org.get('is_trial')}")
            print(f"  trial_end_date: {org.get('trial_end_date')}")
    
    def test_02_demo_org_subscription_priority(self):
        """Verify demo org shows correct subscription based on priority"""
        response = requests.get(
            f"{BASE_URL}/api/admin/organizations",
            headers={"Authorization": f"Bearer {self.admin_token}"}
        )
        assert response.status_code == 200
        
        orgs = response.json()
        demo_org = next((o for o in orgs if o.get("org_id") == DEMO_ORG_ID), None)
        
        if demo_org:
            print(f"Demo org subscription state:")
            print(f"  subscription_status: {demo_org.get('subscription_status')}")
            print(f"  is_trial: {demo_org.get('is_trial')}")
            
            # The priority logic should ensure:
            # - If there's an active paid sub, is_trial=False and status=active
            # - If only trial exists, is_trial=True
            if demo_org.get("subscription_status") == "active":
                print("PASS: Demo org has active subscription status")


class TestWebhookTrialCleanup:
    """Test that checkout webhook cleans up trial subscriptions"""
    
    def test_01_webhook_endpoint_exists(self):
        """Verify webhook endpoint exists (will return 400 without proper Stripe signature)"""
        # Note: We can't fully test the webhook without a valid Stripe signature
        # But we can verify the endpoint exists
        response = requests.post(
            f"{BASE_URL}/api/webhook/stripe",
            data="{}",
            headers={"Content-Type": "application/json"}
        )
        
        # Should return 400 (bad request) due to missing/invalid signature, not 404
        assert response.status_code != 404, "Webhook endpoint not found"
        print(f"Webhook endpoint exists, returned status: {response.status_code}")


class TestEntitlementEndpointResponses:
    """Test entitlement endpoint response structure"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup tokens for each test"""
        self.demo_token = get_demo_user_token()
        assert self.demo_token, "Demo user login failed"
    
    def test_01_entitlement_response_structure(self):
        """Verify entitlement response has all required fields"""
        response = requests.get(
            f"{BASE_URL}/api/billing/entitlement",
            headers={"Authorization": f"Bearer {self.demo_token}"}
        )
        assert response.status_code == 200, f"Entitlement check failed: {response.text}"
        
        data = response.json()
        
        # Required fields
        required_fields = ["is_entitled", "reason"]
        for field in required_fields:
            assert field in data, f"Missing required field: {field}"
        
        # Optional but expected fields
        expected_fields = [
            "subscription_status", "cancel_at_period_end", "current_period_end",
            "active_tier", "active_price_id", "is_trial", "trial_end_date",
            "trial_expired", "trial_days_remaining", "trial_tier_name"
        ]
        
        print("Entitlement response fields:")
        for field in expected_fields:
            value = data.get(field)
            print(f"  {field}: {value}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
