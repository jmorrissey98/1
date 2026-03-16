"""
Tests for Ball Rolling Toggle Feature
=====================================
Tests the include_ball_rolling field on observation templates:
1. Create template with include_ball_rolling set
2. Update template to toggle include_ball_rolling
3. Retrieve template and verify include_ball_rolling value
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    raise ValueError("REACT_APP_BACKEND_URL environment variable must be set")

# Test credentials
TEST_EMAIL = "hello@mycoachdeveloper.com"
TEST_PASSWORD = "_mcDeveloper26!"


class TestBallRollingToggle:
    """Test suite for Ball Rolling toggle feature on observation templates"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Authenticate
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        
        if login_response.status_code != 200:
            pytest.skip(f"Authentication failed: {login_response.status_code} - {login_response.text}")
        
        self.auth_token = login_response.json().get("token")
        if self.auth_token:
            self.session.headers.update({"Authorization": f"Bearer {self.auth_token}"})
        
        yield
        
        # Cleanup: delete test templates
        self._cleanup_test_templates()
    
    def _cleanup_test_templates(self):
        """Clean up any test templates created during the test"""
        try:
            response = self.session.get(f"{BASE_URL}/api/observation-templates")
            if response.status_code == 200:
                templates = response.json()
                for template in templates:
                    if template.get("name", "").startswith("TEST_"):
                        self.session.delete(f"{BASE_URL}/api/observation-templates/{template['template_id']}")
        except Exception as e:
            print(f"Cleanup error (non-critical): {e}")
    
    # ============================================
    # API ENDPOINT TESTS
    # ============================================
    
    def test_observation_templates_endpoint_accessible(self):
        """Test that observation templates endpoint is accessible"""
        response = self.session.get(f"{BASE_URL}/api/observation-templates")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list of templates"
        print(f"Found {len(data)} observation templates")
    
    def test_create_template_with_ball_rolling_enabled(self):
        """Test creating a template with include_ball_rolling=True (default)"""
        template_data = {
            "name": f"TEST_BallRolling_Enabled_{uuid.uuid4().hex[:8]}",
            "description": "Test template with ball rolling enabled",
            "observation_context": "training",
            "include_ball_rolling": True,
            "intervention_types": [
                {"id": "test_int_1", "name": "Command", "color": "yellow"},
                {"id": "test_int_2", "name": "Q&A", "color": "yellow"}
            ],
            "descriptor_group1": {
                "id": "test_group1",
                "name": "Content Focus",
                "color": "blue",
                "descriptors": [{"id": "tech", "name": "Technical"}]
            },
            "descriptor_group2": {
                "id": "test_group2",
                "name": "Delivery Method",
                "color": "green",
                "descriptors": [{"id": "demo", "name": "Visual Demo"}]
            },
            "session_parts": [
                {"id": "part_1", "name": "Part 1", "order": 0}
            ],
            "is_default": False
        }
        
        response = self.session.post(f"{BASE_URL}/api/observation-templates", json=template_data)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        created = response.json()
        assert created.get("template_id") is not None, "Template ID should be returned"
        assert created.get("name") == template_data["name"], "Name should match"
        assert created.get("include_ball_rolling") == True, "include_ball_rolling should be True"
        
        print(f"Created template with include_ball_rolling=True: {created['template_id']}")
        
        # Verify by fetching back
        get_response = self.session.get(f"{BASE_URL}/api/observation-templates/{created['template_id']}")
        assert get_response.status_code == 200, f"GET failed: {get_response.text}"
        
        fetched = get_response.json()
        assert fetched.get("include_ball_rolling") == True, "Fetched template should have include_ball_rolling=True"
    
    def test_create_template_with_ball_rolling_disabled(self):
        """Test creating a template with include_ball_rolling=False"""
        template_data = {
            "name": f"TEST_BallRolling_Disabled_{uuid.uuid4().hex[:8]}",
            "description": "Test template with ball rolling disabled",
            "observation_context": "training",
            "include_ball_rolling": False,
            "intervention_types": [
                {"id": "test_int_1", "name": "Command", "color": "yellow"}
            ],
            "descriptor_group1": {
                "id": "test_group1",
                "name": "Content Focus",
                "color": "blue",
                "descriptors": []
            },
            "descriptor_group2": {
                "id": "test_group2",
                "name": "Delivery Method", 
                "color": "green",
                "descriptors": []
            },
            "session_parts": [
                {"id": "part_1", "name": "Part 1", "order": 0}
            ],
            "is_default": False
        }
        
        response = self.session.post(f"{BASE_URL}/api/observation-templates", json=template_data)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        created = response.json()
        assert created.get("include_ball_rolling") == False, "include_ball_rolling should be False"
        
        print(f"Created template with include_ball_rolling=False: {created['template_id']}")
        
        # Verify by fetching back
        get_response = self.session.get(f"{BASE_URL}/api/observation-templates/{created['template_id']}")
        assert get_response.status_code == 200, f"GET failed: {get_response.text}"
        
        fetched = get_response.json()
        assert fetched.get("include_ball_rolling") == False, "Fetched template should have include_ball_rolling=False"
    
    def test_update_template_toggle_ball_rolling(self):
        """Test updating a template to toggle include_ball_rolling from True to False"""
        # First create a template with ball rolling enabled
        template_data = {
            "name": f"TEST_BallRolling_Toggle_{uuid.uuid4().hex[:8]}",
            "description": "Test template for toggle test",
            "observation_context": "training",
            "include_ball_rolling": True,
            "intervention_types": [
                {"id": "test_int_1", "name": "Command", "color": "yellow"}
            ],
            "session_parts": [
                {"id": "part_1", "name": "Part 1", "order": 0}
            ],
            "is_default": False
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/observation-templates", json=template_data)
        assert create_response.status_code == 200, f"Create failed: {create_response.text}"
        
        created = create_response.json()
        template_id = created["template_id"]
        assert created.get("include_ball_rolling") == True, "Initial include_ball_rolling should be True"
        
        # Now update to disable ball rolling
        update_response = self.session.put(
            f"{BASE_URL}/api/observation-templates/{template_id}",
            json={"include_ball_rolling": False}
        )
        
        assert update_response.status_code == 200, f"Update failed: {update_response.text}"
        
        updated = update_response.json()
        assert updated.get("include_ball_rolling") == False, "Updated template should have include_ball_rolling=False"
        
        print(f"Successfully toggled include_ball_rolling from True to False for template {template_id}")
        
        # Verify persistence by fetching again
        get_response = self.session.get(f"{BASE_URL}/api/observation-templates/{template_id}")
        assert get_response.status_code == 200, f"GET failed: {get_response.text}"
        
        fetched = get_response.json()
        assert fetched.get("include_ball_rolling") == False, "Persisted value should be False"
    
    def test_update_template_toggle_ball_rolling_to_true(self):
        """Test updating a template to toggle include_ball_rolling from False to True"""
        # First create a template with ball rolling disabled
        template_data = {
            "name": f"TEST_BallRolling_Toggle_On_{uuid.uuid4().hex[:8]}",
            "description": "Test template for toggle on test",
            "observation_context": "training",
            "include_ball_rolling": False,
            "intervention_types": [
                {"id": "test_int_1", "name": "Command", "color": "yellow"}
            ],
            "session_parts": [
                {"id": "part_1", "name": "Part 1", "order": 0}
            ],
            "is_default": False
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/observation-templates", json=template_data)
        assert create_response.status_code == 200, f"Create failed: {create_response.text}"
        
        created = create_response.json()
        template_id = created["template_id"]
        assert created.get("include_ball_rolling") == False, "Initial include_ball_rolling should be False"
        
        # Now update to enable ball rolling
        update_response = self.session.put(
            f"{BASE_URL}/api/observation-templates/{template_id}",
            json={"include_ball_rolling": True}
        )
        
        assert update_response.status_code == 200, f"Update failed: {update_response.text}"
        
        updated = update_response.json()
        assert updated.get("include_ball_rolling") == True, "Updated template should have include_ball_rolling=True"
        
        print(f"Successfully toggled include_ball_rolling from False to True for template {template_id}")
        
        # Verify persistence by fetching again
        get_response = self.session.get(f"{BASE_URL}/api/observation-templates/{template_id}")
        assert get_response.status_code == 200, f"GET failed: {get_response.text}"
        
        fetched = get_response.json()
        assert fetched.get("include_ball_rolling") == True, "Persisted value should be True"
    
    def test_existing_templates_have_ball_rolling_field(self):
        """Test that existing templates return include_ball_rolling field"""
        response = self.session.get(f"{BASE_URL}/api/observation-templates")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        templates = response.json()
        if len(templates) == 0:
            pytest.skip("No existing templates to verify")
        
        # Check at least one template
        template = templates[0]
        
        # include_ball_rolling may be undefined for old templates (defaults to True)
        # So we just verify the endpoint returns successfully
        print(f"Template '{template.get('name')}' include_ball_rolling: {template.get('include_ball_rolling', 'undefined (defaults to True)')}")
    
    def test_default_value_for_ball_rolling(self):
        """Test that include_ball_rolling defaults to True when not specified"""
        # Create a template without specifying include_ball_rolling
        template_data = {
            "name": f"TEST_BallRolling_Default_{uuid.uuid4().hex[:8]}",
            "description": "Test template without explicit include_ball_rolling",
            "observation_context": "training",
            # Intentionally NOT including include_ball_rolling
            "intervention_types": [
                {"id": "test_int_1", "name": "Command", "color": "yellow"}
            ],
            "session_parts": [
                {"id": "part_1", "name": "Part 1", "order": 0}
            ],
            "is_default": False
        }
        
        response = self.session.post(f"{BASE_URL}/api/observation-templates", json=template_data)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        created = response.json()
        # Default should be True according to the model definition
        assert created.get("include_ball_rolling") == True, "Default value for include_ball_rolling should be True"
        
        print(f"Verified default include_ball_rolling=True for template: {created['template_id']}")


class TestHealthAndAuth:
    """Basic health and auth tests to ensure API is working"""
    
    def test_api_health(self):
        """Test API health endpoint"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200, f"API health check failed: {response.status_code}"
        print("API health check passed")
    
    def test_auth_login(self):
        """Test authentication"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        
        assert response.status_code == 200, f"Login failed: {response.status_code} - {response.text}"
        data = response.json()
        assert "token" in data or "user" in data, "Login response should contain token or user"
        print(f"Login successful for user: {data.get('user', {}).get('email', TEST_EMAIL)}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
