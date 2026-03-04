"""
Test Demo Account Subscriptions
================================
Tests that demo accounts have active subscriptions and 
entitlement API returns is_entitled=true for all demo accounts.

Demo accounts:
1. demo.coachdeveloper@mycoachdeveloper.com / DemoCD2024! (Coach Developer tier)
2. demo.individualcoach@mycoachdeveloper.com / DemoIC2024! (Individual Coach tier)
3. sarah.mitchell@demo.mycoachdeveloper.com / Demo123! (Riverside - Club tier)
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestDemoSubscriptions:
    """Test demo account subscriptions and entitlement"""
    
    def _login(self, email, password):
        """Helper to login and get auth token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": email, "password": password}
        )
        return response
    
    def _get_entitlement(self, token):
        """Helper to get entitlement status"""
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(
            f"{BASE_URL}/api/billing/entitlement",
            headers=headers
        )
        return response
    
    # --- Coach Developer Demo Account Tests ---
    def test_coach_developer_login(self):
        """Test Coach Developer demo account can login"""
        response = self._login(
            "demo.coachdeveloper@mycoachdeveloper.com",
            "DemoCD2024!"
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "token" in data or "access_token" in data
        print(f"Coach Developer login successful")
    
    def test_coach_developer_entitlement(self):
        """Test Coach Developer demo account is entitled"""
        login_response = self._login(
            "demo.coachdeveloper@mycoachdeveloper.com",
            "DemoCD2024!"
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        
        data = login_response.json()
        token = data.get("token") or data.get("access_token")
        
        entitlement_response = self._get_entitlement(token)
        assert entitlement_response.status_code == 200
        
        entitlement = entitlement_response.json()
        print(f"Coach Developer entitlement: {entitlement}")
        
        assert entitlement.get("is_entitled") == True, \
            f"Coach Developer should be entitled but got: {entitlement}"
        print(f"Coach Developer is entitled (reason: {entitlement.get('reason')})")
    
    # --- Individual Coach Demo Account Tests ---
    def test_individual_coach_login(self):
        """Test Individual Coach demo account can login"""
        response = self._login(
            "demo.individualcoach@mycoachdeveloper.com",
            "DemoIC2024!"
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "token" in data or "access_token" in data
        print(f"Individual Coach login successful")
    
    def test_individual_coach_entitlement(self):
        """Test Individual Coach demo account is entitled"""
        login_response = self._login(
            "demo.individualcoach@mycoachdeveloper.com",
            "DemoIC2024!"
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        
        data = login_response.json()
        token = data.get("token") or data.get("access_token")
        
        entitlement_response = self._get_entitlement(token)
        assert entitlement_response.status_code == 200
        
        entitlement = entitlement_response.json()
        print(f"Individual Coach entitlement: {entitlement}")
        
        assert entitlement.get("is_entitled") == True, \
            f"Individual Coach should be entitled but got: {entitlement}"
        print(f"Individual Coach is entitled (reason: {entitlement.get('reason')})")
    
    # --- Riverside Football Academy (Sarah Mitchell) Tests ---
    def test_riverside_sarah_mitchell_login(self):
        """Test Sarah Mitchell (Riverside) demo account can login"""
        response = self._login(
            "sarah.mitchell@demo.mycoachdeveloper.com",
            "Demo123!"
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "token" in data or "access_token" in data
        print(f"Sarah Mitchell (Riverside) login successful")
    
    def test_riverside_sarah_mitchell_entitlement(self):
        """Test Sarah Mitchell (Riverside) demo account is entitled"""
        login_response = self._login(
            "sarah.mitchell@demo.mycoachdeveloper.com",
            "Demo123!"
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        
        data = login_response.json()
        token = data.get("token") or data.get("access_token")
        
        entitlement_response = self._get_entitlement(token)
        assert entitlement_response.status_code == 200
        
        entitlement = entitlement_response.json()
        print(f"Sarah Mitchell (Riverside) entitlement: {entitlement}")
        
        assert entitlement.get("is_entitled") == True, \
            f"Sarah Mitchell should be entitled but got: {entitlement}"
        print(f"Sarah Mitchell is entitled (reason: {entitlement.get('reason')})")
    
    # --- Verify tier information ---
    def test_coach_developer_tier(self):
        """Verify Coach Developer demo has coach_developer tier"""
        login_response = self._login(
            "demo.coachdeveloper@mycoachdeveloper.com",
            "DemoCD2024!"
        )
        data = login_response.json()
        token = data.get("token") or data.get("access_token")
        
        entitlement = self._get_entitlement(token).json()
        active_tier = entitlement.get("active_tier")
        print(f"Coach Developer tier: {active_tier}")
        
        assert active_tier == "coach_developer", \
            f"Expected coach_developer tier but got: {active_tier}"
    
    def test_individual_coach_tier(self):
        """Verify Individual Coach demo has individual_coach tier"""
        login_response = self._login(
            "demo.individualcoach@mycoachdeveloper.com",
            "DemoIC2024!"
        )
        data = login_response.json()
        token = data.get("token") or data.get("access_token")
        
        entitlement = self._get_entitlement(token).json()
        active_tier = entitlement.get("active_tier")
        print(f"Individual Coach tier: {active_tier}")
        
        assert active_tier == "individual_coach", \
            f"Expected individual_coach tier but got: {active_tier}"
    
    def test_riverside_club_tier(self):
        """Verify Riverside demo has club tier"""
        login_response = self._login(
            "sarah.mitchell@demo.mycoachdeveloper.com",
            "Demo123!"
        )
        data = login_response.json()
        token = data.get("token") or data.get("access_token")
        
        entitlement = self._get_entitlement(token).json()
        active_tier = entitlement.get("active_tier")
        print(f"Riverside tier: {active_tier}")
        
        assert active_tier == "club", \
            f"Expected club tier but got: {active_tier}"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
