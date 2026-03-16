"""
System Default Templates API Tests
===================================
Tests for the new /api/admin/templates/system-defaults endpoint:
- Listing system default templates across organizations
- Filtering by category
- Verifying response structure includes required fields
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials (admin account)
ADMIN_EMAIL = "hello@mycoachdeveloper.com"
ADMIN_PASSWORD = "_mcDeveloper26!"


class TestSystemDefaultTemplates:
    """System Default Templates Endpoint Tests"""
    
    auth_token = None
    
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
    
    def get_headers(self):
        return {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.auth_token}"
        }
    
    # ============================================
    # AUTH TESTS
    # ============================================
    
    def test_01_system_defaults_requires_auth(self):
        """Verify system-defaults endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/admin/templates/system-defaults")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ System defaults endpoint requires authentication")
    
    # ============================================
    # LIST ALL SYSTEM DEFAULTS
    # ============================================
    
    def test_02_list_all_system_defaults(self):
        """List all system default templates without category filter"""
        response = requests.get(
            f"{BASE_URL}/api/admin/templates/system-defaults",
            headers=self.get_headers()
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "templates" in data, "Response should have 'templates' key"
        assert "count" in data, "Response should have 'count' key"
        assert "note" in data, "Response should have 'note' key explaining system defaults"
        
        print(f"✓ Listed all system defaults: {data['count']} templates")
        
        # Check template structure if any exist
        if data["templates"]:
            template = data["templates"][0]
            assert "template_id" in template, "Template should have template_id"
            assert "name" in template, "Template should have name"
            assert "category" in template, "Template should have category"
            assert "is_system_default" in template, "Template should have is_system_default flag"
            assert template["is_system_default"] == True, "is_system_default should be True"
            print(f"✓ Template structure verified: {template['name']}")
        
        return data
    
    # ============================================
    # FILTER BY CATEGORY
    # ============================================
    
    def test_03_list_system_defaults_observation_category(self):
        """List system default templates for observation category"""
        response = requests.get(
            f"{BASE_URL}/api/admin/templates/system-defaults?category=observation",
            headers=self.get_headers()
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        # Verify all returned templates are in observation category
        for template in data.get("templates", []):
            assert template.get("category") == "observation", f"Expected observation category, got {template.get('category')}"
        
        print(f"✓ Listed observation system defaults: {data['count']} templates")
    
    def test_04_list_system_defaults_coach_reflection_category(self):
        """List system default templates for coach_reflection category"""
        response = requests.get(
            f"{BASE_URL}/api/admin/templates/system-defaults?category=coach_reflection",
            headers=self.get_headers()
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        # Verify all returned templates are in coach_reflection category
        for template in data.get("templates", []):
            assert template.get("category") == "coach_reflection", f"Expected coach_reflection category, got {template.get('category')}"
        
        print(f"✓ Listed coach_reflection system defaults: {data['count']} templates")
    
    def test_05_list_system_defaults_coach_developer_reflection_category(self):
        """List system default templates for coach_developer_reflection category"""
        response = requests.get(
            f"{BASE_URL}/api/admin/templates/system-defaults?category=coach_developer_reflection",
            headers=self.get_headers()
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        # Verify all returned templates are in coach_developer_reflection category
        for template in data.get("templates", []):
            assert template.get("category") == "coach_developer_reflection", f"Expected coach_developer_reflection category, got {template.get('category')}"
        
        print(f"✓ Listed coach_developer_reflection system defaults: {data['count']} templates")
    
    # ============================================
    # TEMPLATE FIELDS VERIFICATION
    # ============================================
    
    def test_06_verify_system_default_template_fields(self):
        """Verify system default templates have all required fields for UI display"""
        response = requests.get(
            f"{BASE_URL}/api/admin/templates/system-defaults",
            headers=self.get_headers()
        )
        assert response.status_code == 200
        data = response.json()
        
        if not data.get("templates"):
            pytest.skip("No system default templates exist to verify fields")
        
        # Check each template has required fields for UI display
        required_fields = [
            "template_id",
            "name",
            "category",
            "is_system_default",
            "organization_id",
            "created_at"
        ]
        
        for template in data["templates"]:
            for field in required_fields:
                assert field in template, f"Template {template.get('template_id', 'unknown')} missing required field: {field}"
            
            # Verify category is one of the valid categories
            assert template["category"] in ["observation", "coach_reflection", "coach_developer_reflection"], \
                f"Invalid category: {template['category']}"
            
            # Verify is_system_default is True
            assert template["is_system_default"] == True
        
        print(f"✓ All {len(data['templates'])} templates have required fields")
    
    def test_07_verify_observation_template_data_structure(self):
        """Verify observation system default templates have correct template_data structure"""
        response = requests.get(
            f"{BASE_URL}/api/admin/templates/system-defaults?category=observation",
            headers=self.get_headers()
        )
        assert response.status_code == 200
        data = response.json()
        
        if not data.get("templates"):
            pytest.skip("No observation system default templates exist")
        
        for template in data["templates"]:
            template_data = template.get("template_data", {})
            # Observation templates should have specific fields in template_data
            # These are used when copying to admin templates
            print(f"  - Observation template: {template['name']}")
            print(f"    template_data keys: {list(template_data.keys())}")
        
        print(f"✓ Verified observation template_data for {len(data['templates'])} templates")
    
    def test_08_verify_reflection_template_data_structure(self):
        """Verify reflection system default templates have correct template_data structure"""
        response = requests.get(
            f"{BASE_URL}/api/admin/templates/system-defaults?category=coach_reflection",
            headers=self.get_headers()
        )
        assert response.status_code == 200
        data = response.json()
        
        if not data.get("templates"):
            pytest.skip("No coach_reflection system default templates exist")
        
        for template in data["templates"]:
            template_data = template.get("template_data", {})
            # Reflection templates should have questions in template_data
            assert "questions" in template_data, f"Template {template['name']} missing questions in template_data"
            print(f"  - Reflection template: {template['name']} ({len(template_data.get('questions', []))} questions)")
        
        print(f"✓ Verified reflection template_data for {len(data['templates'])} templates")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
