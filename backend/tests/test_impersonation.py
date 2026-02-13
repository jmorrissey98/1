"""
Test suite for Admin Impersonation Feature
Tests: Admin login, organization listing, club users, impersonation, and exit impersonation
"""
import pytest
import requests
import os

# Use preview URL for testing - same as frontend
BASE_URL = "http://localhost:8001"  # Backend is accessible locally

class TestAdminAuth:
    """Test admin authentication"""
    
    def test_admin_login_success(self):
        """Admin should be able to login with valid credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": "hello@mycoachdeveloper.com",
                "password": "_mcDeveloper26!"
            }
        )
        
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        
        # Validate response structure
        assert "token" in data, "Token missing from response"
        assert "user_id" in data, "user_id missing from response"
        assert data.get("role") == "admin", f"Expected admin role, got {data.get('role')}"
        assert data.get("email") == "hello@mycoachdeveloper.com"
        
        print(f"Admin login successful: user_id={data['user_id']}, role={data['role']}")
        return data["token"]
    
    def test_admin_login_invalid_password(self):
        """Admin login should fail with wrong password"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": "hello@mycoachdeveloper.com",
                "password": "wrongpassword"
            }
        )
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("Invalid password correctly rejected")


class TestAdminOrganizations:
    """Test admin organization listing and user management"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as admin before each test"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": "hello@mycoachdeveloper.com",
                "password": "_mcDeveloper26!"
            }
        )
        assert response.status_code == 200, "Admin login failed"
        self.token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_list_organizations(self):
        """Admin should be able to list all organizations"""
        response = requests.get(
            f"{BASE_URL}/api/admin/organizations",
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Failed to list organizations: {response.text}"
        orgs = response.json()
        
        assert isinstance(orgs, list), "Expected list of organizations"
        print(f"Found {len(orgs)} organizations")
        
        if len(orgs) > 0:
            # Verify org structure
            org = orgs[0]
            assert "org_id" in org, "org_id missing from organization"
            print(f"First org: {org.get('club_name', 'No name')} (org_id: {org.get('org_id')})")
        
        return orgs
    
    def test_get_organization_users(self):
        """Admin should be able to get users for an organization"""
        # First get organizations
        orgs_response = requests.get(
            f"{BASE_URL}/api/admin/organizations",
            headers=self.headers
        )
        assert orgs_response.status_code == 200
        orgs = orgs_response.json()
        
        if len(orgs) == 0:
            pytest.skip("No organizations to test")
        
        org_id = orgs[0]["org_id"]
        
        # Get users for this org
        response = requests.get(
            f"{BASE_URL}/api/admin/organizations/{org_id}/users",
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Failed to get org users: {response.text}"
        users = response.json()
        
        assert isinstance(users, list), "Expected list of users"
        print(f"Found {len(users)} users in organization {org_id}")
        
        if len(users) > 0:
            user = users[0]
            assert "user_id" in user, "user_id missing from user"
            assert "email" in user, "email missing from user"
            assert "role" in user, "role missing from user"
            print(f"First user: {user.get('name')} ({user.get('email')}, role: {user.get('role')})")
        
        return users


class TestImpersonation:
    """Test admin impersonation functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as admin before each test"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": "hello@mycoachdeveloper.com",
                "password": "_mcDeveloper26!"
            }
        )
        assert response.status_code == 200, "Admin login failed"
        self.admin_token = response.json()["token"]
        self.admin_headers = {"Authorization": f"Bearer {self.admin_token}"}
    
    def _get_first_non_admin_user(self):
        """Helper to get a non-admin user to impersonate"""
        orgs_response = requests.get(
            f"{BASE_URL}/api/admin/organizations",
            headers=self.admin_headers
        )
        if orgs_response.status_code != 200 or len(orgs_response.json()) == 0:
            return None, None
        
        org_id = orgs_response.json()[0]["org_id"]
        
        users_response = requests.get(
            f"{BASE_URL}/api/admin/organizations/{org_id}/users",
            headers=self.admin_headers
        )
        
        if users_response.status_code != 200:
            return None, None
            
        users = users_response.json()
        for user in users:
            if user.get("role") != "admin":
                return user, org_id
        
        return None, None
    
    def test_impersonate_user(self):
        """Admin should be able to impersonate a non-admin user"""
        target_user, org_id = self._get_first_non_admin_user()
        
        if not target_user:
            pytest.skip("No non-admin users available for impersonation test")
        
        user_id = target_user["user_id"]
        
        response = requests.post(
            f"{BASE_URL}/api/admin/impersonate/{user_id}",
            headers=self.admin_headers
        )
        
        assert response.status_code == 200, f"Impersonation failed: {response.text}"
        data = response.json()
        
        # Validate response
        assert "token" in data, "Token missing from impersonation response"
        assert "user" in data, "User data missing from impersonation response"
        assert data["user"]["user_id"] == user_id, "Wrong user ID in response"
        assert "impersonated_by" in data, "impersonated_by missing from response"
        
        print(f"Successfully impersonated: {data['user']['name']} ({data['user']['email']}, role: {data['user']['role']})")
        
        # Verify impersonation token works for auth/me
        imp_token = data["token"]
        imp_headers = {"Authorization": f"Bearer {imp_token}"}
        
        me_response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers=imp_headers
        )
        
        assert me_response.status_code == 200, f"Auth/me failed with impersonation token: {me_response.text}"
        me_data = me_response.json()
        assert me_data["user_id"] == user_id, "Auth/me returned wrong user"
        
        # CRITICAL TEST: Verify organization endpoint works for impersonated user
        # This was the root cause of the bug
        org_response = requests.get(
            f"{BASE_URL}/api/organization",
            headers=imp_headers
        )
        
        assert org_response.status_code == 200, f"Organization fetch failed for impersonated user: {org_response.text}"
        org_data = org_response.json()
        
        # Organization should have data (not empty)
        print(f"Organization data for impersonated user: {org_data}")
        
        # If user has organization_id, it should match
        if target_user.get("organization_id"):
            assert org_data.get("org_id") == target_user["organization_id"], \
                f"Organization mismatch: expected {target_user['organization_id']}, got {org_data.get('org_id')}"
        
        return data
    
    def test_impersonate_admin_not_allowed(self):
        """Admin should NOT be able to impersonate another admin"""
        # Get admin user_id
        admin_check = requests.get(f"{BASE_URL}/api/admin/check")
        assert admin_check.status_code == 200
        admin_user_id = admin_check.json()["user_id"]
        
        response = requests.post(
            f"{BASE_URL}/api/admin/impersonate/{admin_user_id}",
            headers=self.admin_headers
        )
        
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        print("Correctly prevented impersonating admin user")
    
    def test_impersonate_nonexistent_user(self):
        """Impersonating non-existent user should return 404"""
        response = requests.post(
            f"{BASE_URL}/api/admin/impersonate/nonexistent_user_12345",
            headers=self.admin_headers
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("Correctly returned 404 for non-existent user")


class TestOrganizationEndpointWithUserOrgId:
    """
    Test the organization endpoint specifically with users who have organization_id set.
    This tests the fix for the impersonation bug where users with organization_id
    weren't getting their org data.
    """
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as admin before each test"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": "hello@mycoachdeveloper.com",
                "password": "_mcDeveloper26!"
            }
        )
        assert response.status_code == 200, "Admin login failed"
        self.admin_token = response.json()["token"]
        self.admin_headers = {"Authorization": f"Bearer {self.admin_token}"}
    
    def test_organization_returns_data_for_users_with_org_id(self):
        """
        Verify /api/organization returns correct data for users with organization_id set.
        This is the key fix - the endpoint now checks user.organization_id first.
        """
        # Get organizations
        orgs_response = requests.get(
            f"{BASE_URL}/api/admin/organizations",
            headers=self.admin_headers
        )
        assert orgs_response.status_code == 200
        orgs = orgs_response.json()
        
        if len(orgs) == 0:
            pytest.skip("No organizations available")
        
        # Find a user with organization_id set
        user_with_org_id = None
        target_org_id = None
        
        for org in orgs:
            org_id = org["org_id"]
            users_response = requests.get(
                f"{BASE_URL}/api/admin/organizations/{org_id}/users",
                headers=self.admin_headers
            )
            
            if users_response.status_code == 200:
                users = users_response.json()
                for user in users:
                    if user.get("organization_id") and user.get("role") != "admin":
                        user_with_org_id = user
                        target_org_id = user["organization_id"]
                        break
            
            if user_with_org_id:
                break
        
        if not user_with_org_id:
            pytest.skip("No users with organization_id found")
        
        print(f"Testing with user: {user_with_org_id['email']} (org_id: {target_org_id})")
        
        # Impersonate this user
        imp_response = requests.post(
            f"{BASE_URL}/api/admin/impersonate/{user_with_org_id['user_id']}",
            headers=self.admin_headers
        )
        assert imp_response.status_code == 200, f"Impersonation failed: {imp_response.text}"
        
        imp_token = imp_response.json()["token"]
        imp_headers = {"Authorization": f"Bearer {imp_token}"}
        
        # Test /api/organization - this should return the user's org data
        org_response = requests.get(
            f"{BASE_URL}/api/organization",
            headers=imp_headers
        )
        
        assert org_response.status_code == 200, f"Organization endpoint failed: {org_response.text}"
        org_data = org_response.json()
        
        # The org_id should match user's organization_id
        assert org_data.get("org_id") == target_org_id, \
            f"Organization mismatch: expected {target_org_id}, got {org_data.get('org_id')}"
        
        print(f"SUCCESS: Organization endpoint correctly returned org_id={target_org_id} for user with organization_id set")
        
        # Verify club data is present
        print(f"Organization details: club_name={org_data.get('club_name')}, owner_id={org_data.get('owner_id')}")


class TestAuthMeReturnsOrgId:
    """Test that /api/auth/me returns organization_id field"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as admin before each test"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": "hello@mycoachdeveloper.com",
                "password": "_mcDeveloper26!"
            }
        )
        assert response.status_code == 200, "Admin login failed"
        self.admin_token = response.json()["token"]
        self.admin_headers = {"Authorization": f"Bearer {self.admin_token}"}
    
    def test_auth_me_includes_organization_id(self):
        """Verify /api/auth/me returns organization_id for impersonated users"""
        # Get a non-admin user to impersonate
        orgs_response = requests.get(
            f"{BASE_URL}/api/admin/organizations",
            headers=self.admin_headers
        )
        
        if orgs_response.status_code != 200 or len(orgs_response.json()) == 0:
            pytest.skip("No organizations available")
        
        org_id = orgs_response.json()[0]["org_id"]
        
        users_response = requests.get(
            f"{BASE_URL}/api/admin/organizations/{org_id}/users",
            headers=self.admin_headers
        )
        
        if users_response.status_code != 200 or len(users_response.json()) == 0:
            pytest.skip("No users available")
        
        # Find non-admin user with org_id
        target_user = None
        for user in users_response.json():
            if user.get("role") != "admin" and user.get("organization_id"):
                target_user = user
                break
        
        if not target_user:
            pytest.skip("No suitable users found")
        
        # Impersonate
        imp_response = requests.post(
            f"{BASE_URL}/api/admin/impersonate/{target_user['user_id']}",
            headers=self.admin_headers
        )
        assert imp_response.status_code == 200
        
        imp_token = imp_response.json()["token"]
        
        # Call /api/auth/me
        me_response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {imp_token}"}
        )
        
        assert me_response.status_code == 200
        me_data = me_response.json()
        
        # Verify organization_id is present and correct
        assert "organization_id" in me_data, "organization_id missing from /api/auth/me response"
        assert me_data["organization_id"] == target_user["organization_id"], \
            f"organization_id mismatch: expected {target_user['organization_id']}, got {me_data['organization_id']}"
        
        print(f"SUCCESS: /api/auth/me correctly returns organization_id={me_data['organization_id']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
