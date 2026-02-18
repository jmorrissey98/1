"""
Test subscription limit enforcement for coaches and admins.
Tests:
1. GET /api/organization/limits - Returns current usage and limits
2. POST /api/coaches - Should return 403 when coach limit exceeded
3. POST /api/invites - Should return 403 when admin/coach limit exceeded
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "hello@mycoachdeveloper.com"
ADMIN_PASSWORD = "_mcDeveloper26!"
COACH_EMAIL = "joe_morrissey@hotmail.co.uk"
COACH_PASSWORD = "CoachTest123"


class TestSubscriptionLimits:
    """Test subscription limit display and enforcement"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        token = data.get("session", {}).get("session_token") or data.get("token")
        assert token, "No token in response"
        return token
    
    @pytest.fixture(scope="class")
    def coach_token(self):
        """Get coach authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": COACH_EMAIL,
            "password": COACH_PASSWORD
        })
        assert response.status_code == 200, f"Coach login failed: {response.text}"
        data = response.json()
        token = data.get("session", {}).get("session_token") or data.get("token")
        assert token, "No token in response"
        return token
    
    def test_get_organization_limits(self, admin_token):
        """Test GET /api/organization/limits returns usage and limits"""
        response = requests.get(
            f"{BASE_URL}/api/organization/limits",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200, f"Failed to get limits: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "coaches" in data, "Missing 'coaches' in response"
        assert "admins" in data, "Missing 'admins' in response"
        assert "tier" in data, "Missing 'tier' in response"
        
        # Verify coaches structure
        coaches = data["coaches"]
        assert "current" in coaches, "Missing coaches.current"
        assert "limit" in coaches, "Missing coaches.limit"
        assert "can_add" in coaches, "Missing coaches.can_add"
        assert "remaining" in coaches, "Missing coaches.remaining"
        
        # Verify admins structure
        admins = data["admins"]
        assert "current" in admins, "Missing admins.current"
        assert "limit" in admins, "Missing admins.limit"
        assert "can_add" in admins, "Missing admins.can_add"
        assert "remaining" in admins, "Missing admins.remaining"
        
        # Log actual values for debugging
        print(f"\nSubscription Limits Response:")
        print(f"  Tier: {data['tier']}")
        print(f"  Coaches: {coaches['current']}/{coaches['limit']} (can_add={coaches['can_add']})")
        print(f"  Admins: {admins['current']}/{admins['limit']} (can_add={admins['can_add']})")
        
        return data
    
    def test_limits_requires_coach_developer(self, coach_token):
        """Test that limits endpoint requires coach_developer role"""
        response = requests.get(
            f"{BASE_URL}/api/organization/limits",
            headers={"Authorization": f"Bearer {coach_token}"}
        )
        
        # Coach should get 403 Forbidden
        assert response.status_code == 403, f"Expected 403 for coach, got {response.status_code}: {response.text}"
    
    def test_can_add_coach_endpoint(self, admin_token):
        """Test GET /api/organization/can-add-coach quick check"""
        response = requests.get(
            f"{BASE_URL}/api/organization/can-add-coach",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200, f"Failed to check can_add_coach: {response.text}"
        data = response.json()
        
        assert "can_add" in data, "Missing 'can_add' in response"
        assert "current" in data, "Missing 'current' in response"
        assert "limit" in data, "Missing 'limit' in response"
        
        print(f"\nCan Add Coach Response: {data}")
        return data
    
    def test_can_add_admin_endpoint(self, admin_token):
        """Test GET /api/organization/can-add-admin quick check"""
        response = requests.get(
            f"{BASE_URL}/api/organization/can-add-admin",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200, f"Failed to check can_add_admin: {response.text}"
        data = response.json()
        
        assert "can_add" in data, "Missing 'can_add' in response"
        assert "current" in data, "Missing 'current' in response"
        assert "limit" in data, "Missing 'limit' in response"
        
        print(f"\nCan Add Admin Response: {data}")
        return data


class TestCoachLimitEnforcement:
    """Test POST /api/coaches returns 403 when limit exceeded"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        token = data.get("session", {}).get("session_token") or data.get("token")
        assert token, "No token in response"
        return token
    
    def test_create_coach_blocked_when_limit_exceeded(self, admin_token):
        """Test POST /api/coaches returns 403 when coach limit is exceeded"""
        # First check the current limits
        limits_response = requests.get(
            f"{BASE_URL}/api/organization/limits",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert limits_response.status_code == 200
        limits = limits_response.json()
        
        # If limit is already exceeded (can_add=false), try to add a coach
        if not limits["coaches"]["can_add"]:
            print(f"\nCoach limit already exceeded: {limits['coaches']['current']}/{limits['coaches']['limit']}")
            
            # Try to create a coach - should fail with 403
            response = requests.post(
                f"{BASE_URL}/api/coaches",
                headers={"Authorization": f"Bearer {admin_token}"},
                json={
                    "name": "TEST_Blocked_Coach",
                    "email": f"test_blocked_coach_{os.urandom(4).hex()}@example.com"
                }
            )
            
            assert response.status_code == 403, f"Expected 403 when limit exceeded, got {response.status_code}: {response.text}"
            
            data = response.json()
            assert "limit" in data.get("detail", "").lower(), f"Error message should mention limit: {data}"
            print(f"\nCorrectly blocked coach creation: {data}")
        else:
            print(f"\nCoach limit not exceeded ({limits['coaches']['current']}/{limits['coaches']['limit']}), skipping block test")
            pytest.skip("Coach limit not exceeded - cannot test blocking")


class TestInviteLimitEnforcement:
    """Test POST /api/invites returns 403 when limit exceeded"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        token = data.get("session", {}).get("session_token") or data.get("token")
        assert token, "No token in response"
        return token
    
    def test_coach_invite_blocked_when_limit_exceeded(self, admin_token):
        """Test POST /api/invites with role='coach' returns 403 when coach limit exceeded"""
        # First check the current limits
        limits_response = requests.get(
            f"{BASE_URL}/api/organization/limits",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert limits_response.status_code == 200
        limits = limits_response.json()
        
        # If coach limit is exceeded, try to send a coach invite
        if not limits["coaches"]["can_add"]:
            print(f"\nCoach limit already exceeded: {limits['coaches']['current']}/{limits['coaches']['limit']}")
            
            # Try to create a coach invite - should fail with 403
            response = requests.post(
                f"{BASE_URL}/api/invites",
                headers={"Authorization": f"Bearer {admin_token}"},
                json={
                    "email": f"test_blocked_coach_invite_{os.urandom(4).hex()}@example.com",
                    "role": "coach"
                }
            )
            
            assert response.status_code == 403, f"Expected 403 when limit exceeded, got {response.status_code}: {response.text}"
            
            data = response.json()
            assert "limit" in data.get("detail", "").lower(), f"Error message should mention limit: {data}"
            print(f"\nCorrectly blocked coach invite: {data}")
        else:
            print(f"\nCoach limit not exceeded ({limits['coaches']['current']}/{limits['coaches']['limit']}), skipping block test")
            pytest.skip("Coach limit not exceeded - cannot test blocking")
    
    def test_admin_invite_blocked_when_limit_exceeded(self, admin_token):
        """Test POST /api/invites with role='coach_developer' returns 403 when admin limit exceeded"""
        # First check the current limits
        limits_response = requests.get(
            f"{BASE_URL}/api/organization/limits",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert limits_response.status_code == 200
        limits = limits_response.json()
        
        # If admin limit is exceeded, try to send an admin invite
        if not limits["admins"]["can_add"]:
            print(f"\nAdmin limit already exceeded: {limits['admins']['current']}/{limits['admins']['limit']}")
            
            # Try to create an admin invite - should fail with 403
            response = requests.post(
                f"{BASE_URL}/api/invites",
                headers={"Authorization": f"Bearer {admin_token}"},
                json={
                    "email": f"test_blocked_admin_invite_{os.urandom(4).hex()}@example.com",
                    "role": "coach_developer"
                }
            )
            
            assert response.status_code == 403, f"Expected 403 when limit exceeded, got {response.status_code}: {response.text}"
            
            data = response.json()
            assert "limit" in data.get("detail", "").lower(), f"Error message should mention limit: {data}"
            print(f"\nCorrectly blocked admin invite: {data}")
        else:
            print(f"\nAdmin limit not exceeded ({limits['admins']['current']}/{limits['admins']['limit']}), skipping block test")
            pytest.skip("Admin limit not exceeded - cannot test blocking")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
