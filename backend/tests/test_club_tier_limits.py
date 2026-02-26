"""
Test Club Tier Subscription Limits
==================================
Tests that the Club subscription tier correctly shows:
- admins_limit = 5 (Coach Developers)
- coaches_limit = 30

Tests both public and admin pricing endpoints.
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "hello@mycoachdeveloper.com"
ADMIN_PASSWORD = "_mcDeveloper26!"


class TestPublicPricingEndpoint:
    """Test the public /api/pricing/tiers endpoint"""
    
    def test_pricing_tiers_endpoint_exists(self):
        """Test that the public pricing endpoint returns 200"""
        response = requests.get(f"{BASE_URL}/api/pricing/tiers")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("PASS: Public pricing endpoint returns 200")
    
    def test_pricing_returns_three_tiers(self):
        """Test that three tiers are returned: individual, developer, club"""
        response = requests.get(f"{BASE_URL}/api/pricing/tiers")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        assert len(data) == 3, f"Expected 3 tiers, got {len(data)}"
        
        tier_ids = [t["tier_id"] for t in data]
        assert "individual" in tier_ids, "individual tier missing"
        assert "developer" in tier_ids, "developer tier missing"
        assert "club" in tier_ids, "club tier missing"
        print("PASS: Three tiers returned (individual, developer, club)")
    
    def test_club_tier_has_correct_limits(self):
        """Test Club tier has admins_limit=5 and coaches_limit=30"""
        response = requests.get(f"{BASE_URL}/api/pricing/tiers")
        assert response.status_code == 200
        
        data = response.json()
        club_tier = next((t for t in data if t["tier_id"] == "club"), None)
        
        assert club_tier is not None, "Club tier not found in response"
        
        # Check admins_limit (Coach Developers)
        admins_limit = club_tier.get("admins_limit")
        assert admins_limit == 5, f"Club admins_limit should be 5, got {admins_limit}"
        print(f"PASS: Club tier admins_limit is {admins_limit}")
        
        # Check coaches_limit
        coaches_limit = club_tier.get("coaches_limit")
        assert coaches_limit == 30, f"Club coaches_limit should be 30, got {coaches_limit}"
        print(f"PASS: Club tier coaches_limit is {coaches_limit}")
    
    def test_individual_tier_limits(self):
        """Test Individual tier has correct limits"""
        response = requests.get(f"{BASE_URL}/api/pricing/tiers")
        assert response.status_code == 200
        
        data = response.json()
        tier = next((t for t in data if t["tier_id"] == "individual"), None)
        
        assert tier is not None, "Individual tier not found"
        assert tier.get("admins_limit") == 1, f"Individual admins_limit should be 1, got {tier.get('admins_limit')}"
        assert tier.get("coaches_limit") == 5, f"Individual coaches_limit should be 5, got {tier.get('coaches_limit')}"
        print(f"PASS: Individual tier limits correct: admins={tier.get('admins_limit')}, coaches={tier.get('coaches_limit')}")
    
    def test_developer_tier_limits(self):
        """Test Developer tier has correct limits"""
        response = requests.get(f"{BASE_URL}/api/pricing/tiers")
        assert response.status_code == 200
        
        data = response.json()
        tier = next((t for t in data if t["tier_id"] == "developer"), None)
        
        assert tier is not None, "Developer tier not found"
        assert tier.get("admins_limit") == 1, f"Developer admins_limit should be 1, got {tier.get('admins_limit')}"
        assert tier.get("coaches_limit") == 10, f"Developer coaches_limit should be 10, got {tier.get('coaches_limit')}"
        print(f"PASS: Developer tier limits correct: admins={tier.get('admins_limit')}, coaches={tier.get('coaches_limit')}")


class TestAdminPricingEndpoint:
    """Test the admin /api/admin/subscription-tiers endpoint"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip(f"Admin login failed: {response.text}")
        return response.json().get("token")
    
    def test_admin_tiers_endpoint_requires_auth(self):
        """Test that admin endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/admin/subscription-tiers")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("PASS: Admin endpoint requires authentication")
    
    def test_admin_tiers_endpoint_works_with_auth(self, auth_token):
        """Test admin endpoint returns data with auth"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/subscription-tiers", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("PASS: Admin endpoint returns 200 with auth")
    
    def test_admin_club_tier_has_correct_limits(self, auth_token):
        """Test Club tier via admin endpoint has admins_limit=5 and coaches_limit=30"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/subscription-tiers", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        club_tier = next((t for t in data if t["tier_id"] == "club"), None)
        
        assert club_tier is not None, "Club tier not found in admin response"
        
        admins_limit = club_tier.get("admins_limit")
        assert admins_limit == 5, f"Admin endpoint: Club admins_limit should be 5, got {admins_limit}"
        print(f"PASS: Admin endpoint Club tier admins_limit is {admins_limit}")
        
        coaches_limit = club_tier.get("coaches_limit")
        assert coaches_limit == 30, f"Admin endpoint: Club coaches_limit should be 30, got {coaches_limit}"
        print(f"PASS: Admin endpoint Club tier coaches_limit is {coaches_limit}")


class TestTierPersistenceAfterSave:
    """Test that saving one tier doesn't remove other tiers"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip(f"Admin login failed: {response.text}")
        return response.json().get("token")
    
    def test_saving_tier_doesnt_remove_others(self, auth_token):
        """Test that updating one tier doesn't affect other tiers"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Get initial state
        response = requests.get(f"{BASE_URL}/api/admin/subscription-tiers", headers=headers)
        assert response.status_code == 200
        
        initial_data = response.json()
        initial_count = len(initial_data)
        assert initial_count == 3, f"Should have 3 tiers initially, got {initial_count}"
        
        # Update Club tier with same values (to not change actual data)
        club_tier = next((t for t in initial_data if t["tier_id"] == "club"), None)
        assert club_tier is not None
        
        update_response = requests.put(
            f"{BASE_URL}/api/admin/subscription-tiers/club",
            headers=headers,
            json={
                "name": club_tier["name"],
                "coaches_limit": 30,
                "admins_limit": 5
            }
        )
        assert update_response.status_code == 200, f"Update failed: {update_response.text}"
        print("PASS: Tier update succeeded")
        
        # Check all tiers still exist
        check_response = requests.get(f"{BASE_URL}/api/admin/subscription-tiers", headers=headers)
        assert check_response.status_code == 200
        
        final_data = check_response.json()
        final_count = len(final_data)
        assert final_count == 3, f"Should still have 3 tiers after update, got {final_count}"
        
        # Verify all tier IDs still exist
        tier_ids = [t["tier_id"] for t in final_data]
        assert "individual" in tier_ids, "Individual tier was removed after update!"
        assert "developer" in tier_ids, "Developer tier was removed after update!"
        assert "club" in tier_ids, "Club tier was removed after update!"
        print("PASS: All tiers preserved after saving one tier")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
