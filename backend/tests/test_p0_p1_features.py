"""
Test P0 UI/UX enhancements and P1 backend refactoring
- P0: UI/UX improvements on coach dashboard
- P1: Backend route modularization (auth, coaches)
"""
import pytest
import requests
import os
import json

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
COACH_USER = {
    "email": "joe_morrissey@hotmail.co.uk",
    "password": "CoachTest123"
}

ADMIN_USER = {
    "email": "hello@mycoachdeveloper.com",
    "password": "_mcDeveloper26!"
}


class TestAuthRoutes:
    """Test modular auth routes from routes/auth.py"""
    
    def test_auth_login_coach_success(self):
        """POST /api/auth/login - Coach login works via modular route"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json=COACH_USER,
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "user_id" in data, "Response should contain user_id"
        assert "token" in data, "Response should contain token"
        assert data["email"] == COACH_USER["email"], "Email should match"
        assert data["role"] == "coach", "Role should be coach"
        
    def test_auth_login_admin_success(self):
        """POST /api/auth/login - Admin login works via modular route"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json=ADMIN_USER,
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "user_id" in data
        assert data["role"] == "admin"
        
    def test_auth_me_with_cookie(self):
        """GET /api/auth/me - Returns user info with cookie auth"""
        # First login to get session token
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json=COACH_USER,
            headers={"Content-Type": "application/json"}
        )
        assert login_response.status_code == 200
        token = login_response.json().get("token")
        
        # Use token as cookie
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Cookie": f"session_token={token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data["email"] == COACH_USER["email"]
        assert "user_id" in data
        assert "role" in data
        assert "linked_coach_id" in data
        
    def test_auth_me_without_token(self):
        """GET /api/auth/me - Returns 401 without authentication"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 401


class TestCoachesRoutes:
    """Test modular coaches routes from routes/coaches.py"""
    
    @pytest.fixture
    def admin_session(self):
        """Get admin session token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json=ADMIN_USER,
            headers={"Content-Type": "application/json"}
        )
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Admin login failed")
        
    def test_coaches_list_with_auth(self, admin_session):
        """GET /api/coaches - Returns list of coaches for admin/coach_developer"""
        response = requests.get(
            f"{BASE_URL}/api/coaches",
            headers={"Cookie": f"session_token={admin_session}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        # Check that coaches have expected fields
        if len(data) > 0:
            coach = data[0]
            assert "id" in coach, "Coach should have id"
            assert "name" in coach, "Coach should have name"
            assert "email" in coach, "Coach should have email"
            assert "sessionCount" in coach, "Coach should have sessionCount"
            
    def test_coaches_list_unauthorized(self):
        """GET /api/coaches - Returns 401 without authentication"""
        response = requests.get(f"{BASE_URL}/api/coaches")
        assert response.status_code == 401
        
    def test_coaches_list_forbidden_for_coach(self):
        """GET /api/coaches - Returns 403 for regular coach user"""
        # Login as coach
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json=COACH_USER,
            headers={"Content-Type": "application/json"}
        )
        assert login_response.status_code == 200
        token = login_response.json().get("token")
        
        # Try to access coaches list
        response = requests.get(
            f"{BASE_URL}/api/coaches",
            headers={"Cookie": f"session_token={token}"}
        )
        assert response.status_code == 403, "Coach should not access coaches list"


class TestCoachDashboard:
    """Test coach dashboard endpoints for UI/UX features"""
    
    @pytest.fixture
    def coach_session(self):
        """Get coach session token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json=COACH_USER,
            headers={"Content-Type": "application/json"}
        )
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Coach login failed")
        
    def test_coach_dashboard_has_pending_reflection(self, coach_session):
        """GET /api/coach/dashboard - Returns pending reflection status"""
        response = requests.get(
            f"{BASE_URL}/api/coach/dashboard",
            headers={"Cookie": f"session_token={coach_session}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        # Check for pending reflection fields (P0 feature)
        assert "has_pending_reflection" in data, "Should have has_pending_reflection field"
        assert "pending_reflection_session_id" in data, "Should have pending_reflection_session_id field"
        
    def test_coach_dashboard_has_profile_with_targets(self, coach_session):
        """GET /api/coach/dashboard - Profile includes active targets count"""
        response = requests.get(
            f"{BASE_URL}/api/coach/dashboard",
            headers={"Cookie": f"session_token={coach_session}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "profile" in data, "Should have profile"
        assert "targets" in data, "Should have targets"
        
        # Targets should be a list
        targets = data.get("targets", [])
        assert isinstance(targets, list)
        
    def test_coach_sessions_has_reflection_status(self, coach_session):
        """GET /api/coach/sessions - Sessions include reflection status for notification dots"""
        response = requests.get(
            f"{BASE_URL}/api/coach/sessions",
            headers={"Cookie": f"session_token={coach_session}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        
        # Check sessions have reflection status fields (needed for UI notification dots)
        if len(data) > 0:
            session = data[0]
            assert "has_observation" in session, "Session should have has_observation"
            assert "has_reflection" in session, "Session should have has_reflection"
            
    def test_coach_analytics_returns_data(self, coach_session):
        """GET /api/coach/analytics - Returns analytics for intervention patterns"""
        response = requests.get(
            f"{BASE_URL}/api/coach/analytics",
            headers={"Cookie": f"session_token={coach_session}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        # Check for analytics fields used in UI
        assert "total_sessions" in data or "total_interventions" in data, "Should have analytics data"


class TestHealthCheck:
    """Basic health checks"""
    
    def test_api_root(self):
        """GET /api/ - API root responds"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        
    def test_config_check(self):
        """GET /api/config-check - Config check endpoint works"""
        response = requests.get(f"{BASE_URL}/api/config-check")
        assert response.status_code == 200


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
