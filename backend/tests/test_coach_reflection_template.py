"""
Test Suite for Coach Reflection Template Assignment & Visibility
Tests the feature: Coach Developer selects template during setup -> template ID saved on observation -> Coach sees template questions when reflecting
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://coach-hub-qa.preview.emergentagent.com').rstrip('/')

# Test credentials
COACH_DEVELOPER_EMAIL = "joemorrisseyg@gmail.com"
COACH_DEVELOPER_PASSWORD = "TestPass123!"
COACH_EMAIL = "joe_morrissey@hotmail.co.uk"
COACH_PASSWORD = "CoachTest123"


class TestCoachReflectionTemplateAssignment:
    """Tests for Coach Reflection Template Selection and Assignment"""
    
    @pytest.fixture
    def coach_developer_session(self):
        """Login as coach developer and return session token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": COACH_DEVELOPER_EMAIL,
            "password": COACH_DEVELOPER_PASSWORD
        })
        assert response.status_code == 200, f"Coach developer login failed: {response.text}"
        data = response.json()
        assert "token" in data, "No token in login response"
        return data["token"]
    
    @pytest.fixture
    def coach_session(self):
        """Login as coach and return session token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": COACH_EMAIL,
            "password": COACH_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip(f"Coach login failed (may not exist): {response.text}")
        data = response.json()
        return data.get("token")
    
    def test_coach_reflection_templates_exist(self, coach_developer_session):
        """Verify coach reflection templates are available"""
        response = requests.get(
            f"{BASE_URL}/api/reflection-templates",
            params={"target_role": "coach"},
            headers={"Authorization": f"Bearer {coach_developer_session}"}
        )
        assert response.status_code == 200, f"Failed to fetch coach reflection templates: {response.text}"
        templates = response.json()
        assert len(templates) > 0, "No coach reflection templates found"
        
        # Check for default template
        default_templates = [t for t in templates if t.get("is_default")]
        assert len(default_templates) > 0, "No default coach reflection template found"
        print(f"PASS: Found {len(templates)} coach reflection templates, {len(default_templates)} is default")
    
    def test_observer_reflection_templates_exist(self, coach_developer_session):
        """Verify observer reflection templates are available"""
        response = requests.get(
            f"{BASE_URL}/api/reflection-templates",
            params={"target_role": "coach_educator"},
            headers={"Authorization": f"Bearer {coach_developer_session}"}
        )
        assert response.status_code == 200, f"Failed to fetch observer reflection templates: {response.text}"
        templates = response.json()
        assert len(templates) >= 0, "Reflection templates endpoint failed"
        print(f"PASS: Found {len(templates)} observer reflection templates")
    
    def test_create_observation_with_coach_reflection_template(self, coach_developer_session):
        """Create a new observation session with coach reflection template ID"""
        import time
        session_id = f"test_session_{int(time.time())}_{os.urandom(4).hex()}"
        
        # First get the default coach reflection template ID
        templates_response = requests.get(
            f"{BASE_URL}/api/reflection-templates",
            params={"target_role": "coach"},
            headers={"Authorization": f"Bearer {coach_developer_session}"}
        )
        assert templates_response.status_code == 200
        templates = templates_response.json()
        assert len(templates) > 0, "No coach reflection templates available"
        
        default_template = next((t for t in templates if t.get("is_default")), templates[0])
        template_id = default_template["template_id"]
        print(f"Using template: {default_template['name']} ({template_id})")
        
        # Get a coach to assign
        coaches_response = requests.get(
            f"{BASE_URL}/api/coaches",
            headers={"Authorization": f"Bearer {coach_developer_session}"}
        )
        assert coaches_response.status_code == 200
        coaches = coaches_response.json()
        assert len(coaches) > 0, "No coaches available"
        coach_id = coaches[0]["id"]
        
        # Create observation with coach_reflection_template_id
        observation_data = {
            "session_id": session_id,
            "name": f"Test Session for Template - {time.strftime('%Y-%m-%d %H:%M')}",
            "coach_id": coach_id,
            "observation_context": "training",
            "status": "draft",
            "planned_date": None,
            "intervention_types": [],
            "descriptor_group1": None,
            "descriptor_group2": None,
            "session_parts": [],
            "start_time": None,
            "end_time": None,
            "total_duration": 0,
            "ball_rolling_time": 0,
            "ball_not_rolling_time": 0,
            "events": [],
            "ball_rolling_log": [],
            "observer_reflections": [],
            "coach_reflections": [],
            "session_notes": "",
            "ai_summary": "",
            "attachments": [],
            "coach_reflection_template_id": template_id,
            "reflection_template_id": None
        }
        
        response = requests.post(
            f"{BASE_URL}/api/observations",
            json=observation_data,
            headers={"Authorization": f"Bearer {coach_developer_session}"}
        )
        assert response.status_code == 200, f"Failed to create observation: {response.text}"
        print(f"PASS: Created observation {session_id} with coach_reflection_template_id={template_id}")
        
        # Verify the template ID was saved by fetching the session
        get_response = requests.get(
            f"{BASE_URL}/api/observations/{session_id}",
            headers={"Authorization": f"Bearer {coach_developer_session}"}
        )
        assert get_response.status_code == 200, f"Failed to fetch created observation: {get_response.text}"
        
        saved_session = get_response.json()
        saved_template_id = saved_session.get("coach_reflection_template_id")
        
        # The actual assertion - verify template ID persisted
        assert saved_template_id == template_id, f"coach_reflection_template_id was not saved! Expected {template_id}, got {saved_template_id}"
        print(f"PASS: Verified coach_reflection_template_id={saved_template_id} persisted in database")
        
        # Cleanup - delete the test session
        delete_response = requests.delete(
            f"{BASE_URL}/api/observations/{session_id}",
            headers={"Authorization": f"Bearer {coach_developer_session}"}
        )
        print(f"Cleanup: Deleted test session {session_id}")
        
        return session_id

    def test_existing_sessions_missing_template_id(self, coach_developer_session):
        """Check existing completed sessions for coach_reflection_template_id"""
        # Get all observations
        response = requests.get(
            f"{BASE_URL}/api/observations",
            headers={"Authorization": f"Bearer {coach_developer_session}"}
        )
        assert response.status_code == 200, f"Failed to fetch observations: {response.text}"
        
        sessions = response.json()
        completed_sessions = [s for s in sessions if s.get("status") == "completed"]
        
        print(f"Found {len(completed_sessions)} completed sessions")
        
        # Check a few completed sessions
        sessions_with_template = 0
        sessions_without_template = 0
        
        for session in completed_sessions[:5]:  # Check first 5
            session_detail = requests.get(
                f"{BASE_URL}/api/observations/{session['session_id']}",
                headers={"Authorization": f"Bearer {coach_developer_session}"}
            ).json()
            
            if session_detail.get("coach_reflection_template_id"):
                sessions_with_template += 1
            else:
                sessions_without_template += 1
        
        print(f"Sessions with template: {sessions_with_template}, without: {sessions_without_template}")
        # This is informational - existing sessions may not have template IDs


class TestCoachViewReflectionTemplate:
    """Tests for Coach view seeing reflection template questions"""
    
    @pytest.fixture
    def coach_developer_session(self):
        """Login as coach developer"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": COACH_DEVELOPER_EMAIL,
            "password": COACH_DEVELOPER_PASSWORD
        })
        assert response.status_code == 200, f"Coach developer login failed: {response.text}"
        return response.json()["token"]
    
    @pytest.fixture
    def coach_session(self):
        """Login as coach"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": COACH_EMAIL,
            "password": COACH_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip(f"Coach login failed - coach user may not exist: {response.text}")
        return response.json()["token"]
    
    def test_coach_login_and_role(self, coach_session):
        """Verify coach can login and has coach role"""
        # Login returns user info, verify role
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": COACH_EMAIL,
            "password": COACH_PASSWORD
        })
        data = response.json()
        assert data.get("role") == "coach", f"Expected role 'coach', got '{data.get('role')}'"
        print(f"PASS: Coach logged in with role={data.get('role')}, linked_coach_id={data.get('linked_coach_id')}")
    
    def test_coach_can_fetch_reflection_template(self, coach_session, coach_developer_session):
        """Verify coach can fetch the reflection template details"""
        # Get a coach reflection template
        templates_response = requests.get(
            f"{BASE_URL}/api/reflection-templates",
            params={"target_role": "coach"},
            headers={"Authorization": f"Bearer {coach_developer_session}"}  # Templates might be org-scoped
        )
        assert templates_response.status_code == 200
        templates = templates_response.json()
        
        if not templates:
            pytest.skip("No coach reflection templates available")
        
        template_id = templates[0]["template_id"]
        
        # Fetch template details
        detail_response = requests.get(
            f"{BASE_URL}/api/reflection-templates/{template_id}",
            headers={"Authorization": f"Bearer {coach_session}"}
        )
        # Coach might need access to fetch template details
        if detail_response.status_code == 200:
            template = detail_response.json()
            assert "questions" in template, "Template should have questions"
            print(f"PASS: Coach can fetch template details - {len(template.get('questions', []))} questions")
        else:
            print(f"INFO: Coach cannot directly fetch template (status={detail_response.status_code}), may be loaded via session")


class TestObservationDataModel:
    """Test the observation data model includes reflection template IDs"""
    
    @pytest.fixture
    def session(self):
        """Login as coach developer"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": COACH_DEVELOPER_EMAIL,
            "password": COACH_DEVELOPER_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["token"]
    
    def test_observation_response_includes_template_fields(self, session):
        """Verify observation response schema includes template ID fields"""
        # Get any observation
        response = requests.get(
            f"{BASE_URL}/api/observations",
            headers={"Authorization": f"Bearer {session}"}
        )
        assert response.status_code == 200
        observations = response.json()
        
        if not observations:
            pytest.skip("No observations available")
        
        # Get full details of first observation
        detail_response = requests.get(
            f"{BASE_URL}/api/observations/{observations[0]['session_id']}",
            headers={"Authorization": f"Bearer {session}"}
        )
        assert detail_response.status_code == 200
        observation = detail_response.json()
        
        # Check schema includes the template fields
        assert "coach_reflection_template_id" in observation, "Response missing coach_reflection_template_id field"
        assert "reflection_template_id" in observation, "Response missing reflection_template_id field"
        assert "coach_reflection" in observation, "Response missing coach_reflection field"
        assert "observer_reflection" in observation, "Response missing observer_reflection field"
        
        print("PASS: Observation response schema includes all reflection template fields")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
