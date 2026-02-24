"""
Test Default Observation and Reflection Templates
================================================
Tests for verifying the default templates bootstrapped during account signup:
- Training Template (4 parts: Part 1, Part 2, Part 3, Part 4)
- Match Day Template (2 parts: First Half, Second Half)
- Coach Educator Reflection Template (5 questions)
- Coach Reflection Template (3 questions)
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "hello@mycoachdeveloper.com"
ADMIN_PASSWORD = "_mcDeveloper26!"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for admin user"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    )
    
    if response.status_code != 200:
        pytest.skip(f"Could not authenticate: {response.status_code} - {response.text}")
    
    data = response.json()
    return data.get("token")


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Get headers with auth token"""
    return {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    }


class TestObservationTemplates:
    """Test observation window templates endpoints"""
    
    def test_list_observation_templates_returns_two(self, auth_headers):
        """GET /api/observation-templates should return exactly 2 templates"""
        response = requests.get(
            f"{BASE_URL}/api/observation-templates",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        templates = response.json()
        assert isinstance(templates, list), "Response should be a list"
        assert len(templates) == 2, f"Expected 2 observation templates, got {len(templates)}"
        
        # Get template names
        template_names = [t.get("name") for t in templates]
        assert "Training Template" in template_names, f"Training Template not found in {template_names}"
        assert "Match Day Template" in template_names, f"Match Day Template not found in {template_names}"
    
    def test_training_template_has_four_parts(self, auth_headers):
        """Training Template should have exactly 4 parts: Part 1, Part 2, Part 3, Part 4"""
        response = requests.get(
            f"{BASE_URL}/api/observation-templates",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        templates = response.json()
        
        # Find Training Template
        training_template = next((t for t in templates if t.get("name") == "Training Template"), None)
        assert training_template is not None, "Training Template not found"
        
        # Check parts
        session_parts = training_template.get("session_parts", [])
        assert len(session_parts) == 4, f"Expected 4 parts, got {len(session_parts)}"
        
        part_names = [p.get("name") for p in session_parts]
        expected_parts = ["Part 1", "Part 2", "Part 3", "Part 4"]
        for expected in expected_parts:
            assert expected in part_names, f"Expected '{expected}' in session parts, got {part_names}"
    
    def test_match_day_template_has_two_parts(self, auth_headers):
        """Match Day Template should have exactly 2 parts: First Half, Second Half"""
        response = requests.get(
            f"{BASE_URL}/api/observation-templates",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        templates = response.json()
        
        # Find Match Day Template
        match_day_template = next((t for t in templates if t.get("name") == "Match Day Template"), None)
        assert match_day_template is not None, "Match Day Template not found"
        
        # Check parts
        session_parts = match_day_template.get("session_parts", [])
        assert len(session_parts) == 2, f"Expected 2 parts, got {len(session_parts)}"
        
        part_names = [p.get("name") for p in session_parts]
        expected_parts = ["First Half", "Second Half"]
        for expected in expected_parts:
            assert expected in part_names, f"Expected '{expected}' in session parts, got {part_names}"
    
    def test_default_training_template_endpoint(self, auth_headers):
        """GET /api/observation-templates/default/training should return Training Template"""
        response = requests.get(
            f"{BASE_URL}/api/observation-templates/default/training",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        template = response.json()
        assert template.get("name") == "Training Template", f"Expected 'Training Template', got {template.get('name')}"
        assert template.get("observation_context") == "training", f"Expected context 'training', got {template.get('observation_context')}"
        
        # Verify parts
        session_parts = template.get("session_parts", [])
        assert len(session_parts) == 4, f"Expected 4 parts, got {len(session_parts)}"
    
    def test_default_game_template_endpoint(self, auth_headers):
        """GET /api/observation-templates/default/game should return Match Day Template"""
        response = requests.get(
            f"{BASE_URL}/api/observation-templates/default/game",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        template = response.json()
        assert template.get("name") == "Match Day Template", f"Expected 'Match Day Template', got {template.get('name')}"
        assert template.get("observation_context") == "game", f"Expected context 'game', got {template.get('observation_context')}"
        
        # Verify parts
        session_parts = template.get("session_parts", [])
        assert len(session_parts) == 2, f"Expected 2 parts, got {len(session_parts)}"
    
    def test_observation_templates_have_intervention_types(self, auth_headers):
        """Both observation templates should have intervention_types with Command, Q&A, Guided Discovery, Transmission"""
        response = requests.get(
            f"{BASE_URL}/api/observation-templates",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        templates = response.json()
        
        expected_interventions = ["Command", "Q&A", "Guided Discovery", "Transmission"]
        
        for template in templates:
            intervention_types = template.get("intervention_types", [])
            assert len(intervention_types) >= 4, f"Template {template.get('name')} should have at least 4 intervention types"
            
            intervention_names = [i.get("name") for i in intervention_types]
            for expected in expected_interventions:
                assert expected in intervention_names, f"'{expected}' not found in {template.get('name')}'s intervention types: {intervention_names}"
    
    def test_observation_templates_have_descriptor_groups(self, auth_headers):
        """Both templates should have descriptor_group1 (Content Focus) and descriptor_group2 (Delivery Method)"""
        response = requests.get(
            f"{BASE_URL}/api/observation-templates",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        templates = response.json()
        
        for template in templates:
            template_name = template.get("name")
            
            # Check descriptor_group1
            dg1 = template.get("descriptor_group1")
            assert dg1 is not None, f"{template_name} missing descriptor_group1"
            assert dg1.get("name") == "Content Focus", f"{template_name} descriptor_group1 should be 'Content Focus', got {dg1.get('name')}"
            
            dg1_descriptors = dg1.get("descriptors", [])
            dg1_names = [d.get("name") for d in dg1_descriptors]
            expected_dg1 = ["Technical", "Tactical", "Physical", "Psych", "Social"]
            for expected in expected_dg1:
                assert expected in dg1_names, f"'{expected}' not found in {template_name}'s descriptor_group1: {dg1_names}"
            
            # Check descriptor_group2
            dg2 = template.get("descriptor_group2")
            assert dg2 is not None, f"{template_name} missing descriptor_group2"
            assert dg2.get("name") == "Delivery Method", f"{template_name} descriptor_group2 should be 'Delivery Method', got {dg2.get('name')}"
            
            dg2_descriptors = dg2.get("descriptors", [])
            dg2_names = [d.get("name") for d in dg2_descriptors]
            expected_dg2 = ["Visual Demo", "Triggers", "Kinesthetic"]
            for expected in expected_dg2:
                assert expected in dg2_names, f"'{expected}' not found in {template_name}'s descriptor_group2: {dg2_names}"


class TestReflectionTemplates:
    """Test reflection templates endpoints"""
    
    def test_list_reflection_templates_returns_two(self, auth_headers):
        """GET /api/reflection-templates should return exactly 2 templates"""
        response = requests.get(
            f"{BASE_URL}/api/reflection-templates",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        templates = response.json()
        assert isinstance(templates, list), "Response should be a list"
        assert len(templates) == 2, f"Expected 2 reflection templates, got {len(templates)}"
        
        # Get template names
        template_names = [t.get("name") for t in templates]
        assert "Coach Educator Reflection" in template_names, f"Coach Educator Reflection not found in {template_names}"
        assert "Coach Reflection" in template_names, f"Coach Reflection not found in {template_names}"
    
    def test_coach_educator_reflection_has_five_questions(self, auth_headers):
        """Coach Educator Reflection template should have 5 questions"""
        response = requests.get(
            f"{BASE_URL}/api/reflection-templates",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        templates = response.json()
        
        # Find Coach Educator Reflection template
        coach_educator_template = next(
            (t for t in templates if t.get("name") == "Coach Educator Reflection"), 
            None
        )
        assert coach_educator_template is not None, "Coach Educator Reflection template not found"
        
        # Check questions count
        questions = coach_educator_template.get("questions", [])
        assert len(questions) == 5, f"Expected 5 questions, got {len(questions)}"
        
        # Check target role
        assert coach_educator_template.get("target_role") == "coach_educator", \
            f"Expected target_role 'coach_educator', got {coach_educator_template.get('target_role')}"
    
    def test_coach_reflection_has_three_questions(self, auth_headers):
        """Coach Reflection template should have 3 questions"""
        response = requests.get(
            f"{BASE_URL}/api/reflection-templates",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        templates = response.json()
        
        # Find Coach Reflection template
        coach_template = next(
            (t for t in templates if t.get("name") == "Coach Reflection"), 
            None
        )
        assert coach_template is not None, "Coach Reflection template not found"
        
        # Check questions count
        questions = coach_template.get("questions", [])
        assert len(questions) == 3, f"Expected 3 questions, got {len(questions)}"
        
        # Check target role
        assert coach_template.get("target_role") == "coach", \
            f"Expected target_role 'coach', got {coach_template.get('target_role')}"
    
    def test_coach_educator_reflection_questions_content(self, auth_headers):
        """Verify Coach Educator Reflection template has expected questions"""
        response = requests.get(
            f"{BASE_URL}/api/reflection-templates",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        templates = response.json()
        
        coach_educator_template = next(
            (t for t in templates if t.get("name") == "Coach Educator Reflection"), 
            None
        )
        assert coach_educator_template is not None
        
        questions = coach_educator_template.get("questions", [])
        
        # First question should be a scale type
        q1 = questions[0] if len(questions) > 0 else {}
        assert q1.get("question_type") == "scale", f"Q1 should be scale type, got {q1.get('question_type')}"
        assert "effective" in q1.get("question_text", "").lower(), "Q1 should ask about effectiveness"
        
        # Other questions should be text type
        for q in questions[1:]:
            assert q.get("question_type") == "text", f"Question should be text type, got {q.get('question_type')}"
    
    def test_coach_reflection_questions_content(self, auth_headers):
        """Verify Coach Reflection template has expected questions"""
        response = requests.get(
            f"{BASE_URL}/api/reflection-templates",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        templates = response.json()
        
        coach_template = next(
            (t for t in templates if t.get("name") == "Coach Reflection"), 
            None
        )
        assert coach_template is not None
        
        questions = coach_template.get("questions", [])
        
        # First question should be a scale type
        q1 = questions[0] if len(questions) > 0 else {}
        assert q1.get("question_type") == "scale", f"Q1 should be scale type, got {q1.get('question_type')}"
        
        # Check for expected question content
        question_texts = [q.get("question_text", "").lower() for q in questions]
        
        # Should have questions about how session went, what went well, and what to change
        has_session_question = any("session" in text and "went" in text for text in question_texts)
        has_well_question = any("well" in text for text in question_texts)
        has_change_question = any("change" in text or "next time" in text for text in question_texts)
        
        assert has_session_question, "Should have question about how session went"
        assert has_well_question, "Should have question about what went well"
        assert has_change_question, "Should have question about what to change next time"


class TestTemplateDefaults:
    """Test that templates are marked as default"""
    
    def test_observation_templates_are_default(self, auth_headers):
        """Both observation templates should be marked as default"""
        response = requests.get(
            f"{BASE_URL}/api/observation-templates",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        templates = response.json()
        
        for template in templates:
            assert template.get("is_default") == True, \
                f"Template '{template.get('name')}' should be marked as default"
    
    def test_reflection_templates_are_default(self, auth_headers):
        """Both reflection templates should be marked as default"""
        response = requests.get(
            f"{BASE_URL}/api/reflection-templates",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        templates = response.json()
        
        for template in templates:
            assert template.get("is_default") == True, \
                f"Template '{template.get('name')}' should be marked as default"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
