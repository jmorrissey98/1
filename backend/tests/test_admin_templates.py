"""
Admin Template Management API Tests
====================================
Tests for admin template CRUD operations:
- Create templates (observation, coach_reflection, coach_developer_reflection)
- Read templates by category
- Update templates
- Delete templates
- Toggle global status
- Tags management
- Stats endpoint
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials (admin account)
ADMIN_EMAIL = "hello@mycoachdeveloper.com"
ADMIN_PASSWORD = "_mcDeveloper26!"


class TestAdminTemplates:
    """Admin Template Management Tests"""
    
    auth_token = None
    created_template_ids = []  # For cleanup
    
    @classmethod
    def setup_class(cls):
        """Login as admin before tests"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        if response.status_code == 200:
            data = response.json()
            cls.auth_token = data.get("token")
            print(f"✓ Admin login successful, role: {data.get('user', {}).get('role')}")
        else:
            print(f"✗ Admin login failed: {response.status_code} - {response.text}")
            pytest.skip("Cannot authenticate as admin")
    
    @classmethod
    def teardown_class(cls):
        """Cleanup: Delete test templates"""
        if cls.auth_token:
            headers = {"Authorization": f"Bearer {cls.auth_token}"}
            for template_id in cls.created_template_ids:
                try:
                    requests.delete(
                        f"{BASE_URL}/api/admin/templates/{template_id}",
                        headers=headers
                    )
                except:
                    pass
    
    def get_headers(self):
        return {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.auth_token}"
        }
    
    # ============================================
    # AUTH TESTS
    # ============================================
    
    def test_01_unauthenticated_access_blocked(self):
        """Verify admin endpoints require authentication"""
        response = requests.get(f"{BASE_URL}/api/admin/templates")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Unauthenticated access blocked (401)")
    
    # ============================================
    # LIST TEMPLATES TESTS
    # ============================================
    
    def test_02_list_templates_all(self):
        """List all admin templates"""
        response = requests.get(
            f"{BASE_URL}/api/admin/templates",
            headers=self.get_headers()
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "templates" in data
        assert "count" in data
        print(f"✓ Listed templates: {data['count']} total")
    
    def test_03_list_templates_by_category_observation(self):
        """List templates filtered by observation category"""
        response = requests.get(
            f"{BASE_URL}/api/admin/templates?category=observation",
            headers=self.get_headers()
        )
        assert response.status_code == 200
        data = response.json()
        # Verify all returned templates are in the observation category
        for t in data.get("templates", []):
            assert t.get("category") == "observation", f"Wrong category: {t.get('category')}"
        print(f"✓ Listed observation templates: {data['count']}")
    
    def test_04_list_templates_by_category_coach_reflection(self):
        """List templates filtered by coach_reflection category"""
        response = requests.get(
            f"{BASE_URL}/api/admin/templates?category=coach_reflection",
            headers=self.get_headers()
        )
        assert response.status_code == 200
        data = response.json()
        for t in data.get("templates", []):
            assert t.get("category") == "coach_reflection"
        print(f"✓ Listed coach_reflection templates: {data['count']}")
    
    def test_05_list_templates_by_category_coach_developer_reflection(self):
        """List templates filtered by coach_developer_reflection category"""
        response = requests.get(
            f"{BASE_URL}/api/admin/templates?category=coach_developer_reflection",
            headers=self.get_headers()
        )
        assert response.status_code == 200
        data = response.json()
        for t in data.get("templates", []):
            assert t.get("category") == "coach_developer_reflection"
        print(f"✓ Listed coach_developer_reflection templates: {data['count']}")
    
    # ============================================
    # CREATE TEMPLATE TESTS
    # ============================================
    
    def test_06_create_observation_template(self):
        """Create a new observation template"""
        unique_name = f"TEST_Observation_Template_{uuid.uuid4().hex[:8]}"
        payload = {
            "category": "observation",
            "name": unique_name,
            "description": "Test observation template",
            "qualification_tags": ["TEST"],
            "is_global": False,
            "template_data": {
                "interventionTypes": [
                    {"id": "command", "name": "Command", "color": "yellow"},
                    {"id": "qa", "name": "Q&A", "color": "yellow"}
                ],
                "descriptorGroup1": {
                    "name": "Content Focus",
                    "descriptors": [{"id": "tech", "name": "Technical"}]
                },
                "descriptorGroup2": {
                    "name": "Delivery",
                    "descriptors": [{"id": "demo", "name": "Demo"}]
                },
                "sessionParts": [
                    {"id": "part1", "name": "Part 1", "order": 0}
                ]
            }
        }
        
        response = requests.post(
            f"{BASE_URL}/api/admin/templates",
            headers=self.get_headers(),
            json=payload
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "template_id" in data
        assert data["name"] == unique_name
        assert data["category"] == "observation"
        assert data["is_admin_template"] == True
        assert data["template_data"]["interventionTypes"] is not None
        
        # Save for cleanup
        self.created_template_ids.append(data["template_id"])
        print(f"✓ Created observation template: {data['template_id']}")
        
        # Verify it can be retrieved
        get_response = requests.get(
            f"{BASE_URL}/api/admin/templates/{data['template_id']}",
            headers=self.get_headers()
        )
        assert get_response.status_code == 200
        fetched = get_response.json()
        assert fetched["name"] == unique_name
        print(f"✓ Verified template retrieval")
    
    def test_07_create_coach_reflection_template(self):
        """Create a new coach reflection template with questions"""
        unique_name = f"TEST_Coach_Reflection_{uuid.uuid4().hex[:8]}"
        payload = {
            "category": "coach_reflection",
            "name": unique_name,
            "description": "Test coach reflection template",
            "qualification_tags": [],
            "is_global": False,
            "template_data": {
                "target_role": "coach_reflection",
                "questions": [
                    {
                        "question_id": "q1",
                        "question_text": "How did the session go?",
                        "question_type": "text",
                        "required": True
                    },
                    {
                        "question_id": "q2",
                        "question_text": "Rate your performance",
                        "question_type": "scale",
                        "required": False,
                        "min_value": 1,
                        "max_value": 10
                    },
                    {
                        "question_id": "q3",
                        "question_text": "Focus area",
                        "question_type": "dropdown",
                        "required": False,
                        "options": ["Tactical", "Technical", "Physical"]
                    },
                    {
                        "question_id": "q4",
                        "question_text": "Topics covered",
                        "question_type": "checkbox",
                        "required": False,
                        "options": ["Passing", "Shooting", "Defense"]
                    }
                ]
            }
        }
        
        response = requests.post(
            f"{BASE_URL}/api/admin/templates",
            headers=self.get_headers(),
            json=payload
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert data["category"] == "coach_reflection"
        assert len(data["template_data"]["questions"]) == 4
        
        self.created_template_ids.append(data["template_id"])
        print(f"✓ Created coach reflection template with 4 question types")
    
    def test_08_create_coach_developer_reflection_template(self):
        """Create a new coach developer reflection template"""
        unique_name = f"TEST_CD_Reflection_{uuid.uuid4().hex[:8]}"
        payload = {
            "category": "coach_developer_reflection",
            "name": unique_name,
            "description": "Test coach developer reflection template",
            "qualification_tags": ["UEFA B"],
            "is_global": True,
            "template_data": {
                "target_role": "coach_developer_reflection",
                "questions": [
                    {
                        "question_id": "q1",
                        "question_text": "What coaching behaviors did you observe?",
                        "question_type": "text",
                        "required": True
                    }
                ]
            }
        }
        
        response = requests.post(
            f"{BASE_URL}/api/admin/templates",
            headers=self.get_headers(),
            json=payload
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["category"] == "coach_developer_reflection"
        assert data["is_global"] == True
        assert "UEFA B" in data["qualification_tags"]
        
        self.created_template_ids.append(data["template_id"])
        print(f"✓ Created coach_developer_reflection template as global")
    
    def test_09_create_template_invalid_category(self):
        """Verify invalid category is rejected"""
        payload = {
            "category": "invalid_category",
            "name": "Invalid Test",
            "template_data": {}
        }
        
        response = requests.post(
            f"{BASE_URL}/api/admin/templates",
            headers=self.get_headers(),
            json=payload
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("✓ Invalid category rejected with 400")
    
    # ============================================
    # UPDATE TEMPLATE TESTS
    # ============================================
    
    def test_10_update_template(self):
        """Update an existing template"""
        # First create a template
        create_payload = {
            "category": "observation",
            "name": f"TEST_Update_{uuid.uuid4().hex[:8]}",
            "description": "Original description",
            "template_data": {"sessionParts": []}
        }
        
        create_resp = requests.post(
            f"{BASE_URL}/api/admin/templates",
            headers=self.get_headers(),
            json=create_payload
        )
        assert create_resp.status_code == 200
        template_id = create_resp.json()["template_id"]
        self.created_template_ids.append(template_id)
        
        # Update it
        update_payload = {
            "name": f"TEST_Updated_{uuid.uuid4().hex[:8]}",
            "description": "Updated description",
            "qualification_tags": ["UPDATED_TAG"],
            "is_global": True
        }
        
        update_resp = requests.put(
            f"{BASE_URL}/api/admin/templates/{template_id}",
            headers=self.get_headers(),
            json=update_payload
        )
        
        assert update_resp.status_code == 200
        data = update_resp.json()
        assert data["description"] == "Updated description"
        assert data["is_global"] == True
        assert "UPDATED_TAG" in data["qualification_tags"]
        print(f"✓ Updated template successfully")
        
        # Verify with GET
        get_resp = requests.get(
            f"{BASE_URL}/api/admin/templates/{template_id}",
            headers=self.get_headers()
        )
        assert get_resp.status_code == 200
        assert get_resp.json()["is_global"] == True
        print("✓ Update persisted correctly")
    
    def test_11_update_nonexistent_template(self):
        """Verify updating non-existent template returns 404"""
        response = requests.put(
            f"{BASE_URL}/api/admin/templates/nonexistent_template_id",
            headers=self.get_headers(),
            json={"name": "Updated"}
        )
        assert response.status_code == 404
        print("✓ Non-existent template update returns 404")
    
    # ============================================
    # TOGGLE GLOBAL STATUS TESTS
    # ============================================
    
    def test_12_set_global_status(self):
        """Test setting template as global"""
        # Create a template
        create_payload = {
            "category": "observation",
            "name": f"TEST_Global_{uuid.uuid4().hex[:8]}",
            "is_global": False,
            "template_data": {}
        }
        
        create_resp = requests.post(
            f"{BASE_URL}/api/admin/templates",
            headers=self.get_headers(),
            json=create_payload
        )
        template_id = create_resp.json()["template_id"]
        self.created_template_ids.append(template_id)
        
        # Set as global
        set_resp = requests.post(
            f"{BASE_URL}/api/admin/templates/{template_id}/set-global",
            headers=self.get_headers()
        )
        assert set_resp.status_code == 200
        assert set_resp.json()["is_global"] == True
        print("✓ Set template as global")
        
        # Unset global
        unset_resp = requests.post(
            f"{BASE_URL}/api/admin/templates/{template_id}/unset-global",
            headers=self.get_headers()
        )
        assert unset_resp.status_code == 200
        assert unset_resp.json()["is_global"] == False
        print("✓ Unset template from global")
    
    # ============================================
    # DELETE TEMPLATE TESTS
    # ============================================
    
    def test_13_delete_template(self):
        """Test deleting a template"""
        # Create a template
        create_payload = {
            "category": "observation",
            "name": f"TEST_Delete_{uuid.uuid4().hex[:8]}",
            "template_data": {}
        }
        
        create_resp = requests.post(
            f"{BASE_URL}/api/admin/templates",
            headers=self.get_headers(),
            json=create_payload
        )
        template_id = create_resp.json()["template_id"]
        
        # Delete it
        delete_resp = requests.delete(
            f"{BASE_URL}/api/admin/templates/{template_id}",
            headers=self.get_headers()
        )
        assert delete_resp.status_code == 200
        assert delete_resp.json()["deleted_template_id"] == template_id
        print("✓ Deleted template")
        
        # Verify it's gone
        get_resp = requests.get(
            f"{BASE_URL}/api/admin/templates/{template_id}",
            headers=self.get_headers()
        )
        assert get_resp.status_code == 404
        print("✓ Template no longer exists")
    
    def test_14_delete_nonexistent_template(self):
        """Verify deleting non-existent template returns 404"""
        response = requests.delete(
            f"{BASE_URL}/api/admin/templates/nonexistent_id",
            headers=self.get_headers()
        )
        assert response.status_code == 404
        print("✓ Delete non-existent returns 404")
    
    # ============================================
    # TAGS ENDPOINT TESTS
    # ============================================
    
    def test_15_list_tags(self):
        """Test listing unique qualification tags"""
        response = requests.get(
            f"{BASE_URL}/api/admin/templates/tags",
            headers=self.get_headers()
        )
        assert response.status_code == 200
        data = response.json()
        assert "tags" in data
        assert isinstance(data["tags"], list)
        print(f"✓ Listed tags: {data['tags']}")
    
    # ============================================
    # STATS ENDPOINT TESTS
    # ============================================
    
    def test_16_get_stats(self):
        """Test getting template statistics"""
        response = requests.get(
            f"{BASE_URL}/api/admin/templates/stats/summary",
            headers=self.get_headers()
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "total_templates" in data
        assert "total_global" in data
        assert "total_user_overrides" in data
        assert "by_category" in data
        
        print(f"✓ Stats: {data['total_templates']} templates, {data['total_global']} global")
    
    # ============================================
    # ASSIGNABLE USERS/ORGS TESTS
    # ============================================
    
    def test_17_list_assignable_users(self):
        """Test listing users that can be assigned templates"""
        response = requests.get(
            f"{BASE_URL}/api/admin/templates/assignable/users",
            headers=self.get_headers()
        )
        assert response.status_code == 200
        data = response.json()
        assert "users" in data
        print(f"✓ Listed assignable users: {len(data['users'])}")
    
    def test_18_list_assignable_organizations(self):
        """Test listing organizations that can be assigned templates"""
        response = requests.get(
            f"{BASE_URL}/api/admin/templates/assignable/organizations",
            headers=self.get_headers()
        )
        assert response.status_code == 200
        data = response.json()
        assert "organizations" in data
        print(f"✓ Listed assignable organizations: {len(data['organizations'])}")
    
    def test_19_search_assignable_users(self):
        """Test searching assignable users"""
        response = requests.get(
            f"{BASE_URL}/api/admin/templates/assignable/users?search=test",
            headers=self.get_headers()
        )
        assert response.status_code == 200
        print("✓ User search works")
    
    # ============================================
    # ASSIGN TEMPLATE TESTS
    # ============================================
    
    def test_20_assign_template(self):
        """Test assigning template to users/orgs"""
        # Create a template
        create_payload = {
            "category": "observation",
            "name": f"TEST_Assign_{uuid.uuid4().hex[:8]}",
            "template_data": {}
        }
        
        create_resp = requests.post(
            f"{BASE_URL}/api/admin/templates",
            headers=self.get_headers(),
            json=create_payload
        )
        template_id = create_resp.json()["template_id"]
        self.created_template_ids.append(template_id)
        
        # Get an existing user to assign
        users_resp = requests.get(
            f"{BASE_URL}/api/admin/templates/assignable/users",
            headers=self.get_headers()
        )
        users = users_resp.json().get("users", [])
        
        if users:
            user_id = users[0].get("user_id")
            
            # Assign to user
            assign_resp = requests.post(
                f"{BASE_URL}/api/admin/templates/{template_id}/assign",
                headers=self.get_headers(),
                json={"user_ids": [user_id], "org_ids": []}
            )
            
            assert assign_resp.status_code == 200
            data = assign_resp.json()
            assert user_id in data.get("assigned_user_ids", [])
            print(f"✓ Assigned template to user")
            
            # Unassign
            unassign_resp = requests.post(
                f"{BASE_URL}/api/admin/templates/{template_id}/unassign",
                headers=self.get_headers(),
                json={"user_ids": [user_id], "org_ids": []}
            )
            assert unassign_resp.status_code == 200
            print("✓ Unassigned template from user")
        else:
            print("⚠ No users available to test assignment")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
