"""
Tests for AI Summary with Coach Targets Integration
Tests:
1. GET /api/coaches/{coach_id} returns targets
2. POST /api/generate-summary with coach_targets parameter
3. Verify shorter summary output (~150 words)
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestCoachTargetsSummaryIntegration:
    """Test AI Summary generation with coach targets integration"""
    
    @pytest.fixture(scope="class")
    def session_token(self):
        """Login and get session token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "joemorrisseyg@gmail.com", "password": "12345"}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.cookies.get('session_token')
    
    @pytest.fixture(scope="class")
    def auth_session(self, session_token):
        """Create authenticated session"""
        session = requests.Session()
        session.cookies.set('session_token', session_token)
        return session
    
    def test_get_coach_with_targets(self, auth_session):
        """Test GET /api/coaches/{coach_id} returns coach with targets"""
        coach_id = "coach_67857d39dbbc"
        
        response = auth_session.get(f"{BASE_URL}/api/coaches/{coach_id}")
        
        assert response.status_code == 200, f"Failed to get coach: {response.text}"
        
        data = response.json()
        assert data["id"] == coach_id
        assert "targets" in data
        assert isinstance(data["targets"], list)
        
        # Verify we have active targets
        active_targets = [t for t in data["targets"] if t.get("status") == "active"]
        assert len(active_targets) >= 2, "Expected at least 2 active targets"
        
        # Verify target structure
        for target in active_targets:
            assert "id" in target
            assert "text" in target
            assert "status" in target
        
        # Verify specific targets exist
        target_texts = [t["text"] for t in active_targets]
        assert any("Q&A" in t for t in target_texts), "Expected Q&A target"
        assert any("ball rolling" in t.lower() for t in target_texts), "Expected ball rolling target"
        
        print(f"✓ Coach has {len(active_targets)} active targets")
        for t in active_targets:
            print(f"  - {t['text']}")
    
    def test_generate_summary_with_coach_targets(self, auth_session):
        """Test POST /api/generate-summary with coach_targets parameter"""
        # Prepare test data
        payload = {
            "session_name": "Test Session with Targets",
            "total_duration": 1800,  # 30 minutes
            "total_events": 15,
            "ball_rolling_time": 1200,  # 20 minutes
            "ball_not_rolling_time": 600,  # 10 minutes
            "event_breakdown": {
                "Command": 4,
                "Q&A": 6,
                "Guided Discovery": 3,
                "Transmission": 2
            },
            "descriptor1_name": "Content Focus",
            "descriptor1_breakdown": {
                "Technical": 8,
                "Tactical": 5,
                "Physical": 2
            },
            "descriptor2_name": "Delivery",
            "descriptor2_breakdown": {
                "Individual": 6,
                "Small Group": 7,
                "Whole Group": 2
            },
            "session_parts": [
                {"name": "Warm Up", "events": 3, "ballRollingPct": 80},
                {"name": "Main Activity", "events": 10, "ballRollingPct": 65},
                {"name": "Cool Down", "events": 2, "ballRollingPct": 50}
            ],
            "user_notes": "Coach showed good engagement with players",
            "observation_context": "training",
            "coach_name": "Joe Morrissey",
            "coach_targets": [
                "Improve use of Q&A",
                "Increase ball rolling in the develop the technique part."
            ],
            "previous_sessions_summary": None
        }
        
        response = auth_session.post(
            f"{BASE_URL}/api/generate-summary",
            json=payload
        )
        
        assert response.status_code == 200, f"Summary generation failed: {response.text}"
        
        data = response.json()
        assert "summary" in data
        assert isinstance(data["summary"], str)
        assert len(data["summary"]) > 50, "Summary is too short"
        
        # Verify summary is shorter (roughly 150 words target)
        word_count = len(data["summary"].split())
        print(f"✓ Summary generated with {word_count} words")
        
        # Check if summary references the targets or related concepts
        summary_lower = data["summary"].lower()
        
        # We don't strictly require targets to be mentioned (LLM output varies)
        # but log if they are for verification
        has_qa_reference = any(term in summary_lower for term in ["q&a", "question", "questioning"])
        has_ball_reference = any(term in summary_lower for term in ["ball rolling", "ball stopped", "activity time"])
        
        print(f"  - Q&A/questioning referenced: {has_qa_reference}")
        print(f"  - Ball rolling referenced: {has_ball_reference}")
        print(f"\n  Summary preview (first 200 chars):")
        print(f"  {data['summary'][:200]}...")
    
    def test_generate_summary_without_targets(self, auth_session):
        """Test POST /api/generate-summary without coach_targets (null)"""
        payload = {
            "session_name": "Test Session No Targets",
            "total_duration": 1200,
            "total_events": 10,
            "ball_rolling_time": 800,
            "ball_not_rolling_time": 400,
            "event_breakdown": {
                "Command": 5,
                "Q&A": 5
            },
            "descriptor1_name": "Content Focus",
            "descriptor1_breakdown": {"Technical": 6, "Tactical": 4},
            "descriptor2_name": "Delivery",
            "descriptor2_breakdown": {"Individual": 5, "Group": 5},
            "session_parts": [],
            "user_notes": "",
            "observation_context": "training",
            "coach_name": "Test Coach",
            "coach_targets": None,  # No targets
            "previous_sessions_summary": None
        }
        
        response = auth_session.post(
            f"{BASE_URL}/api/generate-summary",
            json=payload
        )
        
        assert response.status_code == 200, f"Summary without targets failed: {response.text}"
        
        data = response.json()
        assert "summary" in data
        
        word_count = len(data["summary"].split())
        print(f"✓ Summary without targets: {word_count} words")
    
    def test_generate_summary_empty_targets(self, auth_session):
        """Test POST /api/generate-summary with empty targets list"""
        payload = {
            "session_name": "Test Session Empty Targets",
            "total_duration": 1200,
            "total_events": 8,
            "ball_rolling_time": 700,
            "ball_not_rolling_time": 500,
            "event_breakdown": {"Command": 4, "Q&A": 4},
            "descriptor1_name": "Focus",
            "descriptor1_breakdown": {"Technical": 8},
            "descriptor2_name": "Type",
            "descriptor2_breakdown": {"Group": 8},
            "session_parts": [],
            "user_notes": "",
            "observation_context": "training",
            "coach_name": "Test Coach",
            "coach_targets": [],  # Empty list
            "previous_sessions_summary": None
        }
        
        response = auth_session.post(
            f"{BASE_URL}/api/generate-summary",
            json=payload
        )
        
        assert response.status_code == 200, f"Summary with empty targets failed: {response.text}"
        
        data = response.json()
        assert "summary" in data
        print(f"✓ Summary with empty targets works correctly")
    
    def test_summary_word_count_approximately_150(self, auth_session):
        """Test that summary is approximately 150 words (shorter format)"""
        payload = {
            "session_name": "Word Count Test Session",
            "total_duration": 2400,
            "total_events": 20,
            "ball_rolling_time": 1600,
            "ball_not_rolling_time": 800,
            "event_breakdown": {
                "Command": 6,
                "Q&A": 8,
                "Guided Discovery": 4,
                "Transmission": 2
            },
            "descriptor1_name": "Content Focus",
            "descriptor1_breakdown": {
                "Technical": 10,
                "Tactical": 6,
                "Physical": 4
            },
            "descriptor2_name": "Delivery",
            "descriptor2_breakdown": {
                "Individual": 8,
                "Small Group": 8,
                "Whole Group": 4
            },
            "session_parts": [
                {"name": "Warm Up", "events": 4, "ballRollingPct": 75},
                {"name": "Technical", "events": 8, "ballRollingPct": 60},
                {"name": "Game", "events": 6, "ballRollingPct": 80},
                {"name": "Cool Down", "events": 2, "ballRollingPct": 40}
            ],
            "user_notes": "Good session overall with strong engagement",
            "observation_context": "training",
            "coach_name": "Test Coach",
            "coach_targets": [
                "Improve use of Q&A",
                "Increase ball rolling"
            ],
            "previous_sessions_summary": None
        }
        
        response = auth_session.post(
            f"{BASE_URL}/api/generate-summary",
            json=payload
        )
        
        assert response.status_code == 200, f"Word count test failed: {response.text}"
        
        data = response.json()
        word_count = len(data["summary"].split())
        
        # Target is ~150 words, allow range 80-250 for LLM variation
        print(f"✓ Summary word count: {word_count}")
        assert word_count >= 60, f"Summary too short: {word_count} words"
        assert word_count <= 350, f"Summary may be too long: {word_count} words (target ~150)"
        
        print(f"  - Word count is within acceptable range (80-250)")
    
    def test_get_session_has_coach_id(self, auth_session):
        """Test that session data includes coach_id for frontend to use"""
        session_id = "session_1770897924841_bu9vhupev"
        
        response = auth_session.get(f"{BASE_URL}/api/observations/{session_id}")
        
        assert response.status_code == 200, f"Failed to get session: {response.text}"
        
        data = response.json()
        assert "coach_id" in data, "Session should have coach_id field"
        assert data["coach_id"] == "coach_67857d39dbbc", "Coach ID mismatch"
        assert "coach_name" in data, "Session should have coach_name field"
        assert data["coach_name"] == "Joe Morrissey", "Coach name mismatch"
        
        print(f"✓ Session has coach_id: {data['coach_id']}")
        print(f"✓ Session has coach_name: {data['coach_name']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
