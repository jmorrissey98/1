"""
Test AI Summary Generation Fix
Bug: ReferenceError: storage is not defined
Fix: Replaced storage.getCoach() calls with session.coachName
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAISummaryFix:
    """Tests for the AI summary generation fix"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data"""
        self.api = requests.Session()
        self.api.headers.update({"Content-Type": "application/json"})
        self.test_session_id = "session_1770897924841_bu9vhupev"
        self.login_credentials = {
            "email": "joemorrisseyg@gmail.com",
            "password": "12345"
        }
    
    def test_login_coach_developer(self):
        """Test login with Coach Developer credentials"""
        response = self.api.post(
            f"{BASE_URL}/api/auth/login",
            json=self.login_credentials
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert data.get("role") == "coach_developer", "Expected coach_developer role"
        print(f"✓ Logged in as: {data.get('email')} with role: {data.get('role')}")
        return response.cookies
    
    def test_get_session_data(self):
        """Test fetching the specific session to verify it exists and has coachName"""
        # Login first
        cookies = self.test_login_coach_developer()
        
        response = self.api.get(
            f"{BASE_URL}/api/observations/{self.test_session_id}",
            cookies=cookies
        )
        
        if response.status_code == 404:
            pytest.skip(f"Test session {self.test_session_id} not found - skipping")
        
        assert response.status_code == 200, f"Failed to get session: {response.text}"
        data = response.json()
        
        print(f"✓ Session found: {data.get('name')}")
        print(f"  - Status: {data.get('status')}")
        print(f"  - Coach ID: {data.get('coach_id')}")
        print(f"  - Coach Name: {data.get('coach_name')}")
        print(f"  - Events count: {len(data.get('events', []))}")
        
        return data, cookies
    
    def test_generate_summary_endpoint(self):
        """Test the /api/generate-summary endpoint directly"""
        # Login first
        cookies = self.test_login_coach_developer()
        
        # Prepare minimal test data for summary generation
        # This tests that the backend endpoint works without any 'storage' dependency
        test_payload = {
            "session_name": "Test Session",
            "total_duration": 3600,
            "total_events": 5,
            "ball_rolling_time": 1800,
            "ball_not_rolling_time": 1800,
            "event_breakdown": {"Question": 3, "Instruction": 2},
            "descriptor1_name": "Focus",
            "descriptor1_breakdown": {"Technical": 2, "Tactical": 3},
            "descriptor2_name": "Context",
            "descriptor2_breakdown": {"Individual": 1, "Group": 4},
            "session_parts": [{"name": "Warm Up", "events": 2, "ballRollingPct": 60}],
            "user_notes": "Test observation notes",
            # Test with coach_name provided (as the fix does)
            "coach_name": "Test Coach",
            "coach_targets": None,
            "previous_sessions_summary": None
        }
        
        response = self.api.post(
            f"{BASE_URL}/api/generate-summary",
            json=test_payload,
            cookies=cookies,
            timeout=60  # AI generation can take time
        )
        
        assert response.status_code == 200, f"Generate summary failed: {response.text}"
        data = response.json()
        assert "summary" in data, "Response missing 'summary' field"
        assert len(data["summary"]) > 100, "Summary seems too short"
        
        print(f"✓ AI Summary generated successfully")
        print(f"  - Summary length: {len(data['summary'])} characters")
        print(f"  - Preview: {data['summary'][:200]}...")
        
        return data
    
    def test_generate_summary_without_coach_name(self):
        """Test summary generation works without coach_name (null value)"""
        cookies = self.test_login_coach_developer()
        
        test_payload = {
            "session_name": "Anonymous Test Session",
            "total_duration": 1800,
            "total_events": 3,
            "ball_rolling_time": 900,
            "ball_not_rolling_time": 900,
            "event_breakdown": {"Feedback": 3},
            "descriptor1_name": "Type",
            "descriptor1_breakdown": {"Positive": 2, "Constructive": 1},
            "descriptor2_name": "Target",
            "descriptor2_breakdown": {"Individual": 3},
            "session_parts": [],
            "user_notes": "",
            # Test with coach_name as null (fix handles this case)
            "coach_name": None,
            "coach_targets": None,
            "previous_sessions_summary": None
        }
        
        response = self.api.post(
            f"{BASE_URL}/api/generate-summary",
            json=test_payload,
            cookies=cookies,
            timeout=60
        )
        
        assert response.status_code == 200, f"Generate summary without coach failed: {response.text}"
        data = response.json()
        assert "summary" in data, "Response missing 'summary' field"
        
        print(f"✓ AI Summary generated without coach_name (null case works)")
        return data


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
