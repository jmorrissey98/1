"""
Test Reflection Templates API - Phase 3 Template System Expansion
Tests CRUD operations for reflection templates including:
- Creating templates with different question types (Text, Scale, Dropdown, Checkbox)
- Setting/unsetting default templates
- Listing templates by target_role (coach_educator, coach)
- Updating and deleting templates
"""
import pytest
import requests
import os
import time
from typing import Optional

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Admin credentials
ADMIN_EMAIL = "hello@mycoachdeveloper.com"
ADMIN_PASSWORD = "_mcDeveloper26!"

class TestReflectionTemplatesAPI:
    """Test suite for Reflection Templates API endpoints"""
    
    @pytest.fixture(scope="class")
    def auth_token(self) -> str:
        """Get authentication token for admin user"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "token" in data, "No token in login response"
        return data["token"]
    
    @pytest.fixture
    def headers(self, auth_token):
        """Get headers with auth token"""
        return {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {auth_token}"
        }
    
    # ==================================================
    # LIST TEMPLATES TESTS
    # ==================================================
    
    def test_list_templates_no_filter(self, headers):
        """Test listing all reflection templates without filter"""
        response = requests.get(
            f"{BASE_URL}/api/reflection-templates",
            headers=headers
        )
        assert response.status_code == 200, f"Failed to list templates: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"Found {len(data)} reflection templates")
    
    def test_list_templates_coach_educator(self, headers):
        """Test listing templates filtered by coach_educator role"""
        response = requests.get(
            f"{BASE_URL}/api/reflection-templates?target_role=coach_educator",
            headers=headers
        )
        assert response.status_code == 200, f"Failed to list templates: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        # Verify all returned templates have correct target_role
        for template in data:
            assert template.get("target_role") == "coach_educator", f"Wrong target_role: {template.get('target_role')}"
        print(f"Found {len(data)} coach_educator templates")
    
    def test_list_templates_coach(self, headers):
        """Test listing templates filtered by coach role"""
        response = requests.get(
            f"{BASE_URL}/api/reflection-templates?target_role=coach",
            headers=headers
        )
        assert response.status_code == 200, f"Failed to list templates: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        # Verify all returned templates have correct target_role
        for template in data:
            assert template.get("target_role") == "coach", f"Wrong target_role: {template.get('target_role')}"
        print(f"Found {len(data)} coach templates")
    
    # ==================================================
    # CREATE TEMPLATE TESTS
    # ==================================================
    
    def test_create_template_text_question(self, headers):
        """Test creating a template with a Text question type"""
        template_data = {
            "name": "TEST_Text Question Template",
            "target_role": "coach_educator",
            "description": "Template with text question for testing",
            "questions": [
                {
                    "question_id": f"q_text_{int(time.time())}",
                    "question_text": "What went well in this session?",
                    "question_type": "text",
                    "required": True
                }
            ],
            "is_default": False
        }
        
        response = requests.post(
            f"{BASE_URL}/api/reflection-templates",
            json=template_data,
            headers=headers
        )
        assert response.status_code == 200, f"Failed to create template: {response.text}"
        
        data = response.json()
        assert "template_id" in data, "No template_id in response"
        assert data["name"] == template_data["name"]
        assert data["target_role"] == "coach_educator"
        assert len(data["questions"]) == 1
        assert data["questions"][0]["question_type"] == "text"
        assert data["questions"][0]["required"] == True
        
        print(f"Created text question template: {data['template_id']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/reflection-templates/{data['template_id']}", headers=headers)
    
    def test_create_template_scale_question(self, headers):
        """Test creating a template with a Scale question type (custom range 1-10)"""
        template_data = {
            "name": "TEST_Scale Question Template",
            "target_role": "coach",
            "description": "Template with scale question for testing",
            "questions": [
                {
                    "question_id": f"q_scale_{int(time.time())}",
                    "question_text": "Rate the session effectiveness",
                    "question_type": "scale",
                    "required": True,
                    "scale_min": 1,
                    "scale_max": 10,
                    "scale_min_label": "Not Effective",
                    "scale_max_label": "Very Effective"
                }
            ],
            "is_default": False
        }
        
        response = requests.post(
            f"{BASE_URL}/api/reflection-templates",
            json=template_data,
            headers=headers
        )
        assert response.status_code == 200, f"Failed to create template: {response.text}"
        
        data = response.json()
        assert "template_id" in data, "No template_id in response"
        assert data["target_role"] == "coach"
        assert len(data["questions"]) == 1
        
        question = data["questions"][0]
        assert question["question_type"] == "scale"
        assert question["scale_min"] == 1
        assert question["scale_max"] == 10
        assert question["scale_min_label"] == "Not Effective"
        assert question["scale_max_label"] == "Very Effective"
        
        print(f"Created scale question template with range 1-10: {data['template_id']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/reflection-templates/{data['template_id']}", headers=headers)
    
    def test_create_template_dropdown_question(self, headers):
        """Test creating a template with a Dropdown question type"""
        template_data = {
            "name": "TEST_Dropdown Question Template",
            "target_role": "coach_educator",
            "description": "Template with dropdown question for testing",
            "questions": [
                {
                    "question_id": f"q_dropdown_{int(time.time())}",
                    "question_text": "Primary focus area of the session",
                    "question_type": "dropdown",
                    "required": False,
                    "options": ["Technical Skills", "Tactical Awareness", "Physical Conditioning", "Mental Preparation"]
                }
            ],
            "is_default": False
        }
        
        response = requests.post(
            f"{BASE_URL}/api/reflection-templates",
            json=template_data,
            headers=headers
        )
        assert response.status_code == 200, f"Failed to create template: {response.text}"
        
        data = response.json()
        assert "template_id" in data, "No template_id in response"
        
        question = data["questions"][0]
        assert question["question_type"] == "dropdown"
        assert len(question["options"]) == 4
        assert "Technical Skills" in question["options"]
        
        print(f"Created dropdown question template: {data['template_id']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/reflection-templates/{data['template_id']}", headers=headers)
    
    def test_create_template_checkbox_question(self, headers):
        """Test creating a template with a Checkbox question type"""
        template_data = {
            "name": "TEST_Checkbox Question Template",
            "target_role": "coach",
            "description": "Template with checkbox question for testing",
            "questions": [
                {
                    "question_id": f"q_checkbox_{int(time.time())}",
                    "question_text": "Select all coaching methods used",
                    "question_type": "checkbox",
                    "required": True,
                    "options": ["Demonstration", "Guided Discovery", "Command Style", "Peer Learning", "Game-Based"]
                }
            ],
            "is_default": False
        }
        
        response = requests.post(
            f"{BASE_URL}/api/reflection-templates",
            json=template_data,
            headers=headers
        )
        assert response.status_code == 200, f"Failed to create template: {response.text}"
        
        data = response.json()
        assert "template_id" in data, "No template_id in response"
        
        question = data["questions"][0]
        assert question["question_type"] == "checkbox"
        assert len(question["options"]) == 5
        assert "Demonstration" in question["options"]
        assert "Game-Based" in question["options"]
        
        print(f"Created checkbox question template: {data['template_id']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/reflection-templates/{data['template_id']}", headers=headers)
    
    def test_create_template_mixed_questions(self, headers):
        """Test creating a template with multiple question types"""
        template_data = {
            "name": "TEST_Mixed Questions Template",
            "target_role": "coach_educator",
            "description": "Comprehensive template with all question types",
            "questions": [
                {
                    "question_id": f"q_text_{int(time.time())}_1",
                    "question_text": "Describe the session objectives",
                    "question_type": "text",
                    "required": True
                },
                {
                    "question_id": f"q_scale_{int(time.time())}_2",
                    "question_text": "Overall session quality",
                    "question_type": "scale",
                    "required": True,
                    "scale_min": 1,
                    "scale_max": 5,
                    "scale_min_label": "Poor",
                    "scale_max_label": "Excellent"
                },
                {
                    "question_id": f"q_dropdown_{int(time.time())}_3",
                    "question_text": "Session type",
                    "question_type": "dropdown",
                    "required": False,
                    "options": ["Training", "Match", "Recovery"]
                },
                {
                    "question_id": f"q_checkbox_{int(time.time())}_4",
                    "question_text": "Topics covered",
                    "question_type": "checkbox",
                    "required": False,
                    "options": ["Passing", "Shooting", "Defense", "Set Pieces"]
                }
            ],
            "is_default": False
        }
        
        response = requests.post(
            f"{BASE_URL}/api/reflection-templates",
            json=template_data,
            headers=headers
        )
        assert response.status_code == 200, f"Failed to create template: {response.text}"
        
        data = response.json()
        assert len(data["questions"]) == 4
        
        question_types = [q["question_type"] for q in data["questions"]]
        assert "text" in question_types
        assert "scale" in question_types
        assert "dropdown" in question_types
        assert "checkbox" in question_types
        
        print(f"Created mixed questions template: {data['template_id']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/reflection-templates/{data['template_id']}", headers=headers)
    
    # ==================================================
    # DEFAULT TEMPLATE TESTS
    # ==================================================
    
    def test_set_and_unset_default(self, headers):
        """Test setting and unsetting a template as default"""
        # Create a template
        template_data = {
            "name": "TEST_Default Template Test",
            "target_role": "coach_educator",
            "description": "Testing default functionality",
            "questions": [
                {
                    "question_id": f"q_{int(time.time())}",
                    "question_text": "Test question",
                    "question_type": "text",
                    "required": False
                }
            ],
            "is_default": False
        }
        
        create_resp = requests.post(
            f"{BASE_URL}/api/reflection-templates",
            json=template_data,
            headers=headers
        )
        assert create_resp.status_code == 200
        template_id = create_resp.json()["template_id"]
        
        try:
            # Set as default
            set_resp = requests.post(
                f"{BASE_URL}/api/reflection-templates/{template_id}/set-default",
                headers=headers
            )
            assert set_resp.status_code == 200, f"Failed to set default: {set_resp.text}"
            assert set_resp.json()["is_default"] == True
            
            # Verify it's default
            get_resp = requests.get(
                f"{BASE_URL}/api/reflection-templates/{template_id}",
                headers=headers
            )
            assert get_resp.status_code == 200
            assert get_resp.json()["is_default"] == True
            print(f"Template {template_id} set as default successfully")
            
            # Unset default
            unset_resp = requests.post(
                f"{BASE_URL}/api/reflection-templates/{template_id}/unset-default",
                headers=headers
            )
            assert unset_resp.status_code == 200, f"Failed to unset default: {unset_resp.text}"
            assert unset_resp.json()["is_default"] == False
            
            # Verify it's not default anymore
            get_resp2 = requests.get(
                f"{BASE_URL}/api/reflection-templates/{template_id}",
                headers=headers
            )
            assert get_resp2.status_code == 200
            assert get_resp2.json()["is_default"] == False
            print(f"Template {template_id} unset as default successfully")
            
        finally:
            # Cleanup
            requests.delete(f"{BASE_URL}/api/reflection-templates/{template_id}", headers=headers)
    
    def test_only_one_default_per_role(self, headers):
        """Test that only one template can be default per target_role"""
        # Create first template and set as default
        template1_data = {
            "name": "TEST_First Default",
            "target_role": "coach",
            "description": "First template",
            "questions": [
                {
                    "question_id": f"q_1_{int(time.time())}",
                    "question_text": "Question 1",
                    "question_type": "text",
                    "required": False
                }
            ],
            "is_default": True  # Set as default on creation
        }
        
        create1_resp = requests.post(
            f"{BASE_URL}/api/reflection-templates",
            json=template1_data,
            headers=headers
        )
        assert create1_resp.status_code == 200
        template1_id = create1_resp.json()["template_id"]
        
        try:
            # Create second template and set as default
            template2_data = {
                "name": "TEST_Second Default",
                "target_role": "coach",  # Same target_role
                "description": "Second template",
                "questions": [
                    {
                        "question_id": f"q_2_{int(time.time())}",
                        "question_text": "Question 2",
                        "question_type": "text",
                        "required": False
                    }
                ],
                "is_default": True  # Also set as default
            }
            
            create2_resp = requests.post(
                f"{BASE_URL}/api/reflection-templates",
                json=template2_data,
                headers=headers
            )
            assert create2_resp.status_code == 200
            template2_id = create2_resp.json()["template_id"]
            
            try:
                # Verify second is default
                get2_resp = requests.get(
                    f"{BASE_URL}/api/reflection-templates/{template2_id}",
                    headers=headers
                )
                assert get2_resp.json()["is_default"] == True
                
                # Verify first is no longer default
                get1_resp = requests.get(
                    f"{BASE_URL}/api/reflection-templates/{template1_id}",
                    headers=headers
                )
                assert get1_resp.json()["is_default"] == False, "First template should no longer be default"
                
                print("Only one default per role verified successfully")
                
            finally:
                requests.delete(f"{BASE_URL}/api/reflection-templates/{template2_id}", headers=headers)
        finally:
            requests.delete(f"{BASE_URL}/api/reflection-templates/{template1_id}", headers=headers)
    
    # ==================================================
    # UPDATE TEMPLATE TESTS
    # ==================================================
    
    def test_update_template(self, headers):
        """Test updating an existing template"""
        # Create a template
        template_data = {
            "name": "TEST_Template to Update",
            "target_role": "coach_educator",
            "description": "Original description",
            "questions": [
                {
                    "question_id": f"q_{int(time.time())}",
                    "question_text": "Original question",
                    "question_type": "text",
                    "required": False
                }
            ],
            "is_default": False
        }
        
        create_resp = requests.post(
            f"{BASE_URL}/api/reflection-templates",
            json=template_data,
            headers=headers
        )
        assert create_resp.status_code == 200
        template_id = create_resp.json()["template_id"]
        
        try:
            # Update the template
            update_data = {
                "name": "TEST_Updated Template Name",
                "description": "Updated description",
                "questions": [
                    {
                        "question_id": f"q_updated_{int(time.time())}",
                        "question_text": "Updated question text",
                        "question_type": "scale",
                        "required": True,
                        "scale_min": 1,
                        "scale_max": 5,
                        "scale_min_label": "Low",
                        "scale_max_label": "High"
                    }
                ]
            }
            
            update_resp = requests.put(
                f"{BASE_URL}/api/reflection-templates/{template_id}",
                json=update_data,
                headers=headers
            )
            assert update_resp.status_code == 200, f"Failed to update: {update_resp.text}"
            
            data = update_resp.json()
            assert data["name"] == "TEST_Updated Template Name"
            assert data["description"] == "Updated description"
            assert len(data["questions"]) == 1
            assert data["questions"][0]["question_type"] == "scale"
            
            print(f"Template {template_id} updated successfully")
            
        finally:
            requests.delete(f"{BASE_URL}/api/reflection-templates/{template_id}", headers=headers)
    
    # ==================================================
    # DELETE TEMPLATE TESTS
    # ==================================================
    
    def test_delete_template(self, headers):
        """Test deleting a template"""
        # Create a template
        template_data = {
            "name": "TEST_Template to Delete",
            "target_role": "coach",
            "description": "Will be deleted",
            "questions": [
                {
                    "question_id": f"q_{int(time.time())}",
                    "question_text": "Question",
                    "question_type": "text",
                    "required": False
                }
            ],
            "is_default": False
        }
        
        create_resp = requests.post(
            f"{BASE_URL}/api/reflection-templates",
            json=template_data,
            headers=headers
        )
        assert create_resp.status_code == 200
        template_id = create_resp.json()["template_id"]
        
        # Delete the template
        delete_resp = requests.delete(
            f"{BASE_URL}/api/reflection-templates/{template_id}",
            headers=headers
        )
        assert delete_resp.status_code == 200, f"Failed to delete: {delete_resp.text}"
        assert delete_resp.json()["status"] == "deleted"
        
        # Verify it's deleted
        get_resp = requests.get(
            f"{BASE_URL}/api/reflection-templates/{template_id}",
            headers=headers
        )
        assert get_resp.status_code == 404, "Template should not exist after deletion"
        
        print(f"Template {template_id} deleted successfully")
    
    # ==================================================
    # UNAUTHORIZED ACCESS TESTS
    # ==================================================
    
    def test_unauthorized_access(self):
        """Test that unauthenticated requests are rejected"""
        response = requests.get(
            f"{BASE_URL}/api/reflection-templates",
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("Unauthorized access correctly rejected")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
