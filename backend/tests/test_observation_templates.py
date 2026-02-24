"""
Observation Templates API Tests
Tests CRUD operations for observation templates with session parts
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestObservationTemplates:
    """Tests for observation templates API endpoints"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token for tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "hello@mycoachdeveloper.com",
            "password": "_mcDeveloper26!"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        return data.get("token")
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Get authorization headers"""
        return {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }
    
    def test_list_observation_templates(self, auth_headers):
        """Test GET /api/observation-templates returns templates"""
        response = requests.get(f"{BASE_URL}/api/observation-templates", headers=auth_headers)
        assert response.status_code == 200
        
        templates = response.json()
        assert isinstance(templates, list)
        assert len(templates) >= 2, "Expected at least 2 default templates (Training, Match Day)"
        
        # Verify template structure
        for template in templates:
            assert "template_id" in template
            assert "name" in template
            assert "session_parts" in template
            assert isinstance(template["session_parts"], list)
    
    def test_training_template_has_4_parts(self, auth_headers):
        """Test Training Template has Part 1, Part 2, Part 3, Part 4"""
        response = requests.get(f"{BASE_URL}/api/observation-templates", headers=auth_headers)
        assert response.status_code == 200
        
        templates = response.json()
        training = next((t for t in templates if "Training" in t.get("name", "")), None)
        assert training is not None, "Training Template not found"
        
        parts = training.get("session_parts", [])
        assert len(parts) == 4, f"Expected 4 parts, got {len(parts)}"
        part_names = [p.get("name") for p in parts]
        assert "Part 1" in part_names, f"Part 1 not found in {part_names}"
        assert "Part 2" in part_names, f"Part 2 not found in {part_names}"
        assert "Part 3" in part_names, f"Part 3 not found in {part_names}"
        assert "Part 4" in part_names, f"Part 4 not found in {part_names}"
    
    def test_match_day_template_has_2_parts(self, auth_headers):
        """Test Match Day Template has First Half, Second Half"""
        response = requests.get(f"{BASE_URL}/api/observation-templates", headers=auth_headers)
        assert response.status_code == 200
        
        templates = response.json()
        match_day = next((t for t in templates if "Match" in t.get("name", "")), None)
        assert match_day is not None, "Match Day Template not found"
        
        parts = match_day.get("session_parts", [])
        assert len(parts) == 2, f"Expected 2 parts, got {len(parts)}"
        part_names = [p.get("name") for p in parts]
        assert "First Half" in part_names, f"First Half not found in {part_names}"
        assert "Second Half" in part_names, f"Second Half not found in {part_names}"
    
    def test_get_template_by_id(self, auth_headers):
        """Test GET /api/observation-templates/{id} returns specific template"""
        # First get list to find a template ID
        list_response = requests.get(f"{BASE_URL}/api/observation-templates", headers=auth_headers)
        templates = list_response.json()
        assert len(templates) > 0
        
        template_id = templates[0]["template_id"]
        response = requests.get(f"{BASE_URL}/api/observation-templates/{template_id}", headers=auth_headers)
        assert response.status_code == 200
        
        template = response.json()
        assert template["template_id"] == template_id
    
    def test_get_default_training_template(self, auth_headers):
        """Test GET /api/observation-templates/default/training"""
        response = requests.get(f"{BASE_URL}/api/observation-templates/default/training", headers=auth_headers)
        assert response.status_code == 200
        
        template = response.json()
        assert template.get("observation_context") == "training"
        assert template.get("is_default") == True
    
    def test_get_default_game_template(self, auth_headers):
        """Test GET /api/observation-templates/default/game"""
        response = requests.get(f"{BASE_URL}/api/observation-templates/default/game", headers=auth_headers)
        assert response.status_code == 200
        
        template = response.json()
        assert template.get("observation_context") == "game"
        assert template.get("is_default") == True
    
    def test_update_session_part_name(self, auth_headers):
        """Test updating a session part name in a template"""
        # Get training template
        list_response = requests.get(f"{BASE_URL}/api/observation-templates", headers=auth_headers)
        templates = list_response.json()
        training = next((t for t in templates if "Training" in t.get("name", "")), None)
        assert training is not None
        
        template_id = training["template_id"]
        original_parts = training["session_parts"]
        
        # Update first part name to "Warm Up"
        updated_parts = [
            {"id": p["id"], "name": "Warm Up" if i == 0 else p["name"], "order": p["order"], "isDefault": p.get("isDefault", True)}
            for i, p in enumerate(original_parts)
        ]
        
        update_response = requests.put(
            f"{BASE_URL}/api/observation-templates/{template_id}",
            headers=auth_headers,
            json={"session_parts": updated_parts}
        )
        assert update_response.status_code == 200
        updated = update_response.json()
        assert updated["session_parts"][0]["name"] == "Warm Up"
        
        # Verify persistence with GET
        get_response = requests.get(f"{BASE_URL}/api/observation-templates/{template_id}", headers=auth_headers)
        assert get_response.status_code == 200
        persisted = get_response.json()
        assert persisted["session_parts"][0]["name"] == "Warm Up", "Update was not persisted"
        
        # Revert back to original
        revert_response = requests.put(
            f"{BASE_URL}/api/observation-templates/{template_id}",
            headers=auth_headers,
            json={"session_parts": original_parts}
        )
        assert revert_response.status_code == 200
    
    def test_create_new_template(self, auth_headers):
        """Test creating a new observation template"""
        new_template = {
            "name": "TEST_Custom Training",
            "description": "Test template for pytest",
            "observation_context": "training",
            "intervention_types": [
                {"id": "test_event", "name": "Test Event", "color": "yellow"}
            ],
            "descriptor_group1": {
                "id": "test_group1",
                "name": "Test Group 1",
                "color": "blue",
                "descriptors": [{"id": "test_desc", "name": "Test"}]
            },
            "descriptor_group2": {
                "id": "test_group2",
                "name": "Test Group 2",
                "color": "green",
                "descriptors": []
            },
            "session_parts": [
                {"id": "custom_part1", "name": "Custom Part 1", "order": 0, "isDefault": False},
                {"id": "custom_part2", "name": "Custom Part 2", "order": 1, "isDefault": False}
            ],
            "is_default": False
        }
        
        response = requests.post(
            f"{BASE_URL}/api/observation-templates",
            headers=auth_headers,
            json=new_template
        )
        assert response.status_code == 201, f"Failed to create template: {response.text}"
        created = response.json()
        assert created["name"] == "TEST_Custom Training"
        assert len(created["session_parts"]) == 2
        
        # Clean up - delete the test template
        template_id = created["template_id"]
        delete_response = requests.delete(
            f"{BASE_URL}/api/observation-templates/{template_id}",
            headers=auth_headers
        )
        assert delete_response.status_code in [200, 204]
    
    def test_delete_non_default_template(self, auth_headers):
        """Test deleting a non-default template"""
        # First create a test template
        new_template = {
            "name": "TEST_ToDelete",
            "description": "Template to be deleted",
            "observation_context": "training",
            "intervention_types": [],
            "session_parts": [{"id": "del_part", "name": "Delete Part", "order": 0}],
            "is_default": False
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/observation-templates",
            headers=auth_headers,
            json=new_template
        )
        assert create_response.status_code == 201
        template_id = create_response.json()["template_id"]
        
        # Delete the template
        delete_response = requests.delete(
            f"{BASE_URL}/api/observation-templates/{template_id}",
            headers=auth_headers
        )
        assert delete_response.status_code in [200, 204]
        
        # Verify it's deleted
        get_response = requests.get(f"{BASE_URL}/api/observation-templates/{template_id}", headers=auth_headers)
        assert get_response.status_code == 404
    
    def test_templates_are_isolated(self, auth_headers):
        """Test that different templates have isolated session parts"""
        response = requests.get(f"{BASE_URL}/api/observation-templates", headers=auth_headers)
        templates = response.json()
        
        training = next((t for t in templates if "Training" in t.get("name", "")), None)
        match_day = next((t for t in templates if "Match" in t.get("name", "")), None)
        
        assert training is not None
        assert match_day is not None
        
        training_parts = [p["name"] for p in training.get("session_parts", [])]
        match_day_parts = [p["name"] for p in match_day.get("session_parts", [])]
        
        # Parts should be different
        assert training_parts != match_day_parts
        assert len(training_parts) == 4
        assert len(match_day_parts) == 2


class TestSessionSetupTemplateIntegration:
    """Tests for template selection in session setup flow"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token for tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "hello@mycoachdeveloper.com",
            "password": "_mcDeveloper26!"
        })
        assert response.status_code == 200
        return response.json().get("token")
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Get authorization headers"""
        return {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }
    
    def test_selecting_training_template_provides_4_parts(self, auth_headers):
        """Verify selecting Training Template provides Part 1-4 session parts"""
        response = requests.get(f"{BASE_URL}/api/observation-templates/default/training", headers=auth_headers)
        assert response.status_code == 200
        
        template = response.json()
        parts = template.get("session_parts", [])
        
        assert len(parts) == 4, f"Expected 4 parts, got {len(parts)}"
        part_names = [p["name"] for p in parts]
        
        # Verify exact part names
        expected = ["Part 1", "Part 2", "Part 3", "Part 4"]
        for expected_name in expected:
            assert expected_name in part_names, f"{expected_name} not in {part_names}"
    
    def test_selecting_match_day_template_provides_2_halves(self, auth_headers):
        """Verify selecting Match Day Template provides First Half, Second Half"""
        response = requests.get(f"{BASE_URL}/api/observation-templates/default/game", headers=auth_headers)
        assert response.status_code == 200
        
        template = response.json()
        parts = template.get("session_parts", [])
        
        assert len(parts) == 2, f"Expected 2 parts, got {len(parts)}"
        part_names = [p["name"] for p in parts]
        
        assert "First Half" in part_names
        assert "Second Half" in part_names
