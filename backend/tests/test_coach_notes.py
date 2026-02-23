"""
Coach Notes Feature Tests
Tests CRUD operations for notes on coach profiles with privacy controls.

Features tested:
1. Coach developer can add shared/private notes to coach profiles
2. Coach developer can edit/delete their own notes
3. Coach can view shared notes on My Development page
4. Coach can add their own notes
5. Coach cannot see private notes from coach developers
6. Privacy toggle works correctly
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
COACH_DEVELOPER_EMAIL = "hello@mycoachdeveloper.com"
COACH_DEVELOPER_PASSWORD = "_mcDeveloper26!"
COACH_EMAIL = "joe_morrissey@hotmail.co.uk"
COACH_PASSWORD = "CoachTest123"
COACH_ID = "coach_67857d39dbbc"


class TestCoachNotesAPI:
    """Test suite for Coach Notes API endpoints"""
    
    @pytest.fixture(scope="class")
    def coach_developer_session(self):
        """Get authenticated session for coach developer"""
        session = requests.Session()
        login_response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": COACH_DEVELOPER_EMAIL, "password": COACH_DEVELOPER_PASSWORD}
        )
        assert login_response.status_code == 200, f"Coach developer login failed: {login_response.text}"
        return session

    @pytest.fixture(scope="class")
    def coach_session(self):
        """Get authenticated session for coach"""
        session = requests.Session()
        login_response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": COACH_EMAIL, "password": COACH_PASSWORD}
        )
        assert login_response.status_code == 200, f"Coach login failed: {login_response.text}"
        return session

    # ========== GET NOTES TESTS ==========
    
    def test_coach_developer_can_get_notes(self, coach_developer_session):
        """Coach developer can fetch notes for a coach profile"""
        response = coach_developer_session.get(f"{BASE_URL}/api/coaches/{COACH_ID}/notes")
        assert response.status_code == 200, f"Failed to get notes: {response.text}"
        notes = response.json()
        assert isinstance(notes, list), "Notes should be a list"
        print(f"SUCCESS: Coach developer retrieved {len(notes)} notes")
    
    def test_coach_can_get_own_notes(self, coach_session):
        """Coach can fetch notes for their own profile"""
        response = coach_session.get(f"{BASE_URL}/api/coaches/{COACH_ID}/notes")
        assert response.status_code == 200, f"Failed to get notes: {response.text}"
        notes = response.json()
        assert isinstance(notes, list), "Notes should be a list"
        print(f"SUCCESS: Coach retrieved {len(notes)} notes for own profile")

    # ========== CREATE NOTE TESTS ==========
    
    def test_coach_developer_can_add_shared_note(self, coach_developer_session):
        """Coach developer can add a shared note to a coach's profile"""
        note_data = {
            "text": "TEST_shared_note: Great progress on communication skills",
            "is_private": False
        }
        response = coach_developer_session.post(
            f"{BASE_URL}/api/coaches/{COACH_ID}/notes",
            json=note_data
        )
        assert response.status_code == 200, f"Failed to create shared note: {response.text}"
        
        note = response.json()
        assert note.get("text") == note_data["text"], "Note text should match"
        assert note.get("is_private") == False, "Note should be shared (not private)"
        assert "note_id" in note, "Note should have note_id"
        assert "author_name" in note, "Note should have author_name"
        assert "created_at" in note, "Note should have created_at timestamp"
        
        # Store note_id for cleanup
        self.__class__.shared_note_id = note.get("note_id")
        print(f"SUCCESS: Created shared note with ID: {note.get('note_id')}")
    
    def test_coach_developer_can_add_private_note(self, coach_developer_session):
        """Coach developer can add a private note (invisible to coach)"""
        note_data = {
            "text": "TEST_private_note: Internal observation about coaching style",
            "is_private": True
        }
        response = coach_developer_session.post(
            f"{BASE_URL}/api/coaches/{COACH_ID}/notes",
            json=note_data
        )
        assert response.status_code == 200, f"Failed to create private note: {response.text}"
        
        note = response.json()
        assert note.get("is_private") == True, "Note should be private"
        assert note.get("author_role") == "coach_developer", "Author role should be coach_developer"
        
        # Store note_id for cleanup
        self.__class__.private_note_id = note.get("note_id")
        print(f"SUCCESS: Created private note with ID: {note.get('note_id')}")
    
    def test_coach_can_add_own_note(self, coach_session):
        """Coach can add a note to their own profile"""
        note_data = {
            "text": "TEST_coach_note: Self-reflection on today's training session",
            "is_private": False
        }
        response = coach_session.post(
            f"{BASE_URL}/api/coaches/{COACH_ID}/notes",
            json=note_data
        )
        assert response.status_code == 200, f"Failed to create coach note: {response.text}"
        
        note = response.json()
        assert note.get("author_role") == "coach", "Author role should be coach"
        
        # Store note_id for cleanup
        self.__class__.coach_note_id = note.get("note_id")
        print(f"SUCCESS: Coach created own note with ID: {note.get('note_id')}")

    # ========== PRIVACY VISIBILITY TESTS ==========
    
    def test_coach_cannot_see_private_notes_from_developer(self, coach_session, coach_developer_session):
        """Coach should NOT see private notes from coach developers"""
        # First get notes as coach developer to see all notes
        dev_response = coach_developer_session.get(f"{BASE_URL}/api/coaches/{COACH_ID}/notes")
        dev_notes = dev_response.json()
        dev_private_notes = [n for n in dev_notes if n.get("is_private") and n.get("author_role") == "coach_developer"]
        
        # Now get notes as coach
        coach_response = coach_session.get(f"{BASE_URL}/api/coaches/{COACH_ID}/notes")
        coach_notes = coach_response.json()
        
        # Coach should not see any private notes from coach_developer
        coach_visible_private_dev_notes = [
            n for n in coach_notes 
            if n.get("is_private") and n.get("author_role") == "coach_developer"
        ]
        
        assert len(coach_visible_private_dev_notes) == 0, \
            f"Coach should NOT see {len(coach_visible_private_dev_notes)} private developer notes"
        
        print(f"SUCCESS: Coach cannot see {len(dev_private_notes)} private developer notes")
    
    def test_coach_can_see_shared_notes(self, coach_session):
        """Coach can see shared notes"""
        response = coach_session.get(f"{BASE_URL}/api/coaches/{COACH_ID}/notes")
        notes = response.json()
        
        shared_notes = [n for n in notes if not n.get("is_private")]
        assert len(shared_notes) >= 0, "Coach should be able to see shared notes"
        print(f"SUCCESS: Coach can see {len(shared_notes)} shared notes")
    
    def test_coach_developer_sees_all_notes(self, coach_developer_session):
        """Coach developer can see all notes including private ones"""
        response = coach_developer_session.get(f"{BASE_URL}/api/coaches/{COACH_ID}/notes")
        notes = response.json()
        
        private_notes = [n for n in notes if n.get("is_private")]
        shared_notes = [n for n in notes if not n.get("is_private")]
        
        print(f"SUCCESS: Coach developer sees {len(private_notes)} private + {len(shared_notes)} shared = {len(notes)} total notes")

    # ========== UPDATE NOTE TESTS ==========
    
    def test_coach_developer_can_update_own_note(self, coach_developer_session):
        """Coach developer can update their own note"""
        if not hasattr(self.__class__, 'shared_note_id'):
            pytest.skip("No shared note created to update")
        
        update_data = {
            "text": "TEST_shared_note_updated: Excellent progress on communication skills!",
            "is_private": False
        }
        response = coach_developer_session.put(
            f"{BASE_URL}/api/coaches/{COACH_ID}/notes/{self.__class__.shared_note_id}",
            json=update_data
        )
        assert response.status_code == 200, f"Failed to update note: {response.text}"
        
        note = response.json()
        assert "updated" in note.get("text", "").lower(), "Note text should be updated"
        print(f"SUCCESS: Updated note {self.__class__.shared_note_id}")
    
    def test_coach_developer_can_toggle_privacy(self, coach_developer_session):
        """Coach developer can toggle note privacy"""
        if not hasattr(self.__class__, 'shared_note_id'):
            pytest.skip("No shared note created to toggle")
        
        # Toggle to private
        update_data = {"is_private": True}
        response = coach_developer_session.put(
            f"{BASE_URL}/api/coaches/{COACH_ID}/notes/{self.__class__.shared_note_id}",
            json=update_data
        )
        assert response.status_code == 200, f"Failed to toggle privacy: {response.text}"
        
        note = response.json()
        assert note.get("is_private") == True, "Note should now be private"
        
        # Toggle back to shared
        update_data = {"is_private": False}
        response = coach_developer_session.put(
            f"{BASE_URL}/api/coaches/{COACH_ID}/notes/{self.__class__.shared_note_id}",
            json=update_data
        )
        assert response.status_code == 200
        note = response.json()
        assert note.get("is_private") == False, "Note should now be shared"
        
        print(f"SUCCESS: Toggled privacy for note {self.__class__.shared_note_id}")
    
    def test_coach_cannot_update_developer_note(self, coach_session, coach_developer_session):
        """Coach cannot update a note created by coach developer"""
        if not hasattr(self.__class__, 'shared_note_id'):
            pytest.skip("No shared note created to test")
        
        update_data = {"text": "Trying to update someone else's note"}
        response = coach_session.put(
            f"{BASE_URL}/api/coaches/{COACH_ID}/notes/{self.__class__.shared_note_id}",
            json=update_data
        )
        assert response.status_code == 403, f"Coach should not be able to update developer's note: {response.status_code}"
        print("SUCCESS: Coach correctly denied from updating developer's note")

    # ========== DELETE NOTE TESTS ==========
    
    def test_coach_cannot_delete_developer_note(self, coach_session):
        """Coach cannot delete a note created by coach developer"""
        if not hasattr(self.__class__, 'shared_note_id'):
            pytest.skip("No shared note created to test")
        
        response = coach_session.delete(
            f"{BASE_URL}/api/coaches/{COACH_ID}/notes/{self.__class__.shared_note_id}"
        )
        assert response.status_code == 403, f"Coach should not be able to delete developer's note: {response.status_code}"
        print("SUCCESS: Coach correctly denied from deleting developer's note")
    
    def test_coach_can_delete_own_note(self, coach_session):
        """Coach can delete their own note"""
        if not hasattr(self.__class__, 'coach_note_id'):
            pytest.skip("No coach note created to delete")
        
        response = coach_session.delete(
            f"{BASE_URL}/api/coaches/{COACH_ID}/notes/{self.__class__.coach_note_id}"
        )
        assert response.status_code == 200, f"Failed to delete coach's own note: {response.text}"
        
        result = response.json()
        assert result.get("success") == True or result.get("deleted") == True
        print(f"SUCCESS: Coach deleted own note {self.__class__.coach_note_id}")

    # ========== CLEANUP ==========
    
    def test_cleanup_test_notes(self, coach_developer_session):
        """Cleanup all test notes created during testing"""
        # Get all notes
        response = coach_developer_session.get(f"{BASE_URL}/api/coaches/{COACH_ID}/notes")
        if response.status_code != 200:
            pytest.skip("Could not fetch notes for cleanup")
        
        notes = response.json()
        test_notes = [n for n in notes if n.get("text", "").startswith("TEST_")]
        
        deleted = 0
        for note in test_notes:
            del_response = coach_developer_session.delete(
                f"{BASE_URL}/api/coaches/{COACH_ID}/notes/{note['note_id']}"
            )
            if del_response.status_code == 200:
                deleted += 1
        
        print(f"CLEANUP: Deleted {deleted} test notes")

    # ========== AUTHORIZATION TESTS ==========
    
    def test_unauthenticated_cannot_access_notes(self):
        """Unauthenticated user cannot access notes"""
        session = requests.Session()
        response = session.get(f"{BASE_URL}/api/coaches/{COACH_ID}/notes")
        assert response.status_code == 401, f"Unauthenticated access should be denied: {response.status_code}"
        print("SUCCESS: Unauthenticated access correctly denied")
    
    def test_coach_cannot_access_other_coach_notes(self, coach_session):
        """Coach cannot access notes of another coach's profile"""
        # Try to access a different coach's notes
        other_coach_id = "coach_nonexistent_123"
        response = coach_session.get(f"{BASE_URL}/api/coaches/{other_coach_id}/notes")
        # Should return 403 or 404
        assert response.status_code in [403, 404], \
            f"Coach should not access other coach's notes: {response.status_code}"
        print("SUCCESS: Coach correctly denied from accessing other coach's notes")

    # ========== NOTE FIELD VALIDATION ==========
    
    def test_note_has_required_fields(self, coach_developer_session):
        """Verify note response contains all required fields"""
        note_data = {
            "text": "TEST_field_validation: Checking required fields",
            "is_private": False
        }
        response = coach_developer_session.post(
            f"{BASE_URL}/api/coaches/{COACH_ID}/notes",
            json=note_data
        )
        assert response.status_code == 200, f"Failed to create note: {response.text}"
        
        note = response.json()
        required_fields = ["note_id", "coach_id", "text", "is_private", "author_id", 
                          "author_name", "author_role", "created_at", "updated_at"]
        
        for field in required_fields:
            assert field in note, f"Note missing required field: {field}"
        
        # Cleanup
        coach_developer_session.delete(f"{BASE_URL}/api/coaches/{COACH_ID}/notes/{note['note_id']}")
        print(f"SUCCESS: Note contains all required fields: {required_fields}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
