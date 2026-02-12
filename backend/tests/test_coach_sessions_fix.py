"""
Test suite for coach sessions endpoint and related fixes:
1. New endpoint /api/coaches/{coach_id}/sessions returns sessions for a specific coach
2. Login functionality works with email/password
3. Review Session page does not crash with null checks
4. Coach name is displayed in Review Session header when available
5. Coach profile page loads sessions from the new endpoint
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestLoginFunctionality:
    """Test email/password login functionality"""
    
    def test_login_coach_developer(self):
        """Test login with coach developer credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "joemorrisseyg@gmail.com", "password": "12345"}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert data["role"] == "coach_developer"
        assert "user_id" in data
        print(f"✓ Coach Developer login successful: {data['email']}")
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials returns 401"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "invalid@example.com", "password": "wrongpassword"}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Invalid credentials correctly returns 401")


class TestCoachSessionsEndpoint:
    """Test the new /api/coaches/{coach_id}/sessions endpoint"""
    
    @pytest.fixture
    def auth_session(self):
        """Get authenticated session"""
        session = requests.Session()
        response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "joemorrisseyg@gmail.com", "password": "12345"}
        )
        assert response.status_code == 200
        return session
    
    def test_get_coach_sessions_endpoint_exists(self, auth_session):
        """Test that the new coach sessions endpoint exists and returns valid response"""
        coach_id = "coach_67857d39dbbc"
        response = auth_session.get(f"{BASE_URL}/api/coaches/{coach_id}/sessions")
        
        assert response.status_code == 200, f"Endpoint failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected array response"
        print(f"✓ /api/coaches/{coach_id}/sessions returns valid array with {len(data)} sessions")
    
    def test_get_coach_sessions_returns_correct_fields(self, auth_session):
        """Test that the endpoint returns sessions with correct fields for frontend compatibility"""
        coach_id = "coach_67857d39dbbc"
        response = auth_session.get(f"{BASE_URL}/api/coaches/{coach_id}/sessions")
        
        assert response.status_code == 200
        data = response.json()
        
        # If there are sessions, verify the field structure
        if len(data) > 0:
            session = data[0]
            expected_fields = ["session_id", "id", "name", "title", "coach_id", "status", "created_at", "createdAt"]
            for field in expected_fields:
                assert field in session, f"Missing field: {field}"
            print(f"✓ Session response contains all expected fields")
        else:
            print("✓ No sessions returned (empty array is valid)")
    
    def test_get_coach_sessions_invalid_coach(self, auth_session):
        """Test that invalid coach_id returns 404"""
        response = auth_session.get(f"{BASE_URL}/api/coaches/invalid_coach_id/sessions")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Invalid coach ID correctly returns 404")
    
    def test_get_coach_sessions_unauthorized(self):
        """Test that unauthenticated request returns 401"""
        coach_id = "coach_67857d39dbbc"
        response = requests.get(f"{BASE_URL}/api/coaches/{coach_id}/sessions")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Unauthenticated request correctly returns 401")


class TestCoachProfileEndpoint:
    """Test the coach profile endpoint"""
    
    @pytest.fixture
    def auth_session(self):
        """Get authenticated session"""
        session = requests.Session()
        response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "joemorrisseyg@gmail.com", "password": "12345"}
        )
        assert response.status_code == 200
        return session
    
    def test_get_coach_profile(self, auth_session):
        """Test getting coach profile returns correct data"""
        coach_id = "coach_67857d39dbbc"
        response = auth_session.get(f"{BASE_URL}/api/coaches/{coach_id}")
        
        assert response.status_code == 200, f"Failed to get coach: {response.text}"
        data = response.json()
        assert data["id"] == coach_id
        assert "name" in data
        print(f"✓ Coach profile returned: {data['name']}")
    
    def test_list_all_coaches(self, auth_session):
        """Test listing all coaches"""
        response = auth_session.get(f"{BASE_URL}/api/coaches")
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Coaches list returned {len(data)} coaches")


class TestObservationSessionsAPI:
    """Test observation sessions for Review Session page compatibility"""
    
    @pytest.fixture
    def auth_session(self):
        """Get authenticated session"""
        session = requests.Session()
        response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "joemorrisseyg@gmail.com", "password": "12345"}
        )
        assert response.status_code == 200
        return session
    
    def test_get_observations_list(self, auth_session):
        """Test that observations list endpoint works"""
        response = auth_session.get(f"{BASE_URL}/api/observations")
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Observations list returned {len(data)} sessions")
    
    def test_create_observation_session_with_null_fields(self, auth_session):
        """Test creating a session with null/empty fields that could crash Review page"""
        test_session = {
            "session_id": "test_nullcheck_session",
            "name": "Test Session for Null Check",
            "coach_id": None,  # Null coach - should be handled
            "observation_context": "training",
            "status": "draft",
            "planned_date": None,
            "intervention_types": [],  # Empty array
            "descriptor_group1": None,  # Null descriptor group
            "descriptor_group2": None,  # Null descriptor group
            "session_parts": [],  # Empty session parts
            "start_time": None,
            "end_time": None,
            "total_duration": 0,
            "ball_rolling_time": 0,
            "ball_not_rolling_time": 0,
            "ball_rolling": False,
            "active_part_id": None,
            "events": [],  # Empty events
            "ball_rolling_log": [],
            "observer_reflections": [],
            "coach_reflections": [],
            "session_notes": "",
            "ai_summary": "",
            "attachments": []
        }
        
        response = auth_session.post(
            f"{BASE_URL}/api/observations",
            json=test_session
        )
        
        assert response.status_code in [200, 201], f"Failed to create session: {response.text}"
        data = response.json()
        assert data["session_id"] == "test_nullcheck_session"
        print("✓ Session with null/empty fields created successfully")
        
        # Clean up - delete the test session
        delete_response = auth_session.delete(f"{BASE_URL}/api/observations/test_nullcheck_session")
        assert delete_response.status_code in [200, 204], f"Failed to delete: {delete_response.text}"
        print("✓ Test session cleaned up")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
