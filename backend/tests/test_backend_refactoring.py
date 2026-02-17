"""
Backend API Regression Tests - Server.py Refactoring
======================================================
Tests all API endpoints that were migrated from server.py to modular route files:
- routes/auth.py - Authentication routes  
- routes/users.py - User management routes
- routes/coaches.py - Coach profile routes
- routes/invites.py - Invitation routes
- routes/observations.py - Observation session routes
- routes/organization.py - Organization routes

These tests verify the refactoring didn't break any existing functionality.
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


@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def admin_session(api_client):
    """Login as admin/coach_developer and return session with auth"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    assert response.status_code == 200, f"Admin login failed: {response.text}"
    
    data = response.json()
    token = data.get("token")
    
    # Create new session with auth header
    auth_session = requests.Session()
    auth_session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}"
    })
    
    return auth_session, data


@pytest.fixture(scope="module")
def coach_session(api_client):
    """Login as coach and return session with auth"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": COACH_EMAIL,
        "password": COACH_PASSWORD
    })
    assert response.status_code == 200, f"Coach login failed: {response.text}"
    
    data = response.json()
    token = data.get("token")
    
    # Create new session with auth header
    auth_session = requests.Session()
    auth_session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}"
    })
    
    return auth_session, data


class TestAuthRoutes:
    """Test authentication routes from routes/auth.py"""
    
    def test_login_admin_success(self, api_client):
        """Test admin login works after refactoring"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        assert response.status_code == 200
        data = response.json()
        assert "user_id" in data
        assert "email" in data
        assert data["email"] == ADMIN_EMAIL
        assert "token" in data
        assert data.get("role") in ["coach_developer", "admin"]
        print(f"PASS: Admin login returned user_id={data['user_id']}, role={data.get('role')}")
    
    def test_login_coach_success(self, api_client):
        """Test coach login works after refactoring"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": COACH_EMAIL,
            "password": COACH_PASSWORD
        })
        
        assert response.status_code == 200
        data = response.json()
        assert "user_id" in data
        assert "email" in data
        assert data["email"] == COACH_EMAIL
        assert "token" in data
        assert data.get("role") == "coach"
        print(f"PASS: Coach login returned user_id={data['user_id']}, role={data.get('role')}")
    
    def test_login_invalid_credentials(self, api_client):
        """Test invalid login returns 401"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": "invalid@test.com",
            "password": "wrongpassword"
        })
        
        assert response.status_code == 401
        print("PASS: Invalid login correctly returned 401")
    
    def test_auth_me_with_token(self, admin_session):
        """Test /auth/me endpoint returns current user"""
        session, login_data = admin_session
        response = session.get(f"{BASE_URL}/api/auth/me")
        
        assert response.status_code == 200
        data = response.json()
        assert "user_id" in data
        assert data["email"] == ADMIN_EMAIL
        assert "role" in data
        print(f"PASS: /auth/me returned user_id={data['user_id']}, email={data['email']}")
    
    def test_auth_me_without_token(self, api_client):
        """Test /auth/me without auth returns 401"""
        response = api_client.get(f"{BASE_URL}/api/auth/me")
        
        assert response.status_code == 401
        print("PASS: /auth/me without token correctly returned 401")


class TestUsersRoutes:
    """Test user management routes from routes/users.py"""
    
    def test_list_users_admin(self, admin_session):
        """Test users list endpoint works for admin"""
        session, _ = admin_session
        response = session.get(f"{BASE_URL}/api/users")
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        
        # Verify user structure
        first_user = data[0]
        assert "user_id" in first_user
        assert "email" in first_user
        assert "name" in first_user
        assert "role" in first_user
        print(f"PASS: Users list returned {len(data)} users")
    
    def test_list_users_unauthenticated(self, api_client):
        """Test users list requires authentication"""
        response = api_client.get(f"{BASE_URL}/api/users")
        
        assert response.status_code == 401
        print("PASS: Users list correctly requires authentication")
    
    def test_list_users_coach_forbidden(self, coach_session):
        """Test coach cannot access users list"""
        session, _ = coach_session
        response = session.get(f"{BASE_URL}/api/users")
        
        assert response.status_code == 403
        print("PASS: Coach correctly denied access to users list")


class TestCoachesRoutes:
    """Test coach management routes from routes/coaches.py"""
    
    def test_list_coaches_admin(self, admin_session):
        """Test coaches list endpoint works for admin"""
        session, _ = admin_session
        response = session.get(f"{BASE_URL}/api/coaches")
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        # If coaches exist, verify structure
        if len(data) > 0:
            first_coach = data[0]
            assert "id" in first_coach
            assert "name" in first_coach
            print(f"PASS: Coaches list returned {len(data)} coaches")
        else:
            print("PASS: Coaches list returned empty list (no coaches yet)")
    
    def test_list_coaches_unauthenticated(self, api_client):
        """Test coaches list requires authentication"""
        response = api_client.get(f"{BASE_URL}/api/coaches")
        
        assert response.status_code == 401
        print("PASS: Coaches list correctly requires authentication")
    
    def test_list_coaches_coach_forbidden(self, coach_session):
        """Test coach cannot access coaches list"""
        session, _ = coach_session
        response = session.get(f"{BASE_URL}/api/coaches")
        
        assert response.status_code == 403
        print("PASS: Coach correctly denied access to coaches list")


class TestInvitesRoutes:
    """Test invite management routes from routes/invites.py"""
    
    def test_list_invites_admin(self, admin_session):
        """Test invites list endpoint works for admin"""
        session, _ = admin_session
        response = session.get(f"{BASE_URL}/api/invites")
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"PASS: Invites list returned {len(data)} pending invites")
    
    def test_list_invites_unauthenticated(self, api_client):
        """Test invites list requires authentication"""
        response = api_client.get(f"{BASE_URL}/api/invites")
        
        assert response.status_code == 401
        print("PASS: Invites list correctly requires authentication")
    
    def test_list_invites_coach_forbidden(self, coach_session):
        """Test coach cannot access invites list"""
        session, _ = coach_session
        response = session.get(f"{BASE_URL}/api/invites")
        
        assert response.status_code == 403
        print("PASS: Coach correctly denied access to invites list")
    
    def test_validate_invalid_invite(self, api_client):
        """Test validating an invalid invite ID"""
        response = api_client.get(f"{BASE_URL}/api/invites/validate/invalid_invite_123")
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("valid") == False
        print("PASS: Invalid invite validation correctly returned valid=False")


class TestObservationsRoutes:
    """Test observation session routes from routes/observations.py"""
    
    def test_list_observations_admin(self, admin_session):
        """Test observations list endpoint works for admin"""
        session, _ = admin_session
        response = session.get(f"{BASE_URL}/api/observations")
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        # If observations exist, verify structure
        if len(data) > 0:
            first_obs = data[0]
            assert "session_id" in first_obs
            assert "name" in first_obs
            assert "status" in first_obs
        print(f"PASS: Observations list returned {len(data)} sessions")
    
    def test_list_observations_unauthenticated(self, api_client):
        """Test observations list requires authentication"""
        response = api_client.get(f"{BASE_URL}/api/observations")
        
        assert response.status_code == 401
        print("PASS: Observations list correctly requires authentication")
    
    def test_list_observations_coach_forbidden(self, coach_session):
        """Test coach cannot access observations list (coach developer only)"""
        session, _ = coach_session
        response = session.get(f"{BASE_URL}/api/observations")
        
        assert response.status_code == 403
        print("PASS: Coach correctly denied access to observations list")


class TestOrganizationRoutes:
    """Test organization routes from routes/organization.py"""
    
    def test_get_organization_admin(self, admin_session):
        """Test organization endpoint works for admin"""
        session, _ = admin_session
        response = session.get(f"{BASE_URL}/api/organization")
        
        assert response.status_code == 200
        data = response.json()
        # Organization may or may not have data set
        assert "org_id" in data or data.get("org_id") is None
        print(f"PASS: Organization returned org_id={data.get('org_id')}, club_name={data.get('club_name')}")
    
    def test_get_organization_unauthenticated(self, api_client):
        """Test organization endpoint requires authentication"""
        response = api_client.get(f"{BASE_URL}/api/organization")
        
        assert response.status_code == 401
        print("PASS: Organization endpoint correctly requires authentication")
    
    def test_get_organization_coach(self, coach_session):
        """Test coach can access organization endpoint"""
        session, _ = coach_session
        response = session.get(f"{BASE_URL}/api/organization")
        
        # Coaches should be able to see organization info
        assert response.status_code == 200
        data = response.json()
        assert "org_id" in data or data.get("org_id") is None
        print(f"PASS: Coach can access organization endpoint")


class TestCoachDashboard:
    """Test coach dashboard endpoints (should still work after refactoring)"""
    
    def test_coach_dashboard_access(self, coach_session):
        """Test coach can access their dashboard"""
        session, _ = coach_session
        response = session.get(f"{BASE_URL}/api/coach/dashboard")
        
        assert response.status_code == 200
        data = response.json()
        assert "profile" in data
        assert "targets" in data
        print(f"PASS: Coach dashboard accessible")
    
    def test_coach_sessions(self, coach_session):
        """Test coach can access their sessions"""
        session, _ = coach_session
        response = session.get(f"{BASE_URL}/api/coach/sessions")
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"PASS: Coach sessions returned {len(data)} sessions")


class TestAPIRootAndHealth:
    """Test root and health check endpoints"""
    
    def test_api_root(self, api_client):
        """Test API root endpoint"""
        response = api_client.get(f"{BASE_URL}/api/")
        
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print(f"PASS: API root returned: {data.get('message')}")
    
    def test_config_check(self, api_client):
        """Test config check endpoint"""
        response = api_client.get(f"{BASE_URL}/api/config-check")
        
        assert response.status_code == 200
        data = response.json()
        assert "sender_email" in data
        assert "app_url" in data
        print(f"PASS: Config check returned sender_email={data.get('sender_email')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
