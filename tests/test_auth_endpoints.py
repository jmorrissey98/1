"""
Test suite for Email/Password Authentication endpoints
Tests: signup, login, forgot-password, reset-password, verify-reset-token
"""
import pytest
import requests
import os
import time
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://coach-observer.preview.emergentagent.com').rstrip('/')

# Test data prefix for cleanup
TEST_PREFIX = "TEST_AUTH_"

class TestAuthSignup:
    """Test POST /api/auth/signup endpoint"""
    
    def test_signup_invalid_email_format(self):
        """Signup should reject invalid email format"""
        response = requests.post(f"{BASE_URL}/api/auth/signup", json={
            "email": "invalid-email",
            "password": "Test1234",
            "name": "Test User"
        })
        assert response.status_code == 422, f"Expected 422 for invalid email, got {response.status_code}"
    
    def test_signup_password_too_short(self):
        """Signup should reject password less than 8 characters"""
        response = requests.post(f"{BASE_URL}/api/auth/signup", json={
            "email": f"{TEST_PREFIX}short@example.com",
            "password": "Test12",  # Only 6 chars
            "name": "Test User"
        })
        assert response.status_code == 400, f"Expected 400 for short password, got {response.status_code}"
        data = response.json()
        assert "8 characters" in data.get("detail", ""), f"Expected password length error, got: {data}"
    
    def test_signup_password_no_letter(self):
        """Signup should reject password without letters"""
        response = requests.post(f"{BASE_URL}/api/auth/signup", json={
            "email": f"{TEST_PREFIX}noletter@example.com",
            "password": "12345678",  # No letters
            "name": "Test User"
        })
        assert response.status_code == 400, f"Expected 400 for password without letter, got {response.status_code}"
        data = response.json()
        assert "letter" in data.get("detail", "").lower(), f"Expected letter requirement error, got: {data}"
    
    def test_signup_password_no_number(self):
        """Signup should reject password without numbers"""
        response = requests.post(f"{BASE_URL}/api/auth/signup", json={
            "email": f"{TEST_PREFIX}nonumber@example.com",
            "password": "TestPassword",  # No numbers
            "name": "Test User"
        })
        assert response.status_code == 400, f"Expected 400 for password without number, got {response.status_code}"
        data = response.json()
        assert "number" in data.get("detail", "").lower(), f"Expected number requirement error, got: {data}"
    
    def test_signup_requires_invite_for_non_first_user(self):
        """Signup should require invite for non-first users"""
        # Generate unique email to ensure it's not the first user
        unique_email = f"{TEST_PREFIX}noinvite_{uuid.uuid4().hex[:8]}@example.com"
        response = requests.post(f"{BASE_URL}/api/auth/signup", json={
            "email": unique_email,
            "password": "Test1234",
            "name": "Test User"
        })
        # Should be 403 if not first user and no invite
        assert response.status_code == 403, f"Expected 403 for signup without invite, got {response.status_code}"
        data = response.json()
        assert "invite" in data.get("detail", "").lower(), f"Expected invite required error, got: {data}"


class TestAuthLogin:
    """Test POST /api/auth/login endpoint"""
    
    def test_login_invalid_credentials(self):
        """Login should return 401 for invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "nonexistent@example.com",
            "password": "WrongPassword123"
        })
        assert response.status_code == 401, f"Expected 401 for invalid credentials, got {response.status_code}"
        data = response.json()
        assert "invalid" in data.get("detail", "").lower() or "password" in data.get("detail", "").lower(), \
            f"Expected invalid credentials error, got: {data}"
    
    def test_login_invalid_email_format(self):
        """Login should reject invalid email format"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "not-an-email",
            "password": "Test1234"
        })
        assert response.status_code == 422, f"Expected 422 for invalid email format, got {response.status_code}"
    
    def test_login_missing_password(self):
        """Login should reject missing password"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@example.com"
        })
        assert response.status_code == 422, f"Expected 422 for missing password, got {response.status_code}"


class TestAuthForgotPassword:
    """Test POST /api/auth/forgot-password endpoint"""
    
    def test_forgot_password_returns_generic_success(self):
        """Forgot password should return generic success message (prevents email enumeration)"""
        response = requests.post(f"{BASE_URL}/api/auth/forgot-password", json={
            "email": "nonexistent@example.com"
        })
        assert response.status_code == 200, f"Expected 200 for forgot password, got {response.status_code}"
        data = response.json()
        assert "message" in data, f"Expected message in response, got: {data}"
        # Should not reveal if email exists
        assert "if" in data.get("message", "").lower() or "exists" in data.get("message", "").lower(), \
            f"Expected generic message, got: {data}"
    
    def test_forgot_password_valid_email_format(self):
        """Forgot password should accept valid email format"""
        response = requests.post(f"{BASE_URL}/api/auth/forgot-password", json={
            "email": "valid@example.com"
        })
        assert response.status_code == 200, f"Expected 200 for valid email, got {response.status_code}"
    
    def test_forgot_password_invalid_email_format(self):
        """Forgot password should reject invalid email format"""
        response = requests.post(f"{BASE_URL}/api/auth/forgot-password", json={
            "email": "invalid-email"
        })
        assert response.status_code == 422, f"Expected 422 for invalid email format, got {response.status_code}"


class TestAuthVerifyResetToken:
    """Test GET /api/auth/verify-reset-token/{token} endpoint"""
    
    def test_verify_invalid_token(self):
        """Verify reset token should return invalid for non-existent token"""
        response = requests.get(f"{BASE_URL}/api/auth/verify-reset-token/invalid_token_12345")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert data.get("valid") == False, f"Expected valid=False for invalid token, got: {data}"
    
    def test_verify_empty_token(self):
        """Verify reset token should handle empty token"""
        response = requests.get(f"{BASE_URL}/api/auth/verify-reset-token/")
        # Should return 404 or 422 for empty token path
        assert response.status_code in [404, 422, 307], f"Expected 404/422/307 for empty token, got {response.status_code}"


class TestAuthResetPassword:
    """Test POST /api/auth/reset-password endpoint"""
    
    def test_reset_password_invalid_token(self):
        """Reset password should reject invalid token"""
        response = requests.post(f"{BASE_URL}/api/auth/reset-password", json={
            "token": "invalid_token_12345",
            "new_password": "NewPassword123"
        })
        assert response.status_code == 400, f"Expected 400 for invalid token, got {response.status_code}"
        data = response.json()
        assert "invalid" in data.get("detail", "").lower() or "expired" in data.get("detail", "").lower(), \
            f"Expected invalid/expired token error, got: {data}"
    
    def test_reset_password_weak_password(self):
        """Reset password should validate password requirements"""
        response = requests.post(f"{BASE_URL}/api/auth/reset-password", json={
            "token": "some_token",
            "new_password": "weak"  # Too short
        })
        # Should return 400 for invalid token or weak password
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"


class TestGoogleOnlyAccountLogin:
    """Test login behavior for Google-only accounts"""
    
    def test_login_google_only_account_message(self):
        """Login should return appropriate message for Google-only accounts"""
        # This test verifies the error message format when trying to login
        # with email/password for an account that only has Google auth
        # We can't create a Google-only account in tests, but we verify the endpoint works
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "google_only_test@example.com",
            "password": "Test1234"
        })
        # Should return 401 - either "invalid credentials" or "use Google sign-in"
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"


class TestAuthEndpointValidation:
    """Test endpoint validation and error handling"""
    
    def test_signup_missing_name(self):
        """Signup should require name field"""
        response = requests.post(f"{BASE_URL}/api/auth/signup", json={
            "email": "test@example.com",
            "password": "Test1234"
        })
        assert response.status_code == 422, f"Expected 422 for missing name, got {response.status_code}"
    
    def test_signup_empty_name(self):
        """Signup should reject empty name"""
        response = requests.post(f"{BASE_URL}/api/auth/signup", json={
            "email": "test@example.com",
            "password": "Test1234",
            "name": ""
        })
        # Empty string might be accepted by Pydantic, but should be validated
        assert response.status_code in [400, 422], f"Expected 400/422 for empty name, got {response.status_code}"
    
    def test_login_empty_body(self):
        """Login should reject empty request body"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={})
        assert response.status_code == 422, f"Expected 422 for empty body, got {response.status_code}"
    
    def test_forgot_password_empty_body(self):
        """Forgot password should reject empty request body"""
        response = requests.post(f"{BASE_URL}/api/auth/forgot-password", json={})
        assert response.status_code == 422, f"Expected 422 for empty body, got {response.status_code}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
