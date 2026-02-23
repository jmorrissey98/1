"""
Tests for Shared Reflections feature:
- Toggle sharing for observer (coach developer) reflections
- Toggle sharing for coach reflections
- Verify other_reflection_status in session responses
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
COACH_DEVELOPER_EMAIL = "hello@mycoachdeveloper.com"
COACH_DEVELOPER_PASSWORD = "_mcDeveloper26!"
COACH_EMAIL = "joe_morrissey@hotmail.co.uk"
COACH_PASSWORD = "CoachTest123"
TEST_SESSION_ID = "test_session_12345"


@pytest.fixture(scope="module")
def coach_developer_session():
    """Authenticate as coach developer and return session"""
    session = requests.Session()
    response = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": COACH_DEVELOPER_EMAIL,
        "password": COACH_DEVELOPER_PASSWORD
    })
    if response.status_code != 200:
        pytest.skip(f"Coach developer login failed: {response.status_code} - {response.text}")
    return session


@pytest.fixture(scope="module")
def coach_session():
    """Authenticate as coach and return session"""
    session = requests.Session()
    response = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": COACH_EMAIL,
        "password": COACH_PASSWORD
    })
    if response.status_code != 200:
        pytest.skip(f"Coach login failed: {response.status_code} - {response.text}")
    return session


class TestObserverReflectionSharing:
    """Test observer (coach developer) reflection sharing toggle"""
    
    def test_toggle_observer_sharing_on(self, coach_developer_session):
        """Coach developer can enable sharing their reflection"""
        response = coach_developer_session.put(
            f"{BASE_URL}/api/observations/{TEST_SESSION_ID}/observer-reflection-sharing",
            json={"shared": True}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("success") == True
        assert data.get("shared") == True
    
    def test_toggle_observer_sharing_off(self, coach_developer_session):
        """Coach developer can disable sharing their reflection"""
        response = coach_developer_session.put(
            f"{BASE_URL}/api/observations/{TEST_SESSION_ID}/observer-reflection-sharing",
            json={"shared": False}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("success") == True
        assert data.get("shared") == False
    
    def test_observer_sharing_requires_auth(self):
        """Observer sharing toggle requires authentication"""
        response = requests.put(
            f"{BASE_URL}/api/observations/{TEST_SESSION_ID}/observer-reflection-sharing",
            json={"shared": True}
        )
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
    
    def test_observer_sharing_only_by_owner(self, coach_session):
        """Coach cannot toggle observer's reflection sharing"""
        response = coach_session.put(
            f"{BASE_URL}/api/observations/{TEST_SESSION_ID}/observer-reflection-sharing",
            json={"shared": True}
        )
        # Should fail - coach is not the observer
        assert response.status_code in [403, 404], f"Expected 403/404, got {response.status_code}"


class TestCoachReflectionSharing:
    """Test coach reflection sharing toggle"""
    
    def test_toggle_coach_sharing_on(self, coach_session):
        """Coach can enable sharing their reflection"""
        response = coach_session.put(
            f"{BASE_URL}/api/observations/{TEST_SESSION_ID}/coach-reflection-sharing",
            json={"shared": True}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("success") == True
        assert data.get("shared") == True
    
    def test_toggle_coach_sharing_off(self, coach_session):
        """Coach can disable sharing their reflection"""
        response = coach_session.put(
            f"{BASE_URL}/api/observations/{TEST_SESSION_ID}/coach-reflection-sharing",
            json={"shared": False}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("success") == True
        assert data.get("shared") == False
    
    def test_coach_sharing_requires_auth(self):
        """Coach sharing toggle requires authentication"""
        response = requests.put(
            f"{BASE_URL}/api/observations/{TEST_SESSION_ID}/coach-reflection-sharing",
            json={"shared": True}
        )
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
    
    def test_coach_sharing_only_by_coach(self, coach_developer_session):
        """Coach developer cannot toggle coach's reflection sharing"""
        response = coach_developer_session.put(
            f"{BASE_URL}/api/observations/{TEST_SESSION_ID}/coach-reflection-sharing",
            json={"shared": True}
        )
        # Should fail - coach developer is not a coach
        assert response.status_code in [403, 404], f"Expected 403/404, got {response.status_code}"


class TestOtherReflectionStatus:
    """Test other_reflection_status field in session responses"""
    
    def test_coach_developer_sees_other_reflection_status(self, coach_developer_session):
        """Coach developer gets other_reflection_status when fetching session"""
        response = coach_developer_session.get(f"{BASE_URL}/api/observations/{TEST_SESSION_ID}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Verify session has the other_reflection_status field
        assert "other_reflection_status" in data, f"Missing other_reflection_status field. Keys: {data.keys()}"
        # Status should be one of: not_completed, not_shared, shared, or None
        valid_statuses = ["not_completed", "not_shared", "shared", None]
        assert data.get("other_reflection_status") in valid_statuses, \
            f"Unexpected status: {data.get('other_reflection_status')}"
    
    def test_coach_sees_other_reflection_status(self, coach_session):
        """Coach gets other_reflection_status when fetching session"""
        response = coach_session.get(f"{BASE_URL}/api/observations/{TEST_SESSION_ID}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Verify session has the other_reflection_status field
        assert "other_reflection_status" in data, f"Missing other_reflection_status field. Keys: {data.keys()}"
        valid_statuses = ["not_completed", "not_shared", "shared", None]
        assert data.get("other_reflection_status") in valid_statuses, \
            f"Unexpected status: {data.get('other_reflection_status')}"
    
    def test_session_has_sharing_flags(self, coach_developer_session):
        """Session response includes sharing flags"""
        response = coach_developer_session.get(f"{BASE_URL}/api/observations/{TEST_SESSION_ID}")
        assert response.status_code == 200
        
        data = response.json()
        # Check both sharing flags are present
        assert "observer_reflection_shared" in data, "Missing observer_reflection_shared"
        assert "coach_reflection_shared" in data, "Missing coach_reflection_shared"
        # Default should be True
        assert isinstance(data.get("observer_reflection_shared"), bool)
        assert isinstance(data.get("coach_reflection_shared"), bool)
    
    def test_session_has_other_user_name(self, coach_developer_session):
        """Session response includes other_user_name field"""
        response = coach_developer_session.get(f"{BASE_URL}/api/observations/{TEST_SESSION_ID}")
        assert response.status_code == 200
        
        data = response.json()
        # Should have other_user_name (coach name for coach developer view)
        assert "other_user_name" in data, "Missing other_user_name"


class TestSharingStateFlow:
    """Test complete sharing state flows"""
    
    def test_sharing_default_is_on(self, coach_developer_session):
        """Verify sharing defaults to ON (True)"""
        # First set to True to ensure known state
        response = coach_developer_session.put(
            f"{BASE_URL}/api/observations/{TEST_SESSION_ID}/observer-reflection-sharing",
            json={"shared": True}
        )
        assert response.status_code == 200
        
        # Fetch session and verify
        response = coach_developer_session.get(f"{BASE_URL}/api/observations/{TEST_SESSION_ID}")
        assert response.status_code == 200
        data = response.json()
        assert data.get("observer_reflection_shared") == True
    
    def test_toggle_persists(self, coach_developer_session):
        """Verify toggle change persists in database"""
        # Set to False
        response = coach_developer_session.put(
            f"{BASE_URL}/api/observations/{TEST_SESSION_ID}/observer-reflection-sharing",
            json={"shared": False}
        )
        assert response.status_code == 200
        
        # Fetch session and verify it persisted
        response = coach_developer_session.get(f"{BASE_URL}/api/observations/{TEST_SESSION_ID}")
        assert response.status_code == 200
        data = response.json()
        assert data.get("observer_reflection_shared") == False
        
        # Set back to True
        response = coach_developer_session.put(
            f"{BASE_URL}/api/observations/{TEST_SESSION_ID}/observer-reflection-sharing",
            json={"shared": True}
        )
        assert response.status_code == 200


class TestNonExistentSession:
    """Test error handling for non-existent sessions"""
    
    def test_observer_sharing_nonexistent_session(self, coach_developer_session):
        """Observer sharing toggle returns 404 for non-existent session"""
        response = coach_developer_session.put(
            f"{BASE_URL}/api/observations/nonexistent_session_xyz/observer-reflection-sharing",
            json={"shared": True}
        )
        assert response.status_code == 404
    
    def test_coach_sharing_nonexistent_session(self, coach_session):
        """Coach sharing toggle returns 404 for non-existent session"""
        response = coach_session.put(
            f"{BASE_URL}/api/observations/nonexistent_session_xyz/coach-reflection-sharing",
            json={"shared": True}
        )
        assert response.status_code == 404
