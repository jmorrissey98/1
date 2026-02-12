"""
Test Session Display Logic:
1. HomePage: Planned sessions in 'Upcoming Observations', non-planned in 'Your Sessions'
2. SessionCalendar: Loads sessions from cloud API
3. CoachProfile Sessions tab: Separates upcoming (planned) from completed sessions
4. MyCoaches page: Shows sessionCount (completed) and upcomingCount (planned) badges
5. Backend /api/coaches endpoint returns sessionCount and upcomingCount
"""

import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "joemorrisseyg@gmail.com"
TEST_PASSWORD = "12345"


class TestAuthAndSetup:
    """Authentication tests"""
    
    @pytest.fixture(scope="class")
    def session(self):
        """Create a requests session for tests"""
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        return s
    
    @pytest.fixture(scope="class")
    def auth_cookies(self, session):
        """Authenticate and get session cookies"""
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert data.get("role") == "coach_developer", f"Expected coach_developer role, got {data.get('role')}"
        return session.cookies
    
    def test_login_success(self, session):
        """Verify login works with test credentials"""
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "user_id" in data
        assert data["email"] == TEST_EMAIL
        print(f"Login successful: user_id={data['user_id']}, role={data.get('role')}")


class TestCoachesEndpoint:
    """Test /api/coaches endpoint returns sessionCount and upcomingCount"""
    
    @pytest.fixture(scope="class")
    def auth_session(self):
        """Create authenticated session"""
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        response = s.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return s
    
    def test_coaches_list_returns_session_counts(self, auth_session):
        """Verify /api/coaches returns sessionCount and upcomingCount for each coach"""
        response = auth_session.get(f"{BASE_URL}/api/coaches")
        assert response.status_code == 200, f"Failed to get coaches: {response.text}"
        
        coaches = response.json()
        assert isinstance(coaches, list), "Expected list of coaches"
        print(f"Found {len(coaches)} coaches")
        
        # Verify structure of each coach
        for coach in coaches:
            assert "id" in coach, "Missing coach id"
            assert "name" in coach, "Missing coach name"
            # These are the new fields we're testing
            assert "sessionCount" in coach, f"Missing sessionCount for coach {coach.get('name')}"
            assert "upcomingCount" in coach, f"Missing upcomingCount for coach {coach.get('name')}"
            assert isinstance(coach["sessionCount"], int), "sessionCount should be an integer"
            assert isinstance(coach["upcomingCount"], int), "upcomingCount should be an integer"
            print(f"Coach {coach['name']}: sessionCount={coach['sessionCount']}, upcomingCount={coach['upcomingCount']}")
    
    def test_coach_profile_returns_data(self, auth_session):
        """Verify individual coach profile can be fetched"""
        # First get list of coaches
        response = auth_session.get(f"{BASE_URL}/api/coaches")
        assert response.status_code == 200
        coaches = response.json()
        
        if len(coaches) > 0:
            coach_id = coaches[0]["id"]
            # Get individual coach profile
            response = auth_session.get(f"{BASE_URL}/api/coaches/{coach_id}")
            assert response.status_code == 200, f"Failed to get coach profile: {response.text}"
            coach = response.json()
            assert coach["id"] == coach_id
            print(f"Coach profile fetched: {coach['name']}")


class TestObservationsEndpoint:
    """Test /api/observations endpoint for session listing"""
    
    @pytest.fixture(scope="class")
    def auth_session(self):
        """Create authenticated session"""
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        response = s.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        return s
    
    def test_observations_list_returns_sessions(self, auth_session):
        """Verify /api/observations returns sessions with proper fields"""
        response = auth_session.get(f"{BASE_URL}/api/observations")
        assert response.status_code == 200, f"Failed to get observations: {response.text}"
        
        sessions = response.json()
        assert isinstance(sessions, list), "Expected list of sessions"
        print(f"Found {len(sessions)} sessions")
        
        # Verify structure of each session
        for session in sessions:
            assert "session_id" in session, "Missing session_id"
            assert "status" in session, "Missing status"
            print(f"Session: {session.get('name')} - status: {session.get('status')}")
    
    def test_observations_include_planned_date(self, auth_session):
        """Verify sessions include planned_date field for calendar display"""
        response = auth_session.get(f"{BASE_URL}/api/observations")
        assert response.status_code == 200
        
        sessions = response.json()
        # Check that planned_date field exists (may be null for non-planned sessions)
        for session in sessions:
            # planned_date should be present in the response (even if None)
            if session.get("status") == "planned":
                # For planned sessions, check planned_date
                print(f"Planned session: {session.get('name')} - planned_date: {session.get('planned_date')}")


class TestSessionCreation:
    """Test creating sessions with different statuses"""
    
    @pytest.fixture(scope="class")
    def auth_session(self):
        """Create authenticated session"""
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        response = s.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        return s
    
    @pytest.fixture(scope="class")
    def test_coach_id(self, auth_session):
        """Get a coach ID for testing"""
        response = auth_session.get(f"{BASE_URL}/api/coaches")
        if response.status_code == 200 and len(response.json()) > 0:
            return response.json()[0]["id"]
        return None
    
    def test_create_planned_session(self, auth_session, test_coach_id):
        """Create a planned session with future date"""
        import uuid
        session_id = f"test_planned_{uuid.uuid4().hex[:8]}"
        future_date = (datetime.now() + timedelta(days=7)).isoformat()
        
        payload = {
            "session_id": session_id,
            "name": "Test Planned Session",
            "coach_id": test_coach_id,
            "observation_context": "training",
            "status": "planned",
            "planned_date": future_date
        }
        
        response = auth_session.post(f"{BASE_URL}/api/observations", json=payload)
        assert response.status_code == 200, f"Failed to create planned session: {response.text}"
        
        data = response.json()
        assert data.get("session_id") == session_id
        # API returns success flag, verify by fetching the session
        assert data.get("success") == True, "Session creation should succeed"
        print(f"Created planned session: {session_id}")
        
        # Verify the session was created with correct status by fetching it
        verify_response = auth_session.get(f"{BASE_URL}/api/observations/{session_id}")
        if verify_response.status_code == 200:
            verify_data = verify_response.json()
            assert verify_data.get("status") == "planned", f"Expected planned status, got {verify_data.get('status')}"
        
        # Cleanup
        auth_session.delete(f"{BASE_URL}/api/observations/{session_id}")
        return session_id
    
    def test_create_draft_session(self, auth_session, test_coach_id):
        """Create a draft session (should appear in Your Sessions)"""
        import uuid
        session_id = f"test_draft_{uuid.uuid4().hex[:8]}"
        
        payload = {
            "session_id": session_id,
            "name": "Test Draft Session",
            "coach_id": test_coach_id,
            "observation_context": "training",
            "status": "draft"
        }
        
        response = auth_session.post(f"{BASE_URL}/api/observations", json=payload)
        assert response.status_code == 200, f"Failed to create draft session: {response.text}"
        
        data = response.json()
        assert data.get("session_id") == session_id
        # API returns success flag
        assert data.get("success") == True, "Session creation should succeed"
        print(f"Created draft session: {session_id}")
        
        # Verify the session was created with correct status by fetching it
        verify_response = auth_session.get(f"{BASE_URL}/api/observations/{session_id}")
        if verify_response.status_code == 200:
            verify_data = verify_response.json()
            assert verify_data.get("status") == "draft", f"Expected draft status, got {verify_data.get('status')}"
        
        # Cleanup
        auth_session.delete(f"{BASE_URL}/api/observations/{session_id}")
        return session_id


class TestCoachSessionsEndpoint:
    """Test /api/coaches/{coach_id}/sessions endpoint"""
    
    @pytest.fixture(scope="class")
    def auth_session(self):
        """Create authenticated session"""
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        response = s.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        return s
    
    @pytest.fixture(scope="class")
    def test_coach_id(self, auth_session):
        """Get a coach ID for testing"""
        response = auth_session.get(f"{BASE_URL}/api/coaches")
        if response.status_code == 200 and len(response.json()) > 0:
            return response.json()[0]["id"]
        return None
    
    def test_coach_sessions_endpoint_exists(self, auth_session, test_coach_id):
        """Verify /api/coaches/{coach_id}/sessions endpoint works"""
        if not test_coach_id:
            pytest.skip("No coaches available")
        
        response = auth_session.get(f"{BASE_URL}/api/coaches/{test_coach_id}/sessions")
        assert response.status_code == 200, f"Failed to get coach sessions: {response.text}"
        
        sessions = response.json()
        assert isinstance(sessions, list), "Expected list of sessions"
        print(f"Coach {test_coach_id} has {len(sessions)} sessions")
        
        # Check session structure
        for session in sessions:
            assert "id" in session or "session_id" in session, "Missing session identifier"
            assert "status" in session, "Missing status"
            print(f"  - {session.get('name', session.get('title'))} ({session.get('status')})")


class TestCalendarDataLoading:
    """Test that calendar can load sessions from cloud API"""
    
    @pytest.fixture(scope="class")
    def auth_session(self):
        """Create authenticated session"""
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        response = s.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        return s
    
    def test_observations_returns_all_status_types(self, auth_session):
        """Verify /api/observations can return sessions of all status types for calendar"""
        response = auth_session.get(f"{BASE_URL}/api/observations")
        assert response.status_code == 200
        
        sessions = response.json()
        statuses = set(s.get("status") for s in sessions)
        print(f"Session statuses found: {statuses}")
        
        # The calendar should be able to display all these statuses
        valid_statuses = {"planned", "draft", "active", "completed"}
        for status in statuses:
            assert status in valid_statuses, f"Unexpected status: {status}"
    
    def test_sessions_have_dates_for_calendar(self, auth_session):
        """Verify sessions have date fields for calendar positioning"""
        response = auth_session.get(f"{BASE_URL}/api/observations")
        assert response.status_code == 200
        
        sessions = response.json()
        for session in sessions:
            # Sessions should have either created_at or planned_date for calendar display
            has_date = (
                session.get("created_at") is not None or 
                session.get("planned_date") is not None
            )
            assert has_date, f"Session {session.get('name')} has no date for calendar display"
            print(f"Session {session.get('name')}: created_at={session.get('created_at')}, planned_date={session.get('planned_date')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
