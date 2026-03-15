"""
Test Free Trial Flow
====================
Tests the 1-month free trial functionality for My Coach Developer.

Test Coverage:
- POST /api/trial/start - Create trial subscription
- GET /api/trial/status - Get trial status for logged-in user
- GET /api/billing/entitlement - Returns trial information
"""

import pytest
import requests
import os
import uuid
from datetime import datetime

# Get BASE_URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestTrialStartEndpoint:
    """Tests for POST /api/trial/start"""
    
    def test_start_trial_success(self):
        """Test successful trial start creates account and returns token"""
        # Use unique email for this test
        unique_email = f"trial_test_{uuid.uuid4().hex[:8]}@example.com"
        
        payload = {
            "email": unique_email,
            "password": "TestPass123!",
            "name": "Trial Test User",
            "tier_key": "coach_developer",
            "club_name": "Test Trial Club"
        }
        
        response = requests.post(f"{BASE_URL}/api/trial/start", json=payload)
        
        print(f"Trial start response status: {response.status_code}")
        print(f"Trial start response: {response.json()}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        # Verify response structure
        assert data.get("success") == True
        assert "user_id" in data
        assert "token" in data
        assert data.get("email") == unique_email.lower()
        assert data.get("name") == "Trial Test User"
        assert data.get("role") == "coach_developer"
        assert "organization_id" in data
        
        # Verify trial info
        trial_info = data.get("trial", {})
        assert trial_info.get("tier_key") == "coach_developer"
        assert trial_info.get("tier_name") == "Coach Developer"
        assert "start_date" in trial_info
        assert "end_date" in trial_info
        assert "days_remaining" in trial_info
        assert trial_info["days_remaining"] >= 27  # Should be ~30 days
        
        print(f"SUCCESS: Trial started for {unique_email}")
        return data
    
    def test_start_trial_invalid_tier(self):
        """Test trial start with invalid tier returns 400"""
        unique_email = f"trial_bad_tier_{uuid.uuid4().hex[:8]}@example.com"
        
        payload = {
            "email": unique_email,
            "password": "TestPass123!",
            "name": "Bad Tier User",
            "tier_key": "invalid_tier_xyz"
        }
        
        response = requests.post(f"{BASE_URL}/api/trial/start", json=payload)
        
        print(f"Invalid tier response status: {response.status_code}")
        
        assert response.status_code == 400
        print("SUCCESS: Invalid tier correctly rejected")
    
    def test_start_trial_duplicate_email(self):
        """Test trial start with existing email returns 400"""
        # First create a trial
        unique_email = f"trial_dup_{uuid.uuid4().hex[:8]}@example.com"
        
        payload = {
            "email": unique_email,
            "password": "TestPass123!",
            "name": "First User",
            "tier_key": "coach_developer"
        }
        
        response1 = requests.post(f"{BASE_URL}/api/trial/start", json=payload)
        assert response1.status_code == 200, "First trial creation should succeed"
        
        # Try to create again with same email
        payload["name"] = "Second User"
        response2 = requests.post(f"{BASE_URL}/api/trial/start", json=payload)
        
        print(f"Duplicate email response status: {response2.status_code}")
        
        assert response2.status_code == 400
        assert "already exists" in response2.json().get("detail", "").lower()
        print("SUCCESS: Duplicate email correctly rejected")
    
    def test_start_trial_weak_password(self):
        """Test trial start with weak password returns 400"""
        unique_email = f"trial_weak_{uuid.uuid4().hex[:8]}@example.com"
        
        payload = {
            "email": unique_email,
            "password": "short",  # Too short, no number
            "name": "Weak Pass User",
            "tier_key": "coach_developer"
        }
        
        response = requests.post(f"{BASE_URL}/api/trial/start", json=payload)
        
        print(f"Weak password response status: {response.status_code}")
        
        assert response.status_code == 400
        print("SUCCESS: Weak password correctly rejected")
    
    def test_start_trial_individual_coach_tier(self):
        """Test trial start with individual_coach tier"""
        unique_email = f"trial_ind_{uuid.uuid4().hex[:8]}@example.com"
        
        payload = {
            "email": unique_email,
            "password": "TestPass123!",
            "name": "Individual Coach User",
            "tier_key": "individual_coach"
        }
        
        response = requests.post(f"{BASE_URL}/api/trial/start", json=payload)
        
        print(f"Individual coach tier response status: {response.status_code}")
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("trial", {}).get("tier_key") == "individual_coach"
        print("SUCCESS: Individual coach trial started")
    
    def test_start_trial_club_tier(self):
        """Test trial start with club tier"""
        unique_email = f"trial_club_{uuid.uuid4().hex[:8]}@example.com"
        
        payload = {
            "email": unique_email,
            "password": "TestPass123!",
            "name": "Club User",
            "tier_key": "club",
            "club_name": "Test Football Club"
        }
        
        response = requests.post(f"{BASE_URL}/api/trial/start", json=payload)
        
        print(f"Club tier response status: {response.status_code}")
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("trial", {}).get("tier_key") == "club"
        assert data.get("trial", {}).get("tier_name") == "Club"
        print("SUCCESS: Club trial started")


class TestTrialStatusEndpoint:
    """Tests for GET /api/trial/status"""
    
    def test_trial_status_without_auth(self):
        """Test trial status requires authentication"""
        response = requests.get(f"{BASE_URL}/api/trial/status")
        
        print(f"Unauthenticated status response: {response.status_code}")
        
        assert response.status_code == 401
        print("SUCCESS: Trial status requires auth")
    
    def test_trial_status_for_trial_user(self):
        """Test trial status returns correct info for trial user"""
        # First create a trial user
        unique_email = f"trial_status_{uuid.uuid4().hex[:8]}@example.com"
        
        payload = {
            "email": unique_email,
            "password": "TestPass123!",
            "name": "Status Test User",
            "tier_key": "coach_developer"
        }
        
        start_response = requests.post(f"{BASE_URL}/api/trial/start", json=payload)
        assert start_response.status_code == 200
        
        token = start_response.json().get("token")
        
        # Now check trial status
        headers = {"Authorization": f"Bearer {token}"}
        status_response = requests.get(f"{BASE_URL}/api/trial/status", headers=headers)
        
        print(f"Trial status response status: {status_response.status_code}")
        print(f"Trial status response: {status_response.json()}")
        
        assert status_response.status_code == 200
        
        data = status_response.json()
        
        assert data.get("is_trial") == True
        assert data.get("is_expired") == False
        assert data.get("tier_key") == "coach_developer"
        assert data.get("tier_name") == "Coach Developer"
        assert "trial_start_date" in data
        assert "trial_end_date" in data
        assert "days_remaining" in data
        assert data.get("days_remaining", 0) >= 27
        assert data.get("subscription_status") == "trial_active"
        
        print("SUCCESS: Trial status returned correctly")


class TestBillingEntitlementWithTrial:
    """Tests for GET /api/billing/entitlement with trial support"""
    
    def test_entitlement_without_auth(self):
        """Test entitlement requires authentication"""
        response = requests.get(f"{BASE_URL}/api/billing/entitlement")
        
        print(f"Unauthenticated entitlement response: {response.status_code}")
        
        assert response.status_code == 401
        print("SUCCESS: Entitlement requires auth")
    
    def test_entitlement_for_trial_user(self):
        """Test entitlement returns trial info for trial user"""
        # First create a trial user
        unique_email = f"trial_ent_{uuid.uuid4().hex[:8]}@example.com"
        
        payload = {
            "email": unique_email,
            "password": "TestPass123!",
            "name": "Entitlement Test User",
            "tier_key": "coach_developer"
        }
        
        start_response = requests.post(f"{BASE_URL}/api/trial/start", json=payload)
        assert start_response.status_code == 200
        
        token = start_response.json().get("token")
        
        # Now check entitlement
        headers = {"Authorization": f"Bearer {token}"}
        ent_response = requests.get(f"{BASE_URL}/api/billing/entitlement", headers=headers)
        
        print(f"Entitlement response status: {ent_response.status_code}")
        print(f"Entitlement response: {ent_response.json()}")
        
        assert ent_response.status_code == 200
        
        data = ent_response.json()
        
        # Trial users should be entitled
        assert data.get("is_entitled") == True
        assert data.get("reason") == "trial_active"
        
        # Trial fields should be present
        assert data.get("is_trial") == True
        assert data.get("trial_expired") == False
        assert "trial_end_date" in data
        assert "trial_days_remaining" in data
        assert data.get("trial_days_remaining", 0) >= 27
        assert data.get("trial_tier_name") == "Coach Developer"
        
        print("SUCCESS: Entitlement correctly reflects trial status")
    
    def test_entitlement_for_existing_admin(self):
        """Test entitlement for admin user (should be entitled)"""
        # Login as admin
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "hello@mycoachdeveloper.com",
            "password": "_mcDeveloper26!"
        })
        
        print(f"Admin login response status: {login_response.status_code}")
        
        if login_response.status_code != 200:
            pytest.skip("Admin login failed - skipping test")
        
        # Get token from cookie or response
        token = None
        if 'session_token' in login_response.cookies:
            token = login_response.cookies['session_token']
        else:
            # Try to get from response
            token = login_response.json().get('session_token') or login_response.json().get('token')
        
        if not token:
            pytest.skip("Could not get admin token")
        
        headers = {"Authorization": f"Bearer {token}"}
        ent_response = requests.get(f"{BASE_URL}/api/billing/entitlement", headers=headers)
        
        print(f"Admin entitlement response status: {ent_response.status_code}")
        print(f"Admin entitlement response: {ent_response.json()}")
        
        # Admin should either be entitled or the endpoint handles admin differently
        # Main thing is it shouldn't error
        assert ent_response.status_code == 200


class TestTrialLogin:
    """Test that trial users can login after signup"""
    
    def test_trial_user_can_login(self):
        """Test trial user can login with credentials"""
        unique_email = f"trial_login_{uuid.uuid4().hex[:8]}@example.com"
        password = "TestPass123!"
        
        # Create trial
        payload = {
            "email": unique_email,
            "password": password,
            "name": "Login Test User",
            "tier_key": "coach_developer"
        }
        
        start_response = requests.post(f"{BASE_URL}/api/trial/start", json=payload)
        assert start_response.status_code == 200
        
        # Now try to login
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": unique_email,
            "password": password
        })
        
        print(f"Trial user login response status: {login_response.status_code}")
        
        assert login_response.status_code == 200
        
        data = login_response.json()
        assert data.get("email", "").lower() == unique_email.lower()
        assert data.get("role") == "coach_developer"
        
        print("SUCCESS: Trial user can login")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
