"""
Tests for Coach Development Tab - Coach Analytics API
Tests the /api/coaches/{coach_id}/analytics endpoint
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://coaching-platform-qa.preview.emergentagent.com')

# Test credentials
COACH_DEV_EMAIL = "hello@mycoachdeveloper.com"
COACH_DEV_PASSWORD = "_mcDeveloper26!"
TEST_COACH_ID = "coach_67857d39dbbc"  # Joe Morrissey


class TestCoachAnalyticsEndpoint:
    """Test the /api/coaches/{coach_id}/analytics endpoint"""
    
    @pytest.fixture(scope="class")
    def session(self):
        """Create a session with authentication"""
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        return s
    
    @pytest.fixture(scope="class")
    def authenticated_session(self, session):
        """Login and return authenticated session"""
        login_response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": COACH_DEV_EMAIL, "password": COACH_DEV_PASSWORD}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        return session
    
    def test_analytics_endpoint_returns_200(self, authenticated_session):
        """Test that analytics endpoint returns 200 for valid coach"""
        response = authenticated_session.get(
            f"{BASE_URL}/api/coaches/{TEST_COACH_ID}/analytics"
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("PASS: Analytics endpoint returns 200")
    
    def test_analytics_response_structure(self, authenticated_session):
        """Test that analytics response contains all required fields"""
        response = authenticated_session.get(
            f"{BASE_URL}/api/coaches/{TEST_COACH_ID}/analytics"
        )
        assert response.status_code == 200
        
        data = response.json()
        
        # Verify all required fields are present
        required_fields = [
            'total_sessions',
            'total_interventions',
            'avg_per_session',
            'avg_ball_rolling',
            'total_ball_rolling_time',
            'total_ball_stopped_time',
            'intervention_chart_data',
            'variety_percentage',
            'most_common_pattern'
        ]
        
        for field in required_fields:
            assert field in data, f"Missing required field: {field}"
        
        print("PASS: Analytics response contains all required fields")
    
    def test_analytics_data_types(self, authenticated_session):
        """Test that analytics data has correct types"""
        response = authenticated_session.get(
            f"{BASE_URL}/api/coaches/{TEST_COACH_ID}/analytics"
        )
        assert response.status_code == 200
        
        data = response.json()
        
        # Check data types
        assert isinstance(data['total_sessions'], int), "total_sessions should be int"
        assert isinstance(data['total_interventions'], int), "total_interventions should be int"
        assert isinstance(data['avg_per_session'], (int, float)), "avg_per_session should be numeric"
        assert isinstance(data['avg_ball_rolling'], (int, float)), "avg_ball_rolling should be numeric"
        assert isinstance(data['intervention_chart_data'], list), "intervention_chart_data should be list"
        assert isinstance(data['variety_percentage'], (int, float)), "variety_percentage should be numeric"
        
        print("PASS: Analytics data types are correct")
    
    def test_analytics_intervention_chart_data_structure(self, authenticated_session):
        """Test intervention chart data has correct structure"""
        response = authenticated_session.get(
            f"{BASE_URL}/api/coaches/{TEST_COACH_ID}/analytics"
        )
        assert response.status_code == 200
        
        data = response.json()
        chart_data = data['intervention_chart_data']
        
        # If there's chart data, verify structure
        if len(chart_data) > 0:
            for item in chart_data:
                assert 'name' in item, "Chart item missing 'name'"
                assert 'count' in item, "Chart item missing 'count'"
                assert 'percentage' in item, "Chart item missing 'percentage'"
        
        print("PASS: Intervention chart data structure is correct")
    
    def test_analytics_most_common_pattern(self, authenticated_session):
        """Test most common pattern structure"""
        response = authenticated_session.get(
            f"{BASE_URL}/api/coaches/{TEST_COACH_ID}/analytics"
        )
        assert response.status_code == 200
        
        data = response.json()
        pattern = data['most_common_pattern']
        
        # If there's a pattern, verify structure
        if pattern is not None:
            assert 'pattern' in pattern, "Pattern missing 'pattern' field"
            assert 'count' in pattern, "Pattern missing 'count' field"
        
        print("PASS: Most common pattern structure is correct")
    
    def test_analytics_values_are_reasonable(self, authenticated_session):
        """Test that analytics values are within reasonable ranges"""
        response = authenticated_session.get(
            f"{BASE_URL}/api/coaches/{TEST_COACH_ID}/analytics"
        )
        assert response.status_code == 200
        
        data = response.json()
        
        # Check percentages are in valid range (0-100)
        assert 0 <= data['avg_ball_rolling'] <= 100, f"avg_ball_rolling out of range: {data['avg_ball_rolling']}"
        assert 0 <= data['variety_percentage'] <= 100, f"variety_percentage out of range: {data['variety_percentage']}"
        
        # Check counts are non-negative
        assert data['total_sessions'] >= 0, "total_sessions should be non-negative"
        assert data['total_interventions'] >= 0, "total_interventions should be non-negative"
        assert data['avg_per_session'] >= 0, "avg_per_session should be non-negative"
        
        print("PASS: Analytics values are within reasonable ranges")
    
    def test_analytics_requires_authentication(self, session):
        """Test that analytics endpoint requires authentication"""
        # Clear cookies first to ensure no auth
        session.cookies.clear()
        
        response = session.get(
            f"{BASE_URL}/api/coaches/{TEST_COACH_ID}/analytics"
        )
        # Should return 401 or 403 without auth
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        
        print("PASS: Analytics endpoint requires authentication")
    
    def test_analytics_nonexistent_coach_returns_404(self, session):
        """Test that analytics for non-existent coach returns 404"""
        # Re-authenticate first since previous test cleared cookies
        login_response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": COACH_DEV_EMAIL, "password": COACH_DEV_PASSWORD}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        
        response = session.get(
            f"{BASE_URL}/api/coaches/coach_nonexistent_id/analytics"
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        
        print("PASS: Non-existent coach returns 404")


class TestCoachEndpoints:
    """Test related coach endpoints used by Coach Profile page"""
    
    @pytest.fixture(scope="class")
    def session(self):
        """Create a session with authentication"""
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        return s
    
    @pytest.fixture(scope="class")
    def authenticated_session(self, session):
        """Login and return authenticated session"""
        login_response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": COACH_DEV_EMAIL, "password": COACH_DEV_PASSWORD}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        return session
    
    def test_get_coach_detail(self, authenticated_session):
        """Test GET /api/coaches/{coach_id} returns coach details"""
        response = authenticated_session.get(
            f"{BASE_URL}/api/coaches/{TEST_COACH_ID}"
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert 'id' in data, "Missing 'id' in response"
        assert 'name' in data, "Missing 'name' in response"
        assert 'targets' in data, "Missing 'targets' in response"
        
        print(f"PASS: Coach detail returns {data['name']}")
    
    def test_get_coach_sessions(self, authenticated_session):
        """Test GET /api/coaches/{coach_id}/sessions returns sessions"""
        response = authenticated_session.get(
            f"{BASE_URL}/api/coaches/{TEST_COACH_ID}/sessions"
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        print(f"PASS: Coach sessions returns {len(data)} sessions")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
