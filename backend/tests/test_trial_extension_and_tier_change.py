"""
Test Trial Extension and Tier Change Features
==============================================
Tests for:
1. Admin trial extension endpoint (POST /api/admin/organizations/{org_id}/extend-trial)
2. Admin tier change endpoint with Stripe sync (PUT /api/admin/organizations/{org_id}/tier)
3. Admin organizations list includes trial status fields
"""

import pytest
import requests
import os
from datetime import datetime, timezone

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "hello@mycoachdeveloper.com"
ADMIN_PASSWORD = "_mcDeveloper26!"
DEMO_ORG_ID = "org_demo_0725dd5e668a"  # Riverside Football Academy


class TestAdminAuth:
    """Test admin authentication"""
    
    @pytest.fixture(scope="class")
    def session(self):
        """Create a requests session"""
        return requests.Session()
    
    def test_admin_login(self, session):
        """Test admin can login successfully"""
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        # Login response returns user data directly (not nested under "user")
        assert "role" in data or ("user" in data and "role" in data["user"])
        role = data.get("role") or data.get("user", {}).get("role")
        assert role == "admin"
        email = data.get("email") or data.get("user", {}).get("email")
        print(f"✓ Admin login successful: {email}")


class TestTrialExtension:
    """Test trial extension functionality"""
    
    @pytest.fixture(scope="class")
    def admin_session(self):
        """Get authenticated admin session"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        return session
    
    def test_extend_trial_success(self, admin_session):
        """Test extending trial for an organization"""
        response = admin_session.post(
            f"{BASE_URL}/api/admin/organizations/{DEMO_ORG_ID}/extend-trial",
            json={"days": 14}
        )
        
        assert response.status_code == 200, f"Extend trial failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "message" in data
        assert "org_id" in data
        assert "new_trial_end" in data
        assert "days_remaining" in data
        
        assert data["org_id"] == DEMO_ORG_ID
        assert data["days_remaining"] == 14
        assert "Trial extended" in data["message"]
        
        # Verify new_trial_end is a valid ISO date in the future
        trial_end = datetime.fromisoformat(data["new_trial_end"].replace('Z', '+00:00'))
        now = datetime.now(timezone.utc)
        assert trial_end > now, "Trial end date should be in the future"
        
        print(f"✓ Trial extended successfully: {data['message']}")
        print(f"  New trial end: {data['new_trial_end']}")
    
    def test_extend_trial_invalid_days(self, admin_session):
        """Test extending trial with invalid days parameter"""
        # Test with 0 days
        response = admin_session.post(
            f"{BASE_URL}/api/admin/organizations/{DEMO_ORG_ID}/extend-trial",
            json={"days": 0}
        )
        assert response.status_code == 400, "Should reject 0 days"
        
        # Test with negative days
        response = admin_session.post(
            f"{BASE_URL}/api/admin/organizations/{DEMO_ORG_ID}/extend-trial",
            json={"days": -5}
        )
        assert response.status_code == 400, "Should reject negative days"
        
        # Test with missing days
        response = admin_session.post(
            f"{BASE_URL}/api/admin/organizations/{DEMO_ORG_ID}/extend-trial",
            json={}
        )
        assert response.status_code == 400, "Should reject missing days"
        
        print("✓ Invalid days parameters correctly rejected")
    
    def test_extend_trial_nonexistent_org(self, admin_session):
        """Test extending trial for non-existent organization"""
        response = admin_session.post(
            f"{BASE_URL}/api/admin/organizations/org_nonexistent_12345/extend-trial",
            json={"days": 14}
        )
        assert response.status_code == 404, "Should return 404 for non-existent org"
        print("✓ Non-existent org correctly returns 404")
    
    def test_extend_trial_requires_auth(self):
        """Test that trial extension requires admin authentication"""
        session = requests.Session()  # Unauthenticated session
        response = session.post(
            f"{BASE_URL}/api/admin/organizations/{DEMO_ORG_ID}/extend-trial",
            json={"days": 14}
        )
        assert response.status_code == 401, "Should require authentication"
        print("✓ Trial extension correctly requires authentication")


class TestTierChange:
    """Test tier change functionality with Stripe sync"""
    
    @pytest.fixture(scope="class")
    def admin_session(self):
        """Get authenticated admin session"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        return session
    
    def test_change_tier_success(self, admin_session):
        """Test changing organization tier"""
        response = admin_session.put(
            f"{BASE_URL}/api/admin/organizations/{DEMO_ORG_ID}/tier",
            json={"tier_id": "coach_developer"}
        )
        
        assert response.status_code == 200, f"Tier change failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "message" in data
        assert "org_id" in data
        assert "new_tier" in data
        assert "stripe_updated" in data
        assert "stripe_error" in data
        
        assert data["org_id"] == DEMO_ORG_ID
        assert data["new_tier"] == "coach_developer"
        
        print(f"✓ Tier changed successfully: {data['message']}")
        print(f"  Stripe updated: {data['stripe_updated']}")
        print(f"  Stripe error: {data['stripe_error']}")
    
    def test_change_tier_demo_org_no_stripe_update(self, admin_session):
        """Test that demo orgs (sub_demo_ prefix) don't trigger Stripe updates"""
        # Change to a different tier first
        response = admin_session.put(
            f"{BASE_URL}/api/admin/organizations/{DEMO_ORG_ID}/tier",
            json={"tier_id": "club"}
        )
        
        assert response.status_code == 200, f"Tier change failed: {response.text}"
        data = response.json()
        
        # Demo orgs should NOT have Stripe updated (subscription_id starts with sub_demo_)
        # stripe_updated should be false and stripe_error should be null
        assert data["stripe_updated"] == False, "Demo org should not update Stripe"
        assert data["stripe_error"] is None, "Demo org should not have Stripe error"
        
        print(f"✓ Demo org tier change correctly skips Stripe: stripe_updated={data['stripe_updated']}")
        
        # Change back to coach_developer
        admin_session.put(
            f"{BASE_URL}/api/admin/organizations/{DEMO_ORG_ID}/tier",
            json={"tier_id": "coach_developer"}
        )
    
    def test_change_tier_invalid_tier(self, admin_session):
        """Test changing to invalid tier"""
        response = admin_session.put(
            f"{BASE_URL}/api/admin/organizations/{DEMO_ORG_ID}/tier",
            json={"tier_id": "invalid_tier"}
        )
        assert response.status_code == 400, "Should reject invalid tier"
        print("✓ Invalid tier correctly rejected")
    
    def test_change_tier_missing_tier_id(self, admin_session):
        """Test changing tier without tier_id"""
        response = admin_session.put(
            f"{BASE_URL}/api/admin/organizations/{DEMO_ORG_ID}/tier",
            json={}
        )
        assert response.status_code == 400, "Should reject missing tier_id"
        print("✓ Missing tier_id correctly rejected")
    
    def test_change_tier_requires_auth(self):
        """Test that tier change requires admin authentication"""
        session = requests.Session()  # Unauthenticated session
        response = session.put(
            f"{BASE_URL}/api/admin/organizations/{DEMO_ORG_ID}/tier",
            json={"tier_id": "coach_developer"}
        )
        assert response.status_code == 401, "Should require authentication"
        print("✓ Tier change correctly requires authentication")


class TestAdminOrganizationsList:
    """Test admin organizations list includes trial status"""
    
    @pytest.fixture(scope="class")
    def admin_session(self):
        """Get authenticated admin session"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        return session
    
    def test_organizations_list_includes_trial_fields(self, admin_session):
        """Test that organizations list includes trial-related fields"""
        response = admin_session.get(f"{BASE_URL}/api/admin/organizations")
        
        assert response.status_code == 200, f"Failed to get organizations: {response.text}"
        orgs = response.json()
        
        assert isinstance(orgs, list), "Response should be a list"
        assert len(orgs) > 0, "Should have at least one organization"
        
        # Find the demo org
        demo_org = next((o for o in orgs if o.get("org_id") == DEMO_ORG_ID), None)
        assert demo_org is not None, f"Demo org {DEMO_ORG_ID} not found in list"
        
        # Verify trial-related fields are present
        assert "is_trial" in demo_org, "is_trial field should be present"
        assert "trial_end_date" in demo_org, "trial_end_date field should be present"
        assert "subscription_status" in demo_org, "subscription_status field should be present"
        
        print(f"✓ Organizations list includes trial fields")
        print(f"  Demo org is_trial: {demo_org['is_trial']}")
        print(f"  Demo org trial_end_date: {demo_org['trial_end_date']}")
        print(f"  Demo org subscription_status: {demo_org['subscription_status']}")
    
    def test_organizations_list_trial_status_after_extension(self, admin_session):
        """Test that trial status is correctly reflected after extension"""
        # First extend the trial
        extend_response = admin_session.post(
            f"{BASE_URL}/api/admin/organizations/{DEMO_ORG_ID}/extend-trial",
            json={"days": 7}
        )
        assert extend_response.status_code == 200
        
        # Then get the organizations list
        response = admin_session.get(f"{BASE_URL}/api/admin/organizations")
        assert response.status_code == 200
        
        orgs = response.json()
        demo_org = next((o for o in orgs if o.get("org_id") == DEMO_ORG_ID), None)
        
        # After extension, is_trial should be True and trial_end_date should be set
        assert demo_org["is_trial"] == True, "is_trial should be True after extension"
        assert demo_org["trial_end_date"] is not None, "trial_end_date should be set after extension"
        
        # Verify trial_end_date is in the future
        trial_end = datetime.fromisoformat(demo_org["trial_end_date"].replace('Z', '+00:00'))
        now = datetime.now(timezone.utc)
        assert trial_end > now, "Trial end date should be in the future"
        
        print(f"✓ Trial status correctly reflected after extension")
        print(f"  is_trial: {demo_org['is_trial']}")
        print(f"  trial_end_date: {demo_org['trial_end_date']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
